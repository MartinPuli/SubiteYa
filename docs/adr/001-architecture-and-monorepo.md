# ADR-001: Architecture and Monorepo Structure

**Status**: Accepted  
**Date**: 2025-10-08  
**Deciders**: Architecture Team

## Context

SubiteYa requires a scalable, maintainable architecture that supports:

- Multiple concerns (auth, video processing, scheduling, API, UI)
- Code reusability across packages
- Independent deployment of services
- Strict code quality standards (max 250 lines/file, max 40 lines/function)

## Decision

We adopt a **monorepo structure with Turborepo** organized by domain:

```
/packages
  /api          → REST API and controllers
  /jobs         → Background jobs and scheduler
  /tiktok       → TikTok OAuth and publishing client
  /web          → React frontend
  /shared       → Common utilities and types
  /observability → Logging and metrics
  /security     → Security middleware
  /storage      → File management
```

### Architectural Layers

Each package follows clean architecture principles:

1. **Domain Layer**: Business entities and rules
2. **Application Layer**: Use cases and orchestration
3. **Interface Layer**: Controllers, CLI, UI
4. **Infrastructure Layer**: External integrations (DB, TikTok, Storage)

### Code Quality Principles

- **File size limit**: 250 lines (exception: 300 with documentation)
- **Function size limit**: 40 lines
- **Single responsibility**: One concern per file
- **No god files**: Extract helpers, strategies, adapters
- **Barrel exports**: Each package exposes clean public API

## Consequences

### Positive

- ✅ Clear separation of concerns
- ✅ Reusable shared code
- ✅ Easier testing (isolated domains)
- ✅ Scalable team structure
- ✅ Enforced code quality standards

### Negative

- ❌ More files to navigate
- ❌ Requires discipline to maintain boundaries
- ❌ Build complexity with workspace dependencies

### Mitigation

- Use consistent naming conventions
- Document each package with README
- Pre-commit hooks enforce standards
- CI validates architecture boundaries
