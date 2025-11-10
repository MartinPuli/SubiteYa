# Migración a BullMQ + S3 para Producción

Este documento resume la migración del sistema de colas de simple polling a BullMQ con Redis y AWS S3.

## 🎯 Cambios Principales

### Antes (Simple Polling)

- ❌ Workers con `setInterval` cada 5 segundos
- ❌ Almacenamiento local en `/tmp`
- ❌ Jobs en memoria (se pierden al reiniciar)
- ❌ Sin retry automático
- ❌ No escalable en múltiples instancias

### Después (BullMQ + S3)

- ✅ Workers con BullMQ respaldados por Redis
- ✅ Almacenamiento en AWS S3 (bucket privado)
- ✅ Jobs persistentes en Redis
- ✅ Retry automático con exponential backoff (5s → 10s → 20s)
- ✅ Escalable horizontalmente

## 📦 Archivos Nuevos

### `packages/api/src/lib/storage.ts` (270 líneas)

Abstracción de S3 para subir/descargar videos.

**Funciones principales**:

- `uploadToS3(options)` - Sube Buffer/Stream a S3, devuelve `{ key, url, bucket, size }`
- `downloadFromS3(key)` - Descarga archivo a Buffer
- `downloadStreamFromS3(key)` - Descarga como Readable stream
- `getPresignedDownloadUrl(key, expiresIn)` - URL temporal (1 hora) para descargas
- `getPresignedUploadUrl(filename, contentType)` - URL temporal (15 min) para uploads del frontend
- `deleteFromS3(key)` - Elimina archivo
- `fileExistsInS3(key)` - Verifica existencia
- `extractS3Key(url)` - Parsea URLs `s3://` o `https://`
- `moveToVideoFolder(tempKey)` - Mueve de `temp/` a `videos/`

**Estructura de carpetas**:

```
s3://subiteya-videos/
├── temp/          # Uploads del frontend (se eliminan automáticamente después de 1 día)
└── videos/        # Videos procesados (se eliminan después de 30 días)
```

### `packages/api/src/lib/queues.ts` (95 líneas)

Configuración de colas BullMQ.

**Exports principales**:

- `editQueue` - Queue para edición de videos
- `uploadQueue` - Queue para subida a TikTok
- `PRIORITY` - Constantes de prioridad (CRITICAL=1, HIGH=3, NORMAL=5, LOW=7, VERY_LOW=9)
- `queueEditJob(videoId, priority)` - Agrega job de edición (idempotente)
- `queueUploadJob(videoId, priority)` - Agrega job de upload (idempotente)
- `getQueueStats()` - Estadísticas de colas
- `pauseQueues()`, `resumeQueues()`, `closeQueues()` - Control de colas

**Configuración de jobs**:

- 3 intentos con exponential backoff: 5s → 10s → 20s
- Retención: 50 completed, 100 failed
- Job IDs idempotentes: `edit-${videoId}` (evita duplicados)

### `packages/api/src/workers/edit-worker-bullmq.ts` (255 líneas)

Worker BullMQ para edición de videos.

**Workflow**:

1. Descarga video de S3 (`extractS3Key` → `downloadFromS3`)
2. Guarda en archivo temporal (`/tmp/input-${jobId}-${timestamp}.mp4`)
3. Aplica brand pattern con FFmpeg (logo, subtítulos, efectos)
4. Sube video editado a S3 (`uploadToS3`)
5. Actualiza DB (`status=EDITED`, `editedUrl`)
6. Notifica vía SSE (`notifyUser`)
7. Limpia archivos temporales

**Configuración**:

- Concurrencia: 2 (via `EDIT_WORKER_CONCURRENCY`)
- Rate limiter: 10 jobs/min
- Progress tracking: 10%, 30%, 40%, 70%, 90%, 100%

**Manejo de errores**:

- Actualiza DB a `status=FAILED_EDIT`
- Notifica vía SSE con mensaje de error
- Limpia archivos temporales (finally block)
- Retry automático por BullMQ

### `packages/api/src/workers/upload-worker-bullmq.ts` (280 líneas)

Worker BullMQ para subida a TikTok.

**Workflow**:

