#!/usr/bin/env node
/**
 * @fileoverview Upload Worker HTTP Server
 * Purpose: Standalone HTTP service that receives Qstash webhooks for TikTok uploads
 * This runs as a separate Render service (type: web) to avoid saturating the main API
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import { Receiver } from '@upstash/qstash';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { downloadStreamFromS3, extractS3Key } from '../lib/storage';
import { notifyUser } from '../routes/events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import axios from 'axios';
import crypto from 'node:crypto';

type RequestWithRawBody = Request & { rawBody?: string };

const app = express();
const PORT = process.env.PORT || 3002;

// Encryption key for TikTok tokens
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
if (!ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY is required');
  process.exit(1);
}

/**
 * Decrypt token helper (compatible with tiktok.ts encryption using AES-256-GCM)
 */
function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Initialize Qstash receiver for signature verification
const QSTASH_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY || '';
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY || '';

let qstashReceiver: Receiver | null = null;

if (QSTASH_SIGNING_KEY) {
  qstashReceiver = new Receiver({
    currentSigningKey: QSTASH_SIGNING_KEY,
    nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
  });
  console.log('✅ Qstash receiver initialized with signature verification');
} else {
  console.warn(
    '⚠️  QSTASH_CURRENT_SIGNING_KEY not set - webhook signature verification disabled'
  );
}

// Idempotency tracking: videoId → execution state
const activeExecutions = new Map<
  string,
  { startTime: number; status: 'running' | 'completed' | 'failed' }
>();

// Backoff tracking per account: accountId → { consecutiveFailures, lastFailureTime }
const accountBackoff = new Map<
  string,
  { consecutiveFailures: number; lastFailureTime: number }
>();

const MAX_CONCURRENT_PER_ACCOUNT = 3;
const MAX_RETRIES = 3;

function isExecutionInProgress(videoId: string): boolean {
  const execution = activeExecutions.get(videoId);
  if (!execution) return false;

  // If completed/failed more than 5 minutes ago, allow re-execution
  if (execution.status !== 'running') {
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - execution.startTime > fiveMinutes) {
      activeExecutions.delete(videoId);
      return false;
    }
  }

  return execution.status === 'running';
}

function markExecutionStart(videoId: string): void {
  activeExecutions.set(videoId, { startTime: Date.now(), status: 'running' });
}

function markExecutionEnd(
  videoId: string,
  status: 'completed' | 'failed'
): void {
  const execution = activeExecutions.get(videoId);
  if (execution) {
    execution.status = status;
  }
}

function getAccountConcurrentJobs(accountId: string): number {
  let count = 0;
  for (const [, execution] of activeExecutions) {
    if (execution.status === 'running') count++;
  }
  return count;
}

function shouldBackoff(accountId: string): {
  backoff: boolean;
  delayMs?: number;
} {
  const info = accountBackoff.get(accountId);
  if (!info || info.consecutiveFailures === 0) return { backoff: false };

  // Exponential backoff: 2^failures seconds (max 5 minutes)
  const delayMs = Math.min(
    Math.pow(2, info.consecutiveFailures) * 1000,
    5 * 60 * 1000
  );
  const timeSinceLastFailure = Date.now() - info.lastFailureTime;

  if (timeSinceLastFailure < delayMs) {
    return { backoff: true, delayMs: delayMs - timeSinceLastFailure };
  }

  return { backoff: false };
}

function recordAccountFailure(accountId: string): void {
  const info = accountBackoff.get(accountId) || {
    consecutiveFailures: 0,
    lastFailureTime: 0,
  };
  info.consecutiveFailures++;
  info.lastFailureTime = Date.now();
  accountBackoff.set(accountId, info);
}

function recordAccountSuccess(accountId: string): void {
  accountBackoff.delete(accountId);
}

// Body parser for JSON (store raw body for QStash signature verification)
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as RequestWithRawBody).rawBody = buf.toString();
    },
  })
);

/**
 * Verify Qstash signature
 */
async function verifyQstashSignature(
  req: Request
): Promise<{ valid: boolean; body?: unknown }> {
  if (!qstashReceiver) {
    console.warn('[Upload Worker] Signature verification disabled');
    return { valid: true, body: req.body };
  }

  try {
    const signature = req.headers['upstash-signature'] as string;
    if (!signature) {
      return { valid: false };
    }

    const rawBody = (req as RequestWithRawBody).rawBody;
    const verifiedBody = await qstashReceiver.verify({
      signature,
      body: rawBody ?? JSON.stringify(req.body),
    });

    let parsedBody: unknown = verifiedBody;
    if (typeof verifiedBody === 'string') {
      try {
        parsedBody = JSON.parse(verifiedBody);
      } catch (error) {
        console.warn(
          '[Upload Worker] Unable to parse verified body as JSON, returning raw string'
        );
      }
    }

    return { valid: true, body: parsedBody };
  } catch (error) {
    console.error('[Upload Worker] Signature verification failed:', error);
    return { valid: false };
  }
}

