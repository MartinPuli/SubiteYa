# 🔧 Solución al Error de Conexión

## Problema

El backend no podía conectarse a Supabase mostrando el error:

```
Can't reach database server at `xfvjfakdlcfgdolryuck.pooler.supabase.com:6543`
```

## Causa

El **pooler de Supabase** (puerto 6543) tiene problemas de autenticación con tu contraseña. Esto es un problema conocido cuando se usa el pooler sin la configuración correcta del usuario.

## Solución Aplicada

Cambiamos el `DB_URL` en `packages/api/.env` para usar la **conexión directa** (puerto 5432) en lugar del pooler:

**Antes:**

```env
DB_URL="postgresql://postgres:PyQC3ES3L6vf0j7H@xfvjfakdlcfgdolryuck.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
```

**Después:**

```env
DB_URL="postgresql://postgres:PyQC3ES3L6vf0j7H@db.xfvjfakdlcfgdolryuck.supabase.co:5432/postgres?sslmode=require"
```

## Cómo Aplicar

1. **Detén el servidor**: Presiona `Ctrl+C` en la terminal donde corre `npm run dev`

2. **Reinicia el servidor**:

   ```bash
   npm run dev
   ```

3. **Prueba el registro**: Ve a http://localhost:5173/login
   - Ingresa: Nombre, Email, Password (min 8 caracteres)
   - Click en "Registrarse"
   - Deberías ser redirigido al dashboard

## Verificación

Si todo funciona, deberías ver en los logs:

```
@subiteya/api:dev: 🚀 SubiteYa API listening on port 3000
```

Y **NO** deberías ver más errores de `Can't reach database server`.

## Nota sobre el Pooler

El pooler de Supabase (puerto 6543) es útil para aplicaciones con muchas conexiones concurrentes porque usa connection pooling. Sin embargo, requiere configuración especial del usuario.

Para este MVP, la **conexión directa funciona perfectamente** ya que:

- Es una aplicación de desarrollo local
- No tenemos miles de usuarios concurrentes
- La conexión directa es más simple y confiable

En producción, si necesitás el pooler, tendrás que configurar el usuario como `postgres.[REF]` con el formato correcto.