1. Verifica rate limit (5 min entre uploads por cuenta TikTok)
2. Descarga video editado de S3
3. Consulta TikTok Creator Info (username, avatar)
4. Inicia upload de TikTok (obtiene `publish_id` y `upload_url`)
5. Sube video a `upload_url` (PUT con Content-Type y Content-Length)
6. Actualiza DB (`status=POSTED`, `postUrl`)
7. Notifica vía SSE
8. Actualiza `lastUploadTime` para rate limiting

**Configuración**:

- Concurrencia: 1 (via `UPLOAD_WORKER_CONCURRENCY`)
- Rate limiter BullMQ: 3 jobs/min
- Rate limiter por cuenta: 5 min entre uploads (Map en memoria)
- Privacy: `SELF_ONLY` (privado, para apps no auditadas)

**Manejo de errores**:

- Token expirado → Actualiza DB, notifica, permite retry
- Rate limit TikTok → Marca como `FAILED_UPLOAD`, notifica
- Otros errores → Retry automático

## 📝 Archivos Modificados

### `packages/api/src/routes/videos.ts`

**Cambios**:

- Línea 11: Agregado `import { queueEditJob, queueUploadJob } from '../lib/queues'`
- Línea 118: Agregado `await queueEditJob(id)` después de crear job en DB (endpoint `POST /:id/confirm`)
- Línea 193: Agregado `await queueUploadJob(id)` después de crear job en DB (endpoint `POST /:id/queue-upload`)
- Línea 107: Cast `editSpecJson` a `any` (issue de Prisma con JsonValue)

**Flow**:

```
POST /confirm → Crea job en DB → queueEditJob() → Worker procesa
POST /queue-upload → Crea job en DB → queueUploadJob() → Worker procesa
```

### `packages/api/src/index.ts`

**Cambios**:

- Líneas 125-128: Imports cambiados de `workers/edit-worker` a `workers/edit-worker-bullmq`
- Líneas 125-128: Imports cambiados de `workers/upload-worker` a `workers/upload-worker-bullmq`
- Línea 128: Agregado `import { closeQueues } from './lib/queues'`
- Línea 207: Agregado `await closeQueues()` en SIGTERM handler (graceful shutdown)

**Startup**:

```
Server starts → startEditWorker() → startUploadWorker() → Express listen
SIGTERM → stopEditWorker() → stopUploadWorker() → closeQueues() → Exit
```

## 🔧 Variables de Entorno Nuevas

Ver archivo `.env.production` con template completo.

**Críticas** (requeridas):

```env
# Redis para BullMQ
REDIS_URL=redis://default:PASSWORD@host.upstash.io:6379

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxx
S3_BUCKET_NAME=subiteya-videos

# Workers
EDIT_WORKER_CONCURRENCY=2
UPLOAD_WORKER_CONCURRENCY=1
```

**Opcionales** (para desarrollo local con MinIO/LocalStack):

```env
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true
```

## 🚀 Setup en Producción

### 1. Configurar Redis (Upstash)

Ver `REDIS_SETUP.md` para guía completa.

```bash
# 1. Crear cuenta en https://console.upstash.com/
# 2. Create Database → Regional → us-east-1
# 3. Copiar REDIS_URL del dashboard
# 4. Agregar a Render environment variables
```

### 2. Configurar S3

Ver `S3_SETUP.md` para guía completa.

```bash
# Crear bucket privado
aws s3 mb s3://subiteya-videos --region us-east-1

# Bloquear acceso público
aws s3api put-public-access-block \
  --bucket subiteya-videos \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Crear usuario IAM con permisos limitados
aws iam create-user --user-name subiteya-uploader
aws iam put-user-policy --user-name subiteya-uploader \
  --policy-name SubiteYaS3Access \
  --policy-document file://s3-policy.json
aws iam create-access-key --user-name subiteya-uploader

# Copiar Access Key ID y Secret Access Key
```

### 3. Configurar Lifecycle Policies

Crear `lifecycle.json`:

```json
{
  "Rules": [
    {
      "Id": "DeleteTempFilesAfter1Day",
      "Filter": { "Prefix": "temp/" },
      "Status": "Enabled",
      "Expiration": { "Days": 1 }
    },
    {
      "Id": "DeleteEditedVideosAfter30Days",
      "Filter": { "Prefix": "videos/" },
      "Status": "Enabled",
      "Expiration": { "Days": 30 }
    }
  ]
}
```

Aplicar:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket subiteya-videos \
  --lifecycle-configuration file://lifecycle.json
