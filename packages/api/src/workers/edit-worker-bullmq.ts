/**
 * @fileoverview BullMQ Edit Worker - Production Ready
 * Purpose: Process video editing jobs from Redis queue
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { applyBrandPattern } from '../lib/video-processor';
import { DesignSpec } from '../lib/design-schema';
import { downloadFromS3, uploadToS3, extractS3Key } from '../lib/storage';
import { notifyUser } from '../routes/events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { z } from 'zod';

type DesignSpecType = z.infer<typeof DesignSpec>;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONCURRENCY = Number.parseInt(
  process.env.EDIT_WORKER_CONCURRENCY || '2',
  10
);

let worker: Worker | null = null;

export function startEditWorker() {
  if (worker) {
    console.log('[Edit Worker] Already running');
    return worker;
  }

  worker = new Worker(
    'video-edit',
    async (job: Job) => {
      const { videoId } = job.data;
      await processEditJob(videoId, job);
    },
    {
      connection: {
        host: new URL(REDIS_URL).hostname,
        port: Number.parseInt(new URL(REDIS_URL).port || '6379', 10),
      },
      concurrency: CONCURRENCY,
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // per minute
      },
    }
  );

  worker.on('completed', (job: Job) => {
    console.log(`[Edit Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[Edit Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err: Error) => {
    console.error('[Edit Worker] Worker error:', err);
  });

  console.log(`[Edit Worker] Started with concurrency ${CONCURRENCY}`);
  return worker;
}

export async function stopEditWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[Edit Worker] Stopped');
  }
}

async function processEditJob(videoId: string, job: Job) {
  let tempFilePath: string | null = null;

  try {
    // Get video with design
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        design: true,
        user: true,
      },
    });

    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

    // Update video status to EDITING
    await prisma.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.EDITING },
    });

    // Notify user
    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'EDITING',
    });

    // Update job progress
    await job.updateProgress(10);

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
      `[Edit Worker] Processing video ${videoId} with design: ${video.design?.name || 'frozen spec'}`
    );

    // Download video from S3 to temp file
    const s3Key = extractS3Key(video.srcUrl);
    const videoBuffer = await downloadFromS3(s3Key);

    await job.updateProgress(30);

    // Save to temp file
    tempFilePath = path.join(os.tmpdir(), `video-${videoId}-${Date.now()}.mp4`);
    await fs.promises.writeFile(tempFilePath, videoBuffer);

    console.log(`[Edit Worker] Downloaded to ${tempFilePath}`);

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

    await job.updateProgress(40);

    // Process video with FFmpeg
    console.log(`[Edit Worker] Applying brand pattern...`);
    const result = await applyBrandPattern(tempFilePath, pattern);

    if (!result.success || !result.outputPath) {
      throw new Error(result.error || 'Video processing failed');
    }

    await job.updateProgress(70);

    // Upload edited video to S3
    const editedBuffer = await fs.promises.readFile(result.outputPath);
    const uploadResult = await uploadToS3({
      file: editedBuffer,
      filename: `${videoId}-edited.mp4`,
      folder: 'videos',
      metadata: {
        videoId,
        userId: video.userId,
        type: 'edited',
      },
    });

    console.log(`[Edit Worker] Uploaded edited video to ${uploadResult.url}`);

    await job.updateProgress(90);

    // Update video with edited URL
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.EDITED,
        editedUrl: uploadResult.url,
        progress: 100,
      },
    });

    // Update job in database
    await prisma.job.updateMany({
      where: {
        videoId,
        type: 'edit',
        status: 'running',
      },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        log: `Edited video uploaded to ${uploadResult.url}`,
      },
    });

    // Notify user
    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId,
      status: 'EDITED',
      editedUrl: uploadResult.url,
    });

    // Cleanup temp files
    if (tempFilePath) await fs.promises.unlink(tempFilePath).catch(() => {});
    if (result.outputPath)
      await fs.promises.unlink(result.outputPath).catch(() => {});

    await job.updateProgress(100);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Edit Worker] Error processing video ${videoId}:`, error);

    // Update video status
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.FAILED_EDIT,
        error: errorMessage,
      },
    });

    // Update job
    await prisma.job.updateMany({
      where: {
        videoId,
        type: 'edit',
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
        status: 'FAILED_EDIT',
        error: errorMessage,
      });
    }

    // Cleanup
    if (tempFilePath) await fs.promises.unlink(tempFilePath).catch(() => {});

    throw error; // Re-throw for BullMQ retry logic
  }
}
