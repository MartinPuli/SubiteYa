# 🚀 Guía Rápida: Crear Workers en Render (5 minutos)

## Opción A: Usar Blueprint (MÁS FÁCIL) ⭐

### 1. Ve a tu Dashboard de Render

👉 https://dashboard.render.com

### 2. Click en "New +" → "Blueprint"

### 3. Conecta tu repositorio

- Repo: `MartinPuli/SubiteYa`
- Branch: `main`

### 4. Render detectará `render.yaml` automáticamente

Verás **3 servicios** listos para crear:

```
✓ subiteya-api              (Web Service)
✓ subiteya-edit-worker      (Background Worker)
✓ subiteya-upload-worker    (Background Worker)
```

### 5. Click en "Apply"

Render creará los 3 servicios automáticamente 🎉

### 6. Configurar Variables de Entorno (IMPORTANTE)

Para **CADA UNO** de los 3 servicios:

1. Click en el nombre del servicio
2. Ve a **"Environment"** (panel izquierdo)
3. Click **"Add Environment Variable"**
4. Copia y pega estas variables:

#### Para los 3 servicios (API + 2 Workers):

```env
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxxxxxxxxxx:5432/postgres
REDIS_URL=rediss://default:tu_password@exotic-kid-28613.upstash.io:6379
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=subiteya-videos-bucket
ENCRYPTION_KEY=tu_encryption_key_base64_32bytes
JWT_SECRET=tu_jwt_secret_muy_largo
```

#### Solo para `subiteya-api` (adicionales):

```env
PORT=3000
ALLOWED_ORIGINS=https://martinpuli.github.io
TIKTOK_CLIENT_KEY=tu_tiktok_client_key
TIKTOK_CLIENT_SECRET=tu_tiktok_client_secret
TIKTOK_REDIRECT_URI=https://tu-app-nombre.onrender.com/api/auth/tiktok/callback
```

#### Solo para `subiteya-upload-worker` (adicionales):

```env
TIKTOK_CLIENT_KEY=tu_tiktok_client_key
TIKTOK_CLIENT_SECRET=tu_tiktok_client_secret
```

### 7. Click "Save Changes" en cada servicio

### 8. Esperá 5-10 minutos

Los servicios se van a buildear automáticamente 🏗️

---

## Opción B: Manual (más control)

### 1. Crear Web Service (API)

**New + → Web Service**

```
Name:                subiteya-api
Runtime:             Docker
Dockerfile Path:     ./Dockerfile
Docker Context:      .
Branch:              main
Region:              Oregon
Instance Type:       Free
Health Check Path:   /health
```

**Environment Variables**: (ver lista arriba)

### 2. Crear Background Worker (Edit)

**New + → Background Worker**

```
Name:                subiteya-edit-worker
Runtime:             Docker
Dockerfile Path:     ./Dockerfile
Docker Context:      .
Docker Command:      npm run worker:edit -w @subiteya/api
Branch:              main
Region:              Oregon
Instance Type:       Free
```

**Environment Variables**: (solo las compartidas, sin PORT/ALLOWED_ORIGINS)

### 3. Crear Background Worker (Upload)

**New + → Background Worker**

```
Name:                subiteya-upload-worker
Runtime:             Docker
Dockerfile Path:     ./Dockerfile
Docker Context:      .
Docker Command:      npm run worker:upload -w @subiteya/api
Branch:              main
Region:              Oregon
Instance Type:       Free
```

**Environment Variables**: (compartidas + TIKTOK_CLIENT_KEY/SECRET)

---

## ✅ Verificación (después de 10 minutos)

### 1. Verificá que los 3 servicios estén "Live" (verde)

En tu dashboard deberías ver:

```
🟢 subiteya-api              Live
🟢 subiteya-edit-worker      Live
🟢 subiteya-upload-worker    Live
```

### 2. Verificá los logs de cada uno

**API Logs** debería mostrar:

```
🚀 SubiteYa API listening on port 3000
⚠️  Workers disabled (run separately to avoid memory issues)
```

**Edit Worker Logs** debería mostrar:

```
🎬 Starting Edit Worker (standalone)...
[Edit Worker] Started with concurrency 2
```

**Upload Worker Logs** debería mostrar:

```
📤 Starting Upload Worker (standalone)...
[Upload Worker] Started with concurrency 1
```

### 3. Probá el health check

```bash
curl https://tu-app-nombre.onrender.com/health
```

Debería devolver:

```json
{
  "status": "ok",
  "timestamp": "2025-11-07T...",
  "uptime": 123
}
```

### 4. Probá Redis connectivity

```bash
curl https://tu-app-nombre.onrender.com/health/redis
```

Debería devolver:

```json
{
  "status": "ok",
  "redis": "connected",
  "queues": {
    "edit": {...},
    "upload": {...}
  }
}
```

---

## 🎯 ¿Qué pasa ahora?

### Flujo de Video:

1. **Usuario sube video** → Frontend → API
2. **API devuelve 201** (inmediato, sin procesar)
3. **Usuario confirma video** → API encola trabajo en Redis
4. **Edit Worker** lo agarra y lo procesa (30-60 seg)
5. **Usuario queue upload** → API encola trabajo en Redis
6. **Upload Worker** lo sube a TikTok (1-2 min)

### Memoria:

- **API**: ~200MB (solo requests HTTP)
- **Edit Worker**: ~300MB (FFmpeg + videos)
- **Upload Worker**: ~150MB (HTTP uploads)
- **Total separado**: ✅ Cada uno bajo 512MB

---

## 🐛 Troubleshooting Rápido

### "Service failed to start"

- Verificá que las variables de entorno estén configuradas
- Revisá logs para ver el error específico

### "Out of memory"

- Edit Worker necesita plan pago ($7/mes)
- O reducí concurrency de 2 a 1

### Workers no procesan videos

- Verificá que REDIS_URL sea idéntico en los 3 servicios
- Verificá que los workers estén "Live" (no "Suspended")
- Plan free duerme workers después de 15 min inactivos

### Videos quedan en "EDITING_QUEUED"

- Edit Worker está dormido (plan free)
- Visitá los logs del worker para activarlo
- O upgradea a plan Starter ($7/mes) para keep alive

---

## 💡 Tips

1. **Variables idénticas**: DATABASE_URL y REDIS_URL DEBEN ser iguales en los 3 servicios
2. **Misma región**: Los 3 en Oregon (mejor latencia)
3. **Logs**: Monitoreá logs durante las primeras horas
4. **Plan pago**: Edit Worker es el que más consume, considerá upgradear solo ese
5. **Auto-deploy**: Cualquier push a `main` redeploya los 3 servicios automáticamente

---

## 📋 Checklist Final

- [ ] 3 servicios creados (API + 2 Workers)
- [ ] Variables de entorno configuradas en los 3
- [ ] Los 3 servicios están "Live" (verde)
- [ ] Logs muestran startup exitoso
- [ ] `/health` responde OK
- [ ] `/health/redis` responde OK
- [ ] Probaste subir un video de prueba
- [ ] Video procesó correctamente (DRAFT → EDITING_QUEUED → EDITING → EDITED)

---

¿Todo listo? 🎉

Si tenés algún error, revisá `RENDER_WORKERS_SETUP.md` para troubleshooting detallado.
