/**
 * @fileoverview Redis Usage Monitor for Upstash
 * Purpose: Track and alert on Redis command usage to prevent exceeding 500k/month limit
 *
 * Features:
 * - Command counter with persistence
 * - Daily/monthly usage tracking
 * - Alert thresholds (70%, 85%, 95%)
 * - Export metrics for monitoring
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const USAGE_FILE = path.join(process.cwd(), 'redis-usage.json');
const MONTHLY_LIMIT = 500000; // Upstash free tier limit

interface UsageData {
  month: string; // YYYY-MM format
  commandCount: number;
  lastUpdated: string;
  dailyBreakdown: Record<string, number>; // YYYY-MM-DD -> count
  alerts: AlertLog[];
}

interface AlertLog {
  timestamp: string;
  level: 'warning' | 'critical' | 'exceeded';
  usage: number;
  percentage: number;
  message: string;
}

class RedisUsageMonitor {
  private data: UsageData;
  private lastSaveTime: number = 0;
  private saveInterval: number = 60000; // Save every minute

  constructor() {
    this.data = this.getDefaultData();
    this.load();
  }

  private getDefaultData(): UsageData {
    const now = new Date();
    return {
      month: this.formatMonth(now),
      commandCount: 0,
      lastUpdated: now.toISOString(),
      dailyBreakdown: {},
      alerts: [],
    };
  }

  private formatMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private formatDay(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Load usage data from disk
   */
  private async load(): Promise<void> {
    try {
      const content = await fs.readFile(USAGE_FILE, 'utf-8');
      const loaded = JSON.parse(content) as UsageData;

      // Reset if it's a new month
      const currentMonth = this.formatMonth(new Date());
      if (loaded.month !== currentMonth) {
        console.log(`📅 New month detected, resetting Redis usage counter`);
        this.data = this.getDefaultData();
      } else {
        this.data = loaded;
      }
    } catch (error) {
      // File doesn't exist, use defaults
      console.log('📊 Creating new Redis usage tracking file');
      await this.save();
    }
  }

  /**
   * Save usage data to disk
   */
  private async save(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    try {
      await fs.writeFile(USAGE_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save Redis usage data:', error);
    }
  }

  /**
   * Increment command counter
   */
  async increment(count: number = 1): Promise<void> {
    const now = new Date();
    const today = this.formatDay(now);

    this.data.commandCount += count;
    this.data.dailyBreakdown[today] =
      (this.data.dailyBreakdown[today] || 0) + count;

    // Check thresholds and create alerts
    await this.checkThresholds();

    // Save periodically (not every command to avoid I/O overhead)
    const timeSinceLastSave = Date.now() - this.lastSaveTime;
    if (timeSinceLastSave > this.saveInterval) {
      await this.save();
      this.lastSaveTime = Date.now();
    }
  }

  /**
   * Check usage thresholds and create alerts
   */
  private async checkThresholds(): Promise<void> {
    const usage = this.data.commandCount;
    const percentage = (usage / MONTHLY_LIMIT) * 100;

    // Define thresholds
    const thresholds = [
      { level: 'warning' as const, percent: 70 },
      { level: 'critical' as const, percent: 85 },
      { level: 'exceeded' as const, percent: 100 },
    ];

    for (const threshold of thresholds) {
      if (percentage >= threshold.percent) {
        // Check if we already alerted for this threshold
        const alreadyAlerted = this.data.alerts.some(
          alert =>
            alert.level === threshold.level &&
            new Date(alert.timestamp).getMonth() === new Date().getMonth()
        );

        if (!alreadyAlerted) {
          const alert: AlertLog = {
            timestamp: new Date().toISOString(),
            level: threshold.level,
            usage,
            percentage,
            message: this.getAlertMessage(threshold.level, usage, percentage),
          };

          this.data.alerts.push(alert);
          console.error(`🚨 ${alert.message}`);

          // Save immediately for alerts
          await this.save();
        }
      }
    }
  }

  private getAlertMessage(
    level: 'warning' | 'critical' | 'exceeded',
    usage: number,
    percentage: number
  ): string {
    const remaining = MONTHLY_LIMIT - usage;

    switch (level) {
      case 'warning':
        return `WARNING: Redis usage at ${percentage.toFixed(1)}% (${usage.toLocaleString()}/${MONTHLY_LIMIT.toLocaleString()} commands). ${remaining.toLocaleString()} remaining.`;
      case 'critical':
        return `CRITICAL: Redis usage at ${percentage.toFixed(1)}% (${usage.toLocaleString()}/${MONTHLY_LIMIT.toLocaleString()} commands). Only ${remaining.toLocaleString()} commands left!`;
      case 'exceeded':
        return `EXCEEDED: Redis usage limit reached! ${usage.toLocaleString()}/${MONTHLY_LIMIT.toLocaleString()} commands used. Upstash may throttle requests.`;
    }
  }

  /**
   * Get current usage statistics
   */
  getUsage(): {
    month: string;
    total: number;
    limit: number;
    remaining: number;
    percentage: number;
    dailyAverage: number;
    projectedMonthly: number;
    status: 'ok' | 'warning' | 'critical' | 'exceeded';
  } {
    const total = this.data.commandCount;
    const remaining = Math.max(0, MONTHLY_LIMIT - total);
    const percentage = (total / MONTHLY_LIMIT) * 100;

    // Calculate daily average
    const days = Object.keys(this.data.dailyBreakdown).length || 1;
    const dailyAverage = total / days;

    // Project monthly usage based on daily average
    const daysInMonth = 30;
    const projectedMonthly = dailyAverage * daysInMonth;

    let status: 'ok' | 'warning' | 'critical' | 'exceeded' = 'ok';
    if (percentage >= 100) status = 'exceeded';
    else if (percentage >= 85) status = 'critical';
    else if (percentage >= 70) status = 'warning';

    return {
      month: this.data.month,
      total,
      limit: MONTHLY_LIMIT,
      remaining,
      percentage,
      dailyAverage,
      projectedMonthly,
      status,
    };
  }

  /**
   * Get detailed usage breakdown
   */
  getDetailedUsage() {
    return {
      ...this.getUsage(),
      dailyBreakdown: this.data.dailyBreakdown,
      alerts: this.data.alerts,
      lastUpdated: this.data.lastUpdated,
    };
  }

  /**
   * Reset counter (use carefully!)
   */
  async reset(): Promise<void> {
    this.data = this.getDefaultData();
    await this.save();
    console.log('♻️  Redis usage counter reset');
  }

  /**
   * Force save current state
   */
  async flush(): Promise<void> {
    await this.save();
  }
}

// Singleton instance
export const redisMonitor = new RedisUsageMonitor();

// Export helper functions
export async function trackRedisCommand(count: number = 1): Promise<void> {
  await redisMonitor.increment(count);
}

export function getRedisUsage() {
  return redisMonitor.getUsage();
}

export function getDetailedRedisUsage() {
  return redisMonitor.getDetailedUsage();
}

// Log current usage on startup
const usage = redisMonitor.getUsage();
console.log('📊 Redis Usage Monitor initialized');
console.log(`   Month: ${usage.month}`);
console.log(
  `   Usage: ${usage.total.toLocaleString()}/${usage.limit.toLocaleString()} (${usage.percentage.toFixed(1)}%)`
);
console.log(`   Status: ${usage.status.toUpperCase()}`);

if (usage.status !== 'ok') {
  console.warn(
    `⚠️  WARNING: Redis usage is at ${usage.status} level. Consider:
  1. Set ENABLE_REDIS=false to disable workers
  2. Upgrade Upstash to Pro plan ($10/month = 10M commands)
  3. Optimize command usage with caching`
  );
}

// Flush on process exit
process.on('exit', () => {
  redisMonitor.flush();
});

process.on('SIGINT', async () => {
  await redisMonitor.flush();
  process.exit(0);
});
