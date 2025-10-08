# 🔍 INSTRUCCIONES: Obtener Connection String de PostgreSQL

## ⚠️ Importante

Lo que tienes son:

- ✅ **Project URL**: `https://xfvjfakdlcfgdolryuck.supabase.co`
- ✅ **API Key (anon)**: `eyJhbGciOiJIUzI...`

Pero para Prisma necesitas la **DATABASE CONNECTION STRING** (PostgreSQL).

## 📋 Pasos para obtenerla:

### 1. Ir a Settings en Supabase

1. Abre tu proyecto en Supabase: <https://supabase.com/dashboard/project/xfvjfakdlcfgdolryuck>
2. Clic en el ícono de **⚙️ Settings** (abajo a la izquierda)
3. Clic en **Database** en el menú lateral

### 2. Buscar "Connection string"

Verás una sección que dice **"Connection string"** con varios tabs:

- **URI** ← **ESTE ES EL QUE NECESITAS**
- Nodejs
- JDBC
- .NET

### 3. Copiar la URI

Clic en el tab **"URI"** y verás algo así:

```text
postgresql://postgres.xfvjfakdlcfgdolryuck:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

### 4. ¿Cuál es tu contraseña?

Es la contraseña que elegiste cuando **creaste el proyecto**.

Si no la recuerdas:

1. Ve a **Settings** > **Database**
2. Busca **"Database password"**
3. Clic en **"Reset database password"**
4. Anota la nueva contraseña

### 5. Actualizar .env

Abre el archivo `.env` que acabamos de crear:

```powershell
notepad .env
```

Reemplaza `[TU-PASSWORD]` en la línea `DB_URL` con tu contraseña real.

**Ejemplo:**

Si tu contraseña es `MiPassword123`, la línea quedaría:

```bash
DB_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:MiPassword123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

## 🔐 Generar claves de seguridad

Ejecuta estos comandos en PowerShell para generar valores aleatorios:

### JWT_SECRET (32 caracteres aleatorios):

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### ENCRYPTION_KEY (32 caracteres aleatorios):

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Copia cada resultado y reemplázalo en `.env`:

```bash
JWT_SECRET=abc123xyz...  # Pegar aquí el primer resultado
ENCRYPTION_KEY=xyz789abc...  # Pegar aquí el segundo resultado
```

## ✅ Verificar configuración

Una vez que hayas actualizado `.env` con todos los valores, ejecuta:

```powershell
npm run check:config
```

Si todo está bien, continúa con:

```powershell
cd packages\api
npx prisma generate
npx prisma migrate dev --name init
cd ..\..
npm run dev
```

## 🐛 Solución rápida si no encuentras la password

Si no recuerdas la contraseña de la base de datos:

1. Ve a Supabase Dashboard
2. **Settings** > **Database**
3. Scroll down hasta **"Database password"**
4. Clic en **"Reset database password"**
5. Supabase te mostrará la nueva contraseña (guárdala)
6. Actualiza tu `.env` con la nueva contraseña

---

**Siguiente paso**: Obtén la connection string y actualiza el archivo `.env`
