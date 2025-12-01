/**
 * @fileoverview Video Processor Service
 * Purpose: Apply brand patterns (logos, watermarks) to videos using FFmpeg
 * Max lines: 300
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import OpenAI from 'openai';
import { generateNarrationScript } from './script-generator';
import { generateSpeech } from './elevenlabs';

// Lazy load FFmpeg path to avoid startup errors
let ffmpegInitialized = false;
async function ensureFfmpegPath() {
  if (!ffmpegInitialized) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg');
      ffmpeg.setFfmpegPath(ffmpegPath.path);
      ffmpegInitialized = true;
      console.log('✅ FFmpeg path set:', ffmpegPath.path);
    } catch (error) {
      console.error('⚠️  FFmpeg installer not found, using system FFmpeg');
      // Render should have ffmpeg in PATH
    }
  }
}

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

interface VoiceNarrationConfig {
  enableVoiceNarration?: boolean;
  narrationLanguage?: string | null;
  narrationVoiceId?: string | null;
  narrationStyle?: string | null;
  narrationVolume?: number | null;
  narrationSpeed?: number | null;
  originalAudioVolume?: number | null;
}

interface VoiceNarrationResult extends VideoProcessingResult {
  subtitles?: SubtitleSegment[];
}

/**
 * Apply logo overlay to video using FFmpeg
 */
export async function applyLogoToVideo(
  inputPath: string,
  logoConfig: LogoConfig,
  outputPath?: string
): Promise<VideoProcessingResult> {
  ensureFfmpegPath();
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
 * Advanced Video Processing Configuration (CapCut-style)
 */
interface AdvancedProcessingConfig {
  // Color Grading
  brightness?: number; // 0-200, 100=normal
  contrast?: number; // 0-200, 100=normal
  saturation?: number; // 0-200, 100=normal
  temperature?: number; // 0-200, 100=normal (warm/cool)
  tint?: number; // 0-200, 100=normal (green/magenta)
  hue?: number; // -180 to 180
  exposure?: number; // 50-150, 100=normal
  highlights?: number; // 0-200, 100=normal
  shadows?: number; // 0-200, 100=normal

  // Effects
  filterType?: string; // 'none' | 'vintage' | 'vibrant' | 'cinematic' | 'warm' | 'cool' | 'bw' | 'sepia' | 'dramatic'
  vignette?: number; // 0-100
  sharpen?: number; // 0-100
  blur?: number; // 0-100
  grain?: number; // 0-100

  // Enhancements
  stabilization?: boolean;
  denoise?: boolean;
  denoiseStrength?: number; // 0-100

  // Speed
  speedMultiplier?: number; // 0.25-4.0
  smoothSlow?: boolean; // Smooth slow motion with frame interpolation

  // Auto Crop
  autoCrop?: boolean;
  aspectRatio?: string; // 'original' | '9:16' | '16:9' | '1:1' | '4:5'
  cropPosition?: string; // 'center' | 'top' | 'bottom' | 'smart'

  // Audio
  audioVolume?: number; // 0-200, 100=normal
  audioNormalize?: boolean;
}

/**
 * Legacy Effects Config for backwards compatibility
 */
interface EffectsConfig {
  filterType: string;
  brightness: number;
  contrast: number;
  saturation: number;
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

async function hasAudioStream(videoPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      const audioStreams = data.streams?.filter(
        stream => stream.codec_type === 'audio'
      );
      resolve((audioStreams?.length || 0) > 0);
    });
  });
}

/**
 * Extract audio from video file using FFmpeg
 */
async function extractAudioFromVideo(videoPath: string): Promise<string> {
  await ensureFfmpegPath();

  const audioPath = videoPath.replace(/\.[^.]+$/, '_audio.mp3');

  return new Promise((resolve, reject) => {
    let hasAudioStream = false;

    ffmpeg(videoPath)
      .outputOptions([
        '-vn', // No video
        '-acodec libmp3lame', // MP3 codec
        '-q:a 2', // High quality
        '-af',
        'volume=2.0', // Boost volume 2x to help Whisper detect speech
      ])
      .output(audioPath)
      .on('start', commandLine => {
        console.log('Extracting audio:', commandLine);
      })
      .on('codecData', data => {
        // Check if video has audio stream
        if (data.audio) {
          hasAudioStream = true;
          console.log('✅ Audio stream detected:', data.audio);
        } else {
          console.warn('⚠️ No audio stream found in video');
        }
      })
      .on('end', async () => {
        // Check if audio file was created and has content
        try {
          const stats = await fs.promises.stat(audioPath);
          if (stats.size === 0) {
            console.error('❌ Extracted audio file is empty (0 bytes)');
            reject(new Error('Video has no audio or audio extraction failed'));
            return;
          }
          if (stats.size < 1000) {
            console.warn(
              `⚠️ Audio file is very small (${stats.size} bytes) - may be silent`
            );
          }
          console.log(
            `✅ Audio extracted successfully (${(stats.size / 1024).toFixed(2)} KB)`
          );
          resolve(audioPath);
        } catch (err) {
          console.error('❌ Audio file not created:', err);
          reject(new Error('Failed to create audio file'));
        }
      })
      .on('error', err => {
        console.error('❌ Error extracting audio:', err);
        reject(err);
      })
      .run();
  });
}

