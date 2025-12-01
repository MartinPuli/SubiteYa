#!/usr/bin/env node
/**
 * @fileoverview Upload Worker HTTP Server
 * Purpose: Standalone HTTP service that receives Qstash webhooks for TikTok uploads
 * This runs as a separate Render service (type: web) to avoid saturating the main API
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import { Receiver } from '@upstash/qstash';
import { prisma } from '../lib/prisma';
import { VideoStatus } from '@prisma/client';
import { downloadStreamFromS3, extractS3Key } from '../lib/storage';
import { notifyUser } from '../routes/events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import axios from 'axios';
import crypto from 'node:crypto';
import { getLogger } from '@subiteya/observability';
import {
  markUploadJobFinished,
  markUploadJobStarted,
  recordTempFileSize,
  trackTikTokRequest,
  updateAccountBackoffGauge,
} from '../lib/metrics';

type RequestWithRawBody = Request & { rawBody?: string };

interface UploadWorkerPayload {
  videoId?: string;
  priority?: 'high' | 'normal' | 'low';
  traceId?: string;
}

const app = express();
const PORT = process.env.PORT || 3002;

// Encryption key for TikTok tokens
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
if (!ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY is required');
  process.exit(1);
}

/**
 * Encrypt token helper (compatible with tiktok.ts encryption using AES-256-GCM)
 */
function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt token helper (compatible with tiktok.ts encryption using AES-256-GCM)
 */
function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32));

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Initialize Qstash receiver for signature verification
const QSTASH_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY || '';
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY || '';

let qstashReceiver: Receiver | null = null;

if (QSTASH_SIGNING_KEY) {
  qstashReceiver = new Receiver({
    currentSigningKey: QSTASH_SIGNING_KEY,
    nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
  });
  console.log('✅ Qstash receiver initialized with signature verification');
} else {
  console.warn(
    '⚠️  QSTASH_CURRENT_SIGNING_KEY not set - webhook signature verification disabled'
  );
}

// Idempotency tracking: videoId → execution state
const activeExecutions = new Map<
  string,
  {
    startTime: number;
    status: 'running' | 'completed' | 'failed';
    accountId?: string | null;
  }
>();

// Backoff tracking per account: accountId → { consecutiveFailures, lastFailureTime }
const accountBackoff = new Map<
  string,
  { consecutiveFailures: number; lastFailureTime: number }
>();
updateAccountBackoffGauge(accountBackoff.size);

const MAX_CONCURRENT_PER_ACCOUNT = 3;

function isExecutionInProgress(videoId: string): boolean {
  const execution = activeExecutions.get(videoId);
  if (!execution) return false;

  // If completed/failed more than 5 minutes ago, allow re-execution
  if (execution.status !== 'running') {
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - execution.startTime > fiveMinutes) {
      activeExecutions.delete(videoId);
      return false;
    }
  }

  return execution.status === 'running';
}

function markExecutionStart(videoId: string, accountId?: string | null): void {
  activeExecutions.set(videoId, {
    startTime: Date.now(),
    status: 'running',
    accountId,
  });
}

function markExecutionEnd(
  videoId: string,
  status: 'completed' | 'failed'
): void {
  const execution = activeExecutions.get(videoId);
  if (execution) {
    execution.status = status;
  }
}

function getAccountConcurrentJobs(accountId: string): number {
  let count = 0;
  for (const [, execution] of activeExecutions) {
    if (execution.status === 'running' && execution.accountId === accountId) {
      count++;
    }
  }
  return count;
}

function shouldBackoff(accountId: string): {
  backoff: boolean;
  delayMs?: number;
} {
  const info = accountBackoff.get(accountId);
  if (!info || info.consecutiveFailures === 0) return { backoff: false };

  // Exponential backoff: 2^failures seconds (max 5 minutes)
  const delayMs = Math.min(
    Math.pow(2, info.consecutiveFailures) * 1000,
    5 * 60 * 1000
  );
  const timeSinceLastFailure = Date.now() - info.lastFailureTime;

  if (timeSinceLastFailure < delayMs) {
    return { backoff: true, delayMs: delayMs - timeSinceLastFailure };
  }

  return { backoff: false };
}

