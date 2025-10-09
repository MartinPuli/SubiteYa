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

/**
 * Visual Effects Configuration
 */
interface EffectsConfig {
  filterType: string; // 'none' | 'vintage' | 'vibrant' | 'cinematic' | 'grayscale' | 'sepia'
  brightness: number; // 50-150
  contrast: number; // 50-150
  saturation: number; // 0-200
}

/**
 * Apply visual effects to video using FFmpeg filters
 */
export async function applyEffectsToVideo(
  inputPath: string,
  effects: EffectsConfig,
  outputPath?: string
): Promise<VideoProcessingResult> {
  try {
    const finalOutputPath =
      outputPath || inputPath.replace(/(\.[^.]+)$/, '_with_effects$1');

    // Build filter complex for effects
    const filters = buildEffectsFilter(effects);

    if (!filters || filters.length === 0) {
      // No effects to apply, just copy
      return { success: true, outputPath: inputPath };
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filters)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-c:a copy',
          '-movflags +faststart',
        ])
        .output(finalOutputPath)
        .on('start', commandLine => {
          console.log('FFmpeg effects command:', commandLine);
        })
        .on('progress', progress => {
          if (progress.percent) {
            console.log(
              `Applying effects: ${Math.round(progress.percent)}% done`
            );
          }
        })
        .on('end', () => {
          console.log('Effects applied successfully');
          resolve();
        })
        .on('error', err => {
          console.error('FFmpeg effects error:', err);
          reject(err);
        })
        .run();
    });

    return { success: true, outputPath: finalOutputPath };
  } catch (error) {
    console.error('Error applying effects to video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build FFmpeg filter string for visual effects
 */
function buildEffectsFilter(effects: EffectsConfig): string[] {
  const filters: string[] = [];

  // Normalize values
  const brightnessValue = (effects.brightness - 100) / 100; // -0.5 to +0.5
  const contrastValue = effects.contrast / 100; // 0.5 to 1.5
  const saturationValue = effects.saturation / 100; // 0 to 2

  // Base adjustments (brightness, contrast, saturation)
  const eqFilter = `eq=brightness=${brightnessValue}:contrast=${contrastValue}:saturation=${saturationValue}`;
  filters.push(eqFilter);

  // Apply predefined filter
  switch (effects.filterType) {
    case 'vintage':
      // Vintage: desaturate, warm tones, vignette
      filters.push('curves=vintage');
      filters.push('vignette=angle=PI/4');
      break;

    case 'vibrant':
      // Vibrant: boost saturation and colors
      filters.push('eq=saturation=1.5');
      filters.push('vibrance=intensity=0.3');
      break;

    case 'cinematic':
      // Cinematic: letterbox, color grading
      filters.push('pad=iw:ih*1.2:(ow-iw)/2:(oh-ih)/2:black');
      filters.push('colorbalance=rs=0.1:gs=-0.1:bs=-0.2');
      break;

    case 'grayscale':
      // Grayscale: remove all color
      filters.push('hue=s=0');
      break;

    case 'sepia':
      // Sepia: warm grayscale tone
      filters.push(
        'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131'
      );
      break;

    case 'none':
    default:
      // No special filter, just base adjustments
      break;
  }

  return filters;
}

/**
 * Subtitle Configuration
 */
interface SubtitleConfig {
  style: string; // 'modern' | 'classic' | 'bold' | 'outlined' | 'boxed'
  position: string; // 'top' | 'center' | 'bottom'
  color: string; // Hex color
  backgroundColor: string; // Hex color
  fontSize: number; // 16-48
}

interface SubtitleSegment {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

/**
 * Generate subtitles from video audio using speech-to-text
 * NOTE: This is a placeholder. In production, integrate with Whisper API or similar service.
 */
export async function generateSubtitles(
  videoPath: string
): Promise<{
  success: boolean;
  subtitles?: SubtitleSegment[];
  error?: string;
}> {
  try {
    console.log('Generating subtitles for:', videoPath);

    // TODO: Implement actual speech-to-text integration
    // Options:
    // 1. OpenAI Whisper API: https://platform.openai.com/docs/guides/speech-to-text
    // 2. Google Cloud Speech-to-Text
    // 3. AWS Transcribe
    // 4. Azure Speech Services

    // Placeholder: Return mock subtitles for now
    const mockSubtitles: SubtitleSegment[] = [
      { start: 0, end: 2, text: 'Hola, este es un video de prueba' },
      {
        start: 2.5,
        end: 5,
        text: 'Los subtítulos se generarán automáticamente',
      },
      {
        start: 5.5,
        end: 8,
        text: 'Usando tecnología de reconocimiento de voz',
      },
    ];

    return { success: true, subtitles: mockSubtitles };
  } catch (error) {
    console.error('Error generating subtitles:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert subtitle segments to SRT format
 */
function generateSRTContent(subtitles: SubtitleSegment[]): string {
  return subtitles
    .map((segment, index) => {
      const startTime = formatSRTTimestamp(segment.start);
      const endTime = formatSRTTimestamp(segment.end);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    })
    .join('\n');
}

/**
 * Format seconds to SRT timestamp (00:00:00,000)
 */
function formatSRTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Burn subtitles into video using FFmpeg
 */
export async function burnSubtitlesIntoVideo(
  inputPath: string,
  subtitles: SubtitleSegment[],
  config: SubtitleConfig,
  outputPath?: string
): Promise<VideoProcessingResult> {
  let tempSrtPath = '';

  try {
    const finalOutputPath =
      outputPath || inputPath.replace(/(\.[^.]+)$/, '_with_subtitles$1');

    // 1. Generate SRT file
    const srtContent = generateSRTContent(subtitles);
    tempSrtPath = inputPath.replace(/(\.[^.]+)$/, '.srt');
    await writeFile(tempSrtPath, srtContent, 'utf-8');

    // 2. Build subtitle style
    const subtitleStyle = buildSubtitleStyle(config);

    // 3. Apply subtitles using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf',
          `subtitles=${tempSrtPath.replace(/\\/g, '/')}:${subtitleStyle}`,
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-c:a copy',
          '-movflags +faststart',
        ])
        .output(finalOutputPath)
        .on('start', commandLine => {
          console.log('FFmpeg subtitles command:', commandLine);
        })
        .on('progress', progress => {
          if (progress.percent) {
            console.log(
              `Burning subtitles: ${Math.round(progress.percent)}% done`
            );
          }
        })
        .on('end', () => {
          console.log('Subtitles burned successfully');
          resolve();
        })
        .on('error', err => {
          console.error('FFmpeg subtitles error:', err);
          reject(err);
        })
        .run();
    });

    // Clean up temp SRT file
    if (tempSrtPath) {
      try {
        await unlink(tempSrtPath);
      } catch (err) {
        console.warn('Failed to cleanup SRT file:', err);
      }
    }

    return { success: true, outputPath: finalOutputPath };
  } catch (error) {
    // Clean up temp files
    if (tempSrtPath) {
      try {
        await unlink(tempSrtPath);
      } catch (err) {
        console.warn('Failed to cleanup SRT file:', err);
      }
    }

    console.error('Error burning subtitles into video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build FFmpeg subtitle style string
 */
function buildSubtitleStyle(config: SubtitleConfig): string {
  const styles: string[] = [];

  // Font size
  styles.push(`FontSize=${config.fontSize}`);

  // Primary color (remove # from hex)
  const primaryColor = config.color.replace('#', '');
  styles.push(`PrimaryColour=&H${hexToABGR(primaryColor)}`);

  // Background color
  const bgColor = config.backgroundColor.replace('#', '');
  styles.push(`BackColour=&H${hexToABGR(bgColor)}`);

  // Position (Alignment: 1=bottom-left, 2=bottom-center, 3=bottom-right, etc.)
  let alignment = 2; // Default: bottom-center
  switch (config.position) {
    case 'top':
      alignment = 8; // top-center
      styles.push('MarginV=20');
      break;
    case 'center':
      alignment = 5; // middle-center
      break;
    case 'bottom':
    default:
      alignment = 2; // bottom-center
      styles.push('MarginV=20');
      break;
  }
  styles.push(`Alignment=${alignment}`);

  // Style-specific settings
  switch (config.style) {
    case 'modern':
      styles.push('Bold=0');
      styles.push('Shadow=2');
      break;
    case 'classic':
      styles.push('Bold=0');
      styles.push('Outline=1');
      styles.push('Shadow=0');
      break;
    case 'bold':
      styles.push('Bold=1');
      styles.push('Outline=2');
      break;
    case 'outlined':
      styles.push('Bold=0');
      styles.push('Outline=3');
      styles.push('Shadow=0');
      break;
    case 'boxed':
      styles.push('Bold=0');
      styles.push('BorderStyle=4'); // Box around text
      break;
  }

  return `force_style='${styles.join(',')}'`;
}

/**
 * Convert hex color to ABGR format for FFmpeg (Alpha-Blue-Green-Red)
 */
function hexToABGR(hex: string): string {
  // hex: RRGGBB
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);

  // ABGR format: AA BB GG RR (reversed, with alpha)
  return `FF${b}${g}${r}`;
}

/**
 * Apply complete brand pattern (effects + logo + subtitles) to video
 */
export async function applyBrandPattern(
  inputPath: string,
  pattern: {
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
  }
): Promise<VideoProcessingResult> {
  try {
    let currentPath = inputPath;

    // Step 1: Apply visual effects if enabled
    if (pattern.enableEffects && pattern.filterType !== 'none') {
      console.log('Applying visual effects...');
      const effectsResult = await applyEffectsToVideo(currentPath, {
        filterType: pattern.filterType || 'none',
        brightness: pattern.brightness || 100,
        contrast: pattern.contrast || 100,
        saturation: pattern.saturation || 100,
      });

      if (!effectsResult.success) {
        return effectsResult;
      }

      if (effectsResult.outputPath) {
        currentPath = effectsResult.outputPath;
      }
    }

    // Step 2: Apply logo if provided
    if (pattern.logoUrl) {
      console.log('Applying logo...');
      const logoResult = await applyLogoToVideo(currentPath, {
        logoUrl: pattern.logoUrl,
        position: (pattern.logoPosition ||
          'bottom-right') as LogoConfig['position'],
        size: pattern.logoSize || 15,
        opacity: pattern.logoOpacity || 100,
      });

      if (!logoResult.success) {
        // Clean up effects file if it was created
        if (currentPath !== inputPath) {
          try {
            await unlink(currentPath);
          } catch (err) {
            console.warn('Failed to cleanup effects file:', err);
          }
        }
        return logoResult;
      }

      if (logoResult.outputPath) {
        // Clean up intermediate effects file
        if (currentPath !== inputPath) {
          try {
            await unlink(currentPath);
          } catch (err) {
            console.warn('Failed to cleanup intermediate file:', err);
          }
        }
        currentPath = logoResult.outputPath;
      }
    }

    // Step 3: Generate and burn subtitles if enabled
    if (pattern.enableSubtitles) {
      console.log('Generating subtitles...');
      const subtitlesResult = await generateSubtitles(currentPath);

      if (!subtitlesResult.success || !subtitlesResult.subtitles) {
        // Don't fail the whole process, just log warning
        console.warn('Failed to generate subtitles:', subtitlesResult.error);
      } else {
        console.log('Burning subtitles into video...');
        const burnResult = await burnSubtitlesIntoVideo(
          currentPath,
          subtitlesResult.subtitles,
          {
            style: pattern.subtitleStyle || 'modern',
            position: pattern.subtitlePosition || 'bottom',
            color: pattern.subtitleColor || '#FFFFFF',
            backgroundColor: pattern.subtitleBgColor || '#000000',
            fontSize: pattern.subtitleFontSize || 24,
          }
        );

        if (!burnResult.success) {
          // Don't fail the whole process, just log warning
          console.warn('Failed to burn subtitles:', burnResult.error);
        } else if (burnResult.outputPath) {
          // Clean up intermediate file
          if (currentPath !== inputPath) {
            try {
              await unlink(currentPath);
            } catch (err) {
              console.warn('Failed to cleanup intermediate file:', err);
            }
          }
          currentPath = burnResult.outputPath;
        }
      }
    }

    return { success: true, outputPath: currentPath };
  } catch (error) {
    console.error('Error applying brand pattern:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
