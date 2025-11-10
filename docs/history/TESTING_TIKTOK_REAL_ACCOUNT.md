# 🎬 Testing con Cuenta Real de TikTok

## 🎯 Objetivo

Probar la vinculación de tu cuenta de TikTok y subir un video real usando SubiteYa.

## 📋 Pre-requisitos Completados

### ✅ Checklist Antes de Empezar

- [ ] Backend desplegado en Render: https://subiteya-1.onrender.com
- [ ] Frontend desplegado en GitHub Pages: https://franjm923.github.io/SubiteYa/
- [ ] Rama `feature/estilosedit` mergeada a `main`
- [ ] TikTok Developer App creada
- [ ] Variables configuradas en Render
- [ ] ENCRYPTION_KEY generado y agregado
- [ ] CORS permite GitHub Pages

## 🔧 Configuración TikTok Developer

### Paso 1: Crear/Verificar App en TikTok

1. **Ir a:** https://developers.tiktok.com/apps

2. **Tu app debe tener:**

   ```
   App Name: SubiteYa

   Redirect URIs:
   ✅ https://subiteya-1.onrender.com/api/auth/tiktok/callback
   ✅ https://franjm923.github.io/SubiteYa/auth/callback

   Scopes (Permisos):
   ✅ user.info.basic
   ✅ video.upload
   ✅ video.publish
   ```

3. **Copiar credenciales:**
   - Client Key (App ID)
   - Client Secret

### Paso 2: Variables en Render

Ir a: https://dashboard.render.com → [Tu servicio] → Environment

```bash
# ========================================
# TikTok OAuth Credentials
# ========================================
TIKTOK_CLIENT_KEY=sbawzqfs69au63lgs0
TIKTOK_CLIENT_SECRET=<tu_secret_aqui>
TIKTOK_REDIRECT_URI=https://subiteya-1.onrender.com/api/auth/tiktok/callback

# ========================================
# Security & Legal (Nuevo)
# ========================================
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=<tu_encryption_key_32_bytes>

JWT_SECRET=<tu_jwt_secret>

# ========================================
# Rate Limiting
# ========================================
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_PUBLISH_PER_WINDOW=10

# ========================================
# CORS - MUY IMPORTANTE
# ========================================
ALLOWED_ORIGINS=https://franjm923.github.io,https://subiteya-1.onrender.com,http://localhost:5173,http://localhost:3000

# ========================================
# Database
# ========================================
DB_URL=postgresql://...
DIRECT_URL=postgresql://...

# ========================================
# App Config
# ========================================
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://subiteya-1.onrender.com
```

**⚠️ IMPORTANTE:** Después de guardar, Render redesplegará automáticamente.

## 🧪 Testing Paso a Paso

### Test 1: Verificar Backend ✅

```bash
# 1. Health check
curl https://subiteya-1.onrender.com/health

# Esperado:
# {"status":"ok","timestamp":"...","uptime":...}

# 2. Verificar logs en Render
# Debe mostrar:
# ✅ Encryption test passed
# 🚀 SubiteYa API listening on port 3000
```

### Test 2: Crear Cuenta en SubiteYa ✅

**Opción A: Desde GitHub Pages**

1. Ir a: https://franjm923.github.io/SubiteYa/register
2. Llenar formulario:
   - Email: `tu_email@gmail.com`
   - Password: `TuPassword123!`
   - Name: `Tu Nombre`
   - ✅ Checkbox: "Acepto los Términos y Condiciones"
   - ✅ Checkbox: "Acepto la Política de Privacidad"
3. Click "Registrarse"
4. Deberías ver redirect al dashboard

**Opción B: Con curl**

```bash
curl -X POST https://subiteya-1.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu_email@gmail.com",
    "password": "TuPassword123!",
    "name": "Tu Nombre",
    "acceptedTerms": true,
    "acceptedPrivacy": true
  }'

# Guarda el token de la respuesta
```

### Test 3: Vincular Cuenta de TikTok 🎯

**Desde el Frontend:**

1. **Login en SubiteYa:**
   - Ir a: https://franjm923.github.io/SubiteYa/login
   - Email: `tu_email@gmail.com`
   - Password: `TuPassword123!`

2. **Ir a Cuentas TikTok:**
   - Click en menú → "Cuentas TikTok"
   - O ir directamente a: https://franjm923.github.io/SubiteYa/connections

3. **Conectar Cuenta:**
   - Click en "Conectar Cuenta de TikTok"
   - Serás redirigido a: `https://www.tiktok.com/v2/auth/authorize/...`

4. **Autorizar en TikTok:**
   - TikTok te pedirá login (si no estás logueado)
   - Verás qué permisos pide SubiteYa
   - Click "Autorizar"