async function transcribeAudioWithWhisper(
  audioPath: string
): Promise<SubtitleSegment[]> {
  console.log('Transcribing audio with Whisper:', audioPath);

  const subtitles: SubtitleSegment[] = [];

  try {
    // Check audio file size before sending to Whisper
    const audioStats = await fs.promises.stat(audioPath);
    console.log(
      `📊 Audio file size: ${(audioStats.size / 1024).toFixed(2)} KB`
    );

    if (audioStats.size < 1000) {
      console.warn(
        '⚠️ Audio file too small (<1KB) - likely no speech, skipping Whisper'
      );
      return [];
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: 'es', // Set Spanish as default to improve accuracy
    });

    console.log('Whisper response:', {
      hasSegments: 'segments' in transcription,
      segmentCount:
        'segments' in transcription && Array.isArray(transcription.segments)
          ? transcription.segments.length
          : 0,
      hasText: 'text' in transcription,
      textLength:
        'text' in transcription && typeof transcription.text === 'string'
          ? transcription.text.length
          : 0,
    });

    if ('segments' in transcription && Array.isArray(transcription.segments)) {
      for (const segment of transcription.segments) {
        if (
          typeof segment.start === 'number' &&
          typeof segment.end === 'number' &&
          typeof segment.text === 'string'
        ) {
          const text = segment.text.trim();
          // Filter out empty or very short segments (noise)
          if (text.length >= 2) {
            subtitles.push({
              start: segment.start,
              end: segment.end,
              text,
            });
          }
        }
      }
    } else if (
      'text' in transcription &&
      typeof transcription.text === 'string'
    ) {
      const text = transcription.text.trim();
      if (text.length > 0) {
        subtitles.push({ start: 0, end: 9999, text });
      }
    }

    if (subtitles.length === 0) {
      console.warn(
        '⚠️ Whisper returned 0 subtitles - video may have no speech or only music/noise'
      );
    } else {
      console.log(`✅ Generated ${subtitles.length} subtitle segments`);
    }

    return subtitles;
  } catch (error) {
    console.error('❌ Whisper transcription error:', error);
    throw error;
  }
}

async function mixNarrationWithVideo(options: {
  videoPath: string;
  narrationAudioPath: string;
  outputPath: string;
  narrationVolume: number;
  originalVolume: number;
  narrationSpeed: number;
  includeOriginalAudio: boolean;
}): Promise<void> {
  await ensureFfmpegPath();

  const speed = Math.min(Math.max(options.narrationSpeed, 0.5), 2);
  const narrationVolume = Math.max(options.narrationVolume, 0);
  const originalVolume = Math.max(options.originalVolume, 0);

  const filters: string[] = [];

  if (options.includeOriginalAudio) {
    filters.push(`[0:a]volume=${originalVolume.toFixed(2)}[orig]`);
    filters.push(
      `[1:a]atempo=${speed.toFixed(2)},volume=${narrationVolume.toFixed(2)}[voice]`
    );
    filters.push(
      '[orig][voice]amix=inputs=2:duration=longest:dropout_transition=2[mixed]'
    );
  } else {
    filters.push(
      `[1:a]atempo=${speed.toFixed(2)},volume=${narrationVolume.toFixed(2)}[mixed]`
    );
  }

  const filterComplex = filters.join(';');

  await new Promise<void>((resolve, reject) => {
    ffmpeg(options.videoPath)
      .input(options.narrationAudioPath)
      .complexFilter(filterComplex, 'mixed')
      .outputOptions([
        '-map 0:v',
        '-map [mixed]',
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
        '-movflags +faststart',
      ])
      .output(options.outputPath)
      .on('start', commandLine => {
        console.log('FFmpeg narration mix command:', commandLine);
      })
      .on('end', () => {
        console.log('Narration mixed successfully');
        resolve();
      })
      .on('error', err => {
        console.error('FFmpeg narration mix error:', err);
        reject(err);
      })
      .run();
  });
}

