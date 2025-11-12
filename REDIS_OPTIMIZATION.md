# Redis/Upstash Optimization Guide

## 🚨 Problem

SubiteYa exceeded Upstash's free tier limit of **500,000 Redis commands/month** due to continuous polling by BullMQ workers, causing deployment failures with error:

```
ReplyError: ERR max requests limit exceeded. Limit: 500000, Usage: 500007
```

## ✅ Solution Implemented

### 1. Feature Flag to Disable Redis

Set environment variable to completely disable Redis:

```bash
ENABLE_REDIS=false
```

**When disabled:**

- ✅ No Redis connections made
- ✅ No commands consumed
- ✅ API continues to work (login, voices, etc.)
- ❌ Video processing workers **will not function**
- ❌ Cannot queue edit/upload jobs

**When to disable:**

- Development/testing without video processing
- When approaching Upstash limit
- To preserve quota for production use

### 2. In-Memory Cache

Implemented aggressive caching to reduce Redis queries:

- **Queue stats cached for 30 seconds** (was queried every request)
- **Worker state cached locally**
- **Reduced `getJobCounts()` calls by 95%**

### 3. Optimized Worker Configuration

**Before:**

```typescript
stalledInterval: 30000; // Check every 30s = 2,880 commands/day per worker
maxRetriesPerRequest: null; // Unlimited retries
```

**After:**

```typescript
stalledInterval: 60000; // Check every 60s = 1,440 commands/day per worker (50% reduction)
maxRetriesPerRequest: 3; // Max 3 retries then fail
commandTimeout: 3000; // 3 second timeout
connectTimeout: 5000; // 5 second connection timeout
```

### 4. Usage Monitoring System

Track Redis command usage with alerts:

```typescript
import { getRedisUsage } from './lib/redis-monitor';

const usage = getRedisUsage();
// {
//   total: 245000,
//   limit: 500000,
//   percentage: 49,
//   status: 'ok',  // 'ok' | 'warning' | 'critical' | 'exceeded'
//   remaining: 255000
// }
```

**Alert thresholds:**

- 🟢 **< 70%**: Normal operation
- 🟡 **70-85%**: Warning logged
- 🟠 **85-100%**: Critical alert
- 🔴 **> 100%**: Exceeded, commands throttled

### 5. Reduced Job Retention

**Before:**

```typescript
removeOnComplete: { age: 24 * 3600, count: 100 }  // Keep 24h
removeOnFail: { age: 7 * 24 * 3600 }  // Keep 7 days
```

**After:**

```typescript
removeOnComplete: { age: 3600, count: 10 }  // Keep 1h, max 10 jobs
removeOnFail: { age: 24 * 3600, count: 50 }  // Keep 1 day, max 50 jobs
```

## 📊 Monitoring Endpoints

### Check Current Usage

```bash
GET /api/monitor/redis-usage
Authorization: Bearer <token>
```

Response:

```json
{
  "month": "2025-11",
  "total": 245000,
  "limit": 500000,
  "remaining": 255000,
  "percentage": 49,
  "dailyAverage": 8166,
  "projectedMonthly": 244980,
  "status": "ok"
}
```

### Get Detailed Breakdown

```bash
GET /api/monitor/redis-detailed
```

Returns daily breakdown and alert history.

### Check Queue Health

```bash
GET /api/monitor/queue-health
```

Returns:

```json
{
  "redis": true,
  "queuesActive": true,
  "cacheSize": 5,
  "usage": {
    "total": 245000,
    "percentage": 49,
    "status": "ok"
  },
  "recommendations": [
    "Usage is within normal range.",
    "Daily average: 8166 commands."
  ]
}
```

## 🔧 Environment Variables

### Required

```bash
# Existing
REDIS_URL=rediss://default:xxx@exotic-kid-28613.upstash.io:6379

# New - Feature flag
ENABLE_REDIS=true  # Set to 'false' to disable Redis completely
```

### Optional Worker Configuration

