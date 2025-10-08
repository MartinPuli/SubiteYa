/**
 * @fileoverview Idempotency key generator
 * Purpose: Generate unique keys for idempotent operations
 */

import crypto from 'crypto';

export function generateIdempotencyKey(
  userId: string,
  videoAssetId: string,
  tiktokConnectionId: string,
  batchId: string
): string {
  const input = `${userId}:${videoAssetId}:${tiktokConnectionId}:${batchId}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyPassword(
  password: string,
  salt: string,
  hash: string
): boolean {
  const passwordHash = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(passwordHash));
}
