# 🧪 Testing - Implementación Legal

## 📍 URLs de Testing

- **Frontend (GitHub Pages):** https://franjm923.github.io/SubiteYa/
- **Backend (Render):** https://subiteya-1.onrender.com

## ✅ Pre-requisitos

### 1. Mergear a Main y Desplegar

```bash
# 1. Crear Pull Request
# Ve a: https://github.com/franjm923/SubiteYa/pull/new/feature/estilosedit

# 2. Mergear a main (después de review)

# 3. Render desplegará automáticamente desde main
```

### 2. Configurar Variables de Entorno en Render

Ir a: https://dashboard.render.com/web/[tu-servicio]/env

Agregar:

```bash
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=<tu_key_de_32_bytes>

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_PUBLISH_PER_WINDOW=10

# CORS - Incluir GitHub Pages
ALLOWED_ORIGINS=https://franjm923.github.io,http://localhost:5173,http://localhost:3000
```

**⚠️ IMPORTANTE:** Después de agregar las variables, Render hará redeploy automático.

### 3. Migración de Base de Datos

Render ejecutará automáticamente:

```bash
npx prisma migrate deploy
npx prisma generate
```

Esto agregará las columnas:

- `accepted_terms_version`
- `accepted_privacy_version`

## 🧪 Tests Manuales

### Test 1: Health Check ✅

```bash
curl https://subiteya-1.onrender.com/health
```

**Esperado:**

```json
{
  "status": "ok",
  "timestamp": "2025-11-01T...",
  "uptime": 123
}
```

### Test 2: Encryption Validation ✅

El servidor debe iniciar correctamente y mostrar en los logs:

```
✅ Encryption test passed
🚀 SubiteYa API listening on port 3000
```

Si el ENCRYPTION_KEY está mal o falta:

```
❌ ENCRYPTION_KEY is required in environment variables
```

### Test 3: Registro de Usuario con Legal ✅

**Desde GitHub Pages o con curl:**

```bash
curl -X POST https://subiteya-1.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "name": "Test User",
    "acceptedTerms": true,
    "acceptedPrivacy": true
  }'
```

**Esperado:**

```json
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": "...",
    "email": "test@example.com",
    "name": "Test User",
    "role": "user"
  },
  "token": "eyJhbGc..."
}
```

**Verificar en base de datos:**

- `accepted_terms_version` = `"v1.0"`
- `accepted_privacy_version` = `"v1.0"`
- `accepted_terms_at` = timestamp actual
- `accepted_privacy_at` = timestamp actual

### Test 4: Login y Estado Legal ✅

```bash
# 1. Login
curl -X POST https://subiteya-1.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!"
  }'

# Guarda el token de la respuesta

# 2. Verificar estado legal
curl https://subiteya-1.onrender.com/api/legal/status \
  -H "Authorization: Bearer <tu_token>"
```

**Esperado:**

```json
{
  "terms": {
    "currentVersion": "v1.0",
    "acceptedVersion": "v1.0",
    "acceptedAt": "2025-11-01T...",
    "needsReaccept": false
  },
  "privacy": {
    "currentVersion": "v1.0",
    "acceptedVersion": "v1.0",
    "acceptedAt": "2025-11-01T...",
    "needsReaccept": false
  },
  "allAccepted": true
}
```

### Test 5: Rate Limiting ✅

**Test en register (5/hora):**

```bash
# Ejecutar 6 veces rápido con diferentes emails
for i in {1..6}; do
  curl -X POST https://subiteya-1.onrender.com/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"test${i}@example.com\",
      \"password\": \"Test1234!\",
      \"name\": \"Test ${i}\",
      \"acceptedTerms\": true,
      \"acceptedPrivacy\": true
    }"
  echo ""
done
```

**Esperado en el 6to intento:**

```json
{
  "error": "Too many registration attempts. Please try again later."
}
```

HTTP Status: **429 Too Many Requests**

### Test 6: Reaceptación Forzada (HTTP 428) ⚠️

**Este test requiere cambiar la versión:**

1. Cambiar en `packages/api/src/constants/legal.ts`:

```typescript
export const TERMS_VERSION = 'v1.1'; // Cambiar a v1.1
```

2. Redeploy en Render

3. Intentar acceder a un endpoint protegido:

```bash
curl https://subiteya-1.onrender.com/api/connections \
  -H "Authorization: Bearer <token_de_usuario_con_v1.0>"
```

**Esperado:**

```json
{
  "reacceptRequired": true,
  "doc": "terms",
  "requiredVersion": "v1.1",
  "message": "You must accept the updated Terms and Conditions"
}
```

HTTP Status: **428 Precondition Required**

4. Reaceptar:

```bash
curl -X POST https://subiteya-1.onrender.com/api/legal/accept \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "doc": "terms",
    "version": "v1.1"
  }'
```

**Esperado:**

```json
{
  "success": true,
  "doc": "terms",
  "version": "v1.1",
  "acceptedAt": "2025-11-01T..."
}
```

### Test 7: Auditoría 📊

