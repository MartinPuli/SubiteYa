/**
 * @fileoverview JWT Token Management with Refresh Tokens
 * Purpose: Create and verify access tokens and refresh tokens
 * Max lines: 100
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Validación de seguridad: JWT_SECRET es OBLIGATORIO
if (!process.env.JWT_SECRET) {
  throw new Error(
    '🚨 CRITICAL: JWT_SECRET is not set in environment variables. Application cannot start.'
  );
}

// REFRESH_SECRET se valida solo cuando se usa (no en workers)
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || '';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutos (seguro)
const REFRESH_TOKEN_EXPIRY = '90d'; // 90 días (sesión "infinita")

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  tokenId: string; // Para poder revocar tokens específicos
}

/**
 * Generate access token (short-lived)
 */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'subiteya-api',
  });
}

/**
 * Generate refresh token (long-lived)
 */
export function signRefreshToken(payload: JwtPayload): {
  token: string;
  tokenId: string;
} {
  if (!REFRESH_SECRET) {
    throw new Error('🚨 REFRESH_SECRET is required to generate refresh tokens');
  }
  const tokenId = crypto.randomBytes(32).toString('hex');
  const token = jwt.sign({ ...payload, tokenId }, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'subiteya-api',
  });
  return { token, tokenId };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use signAccessToken instead
 */
export function signToken(payload: JwtPayload): string {
  return signAccessToken(payload);
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'subiteya-api',
    });
    return decoded as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  if (!REFRESH_SECRET) {
    throw new Error('🚨 REFRESH_SECRET is required to verify refresh tokens');
  }
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET, {
      issuer: 'subiteya-api',
    });
    return decoded as RefreshTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

export function extractToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
