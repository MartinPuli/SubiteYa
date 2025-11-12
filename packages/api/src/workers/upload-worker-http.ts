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

// Body parser for JSON
app.use(express.json());

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

    const body = await qstashReceiver.verify({
      signature,
      body: JSON.stringify(req.body),
    });

    return { valid: true, body };
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

  try {
    // Verify Qstash signature
    const { valid, body } = await verifyQstashSignature(req);
    if (!valid) {
      console.error('[Upload Worker] Invalid Qstash signature');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { videoId } = body as { videoId: string };
    console.log(`[Upload Worker] 📥 Received job for video ${videoId}`);

    // Get video with account
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        account: true,
        user: true,
      },
    });

    if (!video) {
      console.error(`[Upload Worker] Video ${videoId} not found`);
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    if (!video.editedUrl) {
      throw new Error('Video has no edited URL');
    }

    if (!video.accountId) {
      throw new Error('Video has no associated TikTok account');
    }

    // Update video status to UPLOADING
    await prisma.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.UPLOADING, progress: 10 },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'UPLOADING',
    });

    // Get TikTok access token
    const accessToken = await getTikTokAccessToken(video.accountId);

    await prisma.video.update({
      where: { id: videoId },
      data: { progress: 20 },
    });

    // Get creator info (required by TikTok API)
    console.log('[Upload Worker] Fetching TikTok creator info...');
    await getTikTokCreatorInfo(accessToken);

    await prisma.video.update({
      where: { id: videoId },
      data: { progress: 30 },
    });

    // Download video from S3 to temp file
    const s3Key = extractS3Key(video.editedUrl);
    const tempFilePath = path.join(
      os.tmpdir(),
      `upload-${videoId}-${Date.now()}.mp4`
    );

    console.log(`[Upload Worker] Downloading ${s3Key} to ${tempFilePath}...`);

    const videoStream = await downloadStreamFromS3(s3Key);
    const writeStream = fs.createWriteStream(tempFilePath);

    await new Promise<void>((resolve, reject) => {
      videoStream.pipe(writeStream);
      videoStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { progress: 50 },
    });

    // Get video file size
    const stats = await fs.promises.stat(tempFilePath);
    const videoSize = stats.size;

    console.log(
      `[Upload Worker] Video size: ${(videoSize / 1024 / 1024).toFixed(2)} MB`
    );

    // Initialize TikTok upload
    console.log('[Upload Worker] Initializing TikTok upload...');

    const { publishId, uploadUrl } = await initTikTokUpload(
      accessToken,
      videoSize,
      video.title || 'SubiteYa Video',
      'PUBLIC_TO_EVERYONE', // Default privacy
      false, // disableComment
      false, // disableDuet
      false // disableStitch
    );

    await prisma.video.update({
      where: { id: videoId },
      data: {
        progress: 70,
      },
    });

    // Upload video to TikTok
    console.log('[Upload Worker] Uploading video to TikTok...');

    await uploadVideoToTikTok(uploadUrl, tempFilePath);

    // Clean up temp file
    await fs.promises.unlink(tempFilePath).catch(() => {});

    // Update video status to POSTED
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.POSTED,
        progress: 100,
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'POSTED',
    });

    const duration = Date.now() - startTime;
    console.log(
      `[Upload Worker] ✅ Completed video ${videoId} in ${duration}ms`
    );

    res.status(200).json({ success: true, videoId, publishId, duration });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Upload Worker] ❌ Error:', errorMessage);

    // Try to update video status
    const { videoId } = req.body as { videoId?: string };
    if (videoId) {
      await prisma.video
        .update({
          where: { id: videoId },
          data: {
            status: VideoStatus.FAILED_UPLOAD,
            error: errorMessage,
          },
        })
        .catch(() => {});
    }

    res.status(500).json({ error: errorMessage });
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
