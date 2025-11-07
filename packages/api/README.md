# @subiteya/api

REST API backend for SubiteYa.

## Purpose

Provides HTTP endpoints for:

- User authentication
- TikTok OAuth flow
- Video asset management
- Multi-account publishing
- Job status tracking
- Publishing history

## Architecture

```
src/
├── index.ts              → Server bootstrap (NO workers)
├── routes/               → Express route definitions
├── controllers/          → Request handlers
├── services/             → Business logic
├── repositories/         → Data access layer
├── middleware/           → Auth, validation, rate limiting
├── workers/              → Background job processors (run separately)
│   ├── edit-worker-bullmq.ts
│   ├── upload-worker-bullmq.ts
│   ├── start-edit-worker.ts    → Standalone edit worker
│   └── start-upload-worker.ts  → Standalone upload worker
└── utils/                → Helpers
```

## Running Workers (Production)

**IMPORTANT**: Workers are **disabled by default** in the main server to avoid memory issues on Render's free plan (512MB limit).

To process videos, run workers **separately**:

```bash
# Terminal 1: Main server (handles API requests)
npm run start

# Terminal 2: Edit worker (processes video editing)
node dist/workers/start-edit-worker.js

# Terminal 3: Upload worker (uploads to TikTok)
node dist/workers/start-upload-worker.js
```

Or in Render, create **separate Background Workers** services for each worker.

### Why Separate Workers?

- Main server uses ~200MB RAM
- Each worker uses ~150-300MB RAM when processing
- Running all together exceeds 512MB limit
- Asynchronous processing: API responds immediately, workers process in background

## Database

Uses **Prisma ORM** with PostgreSQL.

### Migrations

```bash
# Create migration
npm run migrate

# Deploy to production
npm run migrate:deploy

# Seed database
npm run seed
```

## Environment Variables

See `.env.example` in project root.

Required:

- `DB_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT signing
- `ENCRYPTION_KEY`: For token encryption
- `TIKTOK_CLIENT_KEY`: TikTok app client key
- `TIKTOK_CLIENT_SECRET`: TikTok app secret

## Development

```bash
# Install dependencies (from root)
npm install

# Run in dev mode
npm run dev -w @subiteya/api

# Build
npm run build -w @subiteya/api

# Start production server
npm run start -w @subiteya/api
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/users/me` - Current user

### TikTok Connections

- `GET /api/tiktok/connections` - List connections
- `POST /api/tiktok/connect/start` - Initiate OAuth
- `GET /api/tiktok/connect/callback` - OAuth callback
- `DELETE /api/tiktok/connections/:id` - Disconnect
- `POST /api/tiktok/connections/:id/refresh-token` - Refresh token

### Video Assets

- `POST /api/videos/assets` - Upload video
- `GET /api/videos/assets/:id` - Get asset details
- `DELETE /api/videos/assets/:id` - Delete asset

### Publishing

- `POST /api/publish-batches` - Create batch (fan-out to jobs)
- `GET /api/publish-batches/:id` - Get batch status
- `POST /api/publish-batches/:id/cancel` - Cancel batch
- `GET /api/publish-jobs` - List jobs (with filters)
- `GET /api/publish-jobs/:id` - Get job details
- `POST /api/publish-jobs/:id/cancel` - Cancel job

### Webhooks

- `POST /api/webhooks/tiktok` - TikTok webhook receiver

## Testing

```bash
npm run test -w @subiteya/api
```

## Principles

- ✅ Controllers ≤ 50 lines (delegate to services)
- ✅ Services handle business logic
- ✅ Repositories for data access
- ✅ DTOs validated with Zod
- ✅ Errors standardized (AppError)
- ✅ Logging with correlation IDs
