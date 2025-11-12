/**
 * @fileoverview Redis Monitoring Routes
 * Purpose: API endpoints to monitor Redis/Upstash usage
 */

import { Router, Request, Response } from 'express';
import {
  getRedisUsage,
  getDetailedRedisUsage,
  redisMonitor,
} from '../lib/redis-monitor';
import { checkQueueHealth, getCommandCount } from '../lib/queues-optimized';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/monitor/redis-usage
 * Get current Redis usage statistics
 */
router.get(
  '/redis-usage',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const usage = getRedisUsage();
      res.json(usage);
    } catch (error) {
      console.error('Error getting Redis usage:', error);
      res.status(500).json({
        error: 'Failed to get Redis usage',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/monitor/redis-detailed
 * Get detailed Redis usage with daily breakdown and alerts
 */
router.get(
  '/redis-detailed',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const detailed = getDetailedRedisUsage();
      res.json(detailed);
    } catch (error) {
      console.error('Error getting detailed Redis usage:', error);
      res.status(500).json({
        error: 'Failed to get detailed Redis usage',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/monitor/queue-health
 * Check if Redis and queues are operational
 */
router.get(
  '/queue-health',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const health = await checkQueueHealth();
      const usage = getRedisUsage();

      res.json({
        ...health,
        usage: {
          total: usage.total,
          percentage: usage.percentage,
          status: usage.status,
        },
        recommendations: getRecommendations(usage),
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
 * POST /api/monitor/flush-usage
 * Force save current usage data (admin only)
 */
router.post(
  '/flush-usage',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      // Only allow admins
      const user = (req as any).user;
      if (user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      await redisMonitor.flush();
      res.json({ message: 'Usage data saved successfully' });
    } catch (error) {
      console.error('Error flushing usage data:', error);
      res.status(500).json({
        error: 'Failed to flush usage data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/monitor/reset-usage
 * Reset usage counter (admin only, use with extreme caution)
 */
router.post(
  '/reset-usage',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      // Only allow admins
      const user = (req as any).user;
      if (user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      await redisMonitor.reset();
      res.json({ message: 'Usage counter reset successfully' });
    } catch (error) {
      console.error('Error resetting usage:', error);
      res.status(500).json({
        error: 'Failed to reset usage',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Generate recommendations based on usage
 */
function getRecommendations(usage: ReturnType<typeof getRedisUsage>): string[] {
  const recommendations: string[] = [];

  if (usage.percentage >= 100) {
    recommendations.push(
      'URGENT: Redis limit exceeded. Set ENABLE_REDIS=false immediately to stop workers.'
    );
    recommendations.push(
      'Upgrade to Upstash Pro ($10/month) for 10M commands/month.'
    );
  } else if (usage.percentage >= 85) {
    recommendations.push(
      'CRITICAL: Approaching Redis limit. Consider disabling workers or upgrading plan.'
    );
    recommendations.push('Monitor daily usage closely.');
  } else if (usage.percentage >= 70) {
    recommendations.push(
      'WARNING: Redis usage is high. Review worker configuration.'
    );
    recommendations.push(
      'Consider implementing longer polling intervals or event-driven architecture.'
    );
  } else if (usage.projectedMonthly > usage.limit * 0.9) {
    recommendations.push(
      `Projected monthly usage (${usage.projectedMonthly.toLocaleString()}) may exceed limit.`
    );
    recommendations.push('Monitor trends and optimize if needed.');
  } else {
    recommendations.push('Usage is within normal range.');
    recommendations.push(
      `Daily average: ${usage.dailyAverage.toFixed(0)} commands.`
    );
  }

  return recommendations;
}

export default router;
