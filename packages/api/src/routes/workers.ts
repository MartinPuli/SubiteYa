/**
 * @fileoverview Qstash Worker Endpoints
 * Purpose: HTTP endpoints that receive jobs from Qstash
 * These replace BullMQ workers - Qstash sends HTTP POST requests here
 */

import { Router, Request, Response } from 'express';
import { Receiver } from '@upstash/qstash';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { applyBrandPattern } from '../lib/video-processor';
import { DesignSpec } from '../lib/design-schema';
import { downloadStreamFromS3, uploadToS3, extractS3Key } from '../lib/storage';
import { queueUploadJob } from '../lib/qstash-client';
import { notifyUser } from './events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { z } from 'zod';
import crypto from 'crypto';

const router = Router();

type DesignSpecType = z.infer<typeof DesignSpec>;

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

/**
 * Verify Qstash signature
 */
async function verifyQstashSignature(
  req: Request
): Promise<{ valid: boolean; body?: any }> {
  if (!qstashReceiver) {
    console.warn('[Qstash] Signature verification disabled');
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
    console.error('[Qstash] Signature verification failed:', error);
    return { valid: false };
  }
}

/**
 * POST /api/workers/edit
 * Process video editing job (called by Qstash)
 */
router.post('/edit', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Verify Qstash signature
    const { valid, body } = await verifyQstashSignature(req);
    if (!valid) {
      console.error('[Edit Worker] Invalid Qstash signature');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { videoId } = body;
    console.log(`[Edit Worker] 📥 Received job for video ${videoId}`);

    // Get video with design
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        design: true,
        user: true,
      },
    });

    if (!video) {
      console.error(`[Edit Worker] Video ${videoId} not found`);
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    // Update video status to EDITING
    await prisma.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.EDITING, progress: 10 },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'EDITING',
    });

    // Get design spec
    let designSpec: DesignSpecType;
    if (video.editSpecJson) {
      designSpec = video.editSpecJson as DesignSpecType;
    } else if (video.design?.specJson) {
      designSpec = video.design.specJson as DesignSpecType;
    } else {
      throw new Error('No design spec available');
    }

    console.log(
      `[Edit Worker] Processing with design: ${video.design?.name || 'frozen spec'}`
    );

    // Download video from S3 to temp file (streaming)
    const s3Key = extractS3Key(video.srcUrl);
    const tempFilePath = path.join(
      os.tmpdir(),
      `video-${videoId}-${Date.now()}.mp4`
    );

    console.log(`[Edit Worker] Downloading ${s3Key} to ${tempFilePath}...`);

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
      data: { progress: 30 },
    });

    // Convert DesignSpec to pattern format
    const pattern = {
      logoUrl: designSpec.brand?.watermark?.url,
      logoPosition: designSpec.brand?.watermark?.position || 'bottom-right',
      logoSize: 15,
      logoOpacity: (designSpec.brand?.watermark?.opacity || 0.8) * 100,
      enableEffects: false,
      filterType: 'none',
      brightness: 100,
      contrast: 100,
      saturation: 100,
      enableSubtitles: designSpec.captions?.enabled || false,
      subtitleStyle: designSpec.captions?.style || 'classic',
      subtitlePosition: 'bottom',
      subtitleColor: designSpec.typography?.colorPrimary || '#FFFFFF',
      subtitleBgColor: 'rgba(0,0,0,0.7)',
      subtitleFontSize: 24,
    };

    console.log(`[Edit Worker] Applying branding to ${tempFilePath}...`);

    const result = await applyBrandPattern(tempFilePath, pattern);

    if (!result.success || !result.outputPath) {
      throw new Error(result.error || 'Video processing failed');
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { progress: 70 },
    });

    // Upload edited video to S3 (streaming)
    console.log(`[Edit Worker] Uploading ${result.outputPath} to S3...`);

    const editedStream = fs.createReadStream(result.outputPath);
    const editedKey = `videos/edited-${videoId}-${Date.now()}.mp4`;

    const uploadResult = await uploadToS3({
      file: editedStream,
      filename: path.basename(result.outputPath),
      contentType: 'video/mp4',
      folder: 'videos',
    });

    // Clean up temp files
    await fs.promises.unlink(tempFilePath).catch(() => {});
    await fs.promises.unlink(result.outputPath).catch(() => {});

    // Update video status to EDITED
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.EDITED,
        editedUrl: uploadResult.url,
        progress: 100,
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'EDITED',
    });

    // Queue for upload
    await queueUploadJob(videoId);

    const duration = Date.now() - startTime;
    console.log(`[Edit Worker] ✅ Completed video ${videoId} in ${duration}ms`);

    res.status(200).json({ success: true, videoId, duration });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Edit Worker] ❌ Error:', errorMessage);

    // Try to update video status
    const { videoId } = req.body;
    if (videoId) {
      await prisma.video
        .update({
          where: { id: videoId },
          data: {
            status: VideoStatus.FAILED_EDIT,
            error: errorMessage,
          },
        })
        .catch(() => {});
    }

    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/workers/upload
 * Process TikTok upload job (called by Qstash)
 */
