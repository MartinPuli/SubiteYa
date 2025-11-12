# Configuración de Qstash + Workers HTTP

## 📋 Resumen

Migración completa de BullMQ+Redis a **Upstash Qstash** (cola HTTP-based) con workers HTTP dedicados.

### ✅ Beneficios

- **No Redis**: 0 comandos/minuto (eliminado problema de límite)
- **API ligera**: Solo encola jobs, no procesa videos
- **Workers dedicados**: Procesan videos independientemente (FFmpeg + TikTok)
- **Escalabilidad**: Workers HTTP pueden escalar horizontalmente
- **Pricing**: ~$0.01-0.05/mes (vs. límite Redis)

---

## 🏗️ Arquitectura

### Antes (BullMQ + Redis):

```
Usuario → API → Redis Queue → Workers BullMQ → Procesamiento
                   ↓
              100+ cmd/min (límite excedido)
```

### Ahora (Qstash + HTTP):

```
Usuario → API → Qstash → POST https://worker-url/process → Worker procesa
                   ↓
              HTTP requests (sin límites Redis)
```

---

## 📁 Archivos Creados

### 1. Workers HTTP

#### `packages/api/src/workers/edit-worker-http.ts`

- **Tipo**: Servidor HTTP (Express) en puerto 3001
- **Endpoint**: `POST /process` (recibe webhooks de Qstash)
- **Función**:
  - Descarga video de S3
  - Aplica branding con FFmpeg
  - Sube video editado a S3
  - Actualiza status a `EDITED`
- **Health check**: `GET /health`

#### `packages/api/src/workers/upload-worker-http.ts`

- **Tipo**: Servidor HTTP (Express) en puerto 3002
- **Endpoint**: `POST /process` (recibe webhooks de Qstash)
- **Función**:
  - Descarga video editado de S3
  - Sube a TikTok (3-step flow)
  - Actualiza status a `POSTED`
- **Health check**: `GET /health`

### 2. Qstash Client

#### `packages/api/src/lib/qstash-client.ts`

- **Función**: Cliente Qstash para encolar jobs
- **Cambio**: URLs apuntan a workers HTTP (no a API)

  ```typescript
  // Antes:
  url: `${qstashUrl}/api/workers/edit`;

  // Ahora:
  url: `${process.env.EDIT_WORKER_URL}/process`;
  ```

### 3. Render Config

#### `render.yaml`

- **Edit Worker**:
  - `type: worker` → `type: web` ✅
  - `healthCheckPath: /health` ✅
  - `PORT: 3001` ✅
- **Upload Worker**:
  - `type: worker` → `type: web` ✅
  - `healthCheckPath: /health` ✅
  - `PORT: 3002` ✅

---

## 🔧 Variables de Entorno

### En Render Dashboard

#### 1. API (`subiteya-api`)

```env
QSTASH_TOKEN=xxx                      # De console.upstash.com
EDIT_WORKER_URL=https://subiteya-edit-worker.onrender.com
UPLOAD_WORKER_URL=https://subiteya-upload-worker.onrender.com
```

#### 2. Edit Worker (`subiteya-edit-worker`)

```env
PORT=3001
QSTASH_CURRENT_SIGNING_KEY=xxx       # Para verificar webhooks
QSTASH_NEXT_SIGNING_KEY=xxx          # Para verificar webhooks
DATABASE_URL=xxx
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_BUCKET_NAME=xxx
ENCRYPTION_KEY=xxx                    # 32 caracteres
```

#### 3. Upload Worker (`subiteya-upload-worker`)

```env
PORT=3002
QSTASH_CURRENT_SIGNING_KEY=xxx       # Para verificar webhooks
QSTASH_NEXT_SIGNING_KEY=xxx          # Para verificar webhooks
DATABASE_URL=xxx
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_BUCKET_NAME=xxx
ENCRYPTION_KEY=xxx                    # 32 caracteres
```

### Obtener Keys de Qstash

1. Ir a https://console.upstash.com/
2. Navegar a **Qstash** → **Settings**
3. Copiar:
   - `QSTASH_TOKEN` (para cliente)
   - `QSTASH_CURRENT_SIGNING_KEY` (para verificar webhooks)
   - `QSTASH_NEXT_SIGNING_KEY` (para verificar webhooks)

---

## 🚀 Deployment

### 1. Push a GitHub

```bash
git add .
git commit -m "feat: Implementar Qstash + Workers HTTP"
git push
```

### 2. Render Auto-Deploy

- Render detecta cambios en `render.yaml`
- Despliega API y Workers automáticamente

### 3. Verificar Logs

#### API (`subiteya-api`)

```
✅ Qstash client initialized
   Edit Worker: https://subiteya-edit-worker.onrender.com
   Upload Worker: https://subiteya-upload-worker.onrender.com
```

#### Edit Worker (`subiteya-edit-worker`)

```
🎬 Edit Worker HTTP Server listening on port 3001
📝 Health check: http://localhost:3001/health
🔧 Process endpoint: http://localhost:3001/process
✅ Ready to receive Qstash webhooks
```

