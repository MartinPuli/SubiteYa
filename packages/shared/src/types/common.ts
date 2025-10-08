/**
 * @fileoverview Common type definitions
 * Purpose: Shared types across packages
 */

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum Language {
  ES = 'es',
  EN = 'en',
}

export enum TikTokMode {
  SANDBOX = 'sandbox',
  PRODUCTION = 'production',
}

export enum VideoStatus {
  UPLOADED = 'uploaded',
  VALIDATED = 'validated',
  READY = 'ready',
  DELETED = 'deleted',
}

export enum PublishJobState {
  QUEUED = 'queued',
  UPLOADING = 'uploading',
  PUBLISHING = 'publishing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export enum PrivacyStatus {
  PUBLIC = 'public',
  FRIENDS = 'friends',
  PRIVATE = 'private',
}

export enum AuditEventType {
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_REGISTER = 'user.register',
  TIKTOK_CONNECT = 'tiktok.connect',
  TIKTOK_DISCONNECT = 'tiktok.disconnect',
  VIDEO_UPLOAD = 'video.upload',
  PUBLISH_CREATE = 'publish.create',
  PUBLISH_CANCEL = 'publish.cancel',
  TOKEN_REFRESH = 'token.refresh',
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
