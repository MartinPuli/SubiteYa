/**
 * @fileoverview BullMQ Queue Configuration
 * Purpose: Define Redis-backed queues for video processing
 */

import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

// Redis connection with better error handling
const redisConnection = new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(
        `🔄 Redis reconnecting... attempt ${times}, delay ${delay}ms`
      );
      return delay;
    },
  }
);

// Redis event handlers
redisConnection.on('connect', () => {
  console.log('✅ Connected to Redis successfully');
});

redisConnection.on('error', err => {
  console.error('❌ Redis connection error:', err.message);
});

redisConnection.on('close', () => {
  console.warn('⚠️  Redis connection closed');
});

redisConnection.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5s, then 10s, 20s
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 100, // Keep max 100 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

// Edit queue - processes video editing jobs
export const editQueue = new Queue('video-edit', queueOptions);

// Upload queue - processes TikTok upload jobs
export const uploadQueue = new Queue('video-upload', queueOptions);

// Priority levels
export const PRIORITY = {
  CRITICAL: 1,
  HIGH: 3,
  NORMAL: 5,
  LOW: 7,
  VERY_LOW: 9,
} as const;

/**
 * Add a video to the edit queue
 */
export async function queueEditJob(
  videoId: string,
  priority: number = PRIORITY.NORMAL
) {
  const job = await editQueue.add(
    'edit-video',
    { videoId },
    {
      priority,
      jobId: `edit-${videoId}`, // Idempotent - won't duplicate if job exists
    }
  );

  console.log(`[Queue] Added edit job ${job.id} for video ${videoId}`);
  return job;
}

/**
 * Add a video to the upload queue
 */
export async function queueUploadJob(
  videoId: string,
  priority: number = PRIORITY.NORMAL
) {
  const job = await uploadQueue.add(
    'upload-video',
    { videoId },
    {
      priority,
      jobId: `upload-${videoId}`, // Idempotent
    }
  );

  console.log(`[Queue] Added upload job ${job.id} for video ${videoId}`);
  return job;
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  const [editCounts, uploadCounts] = await Promise.all([
    editQueue.getJobCounts(),
    uploadQueue.getJobCounts(),
  ]);

  return {
    edit: editCounts,
    upload: uploadCounts,
  };
}

/**
 * Pause all queues (for maintenance)
 */
export async function pauseQueues() {
  await Promise.all([editQueue.pause(), uploadQueue.pause()]);
  console.log('[Queue] All queues paused');
}

/**
 * Resume all queues
 */
export async function resumeQueues() {
  await Promise.all([editQueue.resume(), uploadQueue.resume()]);
  console.log('[Queue] All queues resumed');
}

/**
 * Gracefully close all queue connections
 */
export async function closeQueues() {
  await Promise.all([
    editQueue.close(),
    uploadQueue.close(),
    redisConnection.quit(),
  ]);
  console.log('[Queue] All queues closed');
}
