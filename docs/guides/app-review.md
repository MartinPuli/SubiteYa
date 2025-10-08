# TikTok App Review Preparation Guide

## Overview

This guide helps you prepare SubiteYa for TikTok's app review process to move from **Sandbox** to **Production** mode.

## Review Checklist

### ✅ Required Materials

1. **Video Demo** (mandatory)
2. **Privacy Policy** (mandatory)
3. **Terms of Service** (mandatory)
4. **Scope Justification** (mandatory)
5. **App Description**
6. **Use Case Documentation**

## 1. Video Demo Requirements

### Content

Create a 2-3 minute screen recording showing:

1. **User Registration/Login**
2. **TikTok OAuth Flow**
   - Click "Connect TikTok"
   - User authorizes permissions
   - Success confirmation
3. **Multi-Account Setup**
   - Connect 2-3 TikTok accounts
   - Show account list with avatars/names
4. **Video Upload**
   - Upload a test video
   - Show validation and preview
5. **Multi-Account Publishing**
   - Select multiple accounts
   - Configure caption, hashtags, privacy
   - Submit for publishing
6. **Status Tracking**
   - Show real-time job status
   - Display completed posts with links
7. **Account Management**
   - Revoke connection
   - Show token refresh (if possible)

### Technical Specs

- **Format**: MP4, 1080p
- **Duration**: 2-3 minutes
- **Audio**: Clear narration explaining each step
- **Language**: English (add subtitles if helpful)
- **Tools**: OBS Studio, Loom, or QuickTime

### Key Points to Demonstrate

- ✅ Clear consent flow (user understands permissions)
- ✅ Secure token handling (no tokens shown in UI)
- ✅ Respectful of user data (no unexpected actions)
- ✅ Error handling (show what happens on failure)
- ✅ Account disconnection (user can revoke access)

## 2. Scope Justification

For each requested scope, provide clear justification:

### `user.info.basic`

**Purpose**: Display connected account information to users

**Usage**:

- Show TikTok username and avatar in connection list
- Help users identify which accounts are connected
- Improve UX by showing account details before publishing

**Frequency**: Retrieved once during OAuth, cached locally

**Data Retention**: Stored until user disconnects account

### `video.upload`

**Purpose**: Upload video files on behalf of users to TikTok

**Usage**:

- Users upload videos to SubiteYa once
- SubiteYa uploads to each connected TikTok account
- Enables multi-account publishing core feature

**Frequency**: Every time user publishes to TikTok

**Data Retention**: Videos temporarily stored during upload process, then deleted

### `video.publish`

**Purpose**: Publish videos to connected TikTok accounts

**Usage**:

- Create posts on user-selected accounts
- Apply user-configured settings (caption, privacy, etc.)
- Enable scheduled publishing for future dates

**Frequency**: Immediate or scheduled based on user choice

**User Control**: Users explicitly select which accounts to publish to

## 3. Privacy Policy (Template)

### Data Collection

**What we collect**:

- Email, name (for SubiteYa account)
- TikTok user ID, display name, avatar URL
- OAuth access/refresh tokens (encrypted)
- Video files (temporary during upload)
- Publishing history and job status

**Why we collect it**:

- Authenticate users
- Connect and manage TikTok accounts
- Upload and publish videos
- Track publishing status and history

**How we protect it**:

- Tokens encrypted with AES-256-GCM
- HTTPS for all communications
- Regular security audits
- No selling of user data

### Data Sharing

We **DO NOT**:

- Sell user data to third parties
- Share data with advertisers
- Use data for purposes other than stated

We **MAY** share data with:

- TikTok (via official APIs only)
- Cloud providers (AWS, Azure) for infrastructure
- Analytics services (anonymized metrics)

### User Rights

Users can:

- Request data export (JSON format)
- Request data deletion
- Revoke TikTok account connections anytime
- Close SubiteYa account and delete all data

### Data Retention

- Active accounts: Retained indefinitely
- Deleted accounts: Purged within 30 days
- Video files: Deleted after successful publish
- Logs: Retained 90 days

## 4. Terms of Service (Key Points)

### Acceptable Use

Users **MAY**:

- Connect personal TikTok accounts they own/manage
- Upload original content or content they have rights to
- Schedule posts for future publishing

Users **MAY NOT**:

- Upload copyrighted content without permission
- Spam or abuse TikTok's platform
- Violate TikTok's Community Guidelines
- Use for automation beyond personal/business management

### Account Termination

We reserve the right to terminate accounts that:

- Violate our Terms of Service
- Abuse the platform (spam, illegal content)
- Circumvent rate limits or security measures

### Liability

- SubiteYa is not responsible for TikTok API downtime
- No guarantee of publish success (depends on TikTok)
- Users responsible for content they publish

## 5. App Description

**Elevator Pitch**:

> SubiteYa is a multi-account TikTok content scheduler that allows creators and businesses to upload a video once and publish it to multiple TikTok accounts simultaneously, saving time and improving workflow efficiency.

**Use Cases**:

1. **Social Media Managers**: Manage multiple client accounts
2. **Multi-Brand Businesses**: Publish to regional accounts
3. **Content Creators**: Manage personal + business accounts
4. **Agencies**: Schedule content across client portfolio

**Key Features**:

- OAuth-secured account connections
- One-time video upload
- Multi-account publishing with per-account customization
- Scheduling for future posting
- Real-time status tracking
- Publishing history and analytics

## 6. Common Review Questions

### Q: Why do you need multiple account support?

**A**: Our target users are social media managers, agencies, and businesses with multiple regional or brand accounts. Publishing the same content across accounts is a common workflow, and SubiteYa automates this to save time.

### Q: How do you prevent abuse?

**A**: We implement:

- Rate limiting (per-user and global)
- Max 10 accounts per publish batch
- Monitoring for spam patterns
- Abuse reporting mechanism
- Account suspension for violations

### Q: What happens to user data if SubiteYa shuts down?

**A**: Users receive 30-day notice and can export all data (JSON format). We provide instructions to revoke TikTok access directly via TikTok settings.

### Q: How do you handle token security?

**A**: All OAuth tokens are encrypted at rest using AES-256-GCM. Tokens are never logged or exposed in UI. We use secure token rotation and proactive refresh before expiry.

## 7. Submission Process

1. **Prepare Materials**: Gather video, policies, justifications
2. **Submit via Developer Portal**:
   - Log into TikTok Developers
   - Navigate to your app
   - Click "Request Production Access"
   - Upload materials
3. **Wait for Review**: Typically 5-10 business days
4. **Respond to Feedback**: TikTok may request clarifications
5. **Approval**: Update `TIKTOK_MODE=production`

## 8. Post-Approval Checklist

- [ ] Update environment variables to production mode
- [ ] Test OAuth flow with real accounts
- [ ] Monitor error rates closely
- [ ] Set up alerts for quota limits
- [ ] Communicate to users about production launch

## Resources

- [TikTok App Review Guidelines](https://developers.tiktok.com/doc/app-review-guidelines)
- [Privacy Policy Generator](https://www.privacypolicies.com/)
- [Terms of Service Generator](https://www.termsofservicegenerator.net/)
