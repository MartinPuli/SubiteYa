/**
 * @fileoverview DTOs for API requests and responses
 * Purpose: Type-safe data transfer objects
 */

import { z } from 'zod';
import { PrivacyStatus } from './common';

// Auth DTOs
export const RegisterDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
});

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

// TikTok Connection DTOs
export const ConnectTikTokDtoSchema = z.object({
  code: z.string(),
  state: z.string(),
});

export type ConnectTikTokDto = z.infer<typeof ConnectTikTokDtoSchema>;

// Publish DTOs
export const PublishDefaultsSchema = z.object({
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).max(10).optional(),
  privacyStatus: z.nativeEnum(PrivacyStatus).default(PrivacyStatus.PUBLIC),
  allowDuet: z.boolean().default(true),
  allowStitch: z.boolean().default(true),
  allowComment: z.boolean().default(true),
});

export type PublishDefaults = z.infer<typeof PublishDefaultsSchema>;

export const PublishBatchDtoSchema = z.object({
  videoAssetId: z.string().uuid(),
  tiktokConnectionIds: z.array(z.string().uuid()).min(1).max(10),
  defaults: PublishDefaultsSchema,
  scheduleTimeUtc: z.string().datetime().optional(),
  overrides: z
    .record(z.string().uuid(), PublishDefaultsSchema.partial())
    .optional(),
});

export type PublishBatchDto = z.infer<typeof PublishBatchDtoSchema>;

// Response DTOs
export interface UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: string;
  language: string;
  timezone: string;
  createdAt: string;
}

export interface TikTokConnectionResponseDto {
  id: string;
  userId: string;
  openId: string;
  displayName: string;
  avatarUrl: string | null;
  scopeGranted: string[];
  expiresAt: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAssetResponseDto {
  id: string;
  userId: string;
  storageUrl: string;
  originalFilename: string;
  sizeBytes: number;
  durationSec: number | null;
  checksum: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishJobResponseDto {
  id: string;
  batchId: string;
  userId: string;
  tiktokConnectionId: string;
  videoAssetId: string;
  caption: string | null;
  hashtags: string[];
  privacyStatus: string;
  allowDuet: boolean;
  allowStitch: boolean;
  allowComment: boolean;
  scheduleTimeUtc: string | null;
  state: string;
  attempts: number;
  lastAttemptAt: string | null;
  tiktokVideoId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
