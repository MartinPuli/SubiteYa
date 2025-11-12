/**
 * @fileoverview Qstash Monitoring Routes
 * Purpose: API endpoints to monitor Qstash queue health and video stats
 */

import { Router, Request, Response } from 'express';
import { getQueueHealth } from '../lib/qstash-client';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/monitor/queue-health
 * Check if Qstash queue system is operational
 */
router.get(
  '/queue-health',
  authenticate,
  async (_req: Request, res: Response) => {
    try {
      const health = getQueueHealth();
      res.json({
        status: health.enabled ? 'operational' : 'disabled',
        qstash: {
          enabled: health.enabled,
          configured: health.configured,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error checking queue health:', error);
      res.status(500).json({
        error: 'Failed to check queue health',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/monitor/stats
 * Get queue statistics from database
 */
router.get('/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await prisma.video.groupBy({
      by: ['status'],
      _count: true,
    });

    const statusCounts = stats.reduce(
      (acc, { status, _count }) => {
        acc[status] = _count;
        return acc;
      },
      {} as Record<string, number>
    );

    const recentVideos = await prisma.video.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      videosByStatus: statusCounts,
      recentActivity: recentVideos,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
