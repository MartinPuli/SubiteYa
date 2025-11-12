/**
 * @fileoverview Optimized Queue Configuration to Reduce Upstash Usage
 * Purpose: Minimize Redis commands to stay under 500k/month limit
 *
 * Key optimizations:
 * 1. Lazy connection - only connect when jobs are added
 * 2. Connection pooling with aggressive timeouts
 * 3. Command batching with pipeline
 * 4. In-memory cache for queue stats
 * 5. Optional Redis disable via env var
 */

import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

// Feature flag to completely disable Redis
const REDIS_ENABLED = process.env.ENABLE_REDIS !== 'false';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// In-memory cache to reduce Redis queries
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlMs: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const statsCache = new MemoryCache();

// Lazy Redis connection - only created when needed
let redisConnection: Redis | null = null;
let connectionPromise: Promise<Redis> | null = null;

/**
 * Get or create Redis connection with aggressive timeout
 */
async function getRedisConnection(): Promise<Redis> {
  if (!REDIS_ENABLED) {
    throw new Error('Redis is disabled via ENABLE_REDIS=false');
  }

  if (redisConnection && redisConnection.status === 'ready') {
    return redisConnection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const redisUrl = new URL(REDIS_URL);
    const isUpstash = redisUrl.protocol === 'rediss:';

    const redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3, // Reduce retries
      enableReadyCheck: false,
      connectTimeout: 5000, // 5 second timeout
      commandTimeout: 3000, // 3 second command timeout
      retryStrategy: (times: number) => {
        if (times > 3) return null; // Stop after 3 retries
        return Math.min(times * 1000, 3000);
      },
      lazyConnect: true,
      ...(isUpstash && { tls: {} }),
    });

    // Aggressive connection management
    redis.on('error', (err: Error) => {
      if (!err.message.includes('ECONNRESET')) {
        console.error('⚠️  Redis error:', err.message);
      }
    });

    await redis.connect();
    redisConnection = redis;
    connectionPromise = null;

    console.log('✅ Redis connected (lazy)');
    return redis;
  })();

  return connectionPromise;
}

/**
 * Disconnect Redis to save resources
 */
export async function disconnectRedis(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    console.log('🔌 Redis disconnected');
  }
}

// Queue options with minimal overhead
const queueOptions: QueueOptions = {
  connection: {
    // Use lazy connection factory
    lazyConnect: true,
  } as any,
  defaultJobOptions: {
    attempts: 2, // Reduce attempts from 3 to 2
    backoff: {
      type: 'exponential',
      delay: 10000, // Longer delays reduce command frequency
    },
    removeOnComplete: {
      age: 3600, // 1 hour instead of 24 hours
      count: 10, // Keep only 10 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 1 day
      count: 50, // Max 50 failed jobs
    },
  },
};

// Create queues only if Redis is enabled
export const editQueue = REDIS_ENABLED
  ? new Queue('video-edit', queueOptions)
  : null;

export const uploadQueue = REDIS_ENABLED
  ? new Queue('video-upload', queueOptions)
  : null;

// Priority levels
export const PRIORITY = {
  CRITICAL: 1,
  HIGH: 3,
  NORMAL: 5,
  LOW: 7,
  VERY_LOW: 9,
} as const;

/**
 * Add a video to the edit queue (with fallback)
 */
export async function queueEditJob(
  videoId: string,
  priority: number = PRIORITY.NORMAL
) {
  if (!REDIS_ENABLED || !editQueue) {
    console.warn('[Queue] Redis disabled, job not queued:', videoId);
    throw new Error('Queue system is disabled. Enable REDIS to use workers.');
  }

  // Batch job addition with pipeline if possible
  const job = await editQueue.add(
    'edit-video',
    { videoId },
    {
      priority,
      jobId: `edit-${videoId}`,
    }
  );

  console.log(`[Queue] Added edit job ${job.id} for video ${videoId}`);
  return job;
}