5. **Redirect de Vuelta:**
   - TikTok te redirige a: `https://subiteya-1.onrender.com/api/auth/tiktok/callback?code=...`
   - El backend procesa el código
   - **IMPORTANTE:** Los tokens se guardarán **encriptados** con AES-256-GCM
   - Finalmente redirige a: `https://franjm923.github.io/SubiteYa/connections`

6. **Verificar:**
   - Deberías ver tu cuenta de TikTok en la lista
   - Con tu foto de perfil y username

### Test 4: Verificar Tokens Encriptados 🔐

**En la base de datos (Render → PostgreSQL):**

```sql
SELECT
  id,
  user_id,
  display_name,
  open_id,
  access_token_enc,  -- ⬅️ ENCRIPTADO
  refresh_token_enc, -- ⬅️ ENCRIPTADO
  created_at
FROM tiktok_connections
WHERE user_id = '<tu_user_id>'
ORDER BY created_at DESC
LIMIT 1;
```

**Verificar:**

- `access_token_enc` tiene formato: `<iv_base64>:<authTag_base64>:<encrypted_base64>`
- `refresh_token_enc` igual formato
- NO son tokens en texto plano

### Test 5: Subir Video a TikTok 🎥

**Desde el Frontend:**

1. **Ir a Upload:**
   - https://franjm923.github.io/SubiteYa/upload

2. **Seleccionar Video:**
   - Drag & drop o click para subir
   - Video debe ser formato TikTok (9:16, MP4, < 500MB)

3. **Configurar Publicación:**
   - Caption: "Test desde SubiteYa 🚀"
   - Hashtags: #test #subiteya
   - Privacy: Público/Privado
   - Permitir: Duet, Stitch, Comentarios

4. **Seleccionar Cuenta:**
   - Elegir tu cuenta de TikTok vinculada
   - Click "Publicar"

5. **Verificar Proceso:**
   - El video se sube al backend
   - El backend lo publica a TikTok usando los tokens **desencriptados**
   - Deberías ver progreso en la UI
   - Al completar, aparece el ID del video en TikTok

6. **Verificar en TikTok:**
   - Ir a tu perfil de TikTok
   - Deberías ver el video publicado

### Test 6: Auditoría de Eventos 📊

**Verificar en base de datos:**

```sql
SELECT
  type,
  user_id,
  details_json,
  ip,
  created_at
FROM audit_events
WHERE user_id = '<tu_user_id>'
ORDER BY created_at DESC
LIMIT 20;
```

**Deberías ver:**

- `auth.register` - Cuando creaste la cuenta
- `auth.login` - Cuando hiciste login
- `legal.accepted` - Cuando aceptaste términos y privacidad
- `tiktok.account_linked` - Cuando vinculaste TikTok
- `tiktok.publish_started` - Cuando empezaste a publicar
- `tiktok.publish_succeeded` - Cuando se publicó exitosamente

### Test 7: Desvincular Cuenta (Opcional) ⚠️

**Desde el Frontend:**

1. Ir a: https://franjm923.github.io/SubiteYa/connections
2. En tu cuenta de TikTok, click "Desconectar"
3. Confirmar acción

**Verificar:**

- Los tokens encriptados se eliminan de la DB
- La cuenta desaparece de la lista
- Evento `tiktok.account_unlinked` en audit_events

## 🐛 Troubleshooting

### Error: "CORS blocked"

**Síntoma:**

```
Access to fetch at 'https://subiteya-1.onrender.com/api/...' from origin 'https://franjm923.github.io' has been blocked by CORS policy
```

**Solución:**

```bash
# En Render, verificar ALLOWED_ORIGINS incluye:
ALLOWED_ORIGINS=https://franjm923.github.io,https://subiteya-1.onrender.com
```

### Error: "Redirect URI mismatch"

**Síntoma:**
TikTok muestra error después de autorizar.

**Solución:**

1. Ir a TikTok Developer → Tu App → Settings
2. Verificar Redirect URIs exactos:
   ```
   https://subiteya-1.onrender.com/api/auth/tiktok/callback
   ```
3. NO debe tener espacios ni barras extra al final

### Error: "Failed to encrypt token"

**Síntoma:**
Backend logs muestran error de encriptación.

**Solución:**

```bash
# Generar nuevo ENCRYPTION_KEY válido:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Agregar en Render (debe ser exactamente 32 bytes en base64)
ENCRYPTION_KEY=<output_del_comando>
```

### Error: "Token expired"

**Síntoma:**
Al intentar publicar, dice que el token expiró.

**Solución:**

- Los tokens de TikTok expiran después de cierto tiempo
- Desvincula y vuelve a vincular la cuenta
- SubiteYa debería implementar refresh automático (TODO)

