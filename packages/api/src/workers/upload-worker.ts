/**
 * @fileoverview Upload Worker - Processes video upload jobs to TikTok
 * Purpose: Poll for UPLOAD_QUEUED videos, upload to TikTok with rate limiting
 */

import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import fs from 'node:fs';
import crypto from 'node:crypto';

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_CONCURRENT_UPLOADS = 1; // Process 1 video at a time
const RATE_LIMIT_PER_ACCOUNT = 5 * 60 * 1000; // 5 minutes between uploads per account
let activeUploads = 0;
let isRunning = false;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

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

// Track last upload time per account for rate limiting
const lastUploadTime = new Map<string, number>();

export function startUploadWorker() {
  if (isRunning) {
    console.log('[Upload Worker] Already running');
    return;
  }

  isRunning = true;
  console.log('[Upload Worker] Started - polling every 5s');
  pollForUploadJobs();
}

export function stopUploadWorker() {
  isRunning = false;
  console.log('[Upload Worker] Stopped');
}

async function pollForUploadJobs() {
  while (isRunning) {
    try {
      // Only process if we have capacity
      if (activeUploads < MAX_CONCURRENT_UPLOADS) {
        await processNextUploadJob();
      }

      await sleep(POLL_INTERVAL);
    } catch (error) {
      console.error('[Upload Worker] Poll error:', error);
      await sleep(POLL_INTERVAL);
    }
  }
}

async function processNextUploadJob() {
  // Find oldest UPLOAD_QUEUED video with a pending upload job
  const video = await prisma.video.findFirst({
    where: { status: VideoStatus.UPLOAD_QUEUED },
    include: {
      account: true,
      jobs: {
        where: { type: 'upload', status: 'queued' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!video || video.jobs.length === 0 || !video.account) {
    return; // No work to do
  }

  const job = video.jobs[0];
  const account = video.account;

  // Check rate limit for this account
  const lastUpload = lastUploadTime.get(account.id) || 0;
  const timeSinceLastUpload = Date.now() - lastUpload;

  if (timeSinceLastUpload < RATE_LIMIT_PER_ACCOUNT) {
    const waitTime = RATE_LIMIT_PER_ACCOUNT - timeSinceLastUpload;
    console.log(
      `[Upload Worker] Rate limited for account ${account.displayName}, waiting ${Math.round(waitTime / 1000)}s`
    );
    return;
  }

  activeUploads++;
  console.log(
    `[Upload Worker] Starting job ${job.id} for video ${video.id} → ${account.displayName}`
  );

  try {
    // Update job status to running
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    // Update video status to UPLOADING
    await prisma.video.update({
      where: { id: video.id },
      data: { status: VideoStatus.UPLOADING },
    });

    // Verify edited video exists
    const videoPath = video.editedUrl || video.srcUrl;
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    // Read video file
    const videoBuffer = await fs.promises.readFile(videoPath);
    const videoSize = videoBuffer.length;

    console.log(
      `[Upload Worker] Uploading ${videoPath} (${videoSize} bytes) to TikTok`
    );

    // Decrypt access token
    const accessToken = decryptToken(account.accessTokenEnc);

    // Step 1: Query Creator Info (required before posting)
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
      throw new Error(
        `Creator info query failed: ${JSON.stringify(errorData)}`
      );
    }

    await creatorInfoResponse.json(); // Consume response

    // Step 2: Initialize video upload
    console.log(`[Upload Worker] Step 2: Initializing video upload...`);

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
            video_size: videoSize,
            chunk_size: videoSize,
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

    console.log(
      `[Upload Worker] Step 3: Uploading video file... (publish_id: ${initData.data.publish_id})`
    );

    // Step 3: Upload video file
    const uploadResponse = await fetch(initData.data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(
        `Video upload failed with status ${uploadResponse.status}`
      );
    }

    console.log(`[Upload Worker] Video uploaded successfully!`);

    // Update last upload time for rate limiting
    lastUploadTime.set(account.id, Date.now());

    // Update video with TikTok URL
    const tiktokUrl = `https://www.tiktok.com/@${account.displayName}/video/${initData.data.publish_id}`;

    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: VideoStatus.POSTED,
        postUrl: tiktokUrl,
        progress: 100,
      },
    });

    // Mark job as succeeded
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        log: `Video uploaded successfully to TikTok. Publish ID: ${initData.data.publish_id}`,
      },
    });

    console.log(`[Upload Worker] Job ${job.id} completed successfully`);
  } catch (error: unknown) {
    console.error(`[Upload Worker] Job ${job.id} failed:`, error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during upload';

    // Check if error is due to token expiration
    const isTokenError =
      errorMessage.includes('token') || errorMessage.includes('auth');

    // Update video status to FAILED_UPLOAD
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: VideoStatus.FAILED_UPLOAD,
        error: errorMessage,
      },
    });

    // Mark job as failed
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        error: errorMessage,
      },
    });

    // If token error and attempts < 3, could retry later
    if (isTokenError && job.attempts < 2) {
      console.log(`[Upload Worker] Token error detected, will retry later`);
      // Reset job to queued for retry
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'queued',
          finishedAt: null,
        },
      });
      await prisma.video.update({
        where: { id: video.id },
        data: { status: VideoStatus.UPLOAD_QUEUED },
      });
    }
  } finally {
    activeUploads--;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
