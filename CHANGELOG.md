# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - 2024-11-12

- **Database Connection Stability**: Implementado sistema de reintentos automáticos para conexiones intermitentes con Supabase
  - Agregada función `withRetry` con backoff exponencial (500ms → 1s → 2s)
  - Configurado pool de conexiones optimizado (limit=10, timeout=20s)
  - Aplicado en operaciones críticas: login, registro, refresh token
  - Detecta y reintenta errores P1001, P1002, P1008, P1017
  - Documentación completa en `docs/DATABASE_CONNECTION_RETRY.md`

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