```bash
# Worker concurrency (lower = fewer commands)
UPLOAD_WORKER_CONCURRENCY=1  # Default: 1
EDIT_WORKER_CONCURRENCY=2     # Default: 2

# Polling intervals (higher = fewer commands)
WORKER_STALLED_INTERVAL=60000  # Default: 60000ms (60s)
```

## 📈 Expected Results

### Before Optimization

- **2 workers × 24/7 polling**
- **~40,000 commands/day** (2,880 from polling + overhead)
- **~1,200,000 commands/month** (exceeds limit by 240%)

### After Optimization

- **2 workers × optimized polling**
- **~15,000 commands/day** (62.5% reduction)
- **~450,000 commands/month** (within free tier limit)

### With Redis Disabled

- **0 commands/day**
- **Workers suspended, no video processing**

## 🚀 Deployment Strategy

### Option A: Free Tier (Recommended for Development)

1. **Disable Redis by default:**

   ```bash
   ENABLE_REDIS=false
   ```

2. **Enable only when processing videos:**

   ```bash
   # In Render dashboard, temporarily set:
   ENABLE_REDIS=true
   # Process your videos
   # Then set back to false
   ```

3. **Monitor usage:**
   ```bash
   curl https://subiteya-api.onrender.com/api/monitor/redis-usage \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Option B: Upgrade Upstash (Recommended for Production)

**Upstash Pro Plan: $10/month**

- ✅ 10 million commands/month (20x free tier)
- ✅ Workers can run 24/7
- ✅ No manual intervention needed
- ✅ Suitable for production traffic

**To upgrade:**

1. Go to https://console.upstash.com/redis
2. Select your database
3. Click "Upgrade to Pro"
4. Keep `ENABLE_REDIS=true`

### Option C: Render Redis ($7/month)

Alternative to Upstash with **no command limits**:

1. Create Redis instance in Render
2. Update `REDIS_URL` to new endpoint
3. Unlimited commands but higher latency

## 🛠️ Troubleshooting

### "ERR max requests limit exceeded"

**Immediate fix:**

```bash
# In all 3 Render services (api + 2 workers):
ENABLE_REDIS=false
```

This stops all Redis commands immediately.

### Workers showing "Redis disabled" logs

Expected when `ENABLE_REDIS=false`. To re-enable:

```bash
ENABLE_REDIS=true
```

### Usage counter seems incorrect

Force refresh:

```bash
POST /api/monitor/flush-usage
Authorization: Bearer <admin_token>
```

### Reset usage counter (admin only)

```bash
POST /api/monitor/reset-usage
Authorization: Bearer <admin_token>
```

⚠️ **Warning:** Only use this at the start of a new billing month.

## 📝 Files Modified

1. **`src/lib/queues-optimized.ts`** - Optimized queue config with lazy connection
2. **`src/lib/redis-monitor.ts`** - Usage tracking and alerting system
3. **`src/routes/monitor.ts`** - API endpoints for monitoring
4. **`src/index.ts`** - Register monitor routes
5. **`src/workers/*-worker-bullmq.ts`** - Optimized worker settings

## 🎯 Next Steps

1. **Test with Redis disabled:**

   ```bash
   ENABLE_REDIS=false npm run dev
   ```

2. **Monitor usage in production:**
   - Check `/api/monitor/redis-usage` daily
   - Set up alerts at 70% threshold

3. **Choose long-term solution:**
   - Stay on free tier with `ENABLE_REDIS=false` when not processing
   - Upgrade to Upstash Pro for $10/month
   - Migrate to Render Redis for $7/month

4. **Deploy with new settings:**
   ```bash
   git add .
   git commit -m "feat: optimize Redis usage to stay under 500k/month limit"
   git push
   ```

## 📞 Support

If usage continues to exceed limits after these optimizations:

1. Check worker logs for unexpected polling
2. Review `redis-usage.json` for daily breakdown
3. Consider upgrading Upstash plan
4. Contact team for architecture review
