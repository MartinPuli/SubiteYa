/**
 * @fileoverview Structured logger with correlation
 * Purpose: Centralized logging with request correlation
 * Max lines: 150
 */

import pino from 'pino';

export interface LoggerContext {
  requestId?: string;
  userId?: string;
  jobId?: string;
  batchId?: string;
  tiktokConnectionId?: string;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export class Logger {
  private logger: pino.Logger;

  constructor(
    private readonly context: LoggerContext = {},
    level: LogLevel = 'info'
  ) {
    this.logger = pino({
      level,
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
      base: {
        ...context,
      },
    });
  }

  /**
   * Creates a child logger with additional context
   */
  child(context: LoggerContext): Logger {
    const childLogger = new Logger(
      { ...this.context, ...context },
      this.logger.level as LogLevel
    );
    return childLogger;
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.logger.trace(data, message);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(data, message);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(data, message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(data, message);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.logger.error(
      {
        ...data,
        err: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
      },
      message
    );
  }

  fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.logger.fatal(
      {
        ...data,
        err: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
      },
      message
    );
  }
}

// Singleton instance
let defaultLogger: Logger;

export function getLogger(context?: LoggerContext): Logger {
  if (context) {
    return new Logger(context, (process.env.LOG_LEVEL as LogLevel) || 'info');
  }

  if (!defaultLogger) {
    defaultLogger = new Logger(
      {},
      (process.env.LOG_LEVEL as LogLevel) || 'info'
    );
  }

  return defaultLogger;
}
