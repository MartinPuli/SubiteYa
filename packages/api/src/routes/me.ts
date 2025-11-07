/**
 * @fileoverview User Queue Routes
 * Purpose: Get user's videos organized by queue status
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /me/queues - Get all user's videos organized by status
router.get('/queues', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Fetch all user's videos with related data
    const allVideos = await prisma.video.findMany({
      where: { userId },
      include: {
        account: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
        design: {
          select: {
            name: true,
            version: true,
          },
        },
        jobs: {
          where: {
            status: { in: ['queued', 'running'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Organize videos by status
    const editing = allVideos
      .filter(v => ['EDITING_QUEUED', 'EDITING'].includes(v.status as string))
      .map(v => ({
        id: v.id,
        thumb: v.thumbnailUrl,
        title: v.title,
        progress: v.progress,
        status: v.status,
        createdAt: v.createdAt,
      }));

    const edited = allVideos
      .filter(v => v.status === 'EDITED')
      .map(v => ({
        id: v.id,
        editedUrl: v.editedUrl,
        thumbnailUrl: v.thumbnailUrl,
        duration: v.duration,
        title: v.title,
        design: v.design
          ? {
              name: v.design.name,
              version: v.design.version,
            }
          : null,
        createdAt: v.createdAt,
      }));

    const uploading = allVideos
      .filter(v => ['UPLOAD_QUEUED', 'UPLOADING'].includes(v.status as string))
      .map(v => ({
        id: v.id,
        title: v.title,
        account: v.account?.displayName,
        progress: v.progress,
        status: v.status,
        createdAt: v.createdAt,
      }));

    const posted = allVideos
      .filter(v => v.status === 'POSTED')
      .map(v => ({
        id: v.id,
        title: v.title,
        postUrl: v.postUrl,
        account: v.account?.displayName,
        createdAt: v.createdAt,
      }));

    const failed = allVideos
      .filter(v =>
        ['FAILED_EDIT', 'FAILED_UPLOAD'].includes(v.status as string)
      )
      .map(v => ({
        id: v.id,
        title: v.title,
        where: v.status === 'FAILED_EDIT' ? 'edit' : 'upload',
        reason: v.error || 'Unknown error',
        createdAt: v.createdAt,
      }));

    const drafts = allVideos
      .filter(v => v.status === 'DRAFT')
      .map(v => ({
        id: v.id,
        srcUrl: v.srcUrl,
        thumbnailUrl: v.thumbnailUrl,
        title: v.title,
        duration: v.duration,
        createdAt: v.createdAt,
      }));

    console.log(
      `[GET /me/queues] User ${userId}: ${editing.length} editing, ${edited.length} edited, ${uploading.length} uploading, ${posted.length} posted, ${failed.length} failed, ${drafts.length} drafts`
    );

    res.json({
      drafts,
      editing,
      edited,
      uploading,
      posted,
      failed,
    });
  } catch (error) {
    console.error('Get queues error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error fetching queues',
    });
  }
});

export default router;
