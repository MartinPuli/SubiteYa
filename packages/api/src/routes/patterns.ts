/**
 * @fileoverview Brand Patterns Routes
 * Purpose: CRUD operations for brand patterns (logos, watermarks, styles per account)
 * Max lines: 300
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

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
    const {
      tiktokConnectionId,
      name,
      logoUrl,
      logoPosition = 'bottom-right',
      logoSize = 15,
      logoOpacity = 100,
      isDefault = false,
    } = req.body;

    // Validate required fields
    if (!tiktokConnectionId || !name) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'tiktokConnectionId y name son requeridos',
      });
      return;
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

    const pattern = await prisma.brandPattern.create({
      data: {
        userId,
        tiktokConnectionId,
        name,
        logoUrl,
        logoPosition,
        logoSize,
        logoOpacity,
        isDefault,
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

    res.status(201).json({ pattern });
  } catch (error) {
    console.error('Create pattern error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear patrón',
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
