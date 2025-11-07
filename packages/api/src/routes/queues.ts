/**
 * @fileoverview Queue Routes
 * Purpose: Get videos organized by queue state
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /me/queues - Get videos organized by state
router.get('/queues', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Fetch all user videos with related data
    const allVideos = await prisma.video.findMany({
      where: { userId },
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
          take: 1, // Latest job only
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Organize by queue
    const queues = {
      drafts: allVideos
        .filter(v => v.status === VideoStatus.DRAFT)
        .map(v => ({
          id: v.id,
          thumbnailUrl: v.thumbnailUrl,
          title: v.title,
          duration: v.duration,
          createdAt: v.createdAt,
        })),

      editing: allVideos
        .filter(
          v =>
            v.status === VideoStatus.EDITING_QUEUED ||
            v.status === VideoStatus.EDITING
        )
        .map(v => ({
          id: v.id,
          thumbnailUrl: v.thumbnailUrl,
          title: v.title,
          progress: v.progress,
          status: v.status,
          job: v.jobs[0]
            ? {
                status: v.jobs[0].status,
                startedAt: v.jobs[0].startedAt,
                log: v.jobs[0].log,
              }
            : null,
        })),

      edited: allVideos
        .filter(v => v.status === VideoStatus.EDITED)
        .map(v => ({
          id: v.id,
          thumbnailUrl: v.thumbnailUrl,
          editedUrl: v.editedUrl,
          title: v.title,
          duration: v.duration,
          design: v.design
            ? {
                name: v.design.name,
                version: v.design.version,
              }
            : null,
          account: v.account
            ? {
                id: v.account.id,
                displayName: v.account.displayName,
              }
            : null,
        })),

      uploading: allVideos
        .filter(
          v =>
            v.status === VideoStatus.UPLOAD_QUEUED ||
            v.status === VideoStatus.UPLOADING
        )
        .map(v => ({
          id: v.id,
          thumbnailUrl: v.thumbnailUrl,
          title: v.title,
          progress: v.progress,
          status: v.status,
          account: v.account
            ? {
                id: v.account.id,
                displayName: v.account.displayName,
              }
            : null,
          job: v.jobs[0]
            ? {
                status: v.jobs[0].status,
                startedAt: v.jobs[0].startedAt,
                log: v.jobs[0].log,
              }
            : null,
        })),

      posted: allVideos
        .filter(v => v.status === VideoStatus.POSTED)
        .map(v => ({
          id: v.id,
          thumbnailUrl: v.thumbnailUrl,
          title: v.title,
          postUrl: v.postUrl,
          account: v.account
            ? {
                id: v.account.id,
                displayName: v.account.displayName,
                avatarUrl: v.account.avatarUrl,
              }
            : null,
          createdAt: v.createdAt,
        })),

      failed: allVideos
        .filter(
          v =>
            v.status === VideoStatus.FAILED_EDIT ||
            v.status === VideoStatus.FAILED_UPLOAD
        )
        .map(v => ({
          id: v.id,
          thumbnailUrl: v.thumbnailUrl,
          title: v.title,
          where: v.status === VideoStatus.FAILED_EDIT ? 'edit' : 'upload',
          reason: v.error,
          job: v.jobs[0]
            ? {
                error: v.jobs[0].error,
                attempts: v.jobs[0].attempts,
              }
            : null,
        })),
    };

    console.log(`[GET /me/queues] User ${userId} queues:`, {
      drafts: queues.drafts.length,
      editing: queues.editing.length,
      edited: queues.edited.length,
      uploading: queues.uploading.length,
      posted: queues.posted.length,
      failed: queues.failed.length,
    });

    res.json(queues);
  } catch (error) {
    console.error('Get queues error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener colas',
    });
  }
});

export default router;