router.post('/upload', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Verify Qstash signature
    const { valid, body } = await verifyQstashSignature(req);
    if (!valid) {
      console.error('[Upload Worker] Invalid Qstash signature');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { videoId } = body;
    console.log(`[Upload Worker] 📥 Received job for video ${videoId}`);

    // Get video with account
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        account: true,
        user: true,
      },
    });

    if (!video || !video.account) {
      console.error(`[Upload Worker] Video ${videoId} not found`);
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const account = video.account;

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

    // Download video from S3
    const videoUrl = video.editedUrl || video.srcUrl;
    const s3Key = extractS3Key(videoUrl);

    console.log(`[Upload Worker] Downloading ${s3Key}...`);

    const tempFilePath = path.join(
      os.tmpdir(),
      `upload-${videoId}-${Date.now()}.mp4`
    );

    const videoStream = await downloadStreamFromS3(s3Key);
    const writeStream = fs.createWriteStream(tempFilePath);

    await new Promise<void>((resolve, reject) => {
      videoStream.pipe(writeStream);
      videoStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
    });

    const videoBuffer = await fs.promises.readFile(tempFilePath);
    await fs.promises.unlink(tempFilePath).catch(() => {});

    await prisma.video.update({
      where: { id: videoId },
      data: { progress: 30 },
    });

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
      throw new Error(
        `Creator info query failed: ${creatorInfoResponse.status}`
      );
    }

    await creatorInfoResponse.json();

    await prisma.video.update({
      where: { id: videoId },
      data: { progress: 40 },
    });

    // Step 2: Initialize video upload
    console.log(`[Upload Worker] Step 2: Initializing upload...`);

    const title = video.title || 'Video subido desde SubiteYa';
    const privacyLevel = 'SELF_ONLY';

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
      throw new Error(`Init failed: ${initResponse.status}`);
    }

    const initData = (await initResponse.json()) as {
      data: {
        publish_id: string;
        upload_url: string;
      };
    };

    await prisma.video.update({
      where: { id: videoId },
      data: { progress: 60 },
    });

    // Step 3: Upload video file
    console.log(
      `[Upload Worker] Step 3: Uploading video (publish_id: ${initData.data.publish_id})...`
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

    // Update video status to POSTED
    const tiktokUrl = `https://www.tiktok.com/@${account.displayName}/video/${initData.data.publish_id}`;

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.POSTED,
        postUrl: tiktokUrl,
        progress: 100,
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'POSTED',
      postUrl: tiktokUrl,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[Upload Worker] ✅ Completed video ${videoId} in ${duration}ms`
    );

    res.status(200).json({
      success: true,
      videoId,
      postUrl: tiktokUrl,
      duration,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Upload Worker] ❌ Error:', errorMessage);

    // Try to update video status
    const { videoId } = req.body;
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
 * GET /api/workers/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    qstash: {
      enabled: !!qstashReceiver,
      signatureVerification: !!QSTASH_SIGNING_KEY,
    },
    timestamp: Date.now(),
  });
});

export default router;