/**
 * Get TikTok access token
 */
async function getTikTokAccessToken(accountId: string): Promise<string> {
  const connection = await prisma.tikTokConnection.findUnique({
    where: {
      id: accountId,
    },
  });

  if (!connection) {
    throw new Error('TikTok connection not found');
  }

  // Decrypt access token
  const accessToken = decryptToken(connection.accessTokenEnc);
  return accessToken;
}

/**
 * Get TikTok creator info
 */
async function getTikTokCreatorInfo(accessToken: string): Promise<string> {
  const response = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data?.error?.code !== 'ok') {
    throw new Error(
      `TikTok API error: ${response.data?.error?.message || 'Unknown error'}`
    );
  }

  return response.data.data?.creator_avatar_url || '';
}

/**
 * Initialize TikTok upload
 */
async function initTikTokUpload(
  accessToken: string,
  videoSize: number,
  title: string,
  privacyLevel: string,
  disableComment: boolean,
  disableDuet: boolean,
  disableStitch: boolean
): Promise<{ publishId: string; uploadUrl: string }> {
  const response = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      post_info: {
        title,
        privacy_level: privacyLevel,
        disable_comment: disableComment,
        disable_duet: disableDuet,
        disable_stitch: disableStitch,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data?.error?.code !== 'ok') {
    throw new Error(
      `TikTok init error: ${response.data?.error?.message || 'Unknown error'}`
    );
  }

  return {
    publishId: response.data.data?.publish_id,
    uploadUrl: response.data.data?.upload_url,
  };
}

/**
 * Upload video to TikTok
 */
async function uploadVideoToTikTok(
  uploadUrl: string,
  videoPath: string
): Promise<void> {
  const videoBuffer = await fs.promises.readFile(videoPath);

  await axios.put(uploadUrl, videoBuffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.length.toString(),
    },
  });
}

/**
 * POST /process - Process TikTok upload job (called by Qstash)
 */
