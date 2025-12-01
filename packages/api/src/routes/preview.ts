/**
 * @fileoverview Video Preview Routes
 * Purpose: Generate preview videos with effects applied
 * Max lines: 200
 */

import { Router, Response } from 'express';
import fs from 'fs';
import { promisify } from 'util';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateVideoPreview } from '../lib/preview-generator';
import { uploadToS3 } from '../lib/storage';

const router = Router();
const unlink = promisify(fs.unlink);

// All routes require authentication
router.use(authenticate);

/**
 * POST /preview/:videoId - Generate preview with effects applied
 * Returns a short preview (5-10 seconds) with BrandPattern effects
 */
router.post('/:videoId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { videoId } = req.params;

    console.log(
      `[POST /preview/${videoId}] Generating preview for user:`,
      userId
    );

    // Fetch video record
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        userId,
      },
      include: {
        account: true,
      },
    });

    if (!video) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Video no encontrado',
      });
      return;
    }

    // Check if video has source URL
    if (!video.srcUrl) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Video no tiene archivo fuente',
      });
      return;
    }

    // Get BrandPattern from connection
    const accountWithPattern = await prisma.tikTokConnection.findUnique({
      where: { id: video.accountId || '' },
      include: { patterns: true },
    });

    // Get the first (or only) brand pattern
    const brandPattern = accountWithPattern?.patterns?.[0];

    if (!brandPattern) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'La cuenta no tiene un patrón de marca configurado',
      });
      return;
    }

    console.log(`[Preview ${videoId}] Generating preview with BrandPattern:`, {
      patternId: brandPattern.id,
      hasLogo: !!brandPattern.logoUrl,
      enableEffects: brandPattern.enableEffects,
      enableSubtitles: brandPattern.enableSubtitles,
      enableVoiceNarration: brandPattern.enable_voice_narration,
    });

    // Generate preview
    const previewResult = await generateVideoPreview(video.srcUrl, {
      logoUrl: brandPattern.logoUrl || undefined,
      logoPosition: brandPattern.logoPosition || undefined,
      logoSize: brandPattern.logoSize || undefined,
      logoOpacity: brandPattern.logoOpacity || undefined,
      enableEffects: brandPattern.enableEffects,
      filterType: brandPattern.filterType || undefined,
      brightness: brandPattern.brightness || undefined,
      contrast: brandPattern.contrast || undefined,
      saturation: brandPattern.saturation || undefined,
      enableSubtitles: brandPattern.enableSubtitles,
      subtitleStyle: brandPattern.subtitleStyle || undefined,
      subtitlePosition: brandPattern.subtitlePosition || undefined,
      subtitleColor: brandPattern.subtitleColor || undefined,
      subtitleBgColor: brandPattern.subtitleBgColor || undefined,
      subtitleFontSize: brandPattern.subtitleFontSize || undefined,
      enableVoiceNarration: brandPattern.enable_voice_narration,
      narrationLanguage: brandPattern.narration_language,
      narrationVoiceId: brandPattern.narration_voice_id,
      narrationStyle: brandPattern.narration_style,
      narrationVolume: brandPattern.narration_volume,
      narrationSpeed: brandPattern.narration_speed,
      originalAudioVolume: brandPattern.original_audio_volume,
    });

    if (!previewResult.success || !previewResult.outputPath) {
      console.error(`[Preview ${videoId}] Failed:`, previewResult.error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: previewResult.error || 'Error al generar preview',
      });
      return;
    }

    console.log(
      `[Preview ${videoId}] Generated successfully:`,
      previewResult.outputPath
    );

    // Upload preview to S3
    const fileStream = fs.createReadStream(previewResult.outputPath);
    const s3Result = await uploadToS3({
      file: fileStream,
      filename: `preview_${videoId}_${Date.now()}.mp4`,
      contentType: 'video/mp4',
      folder: 'temp',
    });

    console.log(`[Preview ${videoId}] Uploaded to S3:`, s3Result.url);

    // Clean up temporary preview file
    try {
      await unlink(previewResult.outputPath);
      console.log(`[Preview ${videoId}] Cleaned up temp file`);
    } catch (err) {
      console.warn(`[Preview ${videoId}] Failed to cleanup:`, err);
    }

    // Return preview URL
    res.status(200).json({
      message: 'Preview generado exitosamente',
      previewUrl: s3Result.url,
      duration: previewResult.duration,
    });
  } catch (error) {
    console.error('Preview generation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al generar preview',
    });
  }
});

export default router;
