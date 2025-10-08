# SubiteYa - Quick Start Guide

## Prerequisites

Before starting, ensure you have installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **Redis** 6+ ([Download](https://redis.io/download/))
- **FFmpeg** (for video validation) ([Download](https://ffmpeg.org/download.html))

### Verify installations

```bash
node --version    # Should be >= 18
npm --version     # Should be >= 9
psql --version    # Should be >= 14
redis-cli --version  # Should be >= 6
ffmpeg -version   # Any recent version
```

## Installation Steps

### 1. Clone or navigate to the project

```bash
cd c:\Users\marti\Documents\Martin-Pulitano\SubiteYa
```

### 2. Install dependencies

```bash
npm install
```

This will install all dependencies for all packages in the monorepo.

### 3. Set up environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

```env
# Generate a random JWT secret (32+ characters)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Generate encryption key (exactly 32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key!

# PostgreSQL connection
DB_URL=postgresql://subiteya:subiteya@localhost:5432/subiteya

# Redis (default)
REDIS_URL=redis://localhost:6379

# TikTok App Credentials
TIKTOK_CLIENT_KEY=your_tiktok_client_key_here
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret_here
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
TIKTOK_MODE=sandbox
```

### 4. Set up database

Create PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE subiteya;
CREATE USER subiteya WITH PASSWORD 'subiteya';
GRANT ALL PRIVILEGES ON DATABASE subiteya TO subiteya;
\q
```

Run migrations:

```bash
npm run db:migrate
```

Optionally, seed with test data:

```bash
npm run db:seed
```

### 5. Start Redis

```bash
# Windows (if installed as service)
redis-server

# Or use WSL
wsl redis-server
```

### 6. Start development servers

Open **two terminal windows**:

**Terminal 1 - Backend API:**

```bash
npm run dev -w @subiteya/api
```

**Terminal 2 - Frontend:**

```bash
npm run dev -w @subiteya/web
```

### 7. Access the application

- **Frontend**: <http://localhost:5173>
- **API**: <http://localhost:3000>
- **Health Check**: <http://localhost:3000/health>

## Create TikTok App (for OAuth)

1. Go to [TikTok Developers Portal](https://developers.tiktok.com/)
2. Click "Manage Apps" → "Create an App"
3. Fill in details:
   - **App Name**: SubiteYa Dev
   - **Company/Individual**: Your name
4. Add Redirect URI: `http://localhost:3000/auth/tiktok/callback`
5. Request scopes:
   - `user.info.basic`
   - `video.upload`
   - `video.publish`
6. Copy **Client Key** and **Client Secret** to your `.env` file
7. Invite test users for Sandbox mode

## Testing the App

### 1. Register a user

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the returned `access_token` for authenticated requests.

### 3. Connect TikTok (via browser)

1. Open <http://localhost:5173>
2. Login with test credentials
3. Click "Connect TikTok Account"
4. Authorize with your TikTok test account

### 4. Upload and publish

Use the web interface at <http://localhost:5173/upload>

## Troubleshooting

### "Cannot connect to database"

- Ensure PostgreSQL is running
- Check DB_URL in `.env`
- Verify database and user exist

### "Cannot connect to Redis"

- Start Redis: `redis-server`
- Check REDIS_URL in `.env`

### "Module not found" errors

- Run `npm install` from project root
- Delete `node_modules` and reinstall if needed

### TikTok OAuth fails

- Verify Redirect URI matches exactly (no trailing slash)
- Check Client Key/Secret in `.env`
- Ensure test user is invited to Sandbox

### Port already in use

Change ports in `.env`:

```env
# For API
PORT=3001

# For web, edit vite.config.ts
server: { port: 5174 }
```

## Next Steps

- Read [TikTok Integration Guide](./docs/guides/tiktok-integration.md)
- Review [Architecture Decision Records](./docs/adr/README.md)
- Explore [API Documentation](./packages/api/README.md)
- Check out [Design System](./packages/web/src/design/tokens.ts)

## Development Commands

```bash
# Run all dev servers
npm run dev

# Build all packages
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format

# Database migrations
npm run db:migrate
npm run db:seed
```

## Need Help?

- Open an issue on GitHub
- Check existing documentation in `/docs`
- Review package READMEs

---

**Happy coding! 🚀**
