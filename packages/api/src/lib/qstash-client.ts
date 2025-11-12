/**
 * @fileoverview Upstash Qstash Client
 * Purpose: HTTP-based job queue (replacement for BullMQ/Redis)
 *
 * Benefits:
 * - No Redis connection (HTTP-based)
 * - No command limits (pay per request)
 * - Automatic retries with exponential backoff
 * - Delivery guarantees
 * - Simple webhook-based architecture
 */

import { Client } from '@upstash/qstash';

// Initialize Qstash client
const qstashToken = process.env.QSTASH_TOKEN;
const editWorkerUrl = process.env.EDIT_WORKER_URL;
const uploadWorkerUrl = process.env.UPLOAD_WORKER_URL;

let qstashClient: Client | null = null;

// Only initialize if token is available
if (qstashToken) {
  qstashClient = new Client({ token: qstashToken });
  console.log('✅ Qstash client initialized');
  console.log(`   Edit Worker: ${editWorkerUrl || 'NOT SET'}`);
  console.log(`   Upload Worker: ${uploadWorkerUrl || 'NOT SET'}`);
} else {
  console.warn('⚠️  QSTASH_TOKEN not set - queue system disabled');
}

export const QSTASH_ENABLED = !!qstashClient;

/**
 * Queue a video for editing
 * Sends HTTP POST to Edit Worker /process endpoint
 */
export async function queueEditJob(
  videoId: string,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<boolean> {
  if (!qstashClient || !editWorkerUrl) {
    console.warn(
      '[Qstash] Client not configured or EDIT_WORKER_URL not set, skipping job queue'
    );
    return false;
  }

  try {
    const delay = priority === 'high' ? 0 : priority === 'normal' ? 5 : 30;

    await qstashClient.publishJSON({
      url: `${editWorkerUrl}/process`,
      body: {
        videoId,
        priority,
        timestamp: Date.now(),
      },
      delay, // Seconds to wait before delivery
      retries: 3, // Retry up to 3 times on failure
    });

    console.log(
      `[Qstash] ✅ Queued edit job for video ${videoId} → ${editWorkerUrl}`
    );
    return true;
  } catch (error) {
    console.error('[Qstash] Failed to queue edit job:', error);
    return false;
  }
}

/**
 * Queue a video for TikTok upload
 * Sends HTTP POST to Upload Worker /process endpoint
 */
export async function queueUploadJob(
  videoId: string,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<boolean> {
  if (!qstashClient || !uploadWorkerUrl) {
    console.warn(
      '[Qstash] Client not configured or UPLOAD_WORKER_URL not set, skipping job queue'
    );
    return false;
  }

  try {
    const delay = priority === 'high' ? 0 : priority === 'normal' ? 10 : 60;

    await qstashClient.publishJSON({
      url: `${uploadWorkerUrl}/process`,
      body: {
        videoId,
        priority,
        timestamp: Date.now(),
      },
      delay, // Seconds to wait before delivery
      retries: 3, // Retry up to 3 times on failure
    });

    console.log(
      `[Qstash] ✅ Queued upload job for video ${videoId} → ${uploadWorkerUrl}`
    );
    return true;
  } catch (error) {
    console.error('[Qstash] Failed to queue upload job:', error);
    return false;
  }
}

/**
 * Schedule a job for future execution
 */
export async function scheduleJob(
  endpoint: 'edit' | 'upload',
  videoId: string,
  delaySeconds: number
): Promise<boolean> {
  if (!qstashClient) {
    console.warn('[Qstash] Client not configured, skipping job schedule');
    return false;
  }

  const targetUrl = endpoint === 'edit' ? editWorkerUrl : uploadWorkerUrl;
  if (!targetUrl) {
    console.warn(
      `[Qstash] ${endpoint.toUpperCase()}_WORKER_URL not set, skipping job schedule`
    );
    return false;
  }

  try {
    await qstashClient.publishJSON({
      url: `${targetUrl}/process`,
      body: {
        videoId,
        scheduled: true,
        timestamp: Date.now(),
      },
      delay: delaySeconds,
      retries: 3,
    });

    console.log(
      `[Qstash] ✅ Scheduled ${endpoint} job for video ${videoId} (delay: ${delaySeconds}s) → ${targetUrl}`
    );
    return true;
  } catch (error) {
    console.error('[Qstash] Failed to schedule job:', error);
    return false;
  }
}

/**
 * Get queue health status
 */
export function getQueueHealth(): {
  enabled: boolean;
  configured: boolean;
} {
  return {
    enabled: QSTASH_ENABLED,
    configured: !!(qstashToken && editWorkerUrl && uploadWorkerUrl),
  };
}

/**
 * No-op function for backward compatibility
 * Qstash doesn't require explicit queue closure
 */
export async function closeQueues(): Promise<void> {
  console.log('[Qstash] No cleanup needed (HTTP-based)');
}

/**
 * Priority levels (for API compatibility)
 */
export const PRIORITY = {
  CRITICAL: 'high' as const,
  HIGH: 'high' as const,
  NORMAL: 'normal' as const,
  LOW: 'low' as const,
  VERY_LOW: 'low' as const,
};
