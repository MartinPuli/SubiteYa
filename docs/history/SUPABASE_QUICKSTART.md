# 🚀 Inicio Rápido con Supabase

## ⚡ Setup en 5 Minutos

### 1. Crear Proyecto en Supabase

**Paso a Paso:**

1. Ir a <https://supabase.com> y registrarse
2. Clic en **"New Project"**
3. Configurar:
   - **Name**: `subiteya`
   - **Password**: Crear una segura (y guardarla)
   - **Region**: `South America (São Paulo)`
4. Esperar 2-3 minutos a que se cree el proyecto

### 2. Obtener Connection String

1. En Supabase, ir a **Settings** > **Database**
2. Buscar **"Connection string"** > **URI**
3. Copiar el string (se ve así):

```text
postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghij.supabase.co:5432/postgres
```

4. Reemplazar `[YOUR-PASSWORD]` con tu contraseña real

### 3. Crear Archivo .env

```powershell
# En la raíz del proyecto
Copy-Item .env.example .env
notepad .env
```

**Editar** y pegar tu connection string:

```bash
DB_URL=postgresql://postgres:TU_PASSWORD_REAL@db.abcdefghij.supabase.co:5432/postgres
```

### 4. Generar Claves Seguras

**JWT_SECRET** (ejecutar en PowerShell):

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Copiar el resultado y pegarlo en `.env`:

```bash
JWT_SECRET=ABC123xyz...
```

**ENCRYPTION_KEY** (debe ser exactamente 32 caracteres):

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Copiar y pegar en `.env`:

```bash
ENCRYPTION_KEY=XYZ789abc...
```

### 5. Ejecutar Migraciones

```powershell
# Ir a packages/api
cd packages\api

# Generar Prisma Client
npx prisma generate

# Crear tablas en Supabase
npx prisma migrate dev --name init

# Volver a la raíz
cd ..\..
```

✅ Verás: "Your database is now in sync with your schema"

### 6. Verificar en Supabase

1. Ir a **Table Editor** en Supabase
2. Deberías ver 7 tablas creadas:
   - User
   - TikTokConnection
   - VideoAsset
   - PublishBatch
   - PublishJob
   - AuditEvent
   - WebhookEvent

### 7. Iniciar Proyecto

```powershell
# En la raíz del proyecto
npm run dev
```

**Abre tu navegador:**

- Frontend: <http://localhost:5173>
- API: <http://localhost:3000/health>

## ✅ Checklist

- [ ] Proyecto creado en Supabase
- [ ] Connection string copiado
- [ ] `.env` creado con valores correctos
- [ ] JWT_SECRET generado
- [ ] ENCRYPTION_KEY generado
- [ ] `npx prisma generate` ejecutado
- [ ] `npx prisma migrate dev` ejecutado exitosamente
- [ ] Tablas visibles en Supabase Table Editor
- [ ] `npm run dev` corriendo sin errores
- [ ] Frontend accesible en <http://localhost:5173>
- [ ] API respondiendo en <http://localhost:3000/health>

## 🎯 Siguiente Paso

¡Ya tienes todo listo! Ahora puedes:

1. **Explorar el código** en `packages/`
2. **Ver la arquitectura** en `docs/adr/`
3. **Implementar autenticación** (ver `NEXT_STEPS.md`)
4. **Conectar con TikTok** (ver `docs/guides/tiktok-integration.md`)

## 💡 Tips

### Ver Datos Visualmente

**Opción 1: Supabase Dashboard**

- Ir a **Table Editor** en <https://supabase.com>
- Ver y editar datos con interfaz gráfica

**Opción 2: Prisma Studio**

```powershell
cd packages\api
npx prisma studio
```

Abre: <http://localhost:5555>

### Ejecutar Queries SQL

En Supabase > **SQL Editor**:

```sql
SELECT * FROM "User";
SELECT * FROM "PublishJob" WHERE state = 'FAILED';
```

### Backups

Supabase hace backups automáticos cada día.  
**Restaurar**: Settings > Database > Backups

## 🐛 Problemas Comunes

### Error: "Can't reach database"

**Solución:**

```bash
# Verificar que la URL tenga SSL
DB_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require
```

### Error: "Prisma Client not generated"

**Solución:**

```powershell
cd packages\api
npx prisma generate
cd ..\..
```

### Proyecto Pausado en Supabase

Supabase pausa proyectos inactivos después de 7 días.

**Solución:** Ir al dashboard > clic en **"Restore project"**

---

**¿Listo?** 🚀 Ejecuta `npm run dev` y empieza a desarrollar!