### Error: "Rate limit exceeded"

**Síntoma:**
HTTP 429 al intentar publicar.

**Solución:**

- Es el rate limiter protegiendo (10 publicaciones/minuto por default)
- Espera 1 minuto e intenta de nuevo
- O ajusta `RATE_LIMIT_MAX_PUBLISH_PER_WINDOW` en Render

### Error: "428 Precondition Required"

**Síntoma:**
Todos los endpoints responden 428.

**Solución:**

```bash
# Verificar estado legal:
curl https://subiteya-1.onrender.com/api/legal/status \
  -H "Authorization: Bearer <tu_token>"

# Si needsReaccept: true, aceptar versión actual:
curl -X POST https://subiteya-1.onrender.com/api/legal/accept \
  -H "Authorization: Bearer <tu_token>" \
  -H "Content-Type: application/json" \
  -d '{"doc": "terms", "version": "v1.0"}'

# Repetir con "privacy"
```

## 📊 Datos Esperados

### En `tiktok_connections` table:

```json
{
  "id": "uuid",
  "user_id": "tu_user_id",
  "open_id": "tiktok_open_id",
  "display_name": "Tu Username TikTok",
  "avatar_url": "https://...",
  "scope_granted": ["user.info.basic", "video.upload", "video.publish"],
  "access_token_enc": "iv:authTag:encrypted_data", // ⬅️ ENCRIPTADO
  "refresh_token_enc": "iv:authTag:encrypted_data", // ⬅️ ENCRIPTADO
  "expires_at": "2025-11-02T...",
  "is_default": true,
  "created_at": "2025-11-01T...",
  "updated_at": "2025-11-01T..."
}
```

### En `audit_events` table:

```json
[
  {
    "type": "tiktok.account_linked",
    "user_id": "tu_user_id",
    "details_json": {
      "open_id": "...",
      "display_name": "...",
      "scopes": ["user.info.basic", "video.upload", "video.publish"]
    },
    "ip": "tu_ip",
    "created_at": "2025-11-01T..."
  }
]
```

## ✅ Checklist Final

### Backend

- [ ] Health check responde 200
- [ ] Logs muestran "✅ Encryption test passed"
- [ ] ENCRYPTION_KEY configurado (32 bytes base64)
- [ ] TIKTOK_CLIENT_KEY y SECRET configurados
- [ ] TIKTOK_REDIRECT_URI correcto
- [ ] ALLOWED_ORIGINS incluye GitHub Pages
- [ ] Migraciones ejecutadas (columnas legales en users)

### TikTok Developer

- [ ] App creada en developers.tiktok.com
- [ ] Redirect URI exacto configurado
- [ ] Scopes: user.info.basic, video.upload, video.publish
- [ ] Client Key copiado
- [ ] Client Secret copiado

### Frontend

- [ ] GitHub Pages desplegado
- [ ] Página de registro funciona
- [ ] Login funciona
- [ ] Botón "Conectar TikTok" visible
- [ ] Redirect a TikTok funciona
- [ ] Redirect de vuelta funciona
- [ ] Cuenta TikTok aparece en lista

### Testing Real

- [ ] Cuenta SubiteYa creada
- [ ] Términos y privacidad aceptados (v1.0)
- [ ] Cuenta TikTok vinculada exitosamente
- [ ] Tokens guardados encriptados en DB
- [ ] Video subido a SubiteYa
- [ ] Video publicado en TikTok exitosamente
- [ ] Auditoría registró todos los eventos

### Seguridad

- [ ] Tokens NUNCA en texto plano
- [ ] ENCRYPTION_KEY nunca en código
- [ ] Rate limiting activo
- [ ] CORS configurado correctamente
- [ ] HTTPS en todas las URLs de producción

## 🎉 ¡Éxito!

Si completaste todos los pasos, ahora tienes:

✅ Cuenta vinculada con TikTok  
✅ Tokens OAuth encriptados con AES-256-GCM  
✅ Sistema legal implementado (términos v1.0)  
✅ Rate limiting activo  
✅ Auditoría completa de eventos  
✅ Capacidad de publicar videos a TikTok desde SubiteYa

## 📞 Próximos Pasos

1. **Probar con múltiples cuentas:** Vincula 2-3 cuentas de TikTok
2. **Publicación en batch:** Subir un video y publicar en todas las cuentas
3. **Programar publicaciones:** Usar la función de scheduling
4. **Crear patrones de marca:** Configurar logo, filtros, subtítulos

---

**Fecha:** 1 de noviembre de 2025  
**Versión:** v1.0 con implementación legal completa  
**Stack:** GitHub Pages + Render + PostgreSQL + TikTok API
