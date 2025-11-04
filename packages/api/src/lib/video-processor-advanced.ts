/**
 * @fileoverview Advanced Video Processing
 * Purpose: CapCut-style video processing with advanced color grading, effects, and enhancements
 * Max lines: 600
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

const unlink = promisify(fs.unlink);

interface VideoProcessingResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

interface AdvancedProcessingOptions {
  // Color Grading
  enableColorGrading?: boolean;
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
  enableEffects?: boolean;
  filterType?: string; // 'none' | 'vintage' | 'vibrant' | 'cinematic' | 'warm' | 'cool' | 'bw' | 'sepia' | 'dramatic'
  vignette?: number; // 0-100
  sharpen?: number; // 0-100
  blur?: number; // 0-100
  grain?: number; // 0-100

  // Enhancements
  enableStabilization?: boolean;
  enableDenoise?: boolean;
  denoiseStrength?: number; // 0-100

  // Speed
  speedMultiplier?: number; // 0.25-4.0
  enableSmoothSlow?: boolean;

  // Auto Crop
  enableAutoCrop?: boolean;
  targetAspectRatio?: string; // 'original' | '9:16' | '16:9' | '1:1' | '4:5'
  cropPosition?: string; // 'center' | 'top' | 'bottom'

  // Audio
  audioVolume?: number; // 0-200, 100=normal
  audioNormalize?: boolean;

  // Output Quality
  outputQuality?: string; // 'low' | 'medium' | 'high' | 'ultra'
  outputBitrate?: string; // 'auto' | '2M' | '5M' | '10M'
  outputFps?: number; // 24, 30, 60
}

/**
 * Apply advanced processing to video with CapCut-style options
 */
