/**
 * @fileoverview Brand Patterns Routes
 * Purpose: CRUD operations for brand patterns (logos, watermarks, styles per account)
 * Max lines: 350
 */

import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Configure multer for logo upload (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max (reducido para evitar saturación)
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes PNG, JPG o WebP'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// POST /patterns/upload-logo - Upload logo (returns compressed data URL for MVP)
router.post(
  '/upload-logo',
  upload.single('logo'),
  async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Archivo de logo requerido',
        });
        return;
      }

      console.log(
        `[Logo Upload] Original size: ${(file.size / 1024).toFixed(2)}KB, type: ${file.mimetype}`
      );

      // Compress image if it's too large
      const imageBuffer = file.buffer;
      const finalMimeType = file.mimetype;

      // If image is over 500KB, we should compress it
      if (file.size > 500 * 1024) {
        console.log('[Logo Upload] Image too large, compressing...');

        // For now, just warn and use original
        // TODO: Add sharp library for compression
        console.warn(
          '[Logo Upload] Warning: Image over 500KB. Consider adding image compression with sharp library.'
        );
      }

      // Convert to data URL (base64)
      const dataUrl = `data:${finalMimeType};base64,${imageBuffer.toString('base64')}`;
      const finalSize = dataUrl.length;

      console.log(
        `[Logo Upload] Final base64 size: ${(finalSize / 1024).toFixed(2)}KB`
      );

      // Warn if final base64 is very large (>1MB in base64)
      if (finalSize > 1024 * 1024) {
        console.warn(
          '[Logo Upload] Warning: Base64 data URL is over 1MB. This may cause performance issues.'
        );
      }

      res.json({
        logoUrl: dataUrl,
        originalName: file.originalname,
        size: file.size,
      });
    } catch (error) {
      console.error('[Logo Upload] Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error al subir logo',
      });
    }
  }
);

// GET /patterns - Get all patterns for user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { connectionId } = req.query;

    interface WhereClause {
      userId: string;
      tiktokConnectionId?: string;
    }

    const whereClause: WhereClause = { userId };

    if (connectionId && typeof connectionId === 'string') {
      whereClause.tiktokConnectionId = connectionId;
    }

    const patterns = await prisma.brandPattern.findMany({
      where: whereClause,
      include: {
        tiktokConnection: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    res.json({ patterns });
  } catch (error) {
    console.error('Get patterns error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener patrones',
    });
  }
});

// GET /patterns/:id - Get specific pattern
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const patternId = req.params.id;

    const pattern = await prisma.brandPattern.findFirst({
      where: { id: patternId, userId },
      include: {
        tiktokConnection: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!pattern) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Patrón no encontrado',
      });
      return;
    }

    res.json({ pattern });
  } catch (error) {
    console.error('Get pattern error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener patrón',
    });
  }
});

