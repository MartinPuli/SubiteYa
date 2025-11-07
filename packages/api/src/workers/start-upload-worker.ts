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
startUploadWorker();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down upload worker...');
  stopUploadWorker();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down upload worker...');
  stopUploadWorker();
  process.exit(0);
});
