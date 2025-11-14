/**
 * @fileoverview Videos Routes - Queue System
 * Purpose: Manage video uploads with edit/upload queue workflow
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { queueEditJob, queueUploadJob } from '../lib/qstash-client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /videos - Create new video in DRAFT state
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { srcUrl, accountId, title, thumbnailUrl, duration } = req.body;

    if (!srcUrl) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'srcUrl is required',
      });
      return;
    }

    const video = await prisma.video.create({
      data: {
        id: createId(),
        userId,
        accountId: accountId || null,
        srcUrl,
        title: title || null,
        thumbnailUrl: thumbnailUrl || null,
        duration: duration || null,
        status: VideoStatus.DRAFT,
      },
    });

    console.log(`[POST /videos] Created video ${video.id} for user ${userId}`);

    res.status(201).json({ video });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear video',
    });
  }
});

// POST /videos/:id/confirm - Move to EDITING_QUEUED and create edit job
router.post('/:id/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify video belongs to user
    const video = await prisma.video.findFirst({
      where: { id, userId },
    });

    if (!video) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Video no encontrado',
      });
      return;
    }

    if (video.status !== VideoStatus.DRAFT) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Video ya está en estado ${video.status}`,
      });
      return;
    }

    // Get design profile if account has one
    let designId = video.designId;
    let editSpecJson = video.editSpecJson;

    if (video.accountId) {
      const account = await prisma.tikTokConnection.findUnique({
        where: { id: video.accountId },
        include: { design: true },
      });

      if (account?.design) {
        designId = account.design.id;
        // Freeze design spec at confirmation time
        editSpecJson = account.design.specJson;
      }
    }

    // Update video to EDITING_QUEUED
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        status: VideoStatus.EDITING_QUEUED,
        designId,
        editSpecJson: editSpecJson as any,
      },
    });

    // Create edit job in database
    const job = await prisma.job.create({
      data: {
        id: createId(),
        videoId: id,
        type: 'edit',
        status: 'queued',
        priority: 5,
      },
    });

    // Queue job in BullMQ
    await queueEditJob(id);

    console.log(
      `[POST /videos/${id}/confirm] Video queued for editing, job: ${job.id}`
    );

    res.status(202).json({ ok: true, video: updatedVideo, job });
  } catch (error) {
    console.error('Confirm video error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al confirmar video',
    });
  }
});

// POST /videos/:id/queue-upload - Move to UPLOAD_QUEUED and create upload job
router.post('/:id/queue-upload', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify video belongs to user and is EDITED
    const video = await prisma.video.findFirst({
      where: { id, userId },
    });

    if (!video) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Video no encontrado',
      });
      return;
    }

    if (video.status !== VideoStatus.EDITED) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Video debe estar en estado EDITED (actual: ${video.status})`,
      });
      return;
    }

    if (!video.editedUrl) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Video no tiene editedUrl',
      });
      return;
    }

    if (!video.accountId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Video debe tener una cuenta asignada',
      });
      return;
    }

    // Update video to UPLOAD_QUEUED
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        status: VideoStatus.UPLOAD_QUEUED,
      },
    });

    // Create upload job in database
    const job = await prisma.job.create({
      data: {
        id: createId(),
        videoId: id,
        type: 'upload',
        status: 'queued',
        priority: 5,
      },
    });

    // Queue job in BullMQ
    await queueUploadJob(id);

    console.log(
      `[POST /videos/${id}/queue-upload] Video queued for upload, job: ${job.id}`
    );

    res.status(202).json({ ok: true, video: updatedVideo, job });
  } catch (error) {
    console.error('Queue upload error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al encolar video para subida',
    });
  }
});

// DELETE /videos/:id - Remove a processed video from history
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const video = await prisma.video.findFirst({
      where: { id, userId },
    });

    if (!video) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Video no encontrado',
      });
      return;
    }

    const deletableStatuses = [
      VideoStatus.EDITED,
      VideoStatus.FAILED_EDIT,
      VideoStatus.FAILED_UPLOAD,
    ];

    if (!deletableStatuses.includes(video.status)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Video en estado ${video.status} no se puede eliminar`,
      });
      return;
    }

    await prisma.video.delete({ where: { id: video.id } });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar video',
    });
  }
});

// GET /videos/:id - Get video details with jobs
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const video = await prisma.video.findFirst({
      where: { id, userId },
      include: {
        account: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        design: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!video) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Video no encontrado',
      });
      return;
    }

    res.json({ video });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener video',
    });
  }
});

// GET /videos - Get user's videos (all or filtered by status)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { status, limit = '50' } = req.query;

    const where: { userId: string; status?: VideoStatus } = { userId };
    if (status && typeof status === 'string') {
      where.status = status as VideoStatus;
    }

    const videos = await prisma.video.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Only latest job
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number.parseInt(limit as string, 10),
    });

    res.json({ videos });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener videos',
    });
  }
});

export default router;