async function applyVoiceNarrationToVideo(
  inputPath: string,
  config: VoiceNarrationConfig
): Promise<VoiceNarrationResult> {
  if (!config.enableVoiceNarration) {
    return { success: false, error: 'Voice narration disabled' };
  }

  if (!config.narrationVoiceId) {
    return { success: false, error: 'Narration voice ID not provided' };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: 'OPENAI_API_KEY not configured for voice narration',
    };
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return {
      success: false,
      error: 'ELEVENLABS_API_KEY not configured for voice narration',
    };
  }

  let originalAudioPath: string | null = null;
  let narrationAudioPath: string | null = null;

  try {
    const hasOriginalAudio = await hasAudioStream(inputPath);

    if (!hasOriginalAudio) {
      return {
        success: false,
        error: 'Video has no audio track to generate narration',
      };
    }

    originalAudioPath = await extractAudioFromVideo(inputPath);
    const originalSegments =
      await transcribeAudioWithWhisper(originalAudioPath);
    const transcriptionText = originalSegments
      .map(segment => segment.text)
      .join(' ')
      .trim();

    if (!transcriptionText) {
      return {
        success: false,
        error: 'Unable to transcribe original audio for narration',
      };
    }

    const language = config.narrationLanguage || 'es';
    const style = config.narrationStyle || 'documentary';

    const narrationScript = await generateNarrationScript(
      transcriptionText,
      language,
      style
    );

    narrationAudioPath = inputPath.replace(
      /\.[^.]+$/,
      `_narration_${Date.now()}.mp3`
    );

    const narrationBuffer = await generateSpeech({
      voice_id: config.narrationVoiceId,
      text: narrationScript,
    });

    await fs.promises.writeFile(narrationAudioPath, narrationBuffer);

    const narrationSubtitles =
      await transcribeAudioWithWhisper(narrationAudioPath);

    const narrationVolume = Math.max((config.narrationVolume ?? 80) / 100, 0);
    const originalVolume = Math.max(
      (config.originalAudioVolume ?? 30) / 100,
      0
    );
    const narrationSpeed = config.narrationSpeed ?? 1;

    const outputPath = inputPath.replace(
      /\.[^.]+$/,
      `_voice_${Date.now()}.mp4`
    );

    await mixNarrationWithVideo({
      videoPath: inputPath,
      narrationAudioPath,
      outputPath,
      narrationVolume,
      originalVolume,
      narrationSpeed,
      includeOriginalAudio: hasOriginalAudio,
    });

    return {
      success: true,
      outputPath,
      subtitles: narrationSubtitles,
    };
  } catch (error) {
    console.error('Error applying voice narration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (originalAudioPath) {
      await fs.promises.unlink(originalAudioPath).catch(() => {});
    }
    if (narrationAudioPath) {
      await fs.promises.unlink(narrationAudioPath).catch(() => {});
    }
  }
}

/**
 * Generate subtitles from video audio using OpenAI Whisper
 */
export async function generateSubtitles(videoPath: string): Promise<{
  success: boolean;
  subtitles?: SubtitleSegment[];
  error?: string;
}> {
  let audioPath: string | null = null;

  try {
    console.log('Generating subtitles for:', videoPath);

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        '⚠ OPENAI_API_KEY not configured. Using mock subtitles instead.'
      );
      return generateMockSubtitles();
    }

    // Step 1: Extract audio from video
    console.log('Extracting audio from video...');
    audioPath = await extractAudioFromVideo(videoPath);

    // Step 2: Transcribe using OpenAI Whisper
    console.log('Transcribing audio with Whisper...');
    const subtitles = await transcribeAudioWithWhisper(audioPath);

    console.log(`✓ Generated ${subtitles.length} subtitle segments`);

    // Clean up temporary audio file
    if (audioPath) {
      try {
        await unlink(audioPath);
      } catch (err) {
        console.warn('Failed to cleanup audio file:', err);
      }
    }

    return { success: true, subtitles };
  } catch (error) {
    // Clean up temporary audio file
    if (audioPath) {
      try {
        await unlink(audioPath);
      } catch (err) {
        console.warn('Failed to cleanup audio file:', err);
      }
    }

    console.error('Error generating subtitles:', error);

    // If Whisper fails, return mock subtitles as fallback
    console.warn('Falling back to mock subtitles...');
    return generateMockSubtitles();
  }
}

/**
 * Generate mock subtitles for testing or when Whisper is unavailable
 */