app.post('/process', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let tempFilePath: string | null = null;
  let videoId: string | undefined;
  let accountId: string | null = null;

  try {
    // Verify Qstash signature
    const { valid, body } = await verifyQstashSignature(req);
    if (!valid) {
      console.error('[Upload Worker] Invalid Qstash signature');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsedBody = body as { videoId?: string };
    if (!parsedBody?.videoId) {
      console.error('[Upload Worker] Missing videoId in request body');
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    videoId = parsedBody.videoId;
    console.log(
      `[Upload Worker] 📥 Received job for video ${parsedBody.videoId}`
    );

    // IDEMPOTENCY CHECK: Skip if already processing or completed
    if (isExecutionInProgress(parsedBody.videoId)) {
      console.log(
        `[Upload Worker] ⏭️  Skipping ${parsedBody.videoId} - already in progress or recently completed`
      );
      res
        .status(200)
        .json({ success: true, skipped: true, reason: 'idempotent' });
      return;
    }

    markExecutionStart(parsedBody.videoId);

    // Get video with account (check terminal states first)
    const video = await prisma.video.findUnique({
      where: { id: parsedBody.videoId },
      include: {
        account: true,
        user: true,
      },
    });

    if (!video) {
      console.error(`[Upload Worker] Video ${parsedBody.videoId} not found`);
      markExecutionEnd(parsedBody.videoId, 'failed');
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    accountId = video.accountId;

    // Skip if already in terminal state
    const terminalStates: VideoStatus[] = [
      VideoStatus.POSTED,
      VideoStatus.FAILED_UPLOAD,
    ];
    if (terminalStates.includes(video.status)) {
      console.log(
        `[Upload Worker] ⏭️  Video ${parsedBody.videoId} already in terminal state: ${video.status}`
      );
      markExecutionEnd(parsedBody.videoId, 'completed');
      res.status(200).json({
        success: true,
        skipped: true,
        reason: 'already_processed',
        status: video.status,
      });
      return;
    }

    if (!video.editedUrl) {
      throw new Error('Video has no edited URL');
    }

    if (!accountId) {
      throw new Error('Video has no associated TikTok account');
    }

    // CONCURRENCY CHECK: Limit concurrent uploads per account
    const concurrentJobs = getAccountConcurrentJobs(accountId);
    if (concurrentJobs >= MAX_CONCURRENT_PER_ACCOUNT) {
      console.log(
        `[Upload Worker] ⏸️  Account ${accountId} has ${concurrentJobs} concurrent jobs (max: ${MAX_CONCURRENT_PER_ACCOUNT})`
      );
      markExecutionEnd(parsedBody.videoId, 'failed');
      res.status(429).json({
        error: 'Too many concurrent uploads for this account',
        retryAfter: 30,
      });
      return;
    }

    // BACKOFF CHECK: Check if account needs backoff due to recent failures
    const backoffInfo = shouldBackoff(accountId);
    if (backoffInfo.backoff) {
      console.log(
        `[Upload Worker] ⏸️  Account ${accountId} in backoff period (${Math.ceil(backoffInfo.delayMs! / 1000)}s remaining)`
      );
      markExecutionEnd(parsedBody.videoId, 'failed');
      res.status(429).json({
        error: 'Account in backoff period',
        retryAfter: Math.ceil(backoffInfo.delayMs! / 1000),
      });
      return;
    }

    // ATOMIC TRANSITION: EDITED/UPLOADING → UPLOADING
    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: {
        status: VideoStatus.UPLOADING,
        progress: 10,
        error: null,
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId: parsedBody.videoId,
      status: 'UPLOADING',
    });

    // Get TikTok access token
    console.log('[Upload Worker] 🔑 Getting access token...');
    const accessToken = await getTikTokAccessToken(accountId);

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 20 },
    });

    // Get creator info (required by TikTok API)
    console.log('[Upload Worker] 👤 Fetching creator info...');
    await getTikTokCreatorInfo(accessToken);

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 30 },
    });

    // Download video from S3 to temp file
    const s3Key = extractS3Key(video.editedUrl);
    tempFilePath = path.join(
      os.tmpdir(),
      `upload-${parsedBody.videoId}-${Date.now()}.mp4`
    );

    console.log(`[Upload Worker] ⬇️  Downloading from S3...`);

    const videoStream = await downloadStreamFromS3(s3Key);
    const writeStream = fs.createWriteStream(tempFilePath);

    await new Promise<void>((resolve, reject) => {
      videoStream.pipe(writeStream);
      videoStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
    });

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 50 },
    });

    // Get video file size
    const stats = await fs.promises.stat(tempFilePath);
    const videoSize = stats.size;

    console.log(
      `[Upload Worker] 📊 Video size: ${(videoSize / 1024 / 1024).toFixed(2)} MB`
    );

    // Initialize TikTok upload
    console.log('[Upload Worker] 🚀 Initializing TikTok upload...');

    const { publishId, uploadUrl } = await initTikTokUpload(
      accessToken,
      videoSize,
      video.title || 'SubiteYa Video',
      'PUBLIC_TO_EVERYONE',
      false,
      false,
      false
    );

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 70 },
    });

    // Upload video to TikTok
    console.log('[Upload Worker] ⬆️  Uploading to TikTok...');

    await uploadVideoToTikTok(uploadUrl, tempFilePath);

    // ATOMIC TRANSITION: UPLOADING → POSTED
    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: {
        status: VideoStatus.POSTED,
        progress: 100,
        error: null,
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId: parsedBody.videoId,
      status: 'POSTED',
    });

    // Record success for backoff tracking
    recordAccountSuccess(accountId);
    markExecutionEnd(parsedBody.videoId, 'completed');

    const duration = Date.now() - startTime;
    console.log(
      `[Upload Worker] ✅ Completed video ${parsedBody.videoId} in ${duration}ms`
    );

    res.status(200).json({
      success: true,
      videoId: parsedBody.videoId,
      publishId,
      duration,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Upload Worker] ❌ Error:', errorMessage);

    if (videoId) {
      markExecutionEnd(videoId, 'failed');

      // Record failure for backoff
      if (accountId) {
        recordAccountFailure(accountId);
      }

      // ATOMIC TRANSITION: Only update to FAILED_UPLOAD if not already failed
      const failedStates: VideoStatus[] = [VideoStatus.FAILED_UPLOAD];
      await prisma.video
        .updateMany({
          where: {
            id: videoId,
            status: { notIn: failedStates },
          },
          data: {
            status: VideoStatus.FAILED_UPLOAD,
            error: errorMessage,
          },
        })
        .catch(() => {});
    }

    res.status(500).json({ error: errorMessage });
  } finally {
    // ROBUST CLEANUP: Always delete temp files
    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'upload-worker',
    qstash: {
      enabled: !!qstashReceiver,
      signatureVerification: !!QSTASH_SIGNING_KEY,
    },
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

/**
 * GET / - Root endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'SubiteYa Upload Worker',
    version: '1.0.0',
    endpoints: {
      process: 'POST /process',
      health: 'GET /health',
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Upload Worker HTTP Server listening on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Process endpoint: http://localhost:${PORT}/process`);
  console.log(`✅ Ready to receive Qstash webhooks`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
