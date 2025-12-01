/**
 * @fileoverview Qstash Monitoring Routes
 * Purpose: API endpoints to monitor Qstash queue health and video stats
 */

import { Router, Response, NextFunction } from 'express';
import { getQueueHealth } from '../lib/qstash-client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getRuntimeMetricsSnapshot } from '../lib/metrics';
import { VideoStatus } from '@prisma/client';

const router = Router();

function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== 'admin') {
    req.logger?.warn('Monitor access denied for non-admin user', {
      userId: req.user?.userId,
      role: req.user?.role,
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Solo usuarios administradores pueden acceder a /api/monitor',
    });
    return;
  }

  next();
}

router.use(authenticate, requireAdmin);

/**
 * GET /api/monitor/queue-health
 * Check if Qstash queue system is operational
 */
router.get('/queue-health', async (_req: AuthRequest, res: Response) => {
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
});

/**
 * GET /api/monitor/stats
 * Get queue statistics from database
 */
router.get('/stats', async (_req: AuthRequest, res: Response) => {
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

router.get('/metrics', async (_req: AuthRequest, res: Response) => {
  try {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      videosByStatusRaw,
      jobsByStatusRaw,
      jobsByTypeRaw,
      recentFailures,
      recentVideos,
      accountFailureAgg,
    ] = await Promise.all([
      prisma.video.groupBy({ by: ['status'], _count: true }),
      prisma.job.groupBy({ by: ['status'], _count: true }),
      prisma.job.groupBy({ by: ['type'], _count: true }),
      prisma.video.findMany({
        where: {
          status: {
            in: [VideoStatus.FAILED_EDIT, VideoStatus.FAILED_UPLOAD],
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          error: true,
          updatedAt: true,
          account: {
            select: {
              displayName: true,
            },
          },
        },
      }),
      prisma.video.findMany({
        where: { updatedAt: { gte: sevenDaysAgo } },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.video.groupBy({
        by: ['accountId'],
        where: {
          accountId: { not: null },
          status: {
            in: [VideoStatus.FAILED_EDIT, VideoStatus.FAILED_UPLOAD],
          },
          updatedAt: { gte: sevenDaysAgo },
        },
        _count: true,
      }),
    ]);

    const accountIds = accountFailureAgg
      .map(entry => entry.accountId)
      .filter((id): id is string => Boolean(id));

    const accountDetails = accountIds.length
      ? await prisma.tikTokConnection.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, displayName: true },
        })
      : [];

    const runtimeMetrics = getRuntimeMetricsSnapshot();

    const videosByStatus = videosByStatusRaw.reduce(
      (acc, { status, _count }) => {
        acc[status] = _count;
        return acc;
      },
      {} as Record<string, number>
    );

    const jobsByStatus = jobsByStatusRaw.reduce(
      (acc, { status, _count }) => {
        acc[status] = _count;
        return acc;
      },
      {} as Record<string, number>
    );

    const jobsByType = jobsByTypeRaw.reduce(
      (acc, { type, _count }) => {
        acc[type] = _count;
        return acc;
      },
      {} as Record<string, number>
    );

    const processedStatuses = new Set<VideoStatus>([
      VideoStatus.EDITED,
      VideoStatus.POSTED,
    ]);
    const failedStatuses = new Set<VideoStatus>([
      VideoStatus.FAILED_EDIT,
      VideoStatus.FAILED_UPLOAD,
    ]);

    const processedVideos = recentVideos.filter(video =>
      processedStatuses.has(video.status)
    );

    const processedLast24h = processedVideos.filter(
      video => video.updatedAt >= oneDayAgo
    ).length;

    const failedLast24h = recentVideos.filter(
      video => failedStatuses.has(video.status) && video.updatedAt >= oneDayAgo
    ).length;

    const processingDurations = processedVideos
      .map(video => video.updatedAt.getTime() - video.createdAt.getTime())
      .filter(duration => duration > 0);

    const averageProcessingSeconds = processingDurations.length
      ? processingDurations.reduce((sum, value) => sum + value, 0) /
        processingDurations.length /
        1000
      : null;

    const throughputMap = new Map<
      string,
      { created: number; processed: number; failed: number }
    >();

    for (const video of recentVideos) {
      const dayKey = video.updatedAt.toISOString().slice(0, 10);
      const bucket =
        throughputMap.get(dayKey) ||
        ({ created: 0, processed: 0, failed: 0 } as {
          created: number;
          processed: number;
          failed: number;
        });

      if (processedStatuses.has(video.status)) {
        bucket.processed += 1;
      } else if (failedStatuses.has(video.status)) {
        bucket.failed += 1;
      } else {
        bucket.created += 1;
      }

      throughputMap.set(dayKey, bucket);
    }

    const dailyThroughput = Array.from(throughputMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, stats]) => ({ day, ...stats }));

    const topicCounts = new Map<string, number>();
    for (const video of recentVideos) {
      const topic = extractTopicFromTitle(video.title);
      if (!topic) continue;
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }

    const topicLeaders = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    const accountsWithFailures = accountFailureAgg
      .filter(entry => entry.accountId)
      .sort((a, b) => b._count - a._count)
      .slice(0, 5)
      .map(entry => ({
        accountId: entry.accountId!,
        failures: entry._count,
        displayName:
          accountDetails.find(acc => acc.id === entry.accountId)?.displayName ||
          'Cuenta desconocida',
      }));

    res.json({
      runtime: runtimeMetrics,
      database: {
        videosByStatus,
        jobsByStatus,
        jobsByType,
        processedLast24h,
        failedLast24h,
        averageProcessingSeconds,
        dailyThroughput,
        topicLeaders,
        accountsWithFailures,
        recentFailures: recentFailures.map(failure => ({
          id: failure.id,
          status: failure.status,
          error: failure.error,
          updatedAt: failure.updatedAt,
          account: failure.account?.displayName || 'Cuenta desconocida',
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error building metrics:', error);
    res.status(500).json({
      error: 'Failed to build metrics snapshot',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function extractTopicFromTitle(title?: string | null): string | null {
  if (!title) {
    return null;
  }

  const hashtag = title.match(/#([A-Za-z0-9_]+)/);
  if (hashtag) {
    return hashtag[1].toLowerCase();
  }

  const sanitized = title.replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ# ]+/g, ' ').trim();

  if (!sanitized) {
    return null;
  }

  const words = sanitized.split(/\s+/).slice(0, 3);
  const topic = words.join(' ').toLowerCase();
  return topic || null;
}

export default router;
