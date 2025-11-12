#!/usr/bin/env node
/**
 * @fileoverview Edit Worker Standalone Runner
 * Purpose: Run edit worker separately from main server to save memory
 * Usage: node dist/workers/start-edit-worker.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { startEditWorker, stopEditWorker } from './edit-worker-bullmq';
import http from 'http';

console.log('🎬 Starting Edit Worker (standalone)...');

// Start the worker
const worker = startEditWorker();

// Create a minimal HTTP server for health checks (Render requires a port)
const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        service: 'edit-worker',
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
  if (worker) {
    console.log('✅ Edit Worker is running and waiting for jobs...');
  }
});

// Keep process alive
process.stdin.resume();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down edit worker...');
  server.close();
  await stopEditWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down edit worker...');
  server.close();
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
