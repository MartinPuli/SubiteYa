# TikTok Integration Guide

## Overview

SubiteYa integrates with TikTok using the following APIs:

- **Login Kit**: OAuth 2.0 authentication
- **Content Posting API**: Video upload and publish

## Prerequisites

1. Create an app at [TikTok for Developers](https://developers.tiktok.com/)
2. Configure Redirect URIs
3. Request required scopes
4. Invite testers for Sandbox mode

## Step 1: Create TikTok App

1. Go to [TikTok Developer Portal](https://developers.tiktok.com/)
2. Click "Create App"
3. Fill in app details:
   - **Name**: SubiteYa
   - **Description**: Multi-account TikTok publisher
   - **Category**: Social Media Tools
   - **Website**: https://subiteya.com (or your domain)

## Step 2: Configure OAuth

### Add Redirect URIs

For **local development**:

```text
http://localhost:3000/auth/tiktok/callback
```

For **production**:

```text
https://subiteya.com/auth/tiktok/callback
https://app.subiteya.com/auth/tiktok/callback
```

### Request Scopes

SubiteYa requires the following permissions:

| Scope             | Purpose                         |
| ----------------- | ------------------------------- |
| `user.info.basic` | Get user profile (name, avatar) |
| `video.upload`    | Upload video files to TikTok    |
| `video.publish`   | Publish uploaded videos         |

**Justification for App Review**:

- We need `user.info.basic` to display connected account information
- We need `video.upload` to upload videos on behalf of users
- We need `video.publish` to create posts on connected accounts

## Step 3: Sandbox Mode

### Invite Testers

1. In TikTok Developer Portal, go to your app
2. Navigate to "Sandbox" section
3. Click "Add Testers"
4. Enter TikTok usernames or email addresses
5. Testers will receive invitations

### Testing Flow

1. Tester accepts invitation
2. Tester logs into SubiteYa
3. Clicks "Connect TikTok Account"
4. Authorizes with sandbox credentials
5. Can now publish videos (visible only to tester)

## Step 4: Environment Variables

Add to `.env`:

```env
TIKTOK_CLIENT_KEY=your_client_key_here
TIKTOK_CLIENT_SECRET=your_client_secret_here
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
TIKTOK_MODE=sandbox
```

For production, change `TIKTOK_MODE=production`

## OAuth Flow Details

### Authorization Request

```http
GET https://www.tiktok.com/v2/auth/authorize/
  ?client_key={CLIENT_KEY}
  &scope=user.info.basic,video.upload,video.publish
  &response_type=code
  &redirect_uri={REDIRECT_URI}
  &state={RANDOM_STATE}
```

### Token Exchange

```http
POST https://open.tiktokapis.com/v2/oauth/token/
Content-Type: application/x-www-form-urlencoded

client_key={CLIENT_KEY}
&client_secret={CLIENT_SECRET}
&code={AUTHORIZATION_CODE}
&grant_type=authorization_code
&redirect_uri={REDIRECT_URI}
```

**Response**:

```json
{
  "access_token": "act.example",
  "refresh_token": "rft.example",
  "expires_in": 86400,
  "token_type": "Bearer",
  "scope": "user.info.basic,video.upload,video.publish",
  "open_id": "user123"
}
```

### Token Refresh

```http
POST https://open.tiktokapis.com/v2/oauth/token/
Content-Type: application/x-www-form-urlencoded

client_key={CLIENT_KEY}
&client_secret={CLIENT_SECRET}
&grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
```

## Video Upload Flow

### 1. Initialize Upload

```http
POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 5242880,
    "chunk_size": 5242880,
    "total_chunk_count": 1
  }
}
```

### 2. Upload Video Chunks

```http
PUT {upload_url}
Content-Range: bytes 0-5242879/5242880
Content-Type: video/mp4

[binary video data]
```

### 3. Publish Video

```http
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "post_info": {
    "title": "Video caption",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_id": "v0201234567890abcdef"
  }
}
```

## Rate Limits

| Endpoint      | Limit       |
| ------------- | ----------- |
| Token         | 5 req/min   |
| User Info     | 100 req/min |
| Video Upload  | 10 req/min  |
| Video Publish | 6 posts/day |

**Important**: SubiteYa implements:

- Retry logic with exponential backoff
- Rate limit detection (429 responses)
- Graceful degradation

## Error Handling

| Error Code | Meaning               | Action                   |
| ---------- | --------------------- | ------------------------ |
| 400        | Bad Request           | Show error to user       |
| 401        | Invalid/Expired Token | Trigger token refresh    |
| 403        | Insufficient Scope    | Request re-authorization |
| 429        | Rate Limit Exceeded   | Retry with backoff       |
| 500        | TikTok Server Error   | Retry with backoff       |

## Security Considerations

1. **Token Storage**: Tokens are encrypted with AES-256-GCM
2. **State Parameter**: Random string validated on callback
3. **Token Rotation**: Refresh tokens proactively before expiry
4. **Scope Validation**: Verify granted scopes match requested
5. **HTTPS Only**: All OAuth flows over HTTPS in production

## Troubleshooting

### "Invalid Redirect URI"

- Ensure URI in code matches exactly what's configured in TikTok app
- No trailing slashes
- Protocol must match (http vs https)

### "Insufficient Scope"

- User may have denied permissions
- Request re-authorization with explanation

### "Upload Failed"

- Check video format (mp4, mov, webm)
- Check file size (max 500 MB in most cases)
- Verify upload URL hasn't expired

## Resources

- [TikTok API Documentation](https://developers.tiktok.com/doc/overview)
- [OAuth 2.0 Guide](https://developers.tiktok.com/doc/oauth-overview)
- [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started)
