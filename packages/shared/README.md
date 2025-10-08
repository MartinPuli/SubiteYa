# @subiteya/shared

Shared utilities, types, errors, and helpers used across all SubiteYa packages.

## Purpose

This package provides common functionality to avoid duplication across the monorepo.

## Exports

### Errors

- `AppError`: Base application error class
- `ValidationError`, `UnauthorizedError`, `ForbiddenError`, etc.
- `TikTokError`: TikTok-specific error classes

### Types

- Common enums: `UserRole`, `Language`, `TikTokMode`, `VideoStatus`, `PublishJobState`
- DTOs with Zod validation schemas
- Response interfaces

### Utils

- `CryptoService`: Encryption/decryption for tokens
- Date utilities: timezone handling, scheduling
- Hash functions: password hashing, idempotency keys
- Validation: email, UUID, file extensions
- Retry: exponential backoff strategy

## Usage

```typescript
import {
  AppError,
  ErrorCode,
  CryptoService,
  generateIdempotencyKey,
} from '@subiteya/shared';

const crypto = new CryptoService(process.env.ENCRYPTION_KEY!);
const encrypted = crypto.encrypt('sensitive-data');
```

## Dependencies

- `zod`: Schema validation
- Node.js built-in: `crypto`

## Architecture Principles

- ✅ Max 250 lines per file
- ✅ Single responsibility per module
- ✅ No external service dependencies
- ✅ Pure functions where possible
