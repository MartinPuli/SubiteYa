#!/usr/bin/env node
/**
 * @fileoverview Edit Worker Standalone Runner
 * Purpose: Run edit worker separately from main server to save memory
 * Usage: node dist/workers/start-edit-worker.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { startEditWorker, stopEditWorker } from './edit-worker-bullmq';

console.log('🎬 Starting Edit Worker (standalone)...');

// Start the worker
const worker = startEditWorker();

// Keep process alive - wait for worker events
if (worker) {
  console.log('✅ Edit Worker is running and waiting for jobs...');
}

// Prevent process from exiting
process.stdin.resume();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down edit worker...');
  await stopEditWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down edit worker...');
  await stopEditWorker();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  stopEditWorker().finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  stopEditWorker().finally(() => process.exit(1));
});
