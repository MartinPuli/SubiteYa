#!/usr/bin/env node
/**
 * @fileoverview Upload Worker Standalone Runner
 * Purpose: Run upload worker separately from main server to save memory
 * Usage: node dist/workers/start-upload-worker.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { startUploadWorker, stopUploadWorker } from './upload-worker-bullmq';
import http from 'http';

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

// Create a minimal HTTP server for health checks
const PORT = process.env.PORT || 3002;
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        service: 'upload-worker',
        uptime: process.uptime(),
      })
    );
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`✅ Health check server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down upload worker...');
  server.close();
  await stopUploadWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down upload worker...');
  server.close();
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