```

### 4. Actualizar Variables en Render

Render Dashboard → subiteya-h9ol → Environment:

```env
REDIS_URL=redis://default:Ac-XXX@us1-xxx.upstash.io:6379
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLE
S3_BUCKET_NAME=subiteya-videos
EDIT_WORKER_CONCURRENCY=2
UPLOAD_WORKER_CONCURRENCY=1
```

**IMPORTANTE**: Verificar que `DATABASE_URL` use puerto 6543 (pooler) para evitar timeout.

### 5. Deploy

Render auto-redeploya al guardar las variables.

Verificar logs:

```
[Server] Starting on port 3001
[Edit Worker] Started with concurrency 2
[Upload Worker] Started with concurrency 1
```

## 📊 Testing

### Test Completo End-to-End

1. **Upload video** (frontend)
   - POST `/api/videos` con FormData
   - Video se sube a S3 `temp/` (o directo si usas presigned URL)
   - Estado: `DRAFT`

2. **Confirm video**
   - POST `/api/videos/:id/confirm`
   - Job agregado a BullMQ `editQueue`
   - Estado: `EDITING_QUEUED` → `EDITING`

3. **Worker edita video**
   - Descarga de S3, aplica FFmpeg, sube a S3 `videos/`
   - Estado: `EDITING` → `EDITED`
   - SSE notifica al frontend

4. **Queue upload**
   - POST `/api/videos/:id/queue-upload`
   - Job agregado a BullMQ `uploadQueue`
   - Estado: `UPLOAD_QUEUED` → `UPLOADING`

5. **Worker sube a TikTok**
   - Descarga de S3, sube a TikTok, obtiene `postUrl`
   - Estado: `UPLOADING` → `POSTED`
   - SSE notifica al frontend

### Comandos de Verificación

```bash
# Ver jobs en cola (Redis)
redis-cli -u $REDIS_URL lrange "bull:video-edit:wait" 0 -1
redis-cli -u $REDIS_URL lrange "bull:video-upload:wait" 0 -1

# Ver jobs activos
redis-cli -u $REDIS_URL lrange "bull:video-edit:active" 0 -1

# Ver videos en S3
aws s3 ls s3://subiteya-videos/temp/ --recursive
aws s3 ls s3://subiteya-videos/videos/ --recursive

# Ver tamaño total
aws s3 ls s3://subiteya-videos --recursive --summarize
```

## 🐛 Troubleshooting

### Workers no arrancan

**Síntoma**: Logs no muestran "Worker started"

**Soluciones**:

- Verificar `REDIS_URL` correcta en Render env
- Verificar Upstash database está "Active"
- Ver logs de errores: `Error connecting to Redis`

### Jobs no se procesan

**Síntoma**: Videos quedan en `EDITING_QUEUED`

**Soluciones**:

```bash
# Verificar jobs en cola
redis-cli -u $REDIS_URL llen "bull:video-edit:wait"

# Verificar workers conectados
redis-cli -u $REDIS_URL client list | grep bull

# Verificar que cola no esté pausada
redis-cli -u $REDIS_URL hget "bull:video-edit:meta" "paused"
```

### S3 Access Denied

**Síntoma**: `AccessDenied` al subir/descargar

**Soluciones**:

- Verificar `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` correctas
- Verificar que usuario IAM tenga permisos `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
- Verificar que `AWS_REGION` coincida con región del bucket

### Videos no se eliminan automáticamente

**Síntoma**: Archivos en `temp/` permanecen después de 1 día

**Soluciones**:

```bash
# Verificar lifecycle policy
aws s3api get-bucket-lifecycle-configuration --bucket subiteya-videos

# Re-aplicar si falta
aws s3api put-bucket-lifecycle-configuration \
  --bucket subiteya-videos \
  --lifecycle-configuration file://lifecycle.json
```

### Rate Limit Exceeded (TikTok)

**Síntoma**: `FAILED_UPLOAD` con "rate limit exceeded"

**Soluciones**:

- Worker ya tiene rate limiting (5 min entre uploads por cuenta)
- Si persiste, aumentar delay en código: `RATE_LIMIT_WINDOW = 10 * 60 * 1000` (10 min)
- Considerar usar múltiples cuentas TikTok

## 💰 Costos Estimados

### Upstash Redis (Free Tier)

