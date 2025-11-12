/**
 * @fileoverview BullMQ Edit Worker - Production Ready
 * Purpose: Process video editing jobs from Redis queue
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { applyBrandPattern } from '../lib/video-processor';
import { DesignSpec } from '../lib/design-schema';
import {
  downloadFromS3,
  downloadStreamFromS3,
  uploadToS3,
  extractS3Key,
} from '../lib/storage';
import { notifyUser } from '../routes/events';
import { generateNarrationScript } from '../lib/script-generator';
import { generateSpeechToFile } from '../lib/elevenlabs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { z } from 'zod';
import Redis from 'ioredis';

const execPromise = promisify(exec);

type DesignSpecType = z.infer<typeof DesignSpec>;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONCURRENCY = Number.parseInt(
  process.env.EDIT_WORKER_CONCURRENCY || '2',
  10
);

let worker: Worker | null = null;
let redisConnection: Redis | null = null;

export function startEditWorker() {
  // Check if Redis is disabled
  const redisEnabled = process.env.ENABLE_REDIS !== 'false';
  if (!redisEnabled) {
    console.log(
      '🚫 [Edit Worker] Redis is DISABLED (ENABLE_REDIS=false). Worker will not start.'
    );
    return null;
  }

  if (worker) {
    console.log('[Edit Worker] Already running');
    return worker;
  }

  // Create Redis connection for BullMQ Worker
  redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true, // Don't connect immediately
  });

  redisConnection.on('connect', () => {
    console.log('[Edit Worker] ✅ Connected to Redis');
  });

  redisConnection.on('error', (err: Error) => {
    if (err.message.includes('ECONNRESET')) {
      console.warn('[Edit Worker] Redis connection reset, will reconnect...');
      return;
    }
    console.error('[Edit Worker] Redis error:', err.message);
  });

  redisConnection.on('close', () => {
    console.warn('[Edit Worker] Redis connection closed');
  });

  // Connect explicitly
  redisConnection.connect().catch(err => {
    console.error('[Edit Worker] Failed to connect to Redis:', err.message);
    process.exit(1);
  });

  worker = new Worker(
    'video-edit',
    async (job: Job) => {
      console.log(
        `[Edit Worker] 📥 Received job ${job.id} for video ${job.data.videoId}`
      );
      const startTime = Date.now();
      try {
        const { videoId } = job.data;
        await processEditJob(videoId, job);
        const duration = Date.now() - startTime;
        console.log(
          `[Edit Worker] ✅ Job ${job.id} completed in ${duration}ms`
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(
          `[Edit Worker] ❌ Job ${job.id} failed after ${duration}ms:`,
          error
        );
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: CONCURRENCY,
      limiter: {
        max: 3,
        duration: 60000, // 3 jobs per minute
      },
      lockDuration: 30000, // 30 seconds
      stalledInterval: 3000000, // Check for stalled jobs every 5 minutes (reduces Redis polling)
      maxStalledCount: 2,
    }
  );

  worker.on('completed', (job: Job) => {
    console.log(`[Edit Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[Edit Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err: Error) => {
    // Ignore ECONNRESET during shutdown/reconnection
    if (err.message.includes('ECONNRESET')) {
      console.warn('[Edit Worker] Redis connection reset, will reconnect...');
      return;
    }
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
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}

/**
 * Aplica narración con voz usando Whisper + GPT-4 + ElevenLabs
 * @param videoPath - Ruta del video a procesar
 * @param pattern - Configuración de narración
 * @returns Ruta del video con narración aplicada
 */
