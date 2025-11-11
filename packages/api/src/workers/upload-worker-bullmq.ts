/**
 * @fileoverview BullMQ Upload Worker - Production Ready
 * Purpose: Process TikTok upload jobs from Redis queue with rate limiting
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { downloadFromS3, extractS3Key } from '../lib/storage';
import { notifyUser } from '../routes/events';
import crypto from 'node:crypto';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONCURRENCY = Number.parseInt(
  process.env.UPLOAD_WORKER_CONCURRENCY || '1',
  10
);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Track last upload time per account for rate limiting
const lastUploadTime = new Map<string, number>();
const RATE_LIMIT_PER_ACCOUNT = 5 * 60 * 1000; // 5 minutes

let worker: Worker | null = null;
let redisConnection: Redis | null = null;

// Decrypt token helper
function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function startUploadWorker() {
  if (worker) {
    console.log('[Upload Worker] Already running');
    return worker;
  }

  console.log('[Upload Worker] Initializing...');
  console.log('[Upload Worker] REDIS_URL:', REDIS_URL ? 'Set' : 'Not set');
  console.log(
    '[Upload Worker] ENCRYPTION_KEY:',
    ENCRYPTION_KEY ? 'Set' : 'Not set'
  );
  console.log('[Upload Worker] CONCURRENCY:', CONCURRENCY);

  // Create Redis connection for BullMQ Worker
  redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(
        `[Upload Worker] Redis retry attempt ${times}, waiting ${delay}ms`
      );
      return delay;
    },
    lazyConnect: true, // Don't connect immediately
  });

  redisConnection.on('connect', () => {
    console.log('[Upload Worker] ✅ Connected to Redis');
  });

  redisConnection.on('error', (err: Error) => {
    if (err.message.includes('ECONNRESET')) {
      console.warn('[Upload Worker] Redis connection reset, will reconnect...');
      return;
    }
    console.error('[Upload Worker] Redis error:', err.message);
  });

  redisConnection.on('close', () => {
    console.warn('[Upload Worker] Redis connection closed');
  });

  // Connect explicitly
  redisConnection.connect().catch(err => {
    console.error('[Upload Worker] Failed to connect to Redis:', err.message);
    process.exit(1);
  });

  worker = new Worker(
    'video-upload',
    async (job: Job) => {
      const { videoId } = job.data;
      await processUploadJob(videoId, job);
    },
    {
      connection: redisConnection,
      concurrency: CONCURRENCY,
      limiter: {
        max: 3, // Max 3 uploads
        duration: 60000, // per minute
      },
      lockDuration: 30000, // 30 seconds
      stalledInterval: 60000, // Check for stalled jobs every 60s (reduces Redis polling)
      maxStalledCount: 2,
    }
  );

  worker.on('completed', (job: Job) => {
    console.log(`[Upload Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[Upload Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err: Error) => {
    // Ignore ECONNRESET during shutdown/reconnection
    if (err.message.includes('ECONNRESET')) {
      console.warn('[Upload Worker] Redis connection reset, will reconnect...');
      return;
    }
    console.error('[Upload Worker] Worker error:', err);
  });

  console.log(`[Upload Worker] Started with concurrency ${CONCURRENCY}`);
  return worker;
}

export async function stopUploadWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[Upload Worker] Stopped');
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    console.log('[Upload Worker] Redis connection closed');
  }
}

async function processUploadJob(videoId: string, job: Job) {
  try {
    // Get video with account
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        account: true,
        user: true,
      },
    });

    if (!video || !video.account) {
      throw new Error(`Video ${videoId} or account not found`);
    }

    const account = video.account;

    // Check rate limit for this account
    const lastUpload = lastUploadTime.get(account.id) || 0;
    const timeSinceLastUpload = Date.now() - lastUpload;

    if (timeSinceLastUpload < RATE_LIMIT_PER_ACCOUNT) {
      const waitTime = RATE_LIMIT_PER_ACCOUNT - timeSinceLastUpload;
      throw new Error(
        `Rate limited: wait ${Math.round(waitTime / 1000)}s for account ${account.displayName}`
      );
    }

    // Update video status to UPLOADING
    await prisma.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.UPLOADING },
    });

    // Notify user
    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'UPLOADING',
    });

    await job.updateProgress(10);

    // Download video from S3
    const videoUrl = video.editedUrl || video.srcUrl;
    const s3Key = extractS3Key(videoUrl);
    const videoBuffer = await downloadFromS3(s3Key);

    console.log(
      `[Upload Worker] Downloaded video ${videoId} (${videoBuffer.length} bytes)`
    );

    await job.updateProgress(30);

    // Decrypt access token
    const accessToken = decryptToken(account.accessTokenEnc);

    // Step 1: Query Creator Info
    console.log(`[Upload Worker] Step 1: Querying creator info...`);
    const creatorInfoResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    );

    if (!creatorInfoResponse.ok) {
      const errorData = await creatorInfoResponse.json();
      throw new Error(`Creator info failed: ${JSON.stringify(errorData)}`);
    }

    await creatorInfoResponse.json(); // Consume response

    await job.updateProgress(40);

    // Step 2: Initialize video upload
    console.log(`[Upload Worker] Step 2: Initializing upload...`);

    const title = video.title || 'Video subido desde SubiteYa';
    const privacyLevel = 'SELF_ONLY'; // Private for unaudited apps

    const initResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title,
            privacy_level: privacyLevel,
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoBuffer.length,
            chunk_size: videoBuffer.length,
            total_chunk_count: 1,
          },
        }),
      }
    );

    if (!initResponse.ok) {
      const errorData = await initResponse.json();
      throw new Error(`Init failed: ${JSON.stringify(errorData)}`);
    }

    const initData = (await initResponse.json()) as {
      data: {
        publish_id: string;
        upload_url: string;
      };
    };

    await job.updateProgress(60);

    // Step 3: Upload video file
    console.log(
      `[Upload Worker] Step 3: Uploading video... (publish_id: ${initData.data.publish_id})`
    );

    const uploadResponse = await fetch(initData.data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Video upload failed: ${uploadResponse.status}`);
    }

    await job.updateProgress(90);

    // Update last upload time for rate limiting
    lastUploadTime.set(account.id, Date.now());

    // Update video with TikTok URL
    const tiktokUrl = `https://www.tiktok.com/@${account.displayName}/video/${initData.data.publish_id}`;

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.POSTED,
        postUrl: tiktokUrl,
        progress: 100,
      },
    });

    // Update job in database
    await prisma.job.updateMany({
      where: {
        videoId,
        type: 'upload',
        status: 'running',
      },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        log: `Uploaded to TikTok: ${tiktokUrl}`,
      },
    });

    // Notify user
    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'POSTED',
      postUrl: tiktokUrl,
    });

    console.log(`[Upload Worker] Video ${videoId} uploaded successfully`);

    await job.updateProgress(100);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Upload Worker] Error uploading video ${videoId}:`, error);

    // Update video status
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.FAILED_UPLOAD,
        error: errorMessage,
      },
    });

    // Update job
    await prisma.job.updateMany({
      where: {
        videoId,
        type: 'upload',
        status: 'running',
      },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        error: errorMessage,
      },
    });

    // Notify user
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (video) {
      notifyUser(video.userId, {
        type: 'video_status_changed',
        videoId,
        status: 'FAILED_UPLOAD',
        error: errorMessage,
      });
    }

    throw error; // Re-throw for BullMQ retry logic
  }
}