function recordAccountFailure(accountId: string): void {
  const info = accountBackoff.get(accountId) || {
    consecutiveFailures: 0,
    lastFailureTime: 0,
  };
  info.consecutiveFailures++;
  info.lastFailureTime = Date.now();
  accountBackoff.set(accountId, info);
  updateAccountBackoffGauge(accountBackoff.size);
}

function recordAccountSuccess(accountId: string): void {
  accountBackoff.delete(accountId);
  updateAccountBackoffGauge(accountBackoff.size);
}

// Body parser for JSON (store raw body for QStash signature verification)
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as RequestWithRawBody).rawBody = buf.toString();
    },
  })
);

/**
 * Verify Qstash signature
 */
async function verifyQstashSignature(
  req: Request
): Promise<{ valid: boolean; body?: unknown }> {
  if (!qstashReceiver) {
    console.warn('[Upload Worker] Signature verification disabled');
    return { valid: true, body: req.body };
  }

  try {
    const signature = req.headers['upstash-signature'] as string;
    if (!signature) {
      console.error('[Upload Worker] Missing upstash-signature header');
      return { valid: false };
    }

    const rawBody = (req as RequestWithRawBody).rawBody;
    const bodyToVerify = rawBody ?? JSON.stringify(req.body);

    // IMPORTANT: qstashReceiver.verify() returns a BOOLEAN, not the body
    const isValid = await qstashReceiver.verify({
      signature,
      body: bodyToVerify,
    });

    if (!isValid) {
      console.error('[Upload Worker] Qstash signature verification failed');
      return { valid: false };
    }

    // Use the Express-parsed body directly after successful verification
    console.log('[Upload Worker] ✅ Qstash signature verified');
    return { valid: true, body: req.body };
  } catch (error) {
    console.error('[Upload Worker] Signature verification error:', error);
    return { valid: false };
  }
}

/**
 * Get TikTok access token
 */
async function getTikTokAccessToken(accountId: string): Promise<string> {
  const connection = await prisma.tikTokConnection.findUnique({
    where: {
      id: accountId,
    },
  });

  if (!connection) {
    throw new Error('TikTok connection not found');
  }

  // Check if token is expired (if we have expiresAt)
  if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
    console.log('[Upload Worker] 🔄 Access token expired, refreshing...');
    const newAccessToken = await refreshTikTokToken(connection);
    return newAccessToken;
  }

  // Decrypt access token
  const accessToken = decryptToken(connection.accessTokenEnc);
  return accessToken;
}

/**
 * Refresh TikTok access token
 */
async function refreshTikTokToken(connection: {
  id: string;
  refreshTokenEnc: string;
}): Promise<string> {
  const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
  const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';

  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    throw new Error('TikTok credentials not configured');
  }

  try {
    const refreshToken = decryptToken(connection.refreshTokenEnc);

    console.log('[Upload Worker] 🔄 Attempting token refresh...');

    const response = await trackTikTokRequest('token.refresh', () =>
      axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        {
          client_key: TIKTOK_CLIENT_KEY,
          client_secret: TIKTOK_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    console.log('[Upload Worker] 🔄 Token refresh response:', {
      status: response.status,
      hasAccessToken: !!response.data?.access_token,
      hasRefreshToken: !!response.data?.refresh_token,
      expiresIn: response.data?.expires_in,
      error: response.data?.error,
    });

    if (!response.data?.access_token) {
      throw new Error(
        `Failed to refresh TikTok token: ${response.data?.error?.message || 'No access token in response'}`
      );
    }

    const { access_token, refresh_token, expires_in } = response.data;

    // Update connection with new tokens
    await prisma.tikTokConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEnc: encryptToken(access_token),
        refreshTokenEnc: encryptToken(refresh_token),
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });

    console.log('[Upload Worker] ✅ Token refreshed successfully');
    return access_token;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('[Upload Worker] ❌ Token refresh failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      // If token is invalid, mark connection as expired
      if (
        error.response?.status === 401 ||
        error.response?.data?.error?.code === 'invalid_grant'
      ) {
        console.error(
          '[Upload Worker] 🔴 Refresh token invalid - user needs to reconnect account'
        );
        throw new Error(
          'TikTok refresh token expired or revoked. User must reconnect their account.'
        );
      }
    }
    throw error;
  }
}

