# 🔧 Fix CORS Completo - Checklist

## ✅ Cambios Realizados

### Backend (`packages/api/src/index.ts`)

1. **Mejorada configuración CORS:**
   - ✅ Agregado `PATCH` a los métodos permitidos
   - ✅ Agregado `X-Requested-With` a headers permitidos
   - ✅ Agregado `exposedHeaders` para respuestas
   - ✅ `maxAge: 86400` (cachea preflight por 24h)
   - ✅ `optionsSuccessStatus: 204` (respuesta limpia para OPTIONS)
   - ✅ `preflightContinue: false` (termina el preflight aquí)

2. **Manejo explícito de preflight:**

   ```typescript
   app.options('*', cors());
   ```

3. **Headers CORS en errores 404 y 500:**
   - ✅ Agregados headers CORS manualmente en handlers de error
   - ✅ Validación de origin en cada error
   - ✅ Headers: `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Vary: Origin`

### Frontend (`packages/web/src/store/authStore.ts`)

4. **Agregado `credentials: 'include'` en fetch:**
   - ✅ En método `login()`
   - ✅ En método `register()`
   - Esto permite enviar/recibir cookies entre dominios

## 🎯 Variables de Entorno en Render

Asegúrate que estén configuradas correctamente:

```env
NODE_ENV=production
APP_BASE_URL=https://subiteya.onrender.com
ALLOWED_ORIGINS=https://martinpuli.github.io,https://martinpuli.github.io/
```

## 🧪 Cómo Probar

### 1. Probar el preflight manualmente:

```bash
curl -i -X OPTIONS https://subiteya.onrender.com/api/auth/login \
  -H "Origin: https://martinpuli.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

**Respuesta esperada:**

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://martinpuli.github.io
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
Vary: Origin
```

### 2. Probar POST real:

```bash
curl -i -X POST https://subiteya.onrender.com/api/auth/login \
  -H "Origin: https://martinpuli.github.io" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

**Respuesta esperada (headers):**

```
Access-Control-Allow-Origin: https://martinpuli.github.io
Access-Control-Allow-Credentials: true
Vary: Origin
```

## 📋 Pasos para Desplegar

1. **Commitear cambios:**

   ```bash
   git add .
   git commit -m "fix: configuración completa CORS con preflight y credentials"
   git push origin main
   ```

2. **Verificar variables en Render:**
   - Dashboard → Tu servicio → Environment
   - Cambiar `NODE_ENV` a `production`
   - Cambiar `APP_BASE_URL` a `https://subiteya.onrender.com`
   - Verificar `ALLOWED_ORIGINS`

3. **Esperar redeploy automático** (1-2 minutos)

4. **Verificar en logs de Render:**

   ```
   🔧 CORS allowed origins: [ 'https://martinpuli.github.io', 'https://martinpuli.github.io/' ]
   🚀 SubiteYa API listening on port 3000
   🌍 Environment: production
   ```

5. **Probar desde el frontend:**
   - Ir a https://martinpuli.github.io/SubiteYa/login
   - Intentar login/registro
   - Abrir DevTools → Network → Ver headers de la respuesta

## 🔍 Qué Buscar en DevTools

### Request Headers (del navegador):

```
Origin: https://martinpuli.github.io
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type
```

### Response Headers (del servidor):

```
Access-Control-Allow-Origin: https://martinpuli.github.io
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Vary: Origin
```

## ❌ Si Sigue Fallando

1. **Limpiar caché de Render:**
   - Dashboard → Settings → Clear build cache
   - Manual Deploy

2. **Verificar que el código se desplegó:**
   - Logs → Buscar "CORS allowed origins"
   - Debe mostrar las URLs correctas

3. **Revisar logs en tiempo real:**
   - Logs → Ver si aparecen mensajes "✅ CORS allowed origin" o "❌ CORS blocked origin"

4. **Temporal workaround:**
   - Agregar `*` temporalmente en `ALLOWED_ORIGINS` para verificar que es CORS el problema
   - Si funciona con `*`, el problema está en la validación de origins
   - **Nota:** No dejar `*` en producción si usas cookies/auth

## 🎉 Éxito

Cuando funcione, deberías ver en los logs:

```
✅ CORS allowed origin: https://martinpuli.github.io
[uuid] POST /api/auth/login - IP: xxx.xxx.xxx.xxx
```

Y en el navegador, el request debe completarse sin errores CORS.
