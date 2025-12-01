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

type RequestWithRawBody = Request & { rawBody?: string };

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

// Idempotency tracking: videoId → execution state
const activeExecutions = new Map<
  string,
  { startTime: number; status: 'running' | 'completed' | 'failed' }
>();

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

    const rawBody = (req as RequestWithRawBody).rawBody;
    const bodyToVerify = rawBody ?? JSON.stringify(req.body);

    // qstashReceiver.verify() returns true/false, doesn't return the body
    const isValid = await qstashReceiver.verify({
      signature,
      body: bodyToVerify,
    });

    if (!isValid) {
      return { valid: false };
    }

    // If valid, return the original parsed body
    return { valid: true, body: req.body };
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
  let tempFilePath: string | null = null;
  let outputFilePath: string | null = null;
  let videoId: string | undefined;

  try {
    console.log(
      '[Edit Worker] 🔍 Raw request body:',
      JSON.stringify(req.body, null, 2)
    );
    console.log(
      '[Edit Worker] 🔍 Request headers:',
      JSON.stringify(req.headers, null, 2)
    );

    // Verify Qstash signature
    const { valid, body } = await verifyQstashSignature(req);
    if (!valid) {
      console.error('[Edit Worker] Invalid Qstash signature');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(
      '[Edit Worker] 🔍 Body after signature verification:',
      JSON.stringify(body, null, 2)
    );
    console.log('[Edit Worker] 🔍 Body type:', typeof body);

    const parsedBody = body as { videoId?: string };
    console.log(
      '[Edit Worker] 🔍 Parsed body:',
      JSON.stringify(parsedBody, null, 2)
    );

    if (!parsedBody?.videoId) {
      console.error('[Edit Worker] Missing videoId in request body');
      console.error(
        '[Edit Worker] Full body received:',
        JSON.stringify(body, null, 2)
      );
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    videoId = parsedBody.videoId;
    console.log(
      `[Edit Worker] 📥 Received job for video ${parsedBody.videoId}`
    );

    // IDEMPOTENCY CHECK: Skip if already processing or completed
    if (isExecutionInProgress(parsedBody.videoId)) {
      console.log(
        `[Edit Worker] ⏭️  Skipping ${parsedBody.videoId} - already in progress or recently completed`
      );
      res
        .status(200)
        .json({ success: true, skipped: true, reason: 'idempotent' });
      return;
    }

    markExecutionStart(parsedBody.videoId);

    // Get video with account and its brand patterns
    const video = await prisma.video.findUnique({
      where: { id: parsedBody.videoId },
      include: {
        design: true, // Old system (deprecated)
        user: true,
        account: {
          include: {
            patterns: {
              where: { isDefault: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!video) {
      console.error(`[Edit Worker] Video ${parsedBody.videoId} not found`);
      markExecutionEnd(parsedBody.videoId, 'failed');
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    if (!video.account) {
      throw new Error('Video has no associated account');
    }

    // Skip if already in terminal state (EDITED, FAILED_EDIT, POSTED, etc.)
    const terminalStates: VideoStatus[] = [
      VideoStatus.EDITED,
      VideoStatus.FAILED_EDIT,
      VideoStatus.POSTED,
      VideoStatus.FAILED_UPLOAD,
    ];
    if (terminalStates.includes(video.status)) {
      console.log(
        `[Edit Worker] ⏭️  Video ${parsedBody.videoId} already in terminal state: ${video.status}`
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

    // ATOMIC TRANSITION: PENDING/EDITING → EDITING with progress
    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: {
        status: VideoStatus.EDITING,
        progress: 10,
        error: null, // Clear any previous error
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId: parsedBody.videoId,
      status: 'EDITING',
    });

    // Get BrandPattern from account (NEW SYSTEM)
    const brandPattern = video.account.patterns?.[0];

    if (!brandPattern && !video.design && !video.editSpecJson) {
      throw new Error(
        'No brand pattern or design spec available for this account'
      );
    }

    console.log(
      `[Edit Worker] 🎨 Processing with ${brandPattern ? `BrandPattern: ${brandPattern.name}` : video.design ? `DesignProfile: ${video.design.name}` : 'frozen spec'}`
    );

    // Download video from S3 to temp file (streaming)
    const s3Key = extractS3Key(video.srcUrl);
    tempFilePath = path.join(
      os.tmpdir(),
      `video-${parsedBody.videoId}-${Date.now()}.mp4`
    );

    console.log(`[Edit Worker] ⬇️  Downloading ${s3Key}...`);

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
      data: { progress: 30 },
    });

    // Build pattern from BrandPattern (NEW) or fallback to old DesignProfile
    let pattern;

    if (brandPattern) {
      // Use BrandPattern (NEW SYSTEM) - fields are directly on the model
      pattern = {
        logoUrl: brandPattern.logoUrl || undefined,
        logoPosition: brandPattern.logoPosition,
        logoSize: brandPattern.logoSize,
        logoOpacity: brandPattern.logoOpacity,
        enableEffects: brandPattern.enableEffects,
        filterType: brandPattern.filterType,
        brightness: brandPattern.brightness,
        contrast: brandPattern.contrast,
        saturation: brandPattern.saturation,
        enableSubtitles: brandPattern.enableSubtitles,
        subtitleStyle: brandPattern.subtitleStyle,
        subtitlePosition: brandPattern.subtitlePosition,
        subtitleColor: brandPattern.subtitleColor,
        subtitleBgColor: brandPattern.subtitleBgColor,
        subtitleFontSize: brandPattern.subtitleFontSize,
        enableVoiceNarration: brandPattern.enable_voice_narration,
        narrationLanguage: brandPattern.narration_language || undefined,
        narrationVoiceId: brandPattern.narration_voice_id || undefined,
        narrationStyle: brandPattern.narration_style || undefined,
        narrationVolume: brandPattern.narration_volume,
        narrationSpeed: brandPattern.narration_speed,
        originalAudioVolume: brandPattern.original_audio_volume,
      };
      console.log(`[Edit Worker] 🎨 Using BrandPattern: ${brandPattern.name}`);
      console.log(`[Edit Worker] 🔍 Pattern values:`, {
        enableEffects: pattern.enableEffects,
        brightness: pattern.brightness,
        contrast: pattern.contrast,
        saturation: pattern.saturation,
        logoUrl: pattern.logoUrl ? 'SET' : 'NOT SET',
        enableSubtitles: pattern.enableSubtitles,
        enableVoiceNarration: pattern.enableVoiceNarration,
      });
    } else if (video.editSpecJson) {
      // Fallback: frozen spec from video
      const spec = video.editSpecJson as any;
      pattern = {
        logoUrl: spec.brand?.watermark?.url,
        logoPosition: spec.brand?.watermark?.position || 'bottom-right',
        logoSize: 15,
        logoOpacity: (spec.brand?.watermark?.opacity || 0.8) * 100,
        enableEffects: false,
        filterType: 'none',
        brightness: 100,
        contrast: 100,
        saturation: 100,
        enableSubtitles: spec.captions?.enabled || false,
        subtitleStyle: spec.captions?.style || 'classic',
        subtitlePosition: 'bottom',
        subtitleColor: spec.typography?.colorPrimary || '#FFFFFF',
        subtitleBgColor: 'rgba(0,0,0,0.7)',
        subtitleFontSize: 24,
      };
      console.log(`[Edit Worker] 🎨 Using frozen editSpecJson`);
    } else if (video.design?.specJson) {
      // Fallback: old DesignProfile
      const spec = video.design.specJson as any;
      pattern = {
        logoUrl: spec.brand?.watermark?.url,
        logoPosition: spec.brand?.watermark?.position || 'bottom-right',
        logoSize: 15,
        logoOpacity: (spec.brand?.watermark?.opacity || 0.8) * 100,
        enableEffects: false,
        filterType: 'none',
        brightness: 100,
        contrast: 100,
        saturation: 100,
        enableSubtitles: spec.captions?.enabled || false,
        subtitleStyle: spec.captions?.style || 'classic',
        subtitlePosition: 'bottom',
        subtitleColor: spec.typography?.colorPrimary || '#FFFFFF',
        subtitleBgColor: 'rgba(0,0,0,0.7)',
        subtitleFontSize: 24,
      };
      console.log(
        `[Edit Worker] 🎨 Using old DesignProfile: ${video.design.name}`
      );
    } else {
      throw new Error('No pattern configuration available');
    }

    console.log(
      `[Edit Worker] 🎬 Applying branding with pattern:`,
      JSON.stringify(pattern, null, 2)
    );

    const result = await applyBrandPattern(tempFilePath, pattern);

    if (!result.success || !result.outputPath) {
      throw new Error(result.error || 'Video processing failed');
    }

    outputFilePath = result.outputPath;

    // Check if output is same as input (no processing happened)
    const wasActuallyEdited = outputFilePath !== tempFilePath;
    console.log(`[Edit Worker] 📊 Processing result:`, {
      wasActuallyEdited,
      inputPath: tempFilePath,
      outputPath: outputFilePath,
    });

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 70 },
    });

    // Upload edited video to S3 (streaming)
    console.log(`[Edit Worker] ⬆️  Uploading to S3...`);

    const editedStream = fs.createReadStream(outputFilePath);

    const uploadResult = await uploadToS3({
      file: editedStream,
      filename: path.basename(outputFilePath),
      contentType: 'video/mp4',
      folder: 'videos',
    });

    // ATOMIC TRANSITION: EDITING → EDITED with all fields
    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: {
        status: VideoStatus.EDITED,
        editedUrl: uploadResult.url,
        progress: 100,
        error: null,
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId: parsedBody.videoId,
      status: 'EDITED',
    });

    markExecutionEnd(parsedBody.videoId, 'completed');

    const duration = Date.now() - startTime;
    console.log(
      `[Edit Worker] ✅ Completed video ${parsedBody.videoId} in ${duration}ms`
    );

    res
      .status(200)
      .json({ success: true, videoId: parsedBody.videoId, duration });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Edit Worker] ❌ Error:', errorMessage);

    if (videoId) {
      markExecutionEnd(videoId, 'failed');

      // ATOMIC TRANSITION: Only update to FAILED_EDIT if not already in a failed state
      await prisma.video
        .updateMany({
          where: {
            id: videoId,
            status: {
              notIn: [VideoStatus.FAILED_EDIT, VideoStatus.FAILED_UPLOAD],
            },
          },
          data: {
            status: VideoStatus.FAILED_EDIT,
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
    if (outputFilePath) {
      await fs.promises.unlink(outputFilePath).catch(() => {});
    }
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
    activeExecutions: activeExecutions.size,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

/**
 * GET /wake - Endpoint to wake up the service (no-op but keeps service alive)
 */
app.get('/wake', (_req: Request, res: Response) => {
  console.log('👋 Wake-up ping received');
  res.json({ status: 'awake', timestamp: Date.now() });
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
