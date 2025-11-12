/**
 * @fileoverview Prisma Client Singleton with Connection Pooling
 * Purpose: Global database client with retry logic and connection management
 * Max lines: 80
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Connection pool configuration for Supabase
const connectionString = process.env.DATABASE_URL;

// Configure connection pool settings for better stability
const datasourceUrl = connectionString
  ? `${connectionString}${connectionString.includes('?') ? '&' : '?'}connection_limit=10&pool_timeout=20`
  : undefined;

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Test connection on startup
prisma
  .$connect()
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

/**
 * Retry wrapper for database operations
 * Handles intermittent connection errors from Supabase pooler
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Only retry on connection errors (P1001, P1002, P1008, P1017)
      const isConnectionError =
        error.code?.startsWith('P100') ||
        error.code === 'P1017' ||
        error.message?.includes("Can't reach database server");

      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }

      const waitTime = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
      console.warn(
        `[Prisma] Connection error (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}ms...`,
        error.code || error.message
      );

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}
