/**
 * @fileoverview Rate Limiting Middleware
 * Purpose: Protect sensitive routes from brute force and abuse
 */

import rateLimit from 'express-rate-limit';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message:
    'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: req => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/health/redis';
  },
});

// Strict limiter for authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true, // Don't count successful requests
  message:
    'Demasiados intentos de inicio de sesión. Por favor, espera 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for email-based operations (verification, reset password)
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 emails per hour
  skipSuccessfulRequests: false,
  message: 'Demasiadas solicitudes de email. Por favor, espera 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for registration
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  skipSuccessfulRequests: false,
  message: 'Demasiados intentos de registro. Por favor, espera 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for video uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  skipSuccessfulRequests: false,
  message: 'Demasiadas subidas de video. Por favor, espera un poco.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for API endpoints (patterns, connections, etc)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  skipSuccessfulRequests: false,
  message: 'Demasiadas solicitudes a la API. Por favor, espera un poco.',
  standardHeaders: true,
  legacyHeaders: false,
});
