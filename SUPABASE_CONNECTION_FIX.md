# 🔧 Solución: Error "Tenant or user not found"

## ⚠️ Problema

Prisma no puede conectarse a Supabase con las credenciales actuales.

## ✅ Solución: Obtener la Connection String correcta

### Paso 1: Ir a Supabase Dashboard

Abre tu navegador en:
<https://supabase.com/dashboard/project/xfvjfakdlcfgdolryuck/settings/database>

### Paso 2: Buscar "Connection string"

Scroll down hasta encontrar la sección **"Connection string"**.

Verás varios tabs:

- **URI**
- Nodejs
- JDBC
- .NET

### Paso 3: Seleccionar "URI" y copiar

1. Clic en el tab **"URI"**
2. Verás algo así:

```text
postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

3. **IMPORTANTE**: Hay dos tipos de conexión:

**Session mode** (para migraciones):

```
postgresql://postgres.xfvjfakdlcfgdolryuck:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

**Transaction mode** (para queries):

```
postgresql://postgres.xfvjfakdlcfgdolryuck:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

### Paso 4: Encontrar tu contraseña

¿No recuerdas tu contraseña? Hay dos opciones:

**Opción A: Buscar en "Database Settings"**

En la misma página, busca **"Database password"** y verás si la tienes guardada.

**Opción B: Resetear contraseña**

1. Busca **"Reset Database Password"**
2. Clic en el botón
3. Supabase generará una nueva contraseña
4. **¡CÓPIALA INMEDIATAMENTE!** No la volverás a ver

### Paso 5: Actualizar tu .env

Una vez que tengas la contraseña correcta, edita:

```powershell
notepad packages\api\.env
```

Y actualiza estas líneas (reemplaza `[PASSWORD]` con tu contraseña real):

```env
# Session mode (puerto 5432) - para migraciones
DB_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

# Session mode (sin pgbouncer) - para migraciones
DIRECT_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

**Ejemplo con contraseña inventada "MiPass123":**

```env
DB_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:MiPass123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:MiPass123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### Paso 6: Intentar migración nuevamente

```powershell
cd packages\api
npx prisma migrate dev --name init
```

## 🐛 Si sigue fallando

### Error: "Tenant or user not found"

Significa que:

- ❌ La contraseña está incorrecta
- ❌ El formato de la URL está mal

### Verificación rápida:

1. ¿Tu URL tiene este formato?

   ```
   postgresql://postgres.xfvjfakdlcfgdolryuck:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```

2. ¿La contraseña NO tiene espacios ni caracteres especiales sin escapar?

3. Si la contraseña tiene caracteres especiales como `@`, `#`, `%`, necesitas URL-encodearlos:
   - `@` → `%40`
   - `#` → `%23`
   - `%` → `%25`
   - ` ` (espacio) → `%20`

### Solución alternativa: Usar Supabase Client directamente

Si Prisma sigue fallando, puedes:

1. Ir a Supabase Dashboard
2. SQL Editor
3. Copiar y pegar el contenido de `packages/api/prisma/migrations/*/migration.sql`
4. Ejecutar manualmente

## 📞 Necesitas la contraseña correcta

**La contraseña que tienes actualmente podría estar incorrecta.**

Ve a Supabase y:

1. Reset Database Password
2. Copia la nueva contraseña
3. Actualiza `.env`
4. Intenta de nuevo

---

**Una vez que tengas la conexión funcionando, podrás:**

- ✅ Crear todas las tablas
- ✅ Ver los datos en Supabase Dashboard
- ✅ Usar Prisma Studio
- ✅ Conectar el backend
