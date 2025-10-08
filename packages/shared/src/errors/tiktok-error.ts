/**
 * @fileoverview TikTok-specific errors
 * Purpose: Handle TikTok API error responses
 */

import { AppError, ErrorCode } from './app-error';

export class TikTokError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly tiktokCode?: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, 500, details);
    this.name = 'TikTokError';
  }
}

export class TikTokAuthError extends TikTokError {
  constructor(message: string, tiktokCode?: string) {
    super(ErrorCode.TIKTOK_AUTH_FAILED, message, tiktokCode);
    this.name = 'TikTokAuthError';
  }
}

export class TikTokUploadError extends TikTokError {
  constructor(message: string, tiktokCode?: string) {
    super(ErrorCode.TIKTOK_UPLOAD_FAILED, message, tiktokCode);
    this.name = 'TikTokUploadError';
  }
}

export class TikTokPublishError extends TikTokError {
  constructor(message: string, tiktokCode?: string) {
    super(ErrorCode.TIKTOK_PUBLISH_FAILED, message, tiktokCode);
    this.name = 'TikTokPublishError';
  }
}

export class TikTokRateLimitError extends TikTokError {
  constructor(message: string = 'TikTok rate limit exceeded') {
    super(ErrorCode.TIKTOK_RATE_LIMIT, message);
    this.name = 'TikTokRateLimitError';
  }
}
