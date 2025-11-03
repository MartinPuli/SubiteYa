# 🚀 Cómo Correr SubiteYa en Local

## 📋 Prerequisitos

1. **Node.js 18+** instalado
2. **PostgreSQL** (Supabase en la nube ya configurado)
3. **Git** instalado
4. **FFmpeg** se instala automáticamente con el proyecto

## 🔧 Instalación Rápida

### 1. Instalar dependencias

```bash
# En la raíz del proyecto
npm install
```

Esto instalará todas las dependencias de todos los paquetes (api, web, shared, observability).

### 2. Configurar variables de entorno

El proyecto ya tiene configuradas las variables de entorno en `.env` en `packages/api/.env`:

- ✅ **DATABASE_URL**: Supabase PostgreSQL (ya configurado)
- ✅ **JWT_SECRET**: Para autenticación
- ✅ **TIKTOK_CLIENT_KEY**: OAuth de TikTok
- ✅ **TIKTOK_CLIENT_SECRET**: OAuth de TikTok
- ✅ **FRONTEND_URL**: http://localhost:5173

**No necesitas cambiar nada**, pero verifica que el archivo existe.

### 3. Sincronizar base de datos

```bash
# Generar cliente de Prisma y sincronizar schema
cd packages/api
npx prisma generate
npx prisma db push
```

Esto sincroniza tu schema de Prisma con la base de datos de Supabase.

## ▶️ Correr el Proyecto

### Opción 1: Correr Todo (Recomendado)

```bash
# En la raíz del proyecto
npm run dev
```

Esto corre **simultáneamente**:

- 🔵 **API Backend** en http://localhost:3000
- 🟢 **Frontend Web** en http://localhost:5173

### Opción 2: Correr por Separado

#### Terminal 1 - Backend API:

```bash
cd packages/api
npm run dev
```

#### Terminal 2 - Frontend Web:

```bash
cd packages/web
npm run dev
```

## 🌐 Acceder a la Aplicación

Una vez que ambos servicios estén corriendo:

1. **Frontend**: http://localhost:5173
2. **API**: http://localhost:3000
3. **Prisma Studio** (opcional):
   ```bash
   cd packages/api
   npx prisma studio
   ```
   Abre en http://localhost:5555

## 📱 Flujo de Usuario

1. **Registro/Login**: http://localhost:5173/register
2. **Conectar TikTok**: http://localhost:5173/connections
3. **Crear Patrón**: http://localhost:5173/patterns/new
4. **Subir Videos**: http://localhost:5173/upload

## 🔍 Verificar que Todo Funciona

### API funcionando:

```bash
curl http://localhost:3000/health
```

Debe responder: `{"status":"ok"}`

### Frontend funcionando:

Abre http://localhost:5173 en tu navegador

### Base de datos conectada:

```bash
cd packages/api
npx prisma studio
```

## ⚡ Scripts Útiles

### Desarrollo

```bash
npm run dev              # Corre todo (API + Web)
npm run build            # Build todo
npm run lint             # Lint todo
```

### Base de Datos (desde packages/api)

```bash
npx prisma generate      # Generar cliente Prisma
npx prisma db push       # Sincronizar schema (sin migrations)
npx prisma studio        # Abrir GUI de base de datos
npx prisma migrate dev   # Crear migration (producción)
```

### Frontend (desde packages/web)

```bash
npm run dev              # Dev server con hot reload
npm run build            # Build para producción
npm run preview          # Preview del build
```

### API (desde packages/api)

```bash
npm run dev              # Dev server con hot reload (tsx watch)
npm run build            # Build TypeScript
npm start                # Correr build de producción
```

## 🐛 Solución de Problemas

### Error: "Cannot find module '@prisma/client'"

```bash
cd packages/api
npx prisma generate
```

### Error: Puerto 3000 o 5173 ocupado

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Ver procesos de Node
tasklist | findstr node
```

### Error: Base de datos no conecta

Verifica que `packages/api/.env` tenga el `DATABASE_URL` correcto de Supabase.

### Frontend no ve la API

Verifica en `packages/web/src/config/api.ts`:

```typescript
const API_BASE_URL = 'http://localhost:3000';
```

## 📦 Estructura de Carpetas

```
SubiteYaRepo/
├── packages/
│   ├── api/           # Backend Express + Prisma
│   │   ├── src/
│   │   ├── prisma/
│   │   └── .env       # Variables de entorno
│   ├── web/           # Frontend React + Vite
│   │   └── src/
│   ├── shared/        # Código compartido
│   └── observability/ # Logs y métricas
├── package.json       # Root package
└── turbo.json         # Configuración Turborepo
```

## 🎯 Siguiente Paso

Una vez que todo esté corriendo:

1. **Regístrate** en http://localhost:5173/register
2. **Conecta tu cuenta de TikTok** (necesitas TikTok OAuth configurado)
3. **Crea un patrón** con tu logo y efectos
4. **Sube un video** y ve la magia ✨

## 🔗 Enlaces Útiles

- **Documentación Completa**: Ver archivos en `/docs/`
- **Supabase Dashboard**: https://supabase.com/dashboard
- **TikTok Developer Portal**: https://developers.tiktok.com/
- **Prisma Docs**: https://www.prisma.io/docs

---

**¿Problemas?** Revisa los logs en la terminal donde corriste `npm run dev`.
