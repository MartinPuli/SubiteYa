/**
 * @fileoverview API Server Entry Point
 * Purpose: Bootstrap Express server with middleware
 * Max lines: 150
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { testEncryption } from './utils/encryption';

dotenv.config();

// Validate required environment variables
if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY is required in environment variables');
  console.error(
    "   Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  );
  process.exit(1);
}

// Test encryption on boot
if (!testEncryption()) {
  console.error('❌ Encryption test failed - check your ENCRYPTION_KEY');
  process.exit(1);
}
console.log('✅ Encryption test passed');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o =>
  o.trim()
) || ['http://localhost:5173', 'http://localhost:3000'];

console.log('🔧 CORS allowed origins:', allowedOrigins);

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      console.log('✅ CORS: No origin (allowed)');
      return callback(null, true);
    }

    // Remove trailing slash for comparison
    const normalizedOrigin = origin.replace(/\/$/, '');

    // Check exact matches
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.replace(/\/$/, '');
      return normalizedOrigin === normalizedAllowed;
    });

    // Check Vercel preview deployments (*.vercel.app)
    const isVercelPreview =
      normalizedOrigin.endsWith('.vercel.app') &&
      normalizedOrigin.startsWith('https://');

    if (isAllowed || isVercelPreview) {
      console.log('✅ CORS allowed origin:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      console.log('   Allowed origins:', allowedOrigins);
      // Don't throw error, just deny
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Apply CORS middleware globally (handles preflight automatically)
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId = crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  console.log(`[${requestId}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Redis health check endpoint
app.get('/health/redis', async (_req: Request, res: Response) => {
  try {
    const { getQueueStats } = await import('./lib/queues');
    const stats = await getQueueStats();
    res.json({
      status: 'ok',
      redis: 'connected',
      queues: stats,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      redis: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Import routes
import authRoutes from './routes/auth';
import connectionsRoutes from './routes/connections';
import publishRoutes from './routes/publish';
import tiktokRoutes from './routes/tiktok';
import patternsRoutes from './routes/patterns';
import legalRoutes from './routes/legal';
import videosRoutes from './routes/videos';
import meRoutes from './routes/me';
import designsRoutes from './routes/designs';
import eventsRoutes from './routes/events';
import elevenlabsRoutes from './routes/elevenlabs';

// Import BullMQ workers (production)
import { startEditWorker, stopEditWorker } from './workers/edit-worker-bullmq';
import {
  startUploadWorker,
  stopUploadWorker,
} from './workers/upload-worker-bullmq';
import { closeQueues } from './lib/queues';

const workersDisabled =
  process.env.DISABLE_WORKERS === 'true' || process.env.NODE_ENV === 'test';

// API routes
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'SubiteYa API',
    version: '1.0.0',
    documentation: '/api/docs',
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/publish', publishRoutes);
app.use('/api/auth', tiktokRoutes);
app.use('/api/patterns', patternsRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/me', meRoutes);
app.use('/api/accounts', designsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/elevenlabs', elevenlabsRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  // Ensure CORS headers in 404 responses
  const origin = req.headers.origin;
  if (
    origin &&
    allowedOrigins.some(
      allowed => allowed.replace(/\/$/, '') === origin.replace(/\/$/, '')
    )
  ) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }

  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Unhandled error:', err.message, {
    path: req.path,
    method: req.method,
    origin: req.headers.origin,
  });

  // Ensure CORS headers in error responses
  const origin = req.headers.origin;
  if (
    origin &&
    allowedOrigins.some(
      allowed => allowed.replace(/\/$/, '') === origin.replace(/\/$/, '')
    )
  ) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received, shutting down gracefully`);

  try {
    if (!workersDisabled) {
      await Promise.all([stopEditWorker(), stopUploadWorker()]);
    }
    await closeQueues();
  } catch (error) {
    console.error('Error during shutdown:', error);
  } finally {
    process.exit(0);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SubiteYa API listening on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 CORS configured for origins:`, allowedOrigins);

  if (workersDisabled) {
    console.log('⚠️  Background workers disabled via configuration');
    console.log(
      '   Set DISABLE_WORKERS=false to enable automatic worker startup.'
    );
  } else {
    console.log('🧵 Starting background workers...');
    startEditWorker();
    startUploadWorker();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
