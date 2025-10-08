/**
 * @fileoverview Connections Routes
 * Purpose: Manage TikTok account connections
 * Max lines: 200
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /connections - List user's TikTok connections
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const connections = await prisma.tikTokConnection.findMany({
      where: { userId },
      select: {
        id: true,
        openId: true,
        displayName: true,
        avatarUrl: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ connections });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener conexiones',
    });
  }
});

// POST /connections/:id/set-default - Set default connection
router.post('/:id/set-default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const connectionId = req.params.id;

    // Verify connection belongs to user
    const connection = await prisma.tikTokConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Conexión no encontrada',
      });
      return;
    }

    // Remove default from all user connections
    await prisma.tikTokConnection.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    // Set this connection as default
    await prisma.tikTokConnection.update({
      where: { id: connectionId },
      data: { isDefault: true },
    });

    res.json({ message: 'Conexión establecida como predeterminada' });
  } catch (error) {
    console.error('Set default connection error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al establecer conexión predeterminada',
    });
  }
});

// DELETE /connections/:id - Delete connection
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const connectionId = req.params.id;

    // Verify connection belongs to user
    const connection = await prisma.tikTokConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Conexión no encontrada',
      });
      return;
    }

    // Check if connection is used in pending jobs
    const pendingJobs = await prisma.publishJob.count({
      where: {
        tiktokConnectionId: connectionId,
        state: { in: ['queued', 'processing'] },
      },
    });

    if (pendingJobs > 0) {
      res.status(409).json({
        error: 'Conflict',
        message: `No se puede eliminar: hay ${pendingJobs} publicaciones pendientes`,
      });
      return;
    }

    // Delete connection (cascade will handle jobs)
    await prisma.tikTokConnection.delete({
      where: { id: connectionId },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        userId,
        type: 'connection.deleted',
        detailsJson: {
          connectionId,
          displayName: connection.displayName,
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ message: 'Conexión eliminada exitosamente' });
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar conexión',
    });
  }
});

// POST /connections/mock - Create mock connection (for development)
router.post('/mock', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { displayName } = req.body;

    const mockConnection = await prisma.tikTokConnection.create({
      data: {
        userId,
        openId: `mock_${Date.now()}`,
        displayName: displayName || `Mock Account ${Date.now()}`,
        avatarUrl:
          'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Date.now(),
        scopeGranted: ['video.upload', 'user.info.basic'],
        accessTokenEnc: 'mock_access_token_encrypted',
        refreshTokenEnc: 'mock_refresh_token_encrypted',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isDefault: false,
      },
    });

    res.status(201).json({
      message: 'Conexión mock creada',
      connection: {
        id: mockConnection.id,
        displayName: mockConnection.displayName,
        avatarUrl: mockConnection.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Create mock connection error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear conexión mock',
    });
  }
});

export default router;
