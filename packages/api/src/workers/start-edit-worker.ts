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
startEditWorker();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down edit worker...');
  stopEditWorker();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down edit worker...');
  stopEditWorker();
  process.exit(0);
});
