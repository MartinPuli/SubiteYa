/**
 * @fileoverview Video Processing Queue
 * Purpose: Sequential video processing queue to handle multiple uploads
 */

import { EventEmitter } from 'events';

export interface VideoJob {
  id: string;
  userId: string;
  connectionId: string;
  videoPath: string;
  displayName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
  createdAt: Date;
}

export interface VideoJobOptions {
  userId: string;
  connectionId: string;
  videoPath: string;
  displayName: string;
}

type ProcessFunction = (job: VideoJob) => Promise<void>;

class VideoQueue extends EventEmitter {
  private queue: VideoJob[] = [];
  private processing = false;
  private processFunction: ProcessFunction | null = null;

  constructor() {
    super();
  }

  /**
   * Set the function that will process each job
   */
  setProcessor(fn: ProcessFunction) {
    this.processFunction = fn;
  }

  /**
   * Add a new job to the queue
   */
  addJob(options: VideoJobOptions): VideoJob {
    const job: VideoJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...options,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
    };

    this.queue.push(job);
    console.log(
      `[Queue] Added job ${job.id} for ${job.displayName} (${this.queue.length} in queue)`
    );

    this.emit('job:added', job);

    // Start processing if not already running
    if (!this.processing) {
      this.processNext();
    }

    return job;
  }

  /**
   * Update job progress
   */
  updateProgress(jobId: string, progress: number) {
    const job = this.queue.find(j => j.id === jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      this.emit('job:progress', job);
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): VideoJob | undefined {
    return this.queue.find(j => j.id === jobId);
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): VideoJob[] {
    return this.queue.filter(j => j.userId === userId);
  }

  /**
   * Process next job in queue
   */
  private async processNext() {
    if (this.processing) return;

    // Find next queued job
    const nextJob = this.queue.find(j => j.status === 'queued');
    if (!nextJob) {
      this.processing = false;
      console.log('[Queue] No more jobs to process');
      return;
    }

    if (!this.processFunction) {
      console.error('[Queue] No process function set!');
      return;
    }

    this.processing = true;
    nextJob.status = 'processing';
    nextJob.progress = 0;

    console.log(
      `[Queue] Processing job ${nextJob.id} for ${nextJob.displayName}`
    );
    this.emit('job:started', nextJob);

    try {
      await this.processFunction(nextJob);

      nextJob.status = 'completed';
      nextJob.progress = 100;
      console.log(`[Queue] ✓ Completed job ${nextJob.id}`);
      this.emit('job:completed', nextJob);
    } catch (error) {
      nextJob.status = 'failed';
      nextJob.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Queue] ✗ Failed job ${nextJob.id}:`, nextJob.error);
      this.emit('job:failed', nextJob);
    }

    this.processing = false;

    // Process next job after a short delay
    setTimeout(() => this.processNext(), 1000);
  }

  /**
   * Clean up old completed/failed jobs (older than 1 hour)
   */
  cleanup() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const beforeCount = this.queue.length;

    this.queue = this.queue.filter(job => {
      const isOld = job.createdAt < oneHourAgo;
      const isDone = job.status === 'completed' || job.status === 'failed';
      return !(isOld && isDone);
    });

    const removed = beforeCount - this.queue.length;
    if (removed > 0) {
      console.log(`[Queue] Cleaned up ${removed} old jobs`);
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      total: this.queue.length,
      queued: this.queue.filter(j => j.status === 'queued').length,
      processing: this.queue.filter(j => j.status === 'processing').length,
      completed: this.queue.filter(j => j.status === 'completed').length,
      failed: this.queue.filter(j => j.status === 'failed').length,
    };
  }
}

// Singleton instance
export const videoQueue = new VideoQueue();

// Cleanup old jobs every 10 minutes
setInterval(
  () => {
    videoQueue.cleanup();
  },
  10 * 60 * 1000
);
