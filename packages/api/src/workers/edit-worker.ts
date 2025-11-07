/**
 * @fileoverview Edit Worker - Processes video editing jobs
 * Purpose: Poll for EDITING_QUEUED videos, apply FFmpeg transformations with design patterns
 */

import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { applyBrandPattern } from '../lib/video-processor';
import { DesignSpec } from '../lib/design-schema';
import fs from 'fs';
import type { z } from 'zod';

type DesignSpecType = z.infer<typeof DesignSpec>;

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_CONCURRENT_EDITS = 2; // Process max 2 videos at once
let activeEdits = 0;
let isRunning = false;

export function startEditWorker() {
  if (isRunning) {
    console.log('[Edit Worker] Already running');
    return;
  }

  isRunning = true;
  console.log('[Edit Worker] Started - polling every 5s');
  pollForEditJobs();
}

export function stopEditWorker() {
  isRunning = false;
  console.log('[Edit Worker] Stopped');
}

async function pollForEditJobs() {
  while (isRunning) {
    try {
      // Only process if we have capacity
      if (activeEdits < MAX_CONCURRENT_EDITS) {
        await processNextEditJob();
      }

      await sleep(POLL_INTERVAL);
    } catch (error) {
      console.error('[Edit Worker] Poll error:', error);
      await sleep(POLL_INTERVAL);
    }
  }
}

async function processNextEditJob() {
  // Find oldest EDITING_QUEUED video with a pending edit job
  const video = await prisma.video.findFirst({
    where: { status: VideoStatus.EDITING_QUEUED },
    include: {
      design: true,
      jobs: {
        where: { type: 'edit', status: 'queued' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!video || video.jobs.length === 0) {
    return; // No work to do
  }

  const job = video.jobs[0];

  activeEdits++;
  console.log(`[Edit Worker] Starting job ${job.id} for video ${video.id}`);

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

    // Update video status to EDITING
    await prisma.video.update({
      where: { id: video.id },
      data: { status: VideoStatus.EDITING },
    });

    // Get design spec (from video's frozen spec or from design profile)
    let designSpec: DesignSpecType;
    if (video.editSpecJson) {
      designSpec = video.editSpecJson as DesignSpecType;
    } else if (video.design?.specJson) {
      designSpec = video.design.specJson as DesignSpecType;
    } else {
      throw new Error('No design spec available for video');
    }

    console.log(
      `[Edit Worker] Processing video with design: ${video.design?.name || 'frozen spec'}`
    );

    // Verify input file exists
    if (!fs.existsSync(video.srcUrl)) {
      throw new Error(`Input file not found: ${video.srcUrl}`);
    }

    // Convert DesignSpec to pattern format for applyBrandPattern
    const pattern = {
      // Logo/Watermark
      logoUrl: designSpec.brand?.watermark?.url,
      logoPosition: designSpec.brand?.watermark?.position || 'bottom-right',
      logoSize: 15, // Default size
      logoOpacity: (designSpec.brand?.watermark?.opacity || 0.8) * 100,
      // Effects
      enableEffects: false, // Simple for now
      filterType: 'none',
      brightness: 100,
      contrast: 100,
      saturation: 100,
      // Subtitles
      enableSubtitles: designSpec.captions?.enabled || false,
      subtitleStyle: designSpec.captions?.style || 'classic',
      subtitlePosition: 'bottom',
      subtitleColor: designSpec.typography?.colorPrimary || '#FFFFFF',
      subtitleBgColor: 'rgba(0,0,0,0.7)',
      subtitleFontSize: 24,
    };

    console.log(`[Edit Worker] Applying brand pattern to: ${video.srcUrl}`);

    // Process video with brand pattern
    const result = await applyBrandPattern(video.srcUrl, pattern);

    if (!result.success || !result.outputPath) {
      throw new Error(
        result.error || 'Video processing failed without error message'
      );
    }

    console.log(
      `[Edit Worker] Video processed successfully: ${result.outputPath}`
    );

    // Update video with edited URL
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: VideoStatus.EDITED,
        editedUrl: result.outputPath,
        progress: 100,
      },
    });

    // Mark job as succeeded
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        log: `Video edited successfully. Output: ${result.outputPath}`,
      },
    });

    console.log(`[Edit Worker] Job ${job.id} completed successfully`);
  } catch (error: unknown) {
    console.error(`[Edit Worker] Job ${job.id} failed:`, error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during editing';

    // Update video status to FAILED_EDIT
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: VideoStatus.FAILED_EDIT,
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
  } finally {
    activeEdits--;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