/**
 * Get TikTok creator info (with auto-retry on 401)
 */
async function getTikTokCreatorInfo(
  accessToken: string,
  accountId: string,
  retryCount = 0
): Promise<string> {
  try {
    const response = await trackTikTokRequest('creator_info', () =>
      axios.post(
        'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    if (response.data?.error?.code !== 'ok') {
      throw new Error(
        `TikTok API error: ${response.data?.error?.message || 'Unknown error'}`
      );
    }

    return response.data.data?.creator_avatar_url || '';
  } catch (error: unknown) {
    // If 401 and first attempt, try refreshing token
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      retryCount === 0
    ) {
      console.log('[Upload Worker] 🔄 401 error, refreshing token...');
      const connection = await prisma.tikTokConnection.findUnique({
        where: { id: accountId },
      });
      if (!connection) throw new Error('Connection not found');

      const newAccessToken = await refreshTikTokToken(connection);
      return getTikTokCreatorInfo(newAccessToken, accountId, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Initialize TikTok upload
 */
async function initTikTokUpload(
  accessToken: string,
  videoSize: number,
  title: string,
  privacyLevel: string,
  disableComment: boolean,
  disableDuet: boolean,
  disableStitch: boolean
): Promise<{ publishId: string; uploadUrl: string }> {
  try {
    const response = await trackTikTokRequest('video.init', () =>
      axios.post(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        {
          post_info: {
            title,
            privacy_level: privacyLevel,
            disable_comment: disableComment,
            disable_duet: disableDuet,
            disable_stitch: disableStitch,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    if (response.data?.error?.code !== 'ok') {
      throw new Error(
        `TikTok init error: ${response.data?.error?.message || 'Unknown error'}`
      );
    }

    return {
      publishId: response.data.data?.publish_id,
      uploadUrl: response.data.data?.upload_url,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('[Upload Worker] 🔴 TikTok init failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorCode: error.response?.data?.error?.code,
        errorMessage: error.response?.data?.error?.message,
        logId: error.response?.data?.error?.log_id,
        fullResponse: JSON.stringify(error.response?.data, null, 2),
      });
    }
    throw error;
  }
}

/**
 * Upload video to TikTok
 */
async function uploadVideoToTikTok(
  uploadUrl: string,
  videoPath: string
): Promise<void> {
  const videoBuffer = await fs.promises.readFile(videoPath);
  const totalSize = videoBuffer.length;

  await trackTikTokRequest('video.upload_put', () =>
    axios.put(uploadUrl, videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': totalSize.toString(),
        'Content-Range': `bytes 0-${totalSize - 1}/${totalSize}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })
  );
}

/**
 * Check TikTok upload status (verify upload completed before finalizing)
 */
async function checkTikTokUploadStatus(
  accessToken: string,
  publishId: string
): Promise<{ status: string; failReason?: string }> {
  try {
    const response = await trackTikTokRequest('status.fetch', () =>
      axios.post(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        {
          publish_id: publishId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    console.log('[Upload Worker] 📊 Upload status:', {
      status: response.data?.data?.status,
      failReason: response.data?.data?.fail_reason,
    });

    return {
      status: response.data?.data?.status || 'UNKNOWN',
      failReason: response.data?.data?.fail_reason,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('[Upload Worker] ⚠️ Status check failed:', {
        status: error.response?.status,
        data: error.response?.data,
      });
    }
    // If status check fails, assume we can proceed (might not be implemented yet)
    return { status: 'UNKNOWN' };
  }
}

/**
 * Finalize TikTok upload (make the post visible in the account)
 */
async function finalizeTikTokUpload(
  accessToken: string,
  publishId: string
): Promise<{ shareUrl?: string | null; videoId?: string | null }> {
  console.log('[Upload Worker] 🔍 Finalizing with publish_id:', publishId);

  try {
    const response = await trackTikTokRequest('video.submit', () =>
      axios.post(
        'https://open.tiktokapis.com/v2/post/publish/video/submit/',
        {
          publish_id: publishId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    console.log('[Upload Worker] 📋 Finalize response:', {
      status: response.status,
      errorCode: response.data?.error?.code,
      errorMessage: response.data?.error?.message,
      data: response.data,
    });

    if (response.data?.error?.code !== 'ok') {
      throw new Error(
        `TikTok finalize error: ${response.data?.error?.message || 'Unknown error'}`
      );
    }

    return {
      shareUrl: response.data?.data?.share_url ?? null,
      videoId: response.data?.data?.video_id ?? null,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('[Upload Worker] ❌ Finalize failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        url: error.config?.url,
        method: error.config?.method,
        requestData: error.config?.data,
      });

      // Extract TikTok error message if available
      const tiktokError = error.response?.data?.error?.message || error.message;
      throw new Error(
        `TikTok finalize failed (${error.response?.status}): ${tiktokError}`
      );
    }
    throw error;
  }
}

/**
 * POST /process - Process TikTok upload job (called by Qstash)
 */
app.post('/process', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let tempFilePath: string | null = null;
  let videoId: string | undefined;
  let accountId: string | null = null;
  let metricsJobStarted = false;
  let metricsRecorded = false;
  let jobLogger = getLogger();

  try {
    // Verify Qstash signature
    const { valid, body } = await verifyQstashSignature(req);
    if (!valid) {
      console.error('[Upload Worker] Invalid Qstash signature');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Debug: Log received body type and content
    console.log('[Upload Worker] Received body:', JSON.stringify(body));
    console.log('[Upload Worker] Body type:', typeof body);

    const parsedBody = body as UploadWorkerPayload;
    const traceId =
      typeof parsedBody.traceId === 'string' && parsedBody.traceId.length > 0
        ? parsedBody.traceId
        : crypto.randomUUID();
    jobLogger = getLogger({
      requestId: traceId,
      jobId: parsedBody.videoId,
    });
    res.setHeader('X-Trace-Id', traceId);
    jobLogger.info('Received upload job', {
      videoId: parsedBody.videoId,
      priority: parsedBody.priority,
    });
    if (!parsedBody?.videoId) {
      console.error('[Upload Worker] Missing videoId in request body');
      console.error('[Upload Worker] Received body was:', parsedBody);
      jobLogger.error('Upload job missing videoId');
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    videoId = parsedBody.videoId;
    console.log(
      `[Upload Worker] 📥 Received job for video ${parsedBody.videoId}`
    );

    // IDEMPOTENCY CHECK: Skip if already processing or completed
    if (isExecutionInProgress(parsedBody.videoId)) {
      console.log(
        `[Upload Worker] ⏭️  Skipping ${parsedBody.videoId} - already in progress or recently completed`
      );
      jobLogger.info('Upload job skipped (already processing)', {
        videoId: parsedBody.videoId,
      });
      res
        .status(200)
        .json({ success: true, skipped: true, reason: 'idempotent' });
      return;
    }

    // Get video with account (check terminal states first)
    const video = await prisma.video.findUnique({
      where: { id: parsedBody.videoId },
      include: {
        account: true,
        user: true,
      },
    });

    if (!video) {
      console.error(`[Upload Worker] Video ${parsedBody.videoId} not found`);
      markExecutionEnd(parsedBody.videoId, 'failed');
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    accountId = video.accountId;

    if (accountId) {
      jobLogger = jobLogger.child({ tiktokConnectionId: accountId });
    }

    // Skip if already in terminal state
    const terminalStates: VideoStatus[] = [
      VideoStatus.POSTED,
      VideoStatus.FAILED_UPLOAD,
    ];
    if (terminalStates.includes(video.status)) {
      console.log(
        `[Upload Worker] ⏭️  Video ${parsedBody.videoId} already in terminal state: ${video.status}`
      );
      markExecutionEnd(parsedBody.videoId, 'completed');
      res.status(200).json({
        success: true,
        skipped: true,
        reason: 'already_processed',
        status: video.status,
      });
      return;
    }

    if (!video.editedUrl) {
      throw new Error('Video has no edited URL');
    }

    if (!accountId) {
      throw new Error('Video has no associated TikTok account');
    }

    markExecutionStart(parsedBody.videoId, accountId);

    const editSpec = (video.editSpecJson ?? {}) as {
      disableComment?: boolean | string;
      disableDuet?: boolean | string;
      disableStitch?: boolean | string;
      privacyLevel?: string;
      title?: string;
      caption?: string;
    };

    const parseBoolean = (value: unknown, fallback = false) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
      }
      return fallback;
    };

    const publishTitle =
      video.title || editSpec.title || editSpec.caption || 'SubiteYa Video';
    const disableComment = parseBoolean(editSpec.disableComment);
    const disableDuet = parseBoolean(editSpec.disableDuet);
    const disableStitch = parseBoolean(editSpec.disableStitch);

    // Force SELF_ONLY for unaudited TikTok apps (required by TikTok API)
    // Once the app passes TikTok's audit, you can use other privacy levels:
    // - MUTUAL_FOLLOW_FRIENDS: Only mutual followers can see
    // - FOLLOWER_OF_CREATOR: Only followers can see
    // - PUBLIC_TO_EVERYONE: Everyone can see (requires audit)
    // For now, force SELF_ONLY to avoid "unaudited_client_can_only_post_to_private_accounts" error
    const privacyLevel = 'SELF_ONLY';

    console.log(
      `[Upload Worker] 🔒 Using privacy level: ${privacyLevel} (unaudited app mode)`
    );

    // CONCURRENCY CHECK: Limit concurrent uploads per account
    const concurrentJobs = getAccountConcurrentJobs(accountId);
    if (concurrentJobs >= MAX_CONCURRENT_PER_ACCOUNT) {
      console.log(
        `[Upload Worker] ⏸️  Account ${accountId} has ${concurrentJobs} concurrent jobs (max: ${MAX_CONCURRENT_PER_ACCOUNT})`
      );
      jobLogger.warn('Upload job throttled due to concurrency limit', {
        accountId,
        concurrentJobs,
      });
      markExecutionEnd(parsedBody.videoId, 'failed');
      res.status(429).json({
        error: 'Too many concurrent uploads for this account',
        retryAfter: 30,
      });
      return;
    }

    // BACKOFF CHECK: Check if account needs backoff due to recent failures
    const backoffInfo = shouldBackoff(accountId);
    if (backoffInfo.backoff) {
      console.log(
        `[Upload Worker] ⏸️  Account ${accountId} in backoff period (${Math.ceil(backoffInfo.delayMs! / 1000)}s remaining)`
      );
      jobLogger.warn('Upload job throttled due to backoff', {
        accountId,
        retryAfterSeconds: Math.ceil(backoffInfo.delayMs! / 1000),
      });
      markExecutionEnd(parsedBody.videoId, 'failed');
      res.status(429).json({
        error: 'Account in backoff period',
        retryAfter: Math.ceil(backoffInfo.delayMs! / 1000),
      });
      return;
    }

    // ATOMIC TRANSITION: EDITED/UPLOADING → UPLOADING
    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: {
        status: VideoStatus.UPLOADING,
        progress: 10,
        error: null,
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId: parsedBody.videoId,
      status: 'UPLOADING',
    });

    markUploadJobStarted();
    metricsJobStarted = true;

    // Get TikTok access token
    console.log('[Upload Worker] 🔑 Getting access token...');
    const accessToken = await getTikTokAccessToken(accountId);

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 20 },
    });

    // Get creator info (required by TikTok API)
    console.log('[Upload Worker] 👤 Fetching creator info...');
    await getTikTokCreatorInfo(accessToken, accountId);

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 30 },
    });

    // Download video from S3 to temp file
    const s3Key = extractS3Key(video.editedUrl);
    tempFilePath = path.join(
      os.tmpdir(),
      `upload-${parsedBody.videoId}-${Date.now()}.mp4`
    );

    console.log(`[Upload Worker] ⬇️  Downloading from S3...`);

    const videoStream = await downloadStreamFromS3(s3Key);
    const writeStream = fs.createWriteStream(tempFilePath);

    await new Promise<void>((resolve, reject) => {
      videoStream.pipe(writeStream);
      videoStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
    });

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 50 },
    });

    // Get video file size
    const stats = await fs.promises.stat(tempFilePath);
    const videoSize = stats.size;
    recordTempFileSize(videoSize);

    console.log(
      `[Upload Worker] 📊 Video size: ${(videoSize / 1024 / 1024).toFixed(2)} MB`
    );

    // Initialize TikTok upload
    console.log('[Upload Worker] 🚀 Initializing TikTok upload...');

    const initStartTime = Date.now();
    const { publishId, uploadUrl } = await initTikTokUpload(
      accessToken,
      videoSize,
      publishTitle,
      privacyLevel,
      disableComment,
      disableDuet,
      disableStitch
    );
    console.log(
      `[Upload Worker] ✅ Received publish_id: ${publishId} (took ${Date.now() - initStartTime}ms)`
    );

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 70 },
    });

    // Upload video to TikTok
    console.log('[Upload Worker] ⬆️  Uploading to TikTok...');

    const uploadStartTime = Date.now();
    await uploadVideoToTikTok(uploadUrl, tempFilePath);
    const uploadDuration = Date.now() - uploadStartTime;
    console.log(
      `[Upload Worker] ✅ Upload completed (took ${uploadDuration}ms)`
    );

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 85 },
    });

    // Wait for TikTok to process the uploaded video (2-5 seconds recommended)
    const timeSinceInit = Date.now() - initStartTime;
    console.log(`[Upload Worker] ⏱️  Time since init: ${timeSinceInit}ms`);

    // Give TikTok a moment to process the upload before finalizing
    const processingDelay = 3000; // 3 seconds
    console.log(
      `[Upload Worker] ⏳ Waiting ${processingDelay}ms for TikTok processing...`
    );
    await new Promise(resolve => setTimeout(resolve, processingDelay));

    // Check upload status before finalizing
    console.log('[Upload Worker] 🔍 Checking upload status...');
    const uploadStatus = await checkTikTokUploadStatus(accessToken, publishId);
    console.log(
      `[Upload Worker] 📊 Status: ${uploadStatus.status}${uploadStatus.failReason ? ` (reason: ${uploadStatus.failReason})` : ''}`
    );

    // If status indicates failure, throw error
    if (
      uploadStatus.status === 'FAILED' ||
      uploadStatus.status === 'PUBLISH_FAILED'
    ) {
      throw new Error(
        `TikTok upload failed: ${uploadStatus.failReason || 'Unknown reason'}`
      );
    }

    let finalizeResult: { shareUrl?: string | null; videoId?: string | null } =
      {};

    // Check if already published (PUBLISH_COMPLETE means video is live)
    if (uploadStatus.status === 'PUBLISH_COMPLETE') {
      console.log(
        '[Upload Worker] ✅ Video already published by TikTok (status: PUBLISH_COMPLETE)'
      );
      console.log(
        '[Upload Worker] ⏭️  Skipping finalize call - not needed for direct file upload'
      );

      // Video is already live, no finalize needed
      finalizeResult = {
        shareUrl: null, // TikTok doesn't provide share URL in status check
        videoId: null,
      };
    } else {
      // Status is PROCESSING_DOWNLOAD or similar - need to finalize
      console.log('[Upload Worker] 📤 Finalizing TikTok publish...');
      console.log(
        `[Upload Worker] 🔑 Using publish_id: ${publishId} (age: ${Date.now() - initStartTime}ms)`
      );

      finalizeResult = await finalizeTikTokUpload(accessToken, publishId);
    }

    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: { progress: 95 },
    });

    // ATOMIC TRANSITION: UPLOADING → POSTED
    await prisma.video.update({
      where: { id: parsedBody.videoId },
      data: {
        status: VideoStatus.POSTED,
        progress: 100,
        error: null,
        ...(finalizeResult.shareUrl
          ? { postUrl: finalizeResult.shareUrl }
          : {}),
      },
    });

    notifyUser(video.userId, {
      type: 'video_status_changed',
      videoId: parsedBody.videoId,
      status: 'POSTED',
    });

    // Record success for backoff tracking
    recordAccountSuccess(accountId);
    markExecutionEnd(parsedBody.videoId, 'completed');

    const duration = Date.now() - startTime;
    console.log(
      `[Upload Worker] ✅ Completed video ${parsedBody.videoId} in ${duration}ms`
    );
    jobLogger.info('Upload job completed', {
      videoId: parsedBody.videoId,
      durationMs: duration,
      accountId,
    });

    if (finalizeResult.shareUrl) {
      console.log(
        `[Upload Worker] 🔗 TikTok share URL: ${finalizeResult.shareUrl}`
      );
    } else if (finalizeResult.videoId) {
      console.log(
        `[Upload Worker] 🆔 TikTok video ID: ${finalizeResult.videoId}`
      );
    }

    res.status(200).json({
      success: true,
      videoId: parsedBody.videoId,
      publishId,
      duration,
      shareUrl: finalizeResult.shareUrl,
      tiktokVideoId: finalizeResult.videoId,
    });

    if (metricsJobStarted && !metricsRecorded) {
      markUploadJobFinished({ success: true, durationMs: duration });
      metricsRecorded = true;
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[Upload Worker] ❌ Error:', errorMessage);

    if (metricsJobStarted && !metricsRecorded) {
      markUploadJobFinished({
        success: false,
        durationMs: Date.now() - startTime,
      });
      metricsRecorded = true;
    }

    if (videoId) {
      markExecutionEnd(videoId, 'failed');

      // Record failure for backoff
      if (accountId) {
        recordAccountFailure(accountId);
      }

      // ATOMIC TRANSITION: Only update to FAILED_UPLOAD if not already failed
      const failedStates: VideoStatus[] = [VideoStatus.FAILED_UPLOAD];
      await prisma.video
        .updateMany({
          where: {
            id: videoId,
            status: { notIn: failedStates },
          },
          data: {
            status: VideoStatus.FAILED_UPLOAD,
            error: errorMessage,
          },
        })
        .catch(() => {});
    }

    if (error instanceof Error) {
      jobLogger.error('Upload job failed', error, { videoId, accountId });
    } else {
      jobLogger.error('Upload job failed', undefined, {
        videoId,
        accountId,
        error: errorMessage,
      });
    }

    res.status(500).json({ error: errorMessage });
  } finally {
    // ROBUST CLEANUP: Always delete temp files
    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'upload-worker',
    qstash: {
      enabled: !!qstashReceiver,
      signatureVerification: !!QSTASH_SIGNING_KEY,
    },
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

/**
 * GET / - Root endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'SubiteYa Upload Worker',
    version: '1.0.0',
    endpoints: {
      process: 'POST /process',
      health: 'GET /health',
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Upload Worker HTTP Server listening on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Process endpoint: http://localhost:${PORT}/process`);
  console.log(`✅ Ready to receive Qstash webhooks`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