- **10,000 comandos/día** - Suficiente para ~200 videos/día
- **256 MB memoria** - Suficiente para miles de jobs en cola
- **Costo**: $0/mes

Si necesitas escalar:

- Pay as you go: $0.20 por 100,000 comandos
- 1,000 videos/mes: ~$3/mes

### AWS S3

Para 1,000 videos/mes (100 MB promedio):

- **Storage**: 100 GB × $0.023/GB = $2.30/mes
- **PUT requests**: 2,000 × $0.005/1000 = $0.01
- **GET requests**: 3,000 × $0.0004/1000 = $0.001
- **Data transfer OUT**: ~5 GB × $0.09/GB = $0.45

**Total**: ~$3/mes

### Alternativa: Cloudflare R2

- Storage: $0.015/GB (35% más barato)
- **Sin costos de egress** (data transfer OUT = $0)
- Compatible con API de S3 (solo cambiar `S3_ENDPOINT`)

## 📈 Escalabilidad

### Escalar Horizontalmente

BullMQ + S3 permite múltiples instancias de workers:

```yaml
# Render.com - Escalar a 2 instancias
instances: 2
```

Cada instancia ejecutará workers con la concurrencia configurada:

- Total edit workers: 2 instancias × 2 concurrency = 4 jobs simultáneos
- Total upload workers: 2 instancias × 1 concurrency = 2 jobs simultáneos

**Sin cambios de código requeridos** - Redis sincroniza automáticamente.

### Escalar Verticalmente

Aumentar concurrencia en variables de entorno:

```env
EDIT_WORKER_CONCURRENCY=5   # De 2 a 5
UPLOAD_WORKER_CONCURRENCY=2  # De 1 a 2
```

**Recomendado para Render Standard plan**:

- Edit: 3-5 (CPU-intensive)
- Upload: 1-2 (rate limited por TikTok)

## 🔄 Próximos Pasos

### 1. Presigned Upload URLs (frontend directo a S3)

**Ventajas**:

- No pasa por backend (reduce bandwidth)
- Upload más rápido
- Menos carga en Render

**Implementar**:

1. Crear endpoint `POST /api/videos/upload-url`
2. Devolver presigned URL de `storage.ts`
3. Frontend hace PUT a S3 directamente
4. Luego POST a `/api/videos` con `srcUrl: s3://...`

### 2. BullMQ Dashboard

Ver jobs en UI web:

```bash
npm install @bull-board/api @bull-board/express
```

Acceder en: `https://your-api.onrender.com/admin/queues`

### 3. Notificaciones por Email

Cuando video esté `POSTED`, enviar email con link:

```typescript
// En upload-worker-bullmq.ts después de actualizar a POSTED
await sendEmail({
  to: user.email,
  subject: '¡Tu video está en TikTok!',
  body: `Ver video: ${postUrl}`,
});
```

### 4. Métricas y Alertas

Integrar con servicio de monitoreo:

```typescript
// En workers
await metrics.increment('jobs.edit.success');
await metrics.timing('jobs.edit.duration', duration);
```

Alertar si:

- Queue length > 100
- Failed jobs > 10% en 1 hora
- Workers desconectados

## ✅ Checklist de Deploy

- [ ] Crear cuenta Upstash y base de datos Redis
- [ ] Copiar `REDIS_URL` a Render
- [ ] Crear bucket S3 `subiteya-videos` privado
- [ ] Crear usuario IAM con permisos S3
- [ ] Copiar `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` a Render
- [ ] Configurar lifecycle policies en S3
- [ ] Agregar variables `EDIT_WORKER_CONCURRENCY=2` y `UPLOAD_WORKER_CONCURRENCY=1`
- [ ] Verificar `DATABASE_URL` usa puerto 6543 (pooler)
- [ ] Deploy en Render
- [ ] Verificar logs: "Edit Worker started", "Upload Worker started"
- [ ] Test end-to-end: upload → confirm → edita → queue-upload → posted
- [ ] Verificar SSE notifica cambios de estado
- [ ] Verificar videos en S3: `aws s3 ls s3://subiteya-videos/videos/`
- [ ] Configurar BullMQ dashboard (opcional)

## 📚 Referencias

- [BullMQ Docs](https://docs.bullmq.io/)
- [Upstash Redis](https://console.upstash.com/)
- [AWS S3 Docs](https://docs.aws.amazon.com/s3/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started/)
