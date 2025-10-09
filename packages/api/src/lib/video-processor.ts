/**
 * @fileoverview Video Processor Service
 * Purpose: Apply brand patterns (logos, watermarks) to videos using FFmpeg
 * Max lines: 300
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

interface LogoConfig {
  logoUrl: string; // Base64 data URL or file path
  position:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'center';
  size: number; // Percentage (5-40)
  opacity: number; // 0-100
}

interface VideoProcessingResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * Apply logo overlay to video using FFmpeg
 */
export async function applyLogoToVideo(
  inputPath: string,
  logoConfig: LogoConfig,
  outputPath?: string
): Promise<VideoProcessingResult> {
  let tempLogoPath: string | null = null;

  try {
    // 1. Extract logo from data URL if needed
    tempLogoPath = await extractLogoFromDataUrl(logoConfig.logoUrl);

    // 2. Generate output path if not provided
    const finalOutputPath =
      outputPath || inputPath.replace(/(\.[^.]+)$/, '_with_logo$1');

    // 3. Calculate logo position and size
    const { x, y, scale } = calculateLogoPlacement(
      logoConfig.position,
      logoConfig.size
    );

    // 4. Build FFmpeg filter complex
    const filterComplex = buildFilterComplex(x, y, scale, logoConfig.opacity);

    // 5. Execute FFmpeg command
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(tempLogoPath!)
        .complexFilter(filterComplex)
        .outputOptions([
          '-c:v libx264', // Video codec
          '-preset fast', // Encoding speed
          '-crf 23', // Quality (lower = better, 18-28 range)
          '-c:a copy', // Copy audio without re-encoding
          '-movflags +faststart', // Enable streaming
        ])
        .output(finalOutputPath)
        .on('start', commandLine => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', progress => {
          if (progress.percent) {
            console.log(`Processing: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('Video processing completed');
          resolve();
        })
        .on('error', err => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .run();
    });

    return {
      success: true,
      outputPath: finalOutputPath,
    };
  } catch (error) {
    console.error('Error applying logo to video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Clean up temp logo file
    if (tempLogoPath && tempLogoPath.startsWith('/tmp/')) {
      try {
        await unlink(tempLogoPath);
      } catch (err) {
        console.warn('Failed to delete temp logo file:', err);
      }
    }
  }
}

/**
 * Extract logo from base64 data URL to temporary file
 */
async function extractLogoFromDataUrl(logoUrl: string): Promise<string> {
  if (!logoUrl.startsWith('data:')) {
    // Already a file path
    return logoUrl;
  }

  // Parse data URL: data:image/png;base64,iVBORw0KG...
  const matches = logoUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split('/')[1] || 'png';

  // Create temp file
  const tempPath = path.join(
    process.env.TEMP || '/tmp',
    `logo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`
  );

  const buffer = Buffer.from(base64Data, 'base64');
  await writeFile(tempPath, buffer);

  return tempPath;
}

/**
 * Calculate logo placement based on position and size
 */
function calculateLogoPlacement(
  position: LogoConfig['position'],
  sizePercent: number
): { x: string; y: string; scale: string } {
  // Logo will be scaled to sizePercent of video width
  const scale = `iw*${sizePercent / 100}:-1`;

  // Padding from edges (in pixels)
  const padding = 30;

  let x: string;
  let y: string;

  switch (position) {
    case 'top-left':
      x = `${padding}`;
      y = `${padding}`;
      break;

    case 'top-right':
      x = `main_w-overlay_w-${padding}`;
      y = `${padding}`;
      break;

    case 'bottom-left':
      x = `${padding}`;
      y = `main_h-overlay_h-${padding}`;
      break;

    case 'bottom-right':
      x = `main_w-overlay_w-${padding}`;
      y = `main_h-overlay_h-${padding}`;
      break;

    case 'center':
      x = '(main_w-overlay_w)/2';
      y = '(main_h-overlay_h)/2';
      break;

    default:
      // Default to bottom-right
      x = `main_w-overlay_w-${padding}`;
      y = `main_h-overlay_h-${padding}`;
  }

  return { x, y, scale };
}

/**
 * Build FFmpeg filter complex for logo overlay
 */
function buildFilterComplex(
  x: string,
  y: string,
  scale: string,
  opacity: number
): string[] {
  // Normalize opacity (0-100 to 0-1)
  const alpha = opacity / 100;

  return [
    // Scale logo and apply opacity
    `[1:v]scale=${scale},format=rgba,colorchannelmixer=aa=${alpha}[logo]`,
    // Overlay logo on video at position
    `[0:v][logo]overlay=${x}:${y}:format=auto`,
  ];
}

/**
 * Get video metadata (duration, dimensions, etc.)
 */
export function getVideoMetadata(
  filePath: string
): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });
}

/**
 * Validate video file (check format, duration, size)
 */
export async function validateVideo(
  filePath: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const metadata = await getVideoMetadata(filePath);

    // Check if video stream exists
    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    if (!videoStream) {
      return { valid: false, error: 'No video stream found' };
    }

    // Check duration (TikTok supports 3s to 10min)
    const duration =
      typeof metadata.format.duration === 'number'
        ? metadata.format.duration
        : parseFloat(metadata.format.duration || '0');
    if (duration < 3) {
      return { valid: false, error: 'Video too short (minimum 3 seconds)' };
    }
    if (duration > 600) {
      return { valid: false, error: 'Video too long (maximum 10 minutes)' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
