# SubiteYa

**SubiteYa** es una plataforma moderna para gestionar y publicar contenido en múltiples cuentas de TikTok simultáneamente.

## 🎯 Características Principales

- 🔐 Autenticación OAuth con TikTok (Login Kit)
- 📹 Subida de videos una sola vez
- 🚀 Publicación en múltiples cuentas simultáneamente
- ⏰ Programación de publicaciones futuras
- 🔄 Sistema de reintentos automáticos
- 📊 Panel de control con estados en tiempo real
- 📜 Historial completo de publicaciones
- 🎨 Diseño minimalista blanco y negro

## 🏗️ Arquitectura

Este proyecto sigue una arquitectura limpia por capas:

- **Domain**: Entidades y reglas de negocio
- **Application**: Casos de uso y orquestación
- **Interface**: Controladores y adaptadores de transporte
- **Infrastructure**: Integraciones externas (TikTok, DB, Storage)

### Principios de Calidad

- ✅ Máximo 250 líneas por archivo
- ✅ Máximo 40 líneas por función
- ✅ Una responsabilidad por archivo
- ✅ Nomenclatura clara y descriptiva
- ✅ SOLID, KISS, DRY

## 📦 Estructura del Proyecto

```
/packages
  /api          → API REST y controladores
  /jobs         → Sistema de colas y workers
  /tiktok       → Cliente TikTok OAuth y Publishing
  /web          → Frontend React
  /shared       → Utilidades compartidas
  /observability → Logging y métricas
  /security     → Middleware de seguridad
  /storage      → Gestión de archivos
/docs           → Documentación y ADRs
/scripts        → Herramientas CLI
/infra          → Configuración de infraestructura
/tests          → Tests unitarios, integración y E2E
```

## 🚀 Setup Local

### Opción A: Con Supabase (Recomendado) ⚡

**Sin instalación local de PostgreSQL**

1. Crear cuenta gratuita en [Supabase](https://supabase.com)
2. Seguir guía: **[SUPABASE_QUICKSTART.md](./SUPABASE_QUICKSTART.md)**
3. Listo en 5 minutos ✅

### Opción B: PostgreSQL Local

### Prerrequisitos

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6 (opcional, para job queue)
- FFmpeg (opcional, para validación de videos)

### Variables de Entorno

Crear un archivo `.env` en la raíz:

```env
# App
APP_BASE_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key-32-chars

# Database
DB_URL=postgresql://user:password@localhost:5432/subiteya

# Storage
STORAGE_BUCKET=subiteya-videos
MAX_UPLOAD_SIZE_MB=500

# Logging
LOG_LEVEL=info

# Queue
QUEUE_CONCURRENCY=5

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# TikTok
TIKTOK_CLIENT_KEY=your-client-key
TIKTOK_CLIENT_SECRET=your-client-secret
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
TIKTOK_MODE=sandbox
```

### Instalación

```bash
# Instalar dependencias
npm install

# Setup de base de datos
npm run db:migrate

# Iniciar en desarrollo
npm run dev
```

### Crear App en TikTok

1. Ve a [TikTok Developers](https://developers.tiktok.com/)
2. Crea una nueva aplicación
3. Configura el Redirect URI: `http://localhost:3000/auth/tiktok/callback`
4. Solicita los scopes: `user.info.basic`, `video.upload`, `video.publish`
5. Invita testers para modo Sandbox

## 🧪 Testing

```bash
# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Tests E2E
npm run test:e2e

# Coverage
npm run test:coverage
```

## 📚 Documentación

- [Architecture Decision Records](./docs/adr/README.md)
- [API Documentation](./docs/api/README.md)
- [TikTok Integration Guide](./docs/guides/tiktok-integration.md)
- [App Review Guide](./docs/guides/app-review.md)

## 🔒 Seguridad

- Tokens cifrados con AES-256-GCM
- CSRF protection
- Rate limiting
- CORS configurado
- Auditoría completa de eventos

## 📄 Licencia

MIT

## 📞 Soporte

Para reportar issues o solicitar features, abre un issue en GitHub.

---

**Versión**: 1.0.0  
**Última actualización**: Octubre 2025
