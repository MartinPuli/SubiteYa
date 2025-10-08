# ADR-004: Multi-Account Publishing Strategy

**Status**: Accepted  
**Date**: 2025-10-08  
**Deciders**: Architecture Team

## Context

SubiteYa's core value proposition is publishing a single video to **multiple TikTok accounts simultaneously**. This requires:

- Idempotency to prevent duplicate posts
- Independent job tracking per account
- Retry logic per account (one failure shouldn't block others)
- Optional overrides per account (different captions, privacy settings)
- Guardrails to prevent abuse and respect rate limits

## Decision

### Architecture

**Fan-out Pattern with Job-per-Account**

When a user creates a `PublishBatch`:

1. User uploads video → creates `VideoAsset`
2. User selects N `TikTokConnection`s and provides defaults
3. System creates **one `PublishJob` per account** (fan-out)
4. Each job is independently queued, executed, and tracked
5. Jobs can have account-specific overrides

### Data Model

```typescript
PublishBatch {
  id, user_id, video_asset_id,
  defaults_json: { caption, hashtags, privacy, flags },
  schedule_time_utc?
}

PublishJob {
  id, batch_id, user_id,
  tiktok_connection_id,  // ← Key: one job per account
  video_asset_id,
  caption, hashtags, privacy_status, flags,
  state, attempts, backoff_sec,
  tiktok_video_id?, error_code?, error_message?,
  idempotency_key  // ← hash(batch_id, video_asset_id, connection_id)
}
```

### Idempotency

Generate key: `SHA256(batch_id:video_asset_id:connection_id)`

- Prevents duplicate jobs if user retries batch creation
- Allows safe job re-enqueuing

### Retry Strategy

Per-job exponential backoff:

```typescript
attempts: 0 → 1 → 2 → 3 (max)
backoff: 5s → 10s → 20s → 40s
```

**Retriable errors**: 429 Rate Limit, 500 Server Error, Network Timeout  
**Non-retriable**: 400 Bad Request, 403 Forbidden, Token Invalid

### Overrides

User can provide account-specific overrides:

```json
{
  "defaults": {
    "caption": "Check this out!",
    "privacyStatus": "public"
  },
  "overrides": {
    "connection-abc-123": {
      "caption": "¡Mira esto! #español"
    },
    "connection-def-456": {
      "privacyStatus": "friends"
    }
  }
}
```

Job processor merges defaults + overrides for each account.

### Guardrails

- **Max 10 accounts per batch** (configurable)
- **Rate limiting**: Global + per-user quotas
- **Staggered execution**: Optional delay between jobs (e.g., 2s) to avoid burst
- **Quota checking**: Pre-flight check of TikTok API quotas

## Consequences

### Positive

- ✅ Truly independent account handling
- ✅ Granular retry and error tracking
- ✅ Flexible per-account customization
- ✅ Horizontally scalable (job workers)
- ✅ Clear audit trail (one row per publish attempt)

### Negative

- ❌ More database rows (N jobs per batch)
- ❌ Complexity in aggregating batch status
- ❌ Potential for resource exhaustion with large N

### Mitigation

- Pagination on job listings
- Batch status computed via aggregation query (cached if needed)
- Admin controls for max accounts per batch
- Monitoring for queue depth and worker saturation
