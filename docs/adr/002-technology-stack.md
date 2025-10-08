# ADR-002: Technology Stack

**Status**: Accepted  
**Date**: 2025-10-08  
**Deciders**: Architecture Team

## Context

SubiteYa needs a modern, performant, and maintainable technology stack that supports:

- Real-time updates for job status
- Efficient video file handling
- Background job processing with retries
- OAuth integration with TikTok
- Monochromatic, accessible UI

## Decision

### Backend

- **Runtime**: Node.js 18+ (native ES modules, performance)
- **Language**: TypeScript (type safety, developer experience)
- **API Framework**: Express.js (lightweight, proven)
- **Validation**: Zod (TypeScript-first schema validation)
- **Database**: PostgreSQL 14+ (ACID, JSON support, reliability)
- **ORM**: Prisma (type-safe, migrations, introspection)
- **Job Queue**: BullMQ + Redis (robust, retries, priorities)
- **File Storage**: S3-compatible (scalable, durable)

### Frontend

- **Framework**: React 18 (concurrent rendering, ecosystem)
- **Build Tool**: Vite (fast HMR, modern bundling)
- **Routing**: React Router v6 (declarative, nested routes)
- **State**: Zustand (lightweight, simple API)
- **Forms**: React Hook Form + Zod (performance, validation)
- **HTTP Client**: Axios (interceptors, error handling)
- **Styling**: CSS Modules + Design Tokens (scoped, maintainable)

### Security

- **Token Encryption**: AES-256-GCM (OAuth tokens at rest)
- **Password Hashing**: PBKDF2 with SHA-512
- **CSRF Protection**: Double Submit Cookie pattern
- **Rate Limiting**: Express Rate Limit + Redis

### Observability

- **Logging**: Pino (structured, performant)
- **Metrics**: Custom collector (extensible)
- **Tracing**: Request correlation IDs

### Development

- **Monorepo**: Turborepo (efficient builds, caching)
- **Linting**: ESLint + TypeScript ESLint
- **Formatting**: Prettier
- **Commit Convention**: Commitlint (Conventional Commits)
- **Git Hooks**: Husky + lint-staged

## Consequences

### Positive

- ✅ Modern, battle-tested stack
- ✅ Strong type safety across full stack
- ✅ Excellent developer experience
- ✅ Active ecosystems and community
- ✅ Production-ready security primitives

### Negative

- ❌ Learning curve for team (Prisma, BullMQ, Zustand)
- ❌ Node.js single-threaded limits (mitigated with workers)

### Alternatives Considered

- **NestJS**: Too heavyweight for our needs
- **tRPC**: Couples frontend/backend, harder to version API
- **Redux**: Boilerplate overkill for our state management needs
- **TailwindCSS**: Conflicts with custom design token system
