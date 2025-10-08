# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-08

### Added

- OAuth authentication with TikTok (Login Kit)
- Multi-account connection support
- Video upload with validation
- Multi-account publishing (fan-out to N accounts)
- Scheduling system with background jobs
- Automatic retry mechanism with exponential backoff
- Real-time status tracking per job
- Publishing history with filters
- Webhook support for TikTok events
- Audit logging for security events
- Sandbox and Production mode support
- Modern monochromatic UI (black & white)
- Accessibility AA compliance
- Rate limiting and CSRF protection
- Token encryption (AES-256-GCM)
- Observability (logs, metrics, traces)

### Security

- Encrypted storage for OAuth tokens
- RBAC implementation (user/admin)
- Comprehensive audit trail
- CORS configuration
- Rate limiting per IP/user

### Documentation

- Architecture Decision Records
- API documentation with examples
- TikTok integration guide
- App Review preparation guide