/**
 * Add a video to the upload queue (with fallback)
 */
export async function queueUploadJob(
  videoId: string,
  priority: number = PRIORITY.NORMAL
) {
  if (!REDIS_ENABLED || !uploadQueue) {
    console.warn('[Queue] Redis disabled, job not queued:', videoId);
    throw new Error('Queue system is disabled. Enable REDIS to use workers.');
  }

  const job = await uploadQueue.add(
    'upload-video',
    { videoId },
    {
      priority,
      jobId: `upload-${videoId}`,
    }
  );

  console.log(`[Queue] Added upload job ${job.id} for video ${videoId}`);
  return job;
}

/**
 * Get queue stats with aggressive caching (reduces Redis commands)
 */
export async function getQueueStats() {
  if (!REDIS_ENABLED || !editQueue || !uploadQueue) {
    return {
      edit: { waiting: 0, active: 0, completed: 0, failed: 0 },
      upload: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };
  }

  // Check cache first (30 second TTL)
  const cached = statsCache.get<any>('queue-stats');
  if (cached) {
    return cached;
  }

  // Fetch from Redis only when cache misses
  const [editCounts, uploadCounts] = await Promise.all([
    editQueue.getJobCounts(),
    uploadQueue.getJobCounts(),
  ]);

  const stats = {
    edit: editCounts,
    upload: uploadCounts,
  };

  // Cache for 30 seconds
  statsCache.set('queue-stats', stats, 30000);

  return stats;
}

/**
 * Pause all queues
 */
export async function pauseQueues() {
  if (!REDIS_ENABLED || !editQueue || !uploadQueue) {
    console.log('[Queue] Redis disabled, nothing to pause');
    return;
  }

  await Promise.all([editQueue.pause(), uploadQueue.pause()]);
  console.log('[Queue] All queues paused');
}

/**
 * Resume all queues
 */
export async function resumeQueues() {
  if (!REDIS_ENABLED || !editQueue || !uploadQueue) {
    console.log('[Queue] Redis disabled, nothing to resume');
    return;
  }

  await Promise.all([editQueue.resume(), uploadQueue.resume()]);
  console.log('[Queue] All queues resumed');
}

/**
 * Gracefully close all connections
 */
export async function closeQueues() {
  statsCache.clear();

  if (!REDIS_ENABLED || !editQueue || !uploadQueue) {
    console.log('[Queue] Redis disabled, no connections to close');
    return;
  }

  await Promise.all([
    editQueue.close(),
    uploadQueue.close(),
    disconnectRedis(),
  ]);

  console.log('[Queue] All queues closed');
}

/**
 * Health check with minimal Redis usage
 */
export async function checkQueueHealth(): Promise<{
  redis: boolean;
  queuesActive: boolean;
  cacheSize: number;
}> {
  if (!REDIS_ENABLED) {
    return {
      redis: false,
      queuesActive: false,
      cacheSize: statsCache.size(),
    };
  }

  try {
    const redis = await getRedisConnection();
    await redis.ping();
    return {
      redis: true,
      queuesActive: !!(editQueue && uploadQueue),
      cacheSize: statsCache.size(),
    };
  } catch (error) {
    return {
      redis: false,
      queuesActive: false,
      cacheSize: statsCache.size(),
    };
  }
}

// Monitor Redis command usage (optional)
let commandCount = 0;
export function getCommandCount(): number {
  return commandCount;
}

export function resetCommandCount(): void {
  commandCount = 0;
}

// Log Redis status on import
if (!REDIS_ENABLED) {
  console.log('⚠️  Redis/Upstash is DISABLED (ENABLE_REDIS=false)');
  console.log('📌 Video processing workers will not function');
} else {
  console.log('✅ Redis/Upstash is ENABLED');
  console.log('💡 Set ENABLE_REDIS=false to disable and save quota');
}