export async function applyAdvancedProcessing(
  inputPath: string,
  options: AdvancedProcessingOptions,
  outputPath?: string
): Promise<VideoProcessingResult> {
  try {
    const finalOutputPath =
      outputPath || inputPath.replace(/(\.[^.]+)$/, '_processed$1');

    // Build comprehensive filter complex
    const filterComplex = buildAdvancedFilterComplex(options);
    const audioFilters = buildAudioFilters(options);

    // Get quality settings
    const qualityOptions = getQualityOptions(options);

    // Execute FFmpeg with all filters
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath);

      // Apply video filters
      if (filterComplex.length > 0) {
        command.complexFilter(filterComplex);
      }

      // Apply audio filters
      if (audioFilters.length > 0) {
        command.audioFilters(audioFilters);
      }

      command
        .outputOptions(qualityOptions)
        .output(finalOutputPath)
        .on('start', commandLine => {
          console.log('FFmpeg advanced processing command:', commandLine);
        })
        .on('progress', progress => {
          if (progress.percent) {
            console.log(
              `Advanced processing: ${Math.round(progress.percent)}% done`
            );
          }
        })
        .on('end', () => {
          console.log('Advanced processing completed');
          resolve();
        })
        .on('error', err => {
          console.error('FFmpeg advanced processing error:', err);
          reject(err);
        })
        .run();
    });

    return { success: true, outputPath: finalOutputPath };
  } catch (error) {
    console.error('Error in advanced processing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build comprehensive filter complex for all visual effects
 */
function buildAdvancedFilterComplex(
  options: AdvancedProcessingOptions
): string[] {
  const filters: string[] = [];
  let currentInput = '[0:v]';

  // 1. Speed adjustment (if not 1.0)
  if (options.speedMultiplier && options.speedMultiplier !== 1.0) {
    const speed = options.speedMultiplier;
    if (options.enableSmoothSlow && speed < 1.0) {
      // Smooth slow motion with frame interpolation
      filters.push(
        `${currentInput}minterpolate='fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1',setpts=${1 / speed}*PTS[v1]`
      );
    } else {
      filters.push(`${currentInput}setpts=${1 / speed}*PTS[v1]`);
    }
    currentInput = '[v1]';
  }

  // 2. Stabilization
  if (options.enableStabilization) {
    filters.push(`${currentInput}deshake=rx=64:ry=64[v2]`);
    currentInput = '[v2]';
  }

  // 3. Denoise
  if (options.enableDenoise) {
    const strength = (options.denoiseStrength || 50) / 100;
    filters.push(
      `${currentInput}hqdn3d=${strength * 4}:${strength * 3}:${strength * 6}:${strength * 4.5}[v3]`
    );
    currentInput = '[v3]';
  }

  // 4. Auto Crop / Aspect Ratio
  if (options.enableAutoCrop && options.targetAspectRatio !== 'original') {
    const cropFilter = buildCropFilter(
      options.targetAspectRatio || '9:16',
      options.cropPosition || 'center'
    );
    if (cropFilter) {
      filters.push(`${currentInput}${cropFilter}[v4]`);
      currentInput = '[v4]';
    }
  }

  // 5. Color Grading (Advanced)
  if (options.enableColorGrading) {
    const colorFilter = buildColorGradingFilter(options);
    if (colorFilter) {
      filters.push(`${currentInput}${colorFilter}[v5]`);
      currentInput = '[v5]';
    }
  }

  // 6. Filter Type (Preset looks)
  if (
    options.enableEffects &&
    options.filterType &&
    options.filterType !== 'none'
  ) {
    const presetFilter = buildPresetFilter(options.filterType);
    if (presetFilter) {
      filters.push(`${currentInput}${presetFilter}[v6]`);
      currentInput = '[v6]';
    }
  }

  // 7. Vignette
  if (options.vignette && options.vignette > 0) {
    const vignetteAmount = options.vignette / 100;
    filters.push(`${currentInput}vignette='PI/${4 - vignetteAmount * 2}'[v7]`);
    currentInput = '[v7]';
  }

  // 8. Sharpen
  if (options.sharpen && options.sharpen > 0) {
    const sharpenAmount = (options.sharpen / 100) * 1.5; // 0-1.5
    filters.push(
      `${currentInput}unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${sharpenAmount}[v8]`
    );
    currentInput = '[v8]';
  }

  // 9. Blur
  if (options.blur && options.blur > 0) {
    const blurAmount = (options.blur / 100) * 10; // 0-10
    filters.push(`${currentInput}boxblur=${blurAmount}:${blurAmount}[v9]`);
    currentInput = '[v9]';
  }

  // 10. Film Grain
  if (options.grain && options.grain > 0) {
    const grainAmount = (options.grain / 100) * 50; // 0-50
    filters.push(`${currentInput}noise=alls=${grainAmount}:allf=t[v10]`);
    currentInput = '[v10]';
  }

  // Final output mapping
  if (currentInput !== '[0:v]') {
    // Filters were applied, map to output
    const lastFilter = filters[filters.length - 1];
    filters[filters.length - 1] = lastFilter.replace(/\[v\d+\]$/, '');
  }

  return filters;
}

/**
 * Build color grading filter
 */
function buildColorGradingFilter(
  options: AdvancedProcessingOptions
): string | null {
  const parts: string[] = [];

  // Brightness, Contrast, Saturation
  const brightness = ((options.brightness || 100) - 100) / 100; // -1 to 1
  const contrast = (options.contrast || 100) / 100; // 0 to 2
  const saturation = (options.saturation || 100) / 100; // 0 to 2
  const exposure = ((options.exposure || 100) - 100) / 50; // -1 to 1

  parts.push(
    `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${1 + exposure}`
  );

  // Hue rotation
  if (options.hue && options.hue !== 0) {
    parts.push(`hue=h=${options.hue}`);
  }

  // Temperature (warm/cool) - use color balance
  if (options.temperature && options.temperature !== 100) {
    const tempShift = (options.temperature - 100) / 100; // -1 to 1
    parts.push(`colorbalance=rs=${tempShift}:gs=0:bs=${-tempShift}`);
  }

  // Tint (green/magenta)
  if (options.tint && options.tint !== 100) {
    const tintShift = (options.tint - 100) / 100; // -1 to 1
    parts.push(`colorbalance=rm=0:gm=${tintShift}:bm=0`);
  }

  // Highlights and Shadows
  if (
    (options.highlights && options.highlights !== 100) ||
    (options.shadows && options.shadows !== 100)
  ) {
    const highlightShift = ((options.highlights || 100) - 100) / 100;
    const shadowShift = ((options.shadows || 100) - 100) / 100;
    parts.push(
      `curves=all='0/${0 + shadowShift * 0.2} 1/${1 + highlightShift * 0.2}'`
    );
  }

  return parts.length > 0 ? parts.join(',') : null;
}

/**
 * Build preset filter (CapCut-style looks)
 */
function buildPresetFilter(filterType: string): string | null {
  switch (filterType) {
    case 'vintage':
      return 'curves=vintage,vignette=PI/4,eq=saturation=0.8';

    case 'vibrant':
      return 'eq=saturation=1.5:contrast=1.1,vibrance=intensity=0.3';

    case 'cinematic':
      return "colorbalance=rs=0.1:gs=-0.05:bs=-0.15,curves=all='0/0 0.5/0.45 1/1',vignette=PI/3";

    case 'warm':
      return 'colorbalance=rs=0.15:gs=0.05:bs=-0.1,eq=contrast=1.05';

    case 'cool':
      return 'colorbalance=rs=-0.1:gs=0:bs=0.15,eq=contrast=1.05';

    case 'bw':
      return "hue=s=0,curves=all='0/0 0.5/0.5 1/1'";

    case 'sepia':
      return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';

    case 'dramatic':
      return "eq=contrast=1.3:saturation=1.2:brightness=-0.05,curves=all='0/0 0.5/0.4 1/1',vignette=PI/3.5";

    default:
      return null;
  }
}

/**
 * Build crop filter for aspect ratio
 */
function buildCropFilter(aspectRatio: string, position: string): string | null {
  const aspectMap: Record<string, string> = {
    '9:16': '(9/16)', // TikTok vertical
    '16:9': '(16/9)', // YouTube horizontal
    '1:1': '1', // Instagram square
    '4:5': '(4/5)', // Instagram portrait
  };

  const aspect = aspectMap[aspectRatio];
  if (!aspect) return null;

  const x = '(iw-ow)/2'; // center by default
  let y = '(ih-oh)/2';

  if (position === 'top') {
    y = '0';
  } else if (position === 'bottom') {
    y = 'ih-oh';
  }

  return `crop='min(iw,ih*${aspect})':'min(ih,iw/${aspect})':${x}:${y}`;
}

/**
 * Build audio filters
 */
function buildAudioFilters(options: AdvancedProcessingOptions): string[] {
  const filters: string[] = [];

  // Volume adjustment
  if (options.audioVolume && options.audioVolume !== 100) {
    const volumeDb = 20 * Math.log10(options.audioVolume / 100);
    filters.push(`volume=${volumeDb}dB`);
  }

  // Normalize audio levels
  if (options.audioNormalize) {
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  }

  // Speed adjustment for audio (if video speed changed)
  if (options.speedMultiplier && options.speedMultiplier !== 1.0) {
    filters.push(`atempo=${options.speedMultiplier}`);
  }

  return filters;
}

/**
 * Get quality output options
 */
function getQualityOptions(options: AdvancedProcessingOptions): string[] {
  const opts: string[] = [];

  // Video codec
  opts.push('-c:v libx264');

  // Quality preset
  const quality = options.outputQuality || 'high';
  switch (quality) {
    case 'ultra':
      opts.push('-preset slow');
      opts.push('-crf 18');
      break;
    case 'high':
      opts.push('-preset medium');
      opts.push('-crf 20');
      break;
    case 'medium':
      opts.push('-preset fast');
      opts.push('-crf 23');
      break;
    case 'low':
      opts.push('-preset faster');
      opts.push('-crf 26');
      break;
  }

  // Bitrate
  if (options.outputBitrate && options.outputBitrate !== 'auto') {
    opts.push(`-b:v ${options.outputBitrate}`);
  }

  // FPS
  if (options.outputFps) {
    opts.push(`-r ${options.outputFps}`);
  }

  // Audio codec
  opts.push('-c:a aac');
  opts.push('-b:a 192k');

  // Streaming optimization
  opts.push('-movflags +faststart');

  // Pixel format for compatibility
  opts.push('-pix_fmt yuv420p');

  return opts;
}

export { AdvancedProcessingOptions, VideoProcessingResult };