Verificar en la base de datos que se registraron eventos:

```sql
SELECT * FROM audit_events
WHERE type IN ('auth.register', 'auth.login', 'legal.accepted', 'security.rate_limit_exceeded')
ORDER BY created_at DESC
LIMIT 20;
```

**Esperado:** Registros de todos los eventos de prueba con:

- `user_id`
- `type`
- `details_json`
- `ip`
- `user_agent`
- `created_at`

## 🌐 Testing desde GitHub Pages

### 1. Acceder al Frontend

https://franjm923.github.io/SubiteYa/

### 2. Prueba de Registro

1. Ir a `/register`
2. Llenar formulario:
   - Email: `frontend-test@example.com`
   - Password: `Test1234!`
   - Name: `Frontend Test`
   - ✅ Checkbox: "Acepto los Términos y Condiciones"
   - ✅ Checkbox: "Acepto la Política de Privacidad"
3. Click "Registrarse"

**Verificar:**

- ✅ Registro exitoso
- ✅ Redirect al dashboard
- ✅ Token guardado en localStorage

### 3. Abrir DevTools → Network

1. Ir a pestaña Network
2. Hacer una acción (ej: ver conexiones TikTok)
3. Verificar request a:
   - `https://subiteya-1.onrender.com/api/connections`
   - Headers: `Authorization: Bearer ...`

**Si falla con CORS:**

- Verificar `ALLOWED_ORIGINS` en Render incluye `https://franjm923.github.io`

## 🐛 Troubleshooting

### Error: "ENCRYPTION_KEY is required"

```bash
# En Render dashboard, agregar:
ENCRYPTION_KEY=<key_generada>

# Generar nueva key:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Error: CORS blocked

```bash
# En Render, verificar ALLOWED_ORIGINS:
ALLOWED_ORIGINS=https://franjm923.github.io,http://localhost:5173,http://localhost:3000
```

### Error: "Cannot find module './utils/encryption'"

```bash
# Verificar que el build se completó:
# En Render logs buscar:
✔ Generated Prisma Client
# ... (compilación TypeScript exitosa)
```

### Error: 428 en todos los endpoints

```bash
# Usuario necesita reaceptar términos
# Verificar versiones actuales:
curl https://subiteya-1.onrender.com/api/legal/status \
  -H "Authorization: Bearer <token>"

# Aceptar versión actual:
curl -X POST https://subiteya-1.onrender.com/api/legal/accept \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"doc": "terms", "version": "v1.0"}'
```

## ✅ Checklist de Testing

### Backend

- [ ] Health check responde 200
- [ ] Encryption test pasa en logs
- [ ] Registro guarda versiones legales (v1.0)
- [ ] `/legal/status` retorna estado correcto
- [ ] `/legal/accept` actualiza versiones
- [ ] Rate limiting activo (429 después de límite)
- [ ] Auditoría registra eventos
- [ ] CORS permite GitHub Pages

### Frontend

- [ ] Página de registro carga
- [ ] Checkboxes de términos y privacidad
- [ ] Registro desde frontend funciona
- [ ] Token se guarda en localStorage
- [ ] Requests a API incluyen Authorization header
- [ ] No hay errores de CORS en DevTools

### Integración

- [ ] Login desde GitHub Pages funciona
- [ ] Dashboard muestra datos del backend
- [ ] Vinculación TikTok funciona
- [ ] Upload de video funciona
- [ ] No hay errores 428 en usuarios nuevos
- [ ] Modal de reaceptación (si cambias versión)

## 📊 Datos de Prueba

### Usuarios de Testing

```javascript
// Usuario 1: Fresh registration
{
  email: "test1@example.com",
  password: "Test1234!",
  // Tiene v1.0 en ambas versiones
}

// Usuario 2: Para testing de reaceptación
{
  email: "test2@example.com",
  password: "Test1234!",
  // Simular que tiene v0.9 (manual en DB)
}

// Usuario 3: Rate limiting
{
  email: "test3@example.com",
  password: "Test1234!",
  // Para probar límite de publish
}
```

## 🎯 Acceptance Criteria

### ✅ Cumplimiento Legal

- [x] Usuarios nuevos aceptan términos en registro
- [x] Versiones se guardan en DB (v1.0)
- [x] Endpoint `/legal/status` funcional
- [x] Endpoint `/legal/accept` actualiza versiones
- [x] HTTP 428 cuando se requiere reaceptación

### ✅ Seguridad

- [x] Tokens OAuth encriptados con AES-256-GCM
- [x] Rate limiting activo en endpoints críticos
- [x] Auditoría de eventos sensibles
- [x] ENCRYPTION_KEY validado on-boot

### ✅ Funcionalidad

- [x] Backend compila sin errores
- [x] Frontend compila sin errores
- [x] Migraciones ejecutables
- [x] Tests de integración pasan

---

**Fecha:** 1 de noviembre de 2025  
**Versión Legal:** v1.0 (terms + privacy)  
**Branch:** feature/estilosedit → main