async function applyVoiceNarration(
  videoPath: string,
  pattern: {
    enable_voice_narration?: boolean;
    narration_language?: string;
    narration_voice_id?: string;
    narration_style?: string;
    narration_volume?: number;
    narration_speed?: number;
    original_audio_volume?: number;
  }
): Promise<string> {
  // Si no está habilitada, retornar el video sin cambios
  if (!pattern.enable_voice_narration) {
    return videoPath;
  }

  const tempDir = os.tmpdir();
  const audioPath = path.join(tempDir, `audio-${Date.now()}.wav`);
  const narrationPath = path.join(tempDir, `narration-${Date.now()}.mp3`);
  const outputPath = path.join(tempDir, `narrated-${Date.now()}.mp4`);

  try {
    console.log('[Voice Narration] Starting narration process...');

    // 1. Extraer audio del video
    console.log('[Voice Narration] Extracting audio from video...');
    await execPromise(
      `ffmpeg -i "${videoPath}" -vn -ar 16000 -ac 1 -f wav "${audioPath}"`
    );

    // 2. Transcribir con Whisper (aquí deberías usar tu implementación de Whisper)
    // Por ahora, vamos a simular una transcripción simple
    // En producción, deberías integrar con Whisper AI
    console.log('[Voice Narration] Transcribing audio with Whisper AI...');
    const transcription = await transcribeAudio(audioPath);

    // 3. Generar script con GPT-4
    console.log('[Voice Narration] Generating narration script with GPT-4...');
    const script = await generateNarrationScript(
      transcription,
      pattern.narration_language || 'es',
      pattern.narration_style || 'documentary'
    );

    // 4. Generar voz con ElevenLabs
    console.log('[Voice Narration] Generating speech with ElevenLabs...');
    await generateSpeechToFile(
      {
        voice_id: pattern.narration_voice_id || '',
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      },
      narrationPath
    );

    // 5. Mezclar narración con video original
    console.log('[Voice Narration] Mixing narration with original video...');
    const narrationVol = (pattern.narration_volume || 80) / 100;
    const originalVol = (pattern.original_audio_volume || 30) / 100;
    const speed = pattern.narration_speed || 1.0;

    // Ajustar velocidad de narración y mezclar audios
    const ffmpegCommand = `ffmpeg -i "${videoPath}" -i "${narrationPath}" \
      -filter_complex "[1:a]atempo=${speed},volume=${narrationVol}[narration]; \
      [0:a]volume=${originalVol}[original]; \
      [narration][original]amix=inputs=2:duration=first[aout]" \
      -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k "${outputPath}"`;

    await execPromise(ffmpegCommand);

    console.log('[Voice Narration] Narration applied successfully!');

    // Limpiar archivos temporales
    await fs.promises.unlink(audioPath).catch(() => {});
    await fs.promises.unlink(narrationPath).catch(() => {});

    return outputPath;
  } catch (error) {
    console.error('[Voice Narration] Error applying narration:', error);
    // Limpiar en caso de error
    await fs.promises.unlink(audioPath).catch(() => {});
    await fs.promises.unlink(narrationPath).catch(() => {});
    await fs.promises.unlink(narrationPath).catch(() => {});
    // En caso de error, retornar el video original sin narración
    return videoPath;
  }
}

/**
 * Transcribe audio usando Whisper AI
 * Por ahora es un placeholder - en producción integrar con Whisper
 */
async function transcribeAudio(_audioPath: string): Promise<string> {
  // TODO: Integrar con Whisper AI real
  // Por ahora retornar transcripción de ejemplo
  console.log('[Transcription] Using Whisper AI to transcribe...');

  // En producción, usar algo como:
  // const { Whisper } = require('whisper-ai');
  // const whisper = new Whisper({ apiKey: process.env.OPENAI_API_KEY });
  // const result = await whisper.transcribe(_audioPath);
  // return result.text;

  // Placeholder: retornar texto de ejemplo
  return 'This is the transcribed audio content from the video.';
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

    // Download video from S3 directly to temp file (streaming to avoid memory issues)
    const s3Key = extractS3Key(video.srcUrl);
    tempFilePath = path.join(os.tmpdir(), `video-${videoId}-${Date.now()}.mp4`);

    console.log(
      `[Edit Worker] Downloading ${s3Key} to ${tempFilePath} (streaming)...`
    );

    // Use streaming download to avoid loading entire video into memory
    const videoStream = await downloadStreamFromS3(s3Key);
    const writeStream = fs.createWriteStream(tempFilePath);

    await new Promise<void>((resolve, reject) => {
      videoStream.pipe(writeStream);
      videoStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
    });

    console.log(`[Edit Worker] Downloaded to ${tempFilePath}`);

    await job.updateProgress(30);

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

    // Get brand pattern for voice narration settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let brandPattern: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((video as any).patternId) {
      brandPattern = await prisma.brandPattern.findUnique({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: { id: (video as any).patternId },
      });
    }

    // Apply voice narration if enabled
    let finalVideoPath = result.outputPath;
    if (brandPattern?.enable_voice_narration) {
      console.log('[Edit Worker] Applying voice narration...');
      const narratedPath = await applyVoiceNarration(result.outputPath, {
        enable_voice_narration: brandPattern.enable_voice_narration,
        narration_language: brandPattern.narration_language || undefined,
        narration_voice_id: brandPattern.narration_voice_id || undefined,
        narration_style: brandPattern.narration_style || undefined,
        narration_volume: brandPattern.narration_volume,
        narration_speed: brandPattern.narration_speed,
        original_audio_volume: brandPattern.original_audio_volume,
      });

      // Si la narración fue exitosa, usar el video narrado
      if (narratedPath !== result.outputPath) {
        finalVideoPath = narratedPath;
        // Limpiar video intermedio
        await fs.promises.unlink(result.outputPath).catch(() => {});
      }
    }

    await job.updateProgress(70);

    // Upload edited video to S3
    const editedBuffer = await fs.promises.readFile(finalVideoPath);
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
    if (result.outputPath && result.outputPath !== finalVideoPath) {
      await fs.promises.unlink(result.outputPath).catch(() => {});
    }
    if (finalVideoPath && finalVideoPath !== result.outputPath) {
      await fs.promises.unlink(finalVideoPath).catch(() => {});
    }

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