// POST /patterns - Create new pattern
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    console.log('[Create Pattern] Request body keys:', Object.keys(req.body));
    console.log('[Create Pattern] User ID:', userId);

    const {
      tiktokConnectionId,
      name,
      logoUrl,
      logoPosition = 'bottom-right',
      logoSize = 15,
      logoOpacity = 100,
      thumbnailUrl,
      isDefault = false,
      // Visual Effects
      enableEffects = false,
      filterType = 'none',
      brightness = 100,
      contrast = 100,
      saturation = 100,
      // Subtitles
      enableSubtitles = false,
      subtitleStyle = 'modern',
      subtitlePosition = 'bottom',
      subtitleColor = '#FFFFFF',
      subtitleBgColor = '#000000',
      subtitleFontSize = 24,
      subtitleAnimation = 'none',
      subtitleFontFamily = 'Arial',
      // Crop
      enableAutoCrop = false,
      aspectRatio = 'original',
      cropPosition = 'center',
      // Color Grading
      enableColorGrading = false,
      temperature = 0,
      tint = 0,
      hue = 0,
      exposure = 0,
      highlights = 0,
      shadows = 0,
      // Effects Extra
      vignette = 0,
      sharpen = 0,
      blur = 0,
      grain = 0,
      // Speed & Motion
      speedMultiplier = 1,
      enableSmoothSlowMotion = false,
      enableStabilization = false,
      enableDenoise = false,
      denoiseStrength = 0.5,
      // Audio
      audioVolume = 100,
      audioNormalize = false,
      enableBackgroundMusic = false,
      backgroundMusicVolume = 50,
      // Quality
      outputQuality = 'medium',
      outputBitrate = '2000k',
      outputFps = 30,
      // Transitions
      transitionType = 'none',
    } = req.body;

    // Validate required fields
    if (!tiktokConnectionId || !name) {
      console.log('[Create Pattern] Missing required fields:', {
        tiktokConnectionId,
        name,
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'tiktokConnectionId y name son requeridos',
      });
      return;
    }

    // Log payload sizes
    if (logoUrl) {
      console.log(
        `[Create Pattern] Logo URL size: ${(logoUrl.length / 1024).toFixed(2)}KB`
      );
    }
    if (thumbnailUrl) {
      console.log(
        `[Create Pattern] Thumbnail URL size: ${(thumbnailUrl.length / 1024).toFixed(2)}KB`
      );
    }

    // Verify connection belongs to user
    const connection = await prisma.tikTokConnection.findFirst({
      where: { id: tiktokConnectionId, userId },
    });

    if (!connection) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Conexión no encontrada',
      });
      return;
    }

    // If setting as default, unset other defaults for this connection
    if (isDefault) {
      await prisma.brandPattern.updateMany({
        where: {
          userId,
          tiktokConnectionId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    console.log('[Create Pattern] Creating pattern with data...');

    const pattern = await prisma.brandPattern.create({
      data: {
        userId,
        tiktokConnectionId,
        name,
        logoUrl,
        logoPosition,
        logoSize,
        logoOpacity,
        thumbnailUrl,
        isDefault,
        // Color Grading
        enableColorGrading,
        brightness,
        contrast,
        saturation,
        temperature,
        tint,
        hue,
        exposure,
        highlights,
        shadows,
        // Visual Effects
        enableEffects,
        filterType,
        vignette,
        sharpen,
        blur,
        grain,
        // Speed & Motion
        speedMultiplier,
        enableSmoothSlow: enableSmoothSlowMotion,
        enableStabilization,
        enableDenoise,
        denoiseStrength: Math.round(denoiseStrength * 100), // Convert 0-1 to 0-100
        // Auto Crop
        enableAutoCrop,
        targetAspectRatio: aspectRatio,
        cropPosition,
        // Subtitles
        enableSubtitles,
        subtitleStyle,
        subtitlePosition,
        subtitleColor,
        subtitleBgColor,
        subtitleFontSize,
        subtitleFontFamily,
        subtitleAnimation,
        // Audio
        enableAudioEnhance: audioNormalize || enableBackgroundMusic,
        audioNormalize,
        audioVolume,
        enableBgMusic: enableBackgroundMusic,
        bgMusicVolume: backgroundMusicVolume,
        // Quality
        outputQuality,
        outputBitrate,
        outputFps,
        // Transitions
        transitionType,
      },
      include: {
        tiktokConnection: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    console.log('[Create Pattern] Pattern created successfully:', pattern.id);
    res.status(201).json({ pattern });
  } catch (error) {
    console.error('[Create Pattern] Error:', error);

    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error('[Create Pattern] Error message:', error.message);
      console.error('[Create Pattern] Error stack:', error.stack);
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear patrón',
      details:
        process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
});

// PATCH /patterns/:id - Update pattern
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const patternId = req.params.id;
    const {
      name,
      logoUrl,
      logoPosition,
      logoSize,
      logoOpacity,
      thumbnailUrl,
      isDefault,
      // Visual Effects
      enableEffects,
      filterType,
      brightness,
      contrast,
      saturation,
      // Subtitles
      enableSubtitles,
      subtitleStyle,
      subtitlePosition,
      subtitleColor,
      subtitleBgColor,
      subtitleFontSize,
    } = req.body;

    // Find pattern
    const existingPattern = await prisma.brandPattern.findFirst({
      where: { id: patternId, userId },
    });

    if (!existingPattern) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Patrón no encontrado',
      });
      return;
    }

    // If setting as default, unset other defaults for this connection
    if (isDefault === true) {
      await prisma.brandPattern.updateMany({
        where: {
          userId,
          tiktokConnectionId: existingPattern.tiktokConnectionId,
          isDefault: true,
          id: { not: patternId },
        },
        data: { isDefault: false },
      });
    }

    // Update pattern
    const pattern = await prisma.brandPattern.update({
      where: { id: patternId },
      data: {
        ...(name !== undefined && { name }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(logoPosition !== undefined && { logoPosition }),
        ...(logoSize !== undefined && { logoSize }),
        ...(logoOpacity !== undefined && { logoOpacity }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(isDefault !== undefined && { isDefault }),
        // Visual Effects
        ...(enableEffects !== undefined && { enableEffects }),
        ...(filterType !== undefined && { filterType }),
        ...(brightness !== undefined && { brightness }),
        ...(contrast !== undefined && { contrast }),
        ...(saturation !== undefined && { saturation }),
        // Subtitles
        ...(enableSubtitles !== undefined && { enableSubtitles }),
        ...(subtitleStyle !== undefined && { subtitleStyle }),
        ...(subtitlePosition !== undefined && { subtitlePosition }),
        ...(subtitleColor !== undefined && { subtitleColor }),
        ...(subtitleBgColor !== undefined && { subtitleBgColor }),
        ...(subtitleFontSize !== undefined && { subtitleFontSize }),
        version: { increment: 1 },
      },
      include: {
        tiktokConnection: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json({ pattern });
  } catch (error) {
    console.error('Update pattern error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar patrón',
    });
  }
});

// DELETE /patterns/:id - Delete pattern
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const patternId = req.params.id;

    const pattern = await prisma.brandPattern.findFirst({
      where: { id: patternId, userId },
    });

    if (!pattern) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Patrón no encontrado',
      });
      return;
    }

    await prisma.brandPattern.delete({
      where: { id: patternId },
    });

    res.json({ message: 'Patrón eliminado' });
  } catch (error) {
    console.error('Delete pattern error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar patrón',
    });
  }
});

export default router;
