import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logAuditEvent } from '../services/audit';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
}

/**
 * Rate limiter for registration endpoint
 * 5 attempts per hour per IP
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logAuditEvent(
      null,
      'security.rate_limit_exceeded',
      {
        endpoint: '/auth/register',
        ip: req.ip,
      },
      req.ip,
      req.get('user-agent')
    );

    res.status(429).json({
      error: 'Too many registration attempts. Please try again later.',
    });
  },
});

/**
 * Rate limiter for login endpoint
 * 20 attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logAuditEvent(
      null,
      'security.rate_limit_exceeded',
      {
        endpoint: '/auth/login',
        ip: req.ip,
      },
      req.ip,
      req.get('user-agent')
    );

    res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
    });
  },
});

/**
 * Rate limiter for email resend endpoint
 * 10 attempts per hour per IP
 */
export const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many resend attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logAuditEvent(
      null,
      'security.rate_limit_exceeded',
      {
        endpoint: '/auth/resend-verification',
        ip: req.ip,
      },
      req.ip,
      req.get('user-agent')
    );

    res.status(429).json({
      error: 'Too many resend attempts. Please try again later.',
    });
  },
});

/**
 * Rate limiter for publish endpoint
 * Configurable via env vars, default 10 per minute per user
 */
export const publishLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_PUBLISH_PER_WINDOW || '10'),
  message: { error: 'Too many publish requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    // Rate limit per user ID instead of IP for authenticated endpoints
    return req.user?.userId || req.ip || 'unknown';
  },
  handler: (req: AuthenticatedRequest, res: Response) => {
    logAuditEvent(
      req.user?.userId || null,
      'security.rate_limit_exceeded',
      {
        endpoint: '/tiktok/publish',
        ip: req.ip,
      },
      req.ip,
      req.get('user-agent')
    );

    res.status(429).json({
      error: 'Too many publish requests. Please slow down.',
    });
  },
});