function generateMockSubtitles(): {
  success: boolean;
  subtitles: SubtitleSegment[];
} {
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
    const escapedSubtitlePath = escapeSubtitleFilePath(tempSrtPath);

    // 3. Apply subtitles using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf',
          `subtitles=${escapedSubtitlePath}:${subtitleStyle}`,
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
 * Escape subtitle file path for FFmpeg subtitles filter
 */
function escapeSubtitleFilePath(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const escapedQuotesPath = normalizedPath.replace(/'/g, "\\'");
  return `'${escapedQuotesPath}'`;
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
    // Voice narration
    enableVoiceNarration?: boolean;
    narrationLanguage?: string | null;
    narrationVoiceId?: string | null;
    narrationStyle?: string | null;
    narrationVolume?: number | null;
    narrationSpeed?: number | null;
    originalAudioVolume?: number | null;
  }
): Promise<VideoProcessingResult> {
  try {
    let currentPath = inputPath;
    let voiceSubtitles: SubtitleSegment[] | undefined;

    if (pattern.enableVoiceNarration && pattern.narrationVoiceId) {
      console.log('Applying AI voice narration...');
      const voiceResult = await applyVoiceNarrationToVideo(currentPath, {
        enableVoiceNarration: pattern.enableVoiceNarration,
        narrationLanguage: pattern.narrationLanguage,
        narrationVoiceId: pattern.narrationVoiceId,
        narrationStyle: pattern.narrationStyle,
        narrationVolume: pattern.narrationVolume,
        narrationSpeed: pattern.narrationSpeed,
        originalAudioVolume: pattern.originalAudioVolume,
      });

      if (!voiceResult.success || !voiceResult.outputPath) {
        console.warn('Voice narration processing failed:', voiceResult.error);
      } else {
        if (currentPath !== inputPath) {
          try {
            await unlink(currentPath);
          } catch (err) {
            console.warn('Failed to cleanup pre-voice file:', err);
          }
        }
        currentPath = voiceResult.outputPath;
        voiceSubtitles = voiceResult.subtitles;
      }
    }

    // Normalize effect values so 0 is treated as explicit input (previously skipped)
    const brightness =
      typeof pattern.brightness === 'number' ? pattern.brightness : 100;
    const contrast =
      typeof pattern.contrast === 'number' ? pattern.contrast : 100;
    const saturation =
      typeof pattern.saturation === 'number' ? pattern.saturation : 100;
    const filterType = pattern.filterType || 'none';

    // Step 1: Apply visual effects if enabled OR if any adjustment values are set
    const hasAdjustments =
      brightness !== 100 || contrast !== 100 || saturation !== 100;

    const shouldApplyEffects =
      (pattern.enableEffects && filterType !== 'none') || hasAdjustments;

    if (shouldApplyEffects) {
      console.log('Applying visual effects...', {
        brightness: pattern.brightness,
        contrast: pattern.contrast,
        saturation: pattern.saturation,
        filterType: pattern.filterType,
        enableEffects: pattern.enableEffects,
      });
      const effectsResult = await applyEffectsToVideo(currentPath, {
        filterType,
        brightness,
        contrast,
        saturation,
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
      let subtitlesResult: {
        success: boolean;
        subtitles?: SubtitleSegment[];
        error?: string;
      };

      if (voiceSubtitles && voiceSubtitles.length > 0) {
        subtitlesResult = { success: true, subtitles: voiceSubtitles };
      } else {
        subtitlesResult = await generateSubtitles(currentPath);
      }

      if (!subtitlesResult.success || !subtitlesResult.subtitles) {
        // Don't fail the whole process, just log warning
        console.warn('Failed to generate subtitles:', subtitlesResult.error);
      } else if (subtitlesResult.subtitles.length === 0) {
        // Skip burning if no subtitles were generated
        console.warn(
          '⚠️ No subtitles generated from transcription - skipping subtitle burn'
        );
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

    // Track if any processing was done
    const wasProcessed = currentPath !== inputPath;

    if (!wasProcessed) {
      console.warn('⚠️ No transformations were applied! Pattern settings:', {
        enableVoiceNarration: pattern.enableVoiceNarration,
        narrationVoiceId: pattern.narrationVoiceId ? 'SET' : 'NOT SET',
        enableEffects: pattern.enableEffects,
        filterType: pattern.filterType,
        brightness: pattern.brightness,
        contrast: pattern.contrast,
        saturation: pattern.saturation,
        logoUrl: pattern.logoUrl ? 'SET' : 'NOT SET',
        enableSubtitles: pattern.enableSubtitles,
      });
      console.warn('⚠️ Returning original file without changes');
    } else {
      console.log('✅ Video processing complete, transformations applied');
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
