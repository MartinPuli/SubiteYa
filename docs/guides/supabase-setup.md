# Configuración de Supabase para SubiteYa

## ¿Por qué Supabase?

✅ **PostgreSQL en la nube** (sin instalación local)  
✅ **Plan gratuito** con 500MB de DB y 1GB de storage  
✅ **Backups automáticos**  
✅ **Dashboard visual** para explorar datos  
✅ **API REST automática** (opcional)  
✅ **Autenticación integrada** (opcional)

## Paso 1: Crear Proyecto

1. **Ir a**: https://supabase.com/
2. Clic en **"Start your project"**
3. Registrarse con GitHub (recomendado) o email
4. Clic en **"New Project"**

### Configuración del Proyecto

```
Organization: (crear una nueva o usar existente)
Project Name: subiteya
Database Password: [GUARDA ESTO - lo necesitarás]
Region: South America (São Paulo) - más cercano a Argentina
Pricing Plan: Free (500MB DB, 1GB Storage)
```

⚠️ **IMPORTANTE**: Anota la contraseña de la base de datos, la necesitarás.

## Paso 2: Obtener Connection String

1. En el dashboard de Supabase, ve a **Settings** (⚙️ abajo a la izquierda)
2. Clic en **Database**
3. Busca la sección **"Connection string"**
4. Selecciona el tab **"URI"**
5. Copia el string que se ve así:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

6. Reemplaza `[YOUR-PASSWORD]` con la contraseña que guardaste

## Paso 3: Configurar .env

Crea el archivo `.env` en la raíz del proyecto:

```bash
# Database (Supabase)
DB_URL=postgresql://postgres:TU_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres

# Security (genera valores aleatorios)
JWT_SECRET=tu-secreto-jwt-muy-seguro-cambia-esto-por-algo-aleatorio
ENCRYPTION_KEY=12345678901234567890123456789012

# App
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000

# TikTok (dejar vacío por ahora)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback

# Redis (opcional, para job queue)
REDIS_URL=redis://localhost:6379

# Storage (AWS S3 - opcional por ahora)
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
```

### Generar valores seguros

**Para JWT_SECRET** (PowerShell):

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Para ENCRYPTION_KEY** (debe ser exactamente 32 caracteres):

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

## Paso 4: Ejecutar Migraciones de Prisma

```powershell
# Ir a la carpeta api
cd packages/api

# Generar cliente Prisma
npx prisma generate

# Crear las tablas en Supabase
npx prisma migrate dev --name init

# Volver a la raíz
cd ../..
```

Esto creará todas las tablas en tu base de datos de Supabase:

- `User`
- `TikTokConnection`
- `VideoAsset`
- `PublishBatch`
- `PublishJob`
- `AuditEvent`
- `WebhookEvent`

## Paso 5: Verificar Tablas en Supabase

1. En el dashboard de Supabase, ve a **Table Editor** (📊)
2. Deberías ver todas las tablas creadas
3. Puedes explorar la estructura y datos visualmente

## Paso 6: Usar Prisma Studio (Opcional)

Para ver y editar datos localmente:

```powershell
cd packages/api
npx prisma studio
```

Abre: http://localhost:5555

## Ventajas de Supabase

### 1. Dashboard Visual

- Ver datos en tiempo real
- Ejecutar queries SQL directamente
- Explorar relaciones entre tablas

### 2. SQL Editor

Puedes ejecutar queries personalizadas:

```sql
SELECT * FROM "User" LIMIT 10;
SELECT * FROM "PublishJob" WHERE state = 'FAILED';
```

### 3. Backups Automáticos

- Plan gratuito: 7 días de backups
- Restauración con un clic

### 4. API REST (Opcional)

Supabase genera automáticamente una API REST para tus tablas.  
**No la usaremos** porque ya tenemos nuestra API con Express, pero está disponible.

### 5. Monitoreo

- Ver queries lentos
- Uso de almacenamiento
- Conexiones activas

## Límites del Plan Gratuito

| Recurso       | Límite          |
| ------------- | --------------- |
| Database      | 500 MB          |
| Storage       | 1 GB            |
| Bandwidth     | 2 GB/mes        |
| API Requests  | Sin límite      |
| Autenticación | 50,000 usuarios |

**Suficiente para desarrollo y MVP** ✅

## Troubleshooting

### Error: "Can't reach database server"

**Solución:**

1. Verifica que la URL en `.env` sea correcta
2. Verifica que reemplazaste `[YOUR-PASSWORD]`
3. Verifica que el proyecto de Supabase esté activo (no pausado)

### Error: "SSL connection required"

Supabase requiere SSL. Agrega esto a tu `DB_URL`:

```env
DB_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require
```

### Proyecto Pausado

Supabase pausa proyectos inactivos después de 1 semana.  
**Solución**: Ir al dashboard y clic en "Restore project"

## Siguientes Pasos

1. ✅ Configurar `.env` con la URL de Supabase
2. ✅ Ejecutar `npx prisma migrate dev`
3. ✅ Verificar tablas en Supabase Dashboard
4. ✅ Iniciar servidores: `npm run dev`

---

**¿Dudas?** Revisa la [documentación oficial de Supabase](https://supabase.com/docs)
