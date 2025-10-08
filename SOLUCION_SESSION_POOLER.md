# 🎯 SOLUCIÓN DEFINITIVA: Session Pooler con IPv4

## El Problema Real

Estás en el **plan FREE de Supabase** que:

- ❌ NO soporta conexiones directas (puerto 5432) con IPv4
- ✅ SÍ soporta Session Pooler (puerto 5432) con IPv4 GRATIS

Por eso las conexiones directas fallan: tu computadora usa IPv4 y Supabase free solo permite IPv4 en el pooler.

## ✅ Solución: Usar Session Pooler

### Paso 1: Obtener la Contraseña

En la pantalla de Supabase que tenés abierta:

1. Busca el botón **"Reset database password"** (suele estar arriba a la derecha)
2. Click ahí
3. Supabase generará una nueva contraseña
4. **COPIALA INMEDIATAMENTE** (solo se muestra una vez)

### Paso 2: Obtener el Connection String

En la misma página, buscá la sección **"Session pooler"** (el tercero en tus capturas).

Click en **"View parameters"**.

Vas a ver algo como:

```
postgresql://postgres.xfvjfakdlcfgdolryuck:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### Paso 3: Actualizar el .env

Abrí el archivo: `packages/api/.env`

Vas a ver estas líneas:

```env
DB_URL="postgresql://postgres.xfvjfakdlcfgdolryuck:TU_PASSWORD_AQUI@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

DIRECT_URL="postgresql://postgres.xfvjfakdlcfgdolryuck:TU_PASSWORD_AQUI@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

**Reemplaza `TU_PASSWORD_AQUI`** con la contraseña que copiaste en el Paso 1.

**IMPORTANTE**: Fijate que el usuario es `postgres.xfvjfakdlcfgdolryuck` (con el punto y el project ID).

### Paso 4: Reiniciar el Servidor

```bash
# Presiona Ctrl+C en la terminal donde corre npm run dev
# Luego ejecuta:
npm run dev
```

### Paso 5: Probar

1. Ve a http://localhost:5173
2. Click en "Registrarse"
3. Ingresa nombre, email, password
4. Click en "Registrarse"

Si todo funciona, serás redirigido al dashboard.

## 🔑 Formato del Connection String (Session Pooler)

```
postgresql://postgres.PROJECTID:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

Donde:

- **Usuario**: `postgres.xfvjfakdlcfgdolryuck` (¡incluye el project ID!)
- **Password**: Tu contraseña real de Supabase
- **Host**: `aws-0-sa-east-1.pooler.supabase.com`
- **Puerto**: `5432` (Session pooler usa 5432, no 6543)

## ❓ Si Sigue Fallando

Si después de esto sigue fallando con "Can't reach database server", puede ser que:

1. La contraseña esté mal copiada
2. Haya espacios extras en el `.env`
3. El formato no sea exacto

En ese caso, copiame el connection string completo que te da Supabase (sin la contraseña) y te lo formateo correctamente.

---

**SIGUIENTE ACCIÓN**:

1. Resetea la password en Supabase
2. Copia el connection string del Session Pooler
3. Actualiza el `.env` con la password correcta
4. Reinicia el servidor
