/**
 * @fileoverview JWT Token Management with Refresh Tokens
 * Purpose: Create and verify access tokens and refresh tokens
 * Max lines: 100
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'fallback-refresh-secret';
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
