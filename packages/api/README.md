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
├── index.ts              → Server bootstrap
├── routes/               → Express route definitions
├── controllers/          → Request handlers
├── services/             → Business logic
├── repositories/         → Data access layer
├── middleware/           → Auth, validation, rate limiting
└── utils/                → Helpers
```

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
