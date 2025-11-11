#!/usr/bin/env node
/**
 * @fileoverview Upload Worker Standalone Runner
 * Purpose: Run upload worker separately from main server to save memory
 * Usage: node dist/workers/start-upload-worker.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { startUploadWorker, stopUploadWorker } from './upload-worker-bullmq';

console.log('📤 Starting Upload Worker (standalone)...');

// Validate required environment variables
if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY is required');
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error('❌ REDIS_URL is required');
  process.exit(1);
}

console.log('✅ Environment variables validated');

// Start the worker
let worker;
try {
  worker = startUploadWorker();
  console.log('✅ Upload Worker started successfully');
} catch (error) {
  console.error('❌ Failed to start upload worker:', error);
  process.exit(1);
}

// Keep process alive - wait for worker events
if (worker) {
  console.log('✅ Upload Worker is running and waiting for jobs...');
}

// Prevent process from exiting
process.stdin.resume();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down upload worker...');
  await stopUploadWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down upload worker...');
  await stopUploadWorker();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  stopUploadWorker().finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  stopUploadWorker().finally(() => process.exit(1));
});
