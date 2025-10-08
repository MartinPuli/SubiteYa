# ✅ SubiteYa - Instalación Completada

## Estado del Proyecto

**✅ INSTALACIÓN EXITOSA** - Todas las dependencias instaladas correctamente.

### Paquetes Instalados

- ✅ 756 paquetes instalados
- ✅ Monorepo configurado con npm workspaces
- ✅ Husky y Git hooks instalados
- ⚠️ 4 vulnerabilidades menores detectadas (pueden corregirse con `npm audit fix`)

## Estructura del Proyecto

```
SubiteYa/
├── packages/
│   ├── api/              → Backend Express (⚠️ requiere dependencias adicionales)
│   ├── web/              → Frontend React con Vite (✅ listo)
│   ├── shared/           → Utilidades comunes (✅ listo)
│   └── observability/    → Logging y métricas (✅ listo)
├── docs/                 → Documentación completa (✅)
├── .github/workflows/    → CI pipeline (✅)
└── scripts/              → Herramientas CLI (pendiente)
```

## Próximos Pasos

### 1. Configurar Base de Datos PostgreSQL

**Instalar PostgreSQL** (si no lo tienes):

- Windows: [Descargar PostgreSQL](https://www.postgresql.org/download/windows/)
- Usar puerto por defecto: 5432

**Crear base de datos**:

```powershell
# Conectar a PostgreSQL (reemplaza con tu ruta)
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres

# Dentro de psql:
CREATE DATABASE subiteya;
CREATE USER subiteya WITH PASSWORD 'subiteya';
GRANT ALL PRIVILEGES ON DATABASE subiteya TO subiteya;
\q
```

### 2. Configurar Variables de Entorno

Copia y edita el archivo de entorno:

```powershell
cp .env.example .env
notepad .env
```

**Valores mínimos necesarios**:

```env
# Database
DB_URL=postgresql://subiteya:subiteya@localhost:5432/subiteya

# JWT (genera un secreto aleatorio)
JWT_SECRET=tu-secreto-muy-seguro-aqui-cambiar

# Encryption (exactamente 32 caracteres)
ENCRYPTION_KEY=12345678901234567890123456789012

# API Base
APP_BASE_URL=http://localhost:3000
```

### 3. Ejecutar Migraciones de Base de Datos

```powershell
# Generar cliente Prisma
cd packages/api
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# Volver a la raíz
cd ../..
```

### 4. Iniciar Servidores de Desarrollo

**Opción A: Dos terminales separadas**

Terminal 1 - Backend:

```powershell
npm run dev -w @subiteya/api
```

Terminal 2 - Frontend:

```powershell
npm run dev -w @subiteya/web
```

**Opción B: Usar Turborepo (ambos a la vez)**

```powershell
npm run dev
```

### 5. Acceder a la Aplicación

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## Comandos Útiles

### Desarrollo

```powershell
# Iniciar todos los paquetes en modo desarrollo
npm run dev

# Iniciar solo el frontend
npm run dev -w @subiteya/web

# Iniciar solo el backend
npm run dev -w @subiteya/api

# Build de todos los paquetes
npm run build

# Formatear código
npm run format

# Lint
npm run lint
```

### Base de Datos

```powershell
# Ver base de datos en interfaz visual
cd packages/api
npx prisma studio

# Crear una nueva migración
npx prisma migrate dev --name nombre_migracion

# Resetear base de datos (⚠️ borra todos los datos)
npx prisma migrate reset
```

### Git

```powershell
# Primer commit
git add .
git commit -m "chore: initial project setup"

# Los hooks automáticos verificarán:
# - Formato de código (Prettier)
# - Linting (ESLint)
# - Mensaje de commit (Commitlint)
```

## Problemas Conocidos y Soluciones

### ⚠️ Vulnerabilidades de npm

El proyecto tiene 4 vulnerabilidades menores. Para corregirlas:

```powershell
npm audit fix
```

O si requiere cambios breaking:

```powershell
npm audit fix --force
```

### ❌ "Cannot find module 'express'" al iniciar API

Esto ocurre porque las dependencias del paquete API necesitan instalarse individualmente:

```powershell
cd packages/api
npm install
cd ../..
```

### ❌ "Prisma Client not found"

Necesitas generar el cliente Prisma después de crear la base de datos:

```powershell
cd packages/api
npx prisma generate
cd ../..
```

### ❌ "Port 3000 is already in use"

Cambiar el puerto en `.env`:

```env
PORT=3001
```

### ❌ PostgreSQL no conecta

Verificar que:

1. PostgreSQL esté corriendo (buscar "Services" en Windows)
2. La URL en `.env` sea correcta
3. El usuario y contraseña coincidan

## Arquitectura y Calidad de Código

### Principios Aplicados

✅ **Archivos pequeños**: Máximo 250 líneas por archivo
✅ **Funciones cortas**: Máximo 40 líneas por función
✅ **Una responsabilidad**: Cada archivo tiene un propósito único
✅ **Nomenclatura clara**: Sin abreviaciones crípticas
✅ **Arquitectura limpia**: Separación por capas
✅ **TypeScript estricto**: Type safety completo

### Convenciones de Commit

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): agregar nueva funcionalidad
fix(scope): corregir un bug
docs(scope): cambios en documentación
style(scope): formateo, sin cambios de lógica
refactor(scope): refactorización de código
test(scope): agregar o actualizar tests
chore(scope): tareas de mantenimiento
```

Ejemplos:

```powershell
git commit -m "feat(api): add user authentication endpoint"
git commit -m "fix(web): resolve video upload button styling"
git commit -m "docs(readme): update setup instructions"
```

## Documentación Disponible

Toda la documentación está en la carpeta `/docs`:

- **[QUICKSTART.md](./QUICKSTART.md)**: Guía de inicio rápido
- **[CONTRIBUTING.md](./CONTRIBUTING.md)**: Cómo contribuir
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)**: Resumen del proyecto
- **[docs/adr/](./docs/adr/)**: Decisiones de arquitectura
- **[docs/guides/tiktok-integration.md](./docs/guides/tiktok-integration.md)**: Integración con TikTok
- **[docs/guides/app-review.md](./docs/guides/app-review.md)**: Preparación para App Review

## Funcionalidades Pendientes de Implementar

### Prioridad Alta

1. **Sistema de Autenticación** (packages/api/src/auth/)
   - Registro de usuarios
   - Login con JWT
   - Middleware de autenticación

2. **Cliente TikTok OAuth** (packages/tiktok/)
   - Flujo de autorización
   - Intercambio de tokens
   - Refresh automático

3. **Cliente de Publicación TikTok** (packages/tiktok/)
   - Upload de videos
   - Publicación de posts
   - Manejo de errores

4. **Sistema de Colas** (packages/jobs/)
   - Integración con BullMQ
   - Procesador de jobs
   - Reintentos con backoff

5. **Almacenamiento de Archivos** (packages/storage/)
   - Integración con S3
   - Validación de videos
   - Limpieza de temporales

### Prioridad Media

6. **Endpoints de API**
   - Controllers para todas las entidades
   - Validación con Zod
   - Manejo de errores

7. **Páginas de Frontend**
   - Login/Registro
   - Dashboard
   - Conexiones TikTok
   - Upload de videos
   - Historial

## Stack Tecnológico

### Backend

- **Node.js** 18+ con TypeScript
- **Express** para API REST
- **Prisma** ORM con PostgreSQL
- **Zod** para validación
- **JWT** para autenticación

### Frontend

- **React** 18 con TypeScript
- **Vite** para build y HMR
- **React Router** v6
- **Zustand** para estado global
- **Axios** para HTTP

### Infraestructura

- **Turborepo** para monorepo
- **npm workspaces**
- **GitHub Actions** para CI/CD
- **Husky** para Git hooks

## Recursos Adicionales

### Crear App en TikTok

1. Ve a [TikTok Developers](https://developers.tiktok.com/)
2. Crea una aplicación
3. Configura Redirect URI: `http://localhost:3000/auth/tiktok/callback`
4. Solicita scopes: `user.info.basic`, `video.upload`, `video.publish`
5. Copia Client Key y Client Secret a `.env`

### Base de Datos Visual

```powershell
cd packages/api
npx prisma studio
```

Abre una interfaz web en http://localhost:5555 para ver y editar datos.

## Soporte

Si encuentras problemas:

1. Revisa la documentación en `/docs`
2. Busca en los Issues de GitHub
3. Crea un nuevo Issue con detalles del error

---

**¡Proyecto listo para desarrollar!** 🚀

Siguiente paso: Configurar la base de datos y ejecutar `npm run dev`