#### Upload Worker (`subiteya-upload-worker`)

```
🚀 Upload Worker HTTP Server listening on port 3002
📝 Health check: http://localhost:3002/health
🔧 Process endpoint: http://localhost:3002/process
✅ Ready to receive Qstash webhooks
```

### 4. Verificar Health Checks

```bash
curl https://subiteya-edit-worker.onrender.com/health
# {
#   "status": "healthy",
#   "service": "edit-worker",
#   "qstash": { "enabled": true, "signatureVerification": true },
#   "uptime": 123.45,
#   "timestamp": 1234567890
# }

curl https://subiteya-upload-worker.onrender.com/health
# Similar response
```

---

## 🧪 Testing

### 1. Upload Video

```bash
curl -X POST https://subiteya-api.onrender.com/api/publish \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "video=@test.mp4" \
  -F "accountId=xxx"
```

### 2. Verificar Logs

#### API Log:

```
[Qstash] ✅ Queued edit job for video abc123 → https://subiteya-edit-worker.onrender.com
```

#### Edit Worker Log:

```
[Edit Worker] 📥 Received job for video abc123
[Edit Worker] Downloading s3-key to /tmp/video-abc123-1234567890.mp4...
[Edit Worker] Applying branding to /tmp/video-abc123-1234567890.mp4...
[Edit Worker] Uploading edited video to S3...
[Edit Worker] ✅ Completed video abc123 in 12345ms
```

#### Upload Worker Log:

```
[Upload Worker] 📥 Received job for video abc123
[Upload Worker] Downloading s3-key to /tmp/upload-abc123-1234567890.mp4...
[Upload Worker] Initializing TikTok upload...
[Upload Worker] Uploading video to TikTok...
[Upload Worker] ✅ Completed video abc123 in 8765ms
```

### 3. Verificar Qstash Dashboard

1. Ir a https://console.upstash.com/
2. Navegar a **Qstash** → **Messages**
3. Ver requests HTTP (no Redis commands)
4. Verificar: ~2 requests por video (edit + upload)

---

## 📊 Pricing Estimado

### Qstash

- **Free Tier**: 500 requests/día
- **Uso estimado**:
  - 10 videos/día × 2 jobs = 20 requests/día
  - ~600 requests/mes
- **Costo**: **$0.00** (dentro del free tier)

### Render

- **API**: Free plan (512MB RAM) ✅
- **Edit Worker**: Free plan (512MB RAM) ✅
- **Upload Worker**: Free plan (512MB RAM) ✅

**Total**: **$0.00/mes** 🎉

---

## 🔍 Monitoring

### Verificar Redis Usage

```bash
# Debería mostrar 0 cmd/min
curl https://console.upstash.com/redis/xxx
```

### Verificar Qstash Usage

```bash
# Dashboard → Qstash → Usage
# Debería mostrar 10-50 requests/día
```

### Logs de Workers

```bash
# En Render Dashboard
# Services → subiteya-edit-worker → Logs
# Services → subiteya-upload-worker → Logs
```

---

## ⚠️ Troubleshooting

### Worker no recibe webhooks

1. Verificar `EDIT_WORKER_URL` y `UPLOAD_WORKER_URL` en API
2. Verificar workers están tipo `web` (no `worker`)
3. Verificar `healthCheckPath` configurado en `render.yaml`
4. Verificar logs de Qstash en https://console.upstash.com/

### Signature verification failed

1. Verificar `QSTASH_CURRENT_SIGNING_KEY` en workers
2. Verificar `QSTASH_NEXT_SIGNING_KEY` en workers
3. Las keys deben coincidir con Qstash dashboard

### Worker OOM (Out of Memory)

1. Considerar subir a plan pago (1GB RAM)
2. Optimizar descarga de videos (streaming)
3. Limpiar archivos temporales después de procesar

---

## 📚 Referencias

- [Upstash Qstash Docs](https://upstash.com/docs/qstash)
- [Render Web Services](https://render.com/docs/web-services)
- [Architecture Decision Record](docs/adr/qstash-migration.md)

---

## ✅ Checklist de Deployment

- [x] Crear workers HTTP (edit-worker-http.ts, upload-worker-http.ts)
- [x] Actualizar qstash-client.ts (usar EDIT_WORKER_URL/UPLOAD_WORKER_URL)
- [x] Actualizar render.yaml (type: web, healthCheckPath, PORT)
- [x] Remover workers.ts de API
- [x] Eliminar archivos obsoletos de Redis/BullMQ
- [ ] Agregar variables de entorno en Render Dashboard
- [ ] Obtener Qstash keys de console.upstash.com
- [ ] Verificar health checks de workers
- [ ] Test end-to-end (upload → edit → upload to TikTok)
- [ ] Verificar 0 comandos Redis
- [ ] Verificar logs de Qstash

---

**Última actualización**: 2025-01-XX  
**Estado**: ✅ Código listo, pendiente configuración de env vars
