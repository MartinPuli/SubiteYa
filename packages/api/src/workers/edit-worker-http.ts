#!/usr/bin/env node
/**
 * @fileoverview Edit Worker HTTP Server
 * Purpose: Standalone HTTP service that receives Qstash webhooks for video editing
 * This runs as a separate Render service (type: web) to avoid saturating the main API
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import { Receiver } from '@upstash/qstash';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { applyBrandPattern } from '../lib/video-processor';
import { DesignSpec } from '../lib/design-schema';
import { downloadStreamFromS3, uploadToS3, extractS3Key } from '../lib/storage';
import { notifyUser } from '../routes/events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { z } from 'zod';

type DesignSpecType = z.infer<typeof DesignSpec>;

const app = express();
const PORT = process.env.PORT || 3001;

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
): Promise<{ valid: boolean; body?: any }> {
  if (!qstashReceiver) {
    console.warn('[Edit Worker] Signature verification disabled');
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
    console.error('[Edit Worker] Signature verification failed:', error);
    return { valid: false };
  }
}

/**
 * POST /process - Process video editing job (called by Qstash)
 */
app.post('/process', async (req: Request, res: Response) => {
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
 * GET /health - Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'edit-worker',
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
    service: 'SubiteYa Edit Worker',
    version: '1.0.0',
    endpoints: {
      process: 'POST /process',
      health: 'GET /health',
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎬 Edit Worker HTTP Server listening on port ${PORT}`);
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
