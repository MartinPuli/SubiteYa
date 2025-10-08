# 🔴 PROBLEMA CRÍTICO: No se puede conectar a Supabase

## El Error

```
Can't reach database server at `db.xfvjfakdlcfgdolryuck.supabase.co:5432`
```

Esto significa que:

1. ❌ La contraseña `PyQC3ES3L6vf0j7H` NO es correcta
2. ❌ O el formato del connection string está mal

## ✅ SOLUCIÓN: Obtener el Connection String Correcto

### Paso 1: Ve al Dashboard de Supabase

Abre esta URL en tu navegador:

```
https://supabase.com/dashboard/project/xfvjfakdlcfgdolryuck/settings/database
```

### Paso 2: Busca "Connection string"

En esa página verás una sección llamada **"Connection string"**.

### Paso 3: Selecciona el modo "URI"

Hay varios tabs:

- **PSQL** (línea de comando)
- **URI** ← **SELECCIONA ESTE**
- **JDBC**
- Etc.

### Paso 4: Copia el Connection String

Verás algo como:

```
postgresql://postgres.[ALGO]:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**IMPORTANTE**: Supabase muestra `[YOUR-PASSWORD]` como placeholder. Necesitás reemplazarlo con tu contraseña real.

### Paso 5: ¿No tenés la contraseña?

Si no sabés la contraseña, hacé click en **"Reset database password"** en la misma página.

⚠️ **CUIDADO**: Esto generará una NUEVA contraseña. Supabase la mostrará **UNA SOLA VEZ**. Copiala y guardala.

### Paso 6: Actualiza el .env

Una vez que tengas el connection string correcto, abrí:

```
packages/api/.env
```

Y reemplazá estas líneas:

```env
# Reemplaza CON EL STRING QUE COPIASTE
DB_URL="postgresql://postgres:TU_PASSWORD_REAL@db.xfvjfakdlcfgdolryuck.supabase.co:5432/postgres?sslmode=require"

DIRECT_URL="postgresql://postgres:TU_PASSWORD_REAL@db.xfvjfakdlcfgdolryuck.supabase.co:5432/postgres?sslmode=require"
```

### Paso 7: Reinicia el servidor

```bash
# Presiona Ctrl+C para detener el servidor
# Luego ejecuta:
npm run dev
```

## 🧪 Cómo Probar que Funciona

Una vez que actualices el `.env`, ejecuta este comando para probar la conexión:

```bash
cd packages/api
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.findMany().then(users => { console.log('✅ Conexión exitosa!'); console.log('Usuarios:', users.length); process.exit(0); }).catch(err => { console.error('❌ Error:', err.message); process.exit(1); });"
```

Si ves `✅ Conexión exitosa!` entonces ya está funcionando.

## 📝 Formato del Connection String

El formato correcto debe ser UNO de estos:

### Opción 1: Conexión Directa (Recomendado para desarrollo)

```
postgresql://postgres:PASSWORD@db.xfvjfakdlcfgdolryuck.supabase.co:5432/postgres?sslmode=require
```

### Opción 2: Connection Pooler

```
postgresql://postgres.xfvjfakdlcfgdolryuck:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Nota**: Fijate que en el pooler el usuario es `postgres.xfvjfakdlcfgdolryuck` (con el project ID).

## 🔑 Sobre la Contraseña

La contraseña que pusiste (`PyQC3ES3L6vf0j7H`) claramente **NO funciona**.

Posibles razones:

1. La copiaste mal del dashboard
2. Reseteaste la contraseña después y usás una vieja
3. Estás usando una contraseña diferente

**SOLUCIÓN**: Ve al dashboard y resetea la contraseña. Supabase te dará una nueva y la podés copiar directamente.

## ⚠️ IMPORTANTE

Después de resetear la contraseña en Supabase:

1. El SQL que corriste antes (init.sql) **SIGUE funcionando** - las tablas ya están creadas
2. Solo necesitás actualizar el `.env` con la nueva contraseña
3. No necesitás volver a correr las migraciones

---

**SIGUIENTE ACCIÓN**: Ve a https://supabase.com/dashboard/project/xfvjfakdlcfgdolryuck/settings/database y obtené el connection string correcto.
