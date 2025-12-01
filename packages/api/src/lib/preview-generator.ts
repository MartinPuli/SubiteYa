/**
 * @fileoverview Preview Generator Service
 * Purpose: Generate short preview videos with effects applied
 * Max lines: 300
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { promisify } from 'util';
import { applyBrandPattern } from './video-processor';

const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);

interface PreviewConfig {
  // Logo
  logoUrl?: string;
  logoPosition?: string;
  logoSize?: number;
  logoOpacity?: number;
  // Effects
  enableEffects?: boolean;
  filterType?: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  // Subtitles
  enableSubtitles?: boolean;
  subtitleStyle?: string;
  subtitlePosition?: string;
  subtitleColor?: string;
  subtitleBgColor?: string;
  subtitleFontSize?: number;
  // Voice narration
  enableVoiceNarration?: boolean;
  narrationLanguage?: string | null;
  narrationVoiceId?: string | null;
  narrationStyle?: string | null;
  narrationVolume?: number | null;
  narrationSpeed?: number | null;
  originalAudioVolume?: number | null;
}

interface PreviewResult {
  success: boolean;
  outputPath?: string;
  duration?: number;
  error?: string;
}

/**
 * Download video from URL to temporary file
 */
async function downloadVideo(url: string): Promise<string> {
  const tempPath = path.join(
    process.env.TEMP || '/tmp',
    `preview_source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
  );

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol
      .get(url, response => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('✓ Video downloaded to:', tempPath);
          resolve(tempPath);
        });
      })
      .on('error', err => {
        fs.unlink(tempPath, () => {});
        reject(err);
      });
  });
}

/**
 * Extract video duration in seconds
 */
async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const duration =
        typeof metadata.format.duration === 'number'
          ? metadata.format.duration
          : parseFloat(metadata.format.duration || '0');

      resolve(duration);
    });
  });
}

/**
 * Extract first N seconds of video at reduced resolution
 */
async function extractPreviewClip(
  inputPath: string,
  durationSeconds: number = 10,
  resolution: string = '854x480' // 480p for fast processing
): Promise<string> {
  const outputPath = inputPath.replace(/(\.[^.]+)$/, '_clip$1');

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(0)
      .setDuration(durationSeconds)
      .size(resolution)
      .outputOptions([
        '-c:v libx264',
        '-preset ultrafast', // Fastest encoding for preview
        '-crf 28', // Lower quality acceptable for preview
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('start', commandLine => {
        console.log('FFmpeg clip extraction:', commandLine);
      })
      .on('progress', progress => {
        if (progress.percent) {
          console.log(`Extracting clip: ${Math.round(progress.percent)}% done`);
        }
      })
      .on('end', () => {
        console.log('✓ Preview clip extracted');
        resolve(outputPath);
      })
      .on('error', err => {
        console.error('FFmpeg clip extraction error:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Generate video preview with effects applied
 *
 * Process:
 * 1. Download video from S3 URL
 * 2. Extract first 5-10 seconds at reduced resolution (480p)
 * 3. Apply BrandPattern effects using existing applyBrandPattern()
 * 4. Return preview video path
 */
export async function generateVideoPreview(
  videoUrl: string,
  config: PreviewConfig
): Promise<PreviewResult> {
  let downloadedPath: string | null = null;
  let clippedPath: string | null = null;

  try {
    console.log('[Preview] Starting preview generation for:', videoUrl);

    // Step 1: Download video from URL
    console.log('[Preview] Downloading video...');
    downloadedPath = await downloadVideo(videoUrl);

    // Step 2: Get video duration
    const fullDuration = await getVideoDuration(downloadedPath);
    console.log(`[Preview] Video duration: ${fullDuration.toFixed(2)}s`);

    // Step 3: Extract preview clip (first 5-10 seconds, max 10s)
    const previewDuration = Math.min(fullDuration, 10);
    console.log(`[Preview] Extracting ${previewDuration}s clip at 480p...`);
    clippedPath = await extractPreviewClip(downloadedPath, previewDuration);

    // Clean up downloaded video (no longer needed)
    try {
      await unlink(downloadedPath);
      downloadedPath = null;
    } catch (err) {
      console.warn('[Preview] Failed to cleanup downloaded video:', err);
    }

    // Step 4: Apply BrandPattern effects to clip
    console.log('[Preview] Applying effects to clip...');
    const result = await applyBrandPattern(clippedPath, {
      logoUrl: config.logoUrl,
      logoPosition: config.logoPosition,
      logoSize: config.logoSize,
      logoOpacity: config.logoOpacity,
      enableEffects: config.enableEffects,
      filterType: config.filterType,
      brightness: config.brightness,
      contrast: config.contrast,
      saturation: config.saturation,
      enableSubtitles: config.enableSubtitles,
      subtitleStyle: config.subtitleStyle,
      subtitlePosition: config.subtitlePosition,
      subtitleColor: config.subtitleColor,
      subtitleBgColor: config.subtitleBgColor,
      subtitleFontSize: config.subtitleFontSize,
      enableVoiceNarration: config.enableVoiceNarration,
      narrationLanguage: config.narrationLanguage || undefined,
      narrationVoiceId: config.narrationVoiceId || undefined,
      narrationStyle: config.narrationStyle || undefined,
      narrationVolume: config.narrationVolume || undefined,
      narrationSpeed: config.narrationSpeed || undefined,
      originalAudioVolume: config.originalAudioVolume || undefined,
    });

    // Clean up clipped video if effects were applied
    if (
      result.success &&
      result.outputPath &&
      result.outputPath !== clippedPath
    ) {
      try {
        await unlink(clippedPath);
        clippedPath = null;
      } catch (err) {
        console.warn('[Preview] Failed to cleanup clipped video:', err);
      }
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to apply effects to preview',
      };
    }

    console.log('[Preview] ✓ Preview generated successfully');

    return {
      success: true,
      outputPath: result.outputPath || clippedPath || undefined,
      duration: previewDuration,
    };
  } catch (error) {
    console.error('[Preview] Error generating preview:', error);

    // Clean up temporary files
    if (downloadedPath) {
      try {
        await unlink(downloadedPath);
      } catch (err) {
        console.warn('[Preview] Failed to cleanup downloaded file:', err);
      }
    }
    if (clippedPath) {
      try {
        await unlink(clippedPath);
      } catch (err) {
        console.warn('[Preview] Failed to cleanup clipped file:', err);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
