# 📊 Flujo Completo: API → BullMQ Workers → TikTok

## Arquitectura General

```
┌─────────────┐
│   Cliente   │ (Frontend React)
│  (Browser)  │
└──────┬──────┘
       │ HTTP POST /api/videos
       ↓
┌─────────────────────────────────────────┐
│          API Server (Express)            │
│         packages/api/src/index.ts        │
└──────────────┬──────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────┐
│  queues-optimized.ts (BullMQ Producer)   │
│  - queueEditJob(videoId)                 │
│  - queueUploadJob(videoId)               │
└──────────────┬───────────────────────────┘
               │ Agrega jobs a Redis Queue
               ↓
        ┌─────────────┐
        │ Redis/Upstash│
        │  (Queue DB)  │
        └──────┬──────┘
               │
       ┌───────┴────────┐
       │                │
       ↓                ↓
┌──────────────┐  ┌──────────────┐
│ Edit Worker  │  │Upload Worker │
│  (BullMQ)    │  │   (BullMQ)   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ↓                 ↓
  FFmpeg Process    TikTok API
   (Branding)       (Publish)
```

---

## 🎬 Flujo Paso a Paso

### 1. **Usuario Sube Video** (Frontend → API)

```
POST /api/videos
Body: FormData {
  file: video.mp4,
  accountId: "conn_123",
  title: "Mi video"
}
```

**API Handler:** `packages/api/src/routes/videos.ts`

### 2. **API Procesa Request**

```typescript
// routes/videos.ts - línea ~45
router.post('/', upload.single('video'), async (req, res) => {
  // 1. Upload a S3
  const videoUrl = await uploadToS3(file);

  // 2. Crear video en DB
  const video = await prisma.video.create({
    data: {
      userId,
      accountId,
      srcUrl: videoUrl,
      status: 'EDITING_QUEUED',
    },
  });

  // 3. ⚡ AGREGAR JOB A QUEUE DE EDICIÓN
  await queueEditJob(video.id, PRIORITY.HIGH);

  res.json({ video });
});
```

### 3. **Queue Producer (BullMQ)** - `queues-optimized.ts`

```typescript
// lib/queues-optimized.ts - línea ~195
export async function queueEditJob(videoId: string, priority = 5) {
  if (!REDIS_ENABLED || !editQueue) {
    throw new Error('Queue system is disabled');
  }

  // Agrega job a Redis Queue 'video-edit'
  await editQueue.add(
    'edit-video',
    { videoId },
    {
      priority,
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
    }
  );

  console.log(`📥 [Queue] Edit job added for video ${videoId}`);
}
```

**Redis Command:**

```
RPUSH video-edit:jobs {"videoId": "vid_123", "priority": 3}
```

### 4. **Edit Worker Procesa Job** - `edit-worker-bullmq.ts`

```typescript
// workers/edit-worker-bullmq.ts - línea ~84
worker = new Worker(
  'video-edit',
  async job => {
    const { videoId } = job.data;
    await processEditJob(videoId, job);
  },
  {
    connection: redisConnection,
    concurrency: 2, // 2 videos simultáneos
    stalledInterval: 300000, // Check cada 5 min
  }
);
```

**Proceso:**

1. Worker hace polling a Redis cada ~5ms (event-driven)
2. Detecta nuevo job en queue `video-edit`
3. Ejecuta `processEditJob(videoId)`

```typescript
// workers/edit-worker-bullmq.ts - línea ~259
async function processEditJob(videoId, job) {
  // 1. Obtener video desde DB
  const video = await prisma.video.findUnique({ where: { id: videoId } });

  // 2. Descargar desde S3
  const videoBuffer = await downloadFromS3(video.srcUrl);

  // 3. Aplicar branding con FFmpeg
  const editedPath = await applyBrandPattern(videoPath, {
    logoUrl: design.watermark?.url,
    subtitles: design.captions?.enabled,
    effects: design.effects,
  });

  // 4. Subir video editado a S3
  const editedUrl = await uploadToS3(editedPath);

  // 5. Actualizar video en DB
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: 'EDITED',
      editedUrl,
      progress: 100,
    },
  });

  // 6. ⚡ AGREGAR JOB A QUEUE DE UPLOAD
  await queueUploadJob(videoId, PRIORITY.NORMAL);
}
```

### 5. **Upload Worker Procesa Job** - `upload-worker-bullmq.ts`

```typescript
// workers/upload-worker-bullmq.ts - línea ~127
worker = new Worker(
  'video-upload',
  async job => {
    const { videoId } = job.data;
    await processUploadJob(videoId, job);
  },
  {
    connection: redisConnection,
    concurrency: 1, // 1 upload a la vez
    limiter: { max: 3, duration: 60000 }, // Max 3/min
    stalledInterval: 300000, // Check cada 5 min
  }
);
```

**Proceso:**

1. Worker detecta job en queue `video-upload`
2. Ejecuta `processUploadJob(videoId)`

```typescript
// workers/upload-worker-bullmq.ts - línea ~186
async function processUploadJob(videoId, job) {
  // 1. Obtener video y account
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { account: true },
  });

  // 2. Descargar video editado
  const videoBuffer = await downloadFromS3(video.editedUrl);

  // 3. Decrypt TikTok access token
  const accessToken = decryptToken(account.accessTokenEnc);

  // 4. TikTok API: Step 1 - Query Creator Info
  await fetch(
    'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // 5. TikTok API: Step 2 - Initialize Upload
  const initResponse = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      method: 'POST',
      body: JSON.stringify({
        post_info: { title, privacy_level: 'SELF_ONLY' },
        source_info: { source: 'FILE_UPLOAD', video_size },
      }),
    }
  );

  const { publish_id, upload_url } = await initResponse.json();

  // 6. TikTok API: Step 3 - Upload Video File
  await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: videoBuffer,
  });

  // 7. Actualizar video como POSTED
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: 'POSTED',
      postUrl: `https://www.tiktok.com/@${account.displayName}/video/${publish_id}`,
      progress: 100,
    },
  });

  console.log(`✅ Video ${videoId} uploaded to TikTok!`);
}
```

---

## 🔧 Configuración de Workers

### **Edit Worker** (`edit-worker-bullmq.ts`)

- **Concurrency:** 2 (procesa 2 videos simultáneos)
- **Rate Limiter:** 3 jobs/min
- **Stalled Check:** Cada 5 minutos
- **Lock Duration:** 30 segundos
- **Retries:** 2 intentos

### **Upload Worker** (`upload-worker-bullmq.ts`)

- **Concurrency:** 1 (procesa 1 video a la vez)
- **Rate Limiter:** 3 uploads/min (global) + 1 upload/5min (por cuenta)
- **Stalled Check:** Cada 5 minutos
- **Lock Duration:** 30 segundos
- **Retries:** 2 intentos

---

## 📊 Redis Commands Breakdown

### **Comandos por Job Completo**

1. **Add Job:** `RPUSH video-edit:jobs {...}` → 1 comando
2. **Worker Polling (Event-driven):** Redis Pub/Sub → ~0 comandos extra
3. **Get Job:** `BLPOP video-edit:jobs` → 1 comando
4. **Update Progress:** `HSET video-edit:job:123 progress 50` → 5 comandos (0%, 10%, 30%, 60%, 100%)
5. **Complete Job:** `HSET + DEL` → 2 comandos
6. **Add Upload Job:** `RPUSH video-upload:jobs {...}` → 1 comando
7. **Upload Worker (igual):** ~9 comandos

**Total por video completo:** ~19 comandos

### **Comandos por Stalled Check** (cada 5 min)

- Edit Worker: `EVALSHA + SCAN` → ~10 comandos
- Upload Worker: `EVALSHA + SCAN` → ~10 comandos

**Total stalled checks/mes:**

- Edit: 288 checks/día × 30 días × 10 cmd = 86,400 comandos/mes
- Upload: 288 checks/día × 30 días × 10 cmd = 86,400 comandos/mes

**TOTAL POLLING:** ~172,800 comandos/mes

### **Uso Normal (con 100 videos/mes)**

```
Jobs: 100 videos × 19 comandos = 1,900 comandos
Polling: 172,800 comandos
────────────────────────────────
TOTAL: 174,700 comandos/mes ✅ Dentro de 500k
```

---

## 🚨 Problemas Anteriores (RESUELTOS)

### **❌ Problema 1: Loop infinito a localhost**

**Causa:** `REDIS_URL` no configurada → workers intentaban conectar a `127.0.0.1:6379`

**Síntoma:**

```
Error: connect ECONNREFUSED 127.0.0.1:6379
Error: connect ECONNREFUSED 127.0.0.1:6379
... (loop infinito)
```

**Fix:** Validar `REDIS_URL` ANTES de crear queues (líneas 17-26 de `queues-optimized.ts`)

### **❌ Problema 2: Queues creadas antes de validar**

**Causa:** Orden de ejecución incorrecto

```typescript
// ANTES (MAL):
const REDIS_ENABLED = process.env.ENABLE_REDIS !== 'false';  // línea 17
const REDIS_URL = process.env.REDIS_URL;  // línea 18

// ... validación en línea 23-28 (TARDE!)

// Queues ya creadas en línea 176:
export const editQueue = REDIS_ENABLED ? new Queue(...) : null;
```

**Fix:** Mover validación ANTES de crear queues

```typescript
// DESPUÉS (BIEN):
const REDIS_URL = process.env.REDIS_URL;  // línea 16
const hasValidRedisUrl = REDIS_URL && !REDIS_URL.includes('localhost');  // línea 18
let REDIS_ENABLED = process.env.ENABLE_REDIS !== 'false';  // línea 24

if (REDIS_ENABLED && !hasValidRedisUrl) {
  REDIS_ENABLED = false;  // Desactivar ANTES de línea 176
}

// Ahora queues se crean correctamente:
export const editQueue = REDIS_ENABLED ? new Queue(...) : null;
```

### **❌ Problema 3: stalledInterval = 60s (muy frecuente)**

**Antes:** 1,440 checks/día/worker = 691,200 comandos/mes ❌

**Después:** 288 checks/día/worker = 172,800 comandos/mes ✅

---

## ✅ Estado Actual

### **Configuración Correcta:**

1. ✅ `REDIS_URL` validada ANTES de crear queues
2. ✅ `stalledInterval: 300000` (5 minutos)
3. ✅ Workers NO se inician si `REDIS_ENABLED=false`
4. ✅ No más loops a localhost
5. ✅ Uso de Redis: ~175k comandos/mes (35% del límite)

### **Variables de Entorno Requeridas:**

```bash
# Render Environment Variables
REDIS_URL=rediss://default:PASSWORD@cunning-aphid-36462.upstash.io:6379
ENABLE_REDIS=true  # Opcional, default es true
ENCRYPTION_KEY=tu_encryption_key_32_chars
DATABASE_URL=postgresql://...
S3_BUCKET=tu-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### **Logs Esperados:**

```
✅ Redis/Upstash is ENABLED
[Upload Worker] Initializing...
[Upload Worker] REDIS_URL: Set
✅ [Upload Worker] Connected to Redis
[Upload Worker] Started with concurrency 1
✅ [Edit Worker] Connected to Redis
[Edit Worker] Started with concurrency 2
🚀 SubiteYa API listening on port 3000
```

---

## 🔍 Monitoreo

### **Endpoints de Monitoreo:**

```bash
# Redis Usage
GET /api/monitor/redis-usage
Response: {
  "total": 174700,
  "limit": 500000,
  "percentage": 34.94,
  "status": "OK"
}

# Queue Health
GET /api/monitor/queue-health
Response: {
  "redis": true,
  "queuesActive": true,
  "usage": { "percentage": 34.94 }
}
```

### **Upstash Dashboard:**

- https://console.upstash.com/
- Monitorea comandos en tiempo real
- Verifica que no exceda 500k/mes

---

## 📈 Optimizaciones Futuras

1. **Reducir stalledInterval a 10 minutos** si el uso sigue bajo
2. **Implementar Redis Streams** en lugar de BullMQ (menos overhead)
3. **Batch processing:** Procesar múltiples videos en un solo job
4. **Upgrade Upstash:** Plan Pro (1M requests/mes) si crece el uso

---

## 🐛 Troubleshooting

### **Workers no se inician:**

```bash
# Verificar REDIS_URL
echo $REDIS_URL

# Debe ser: rediss://default:PASSWORD@HOST:6379
# NO debe ser: redis://localhost:6379
```

### **Error "max requests limit exceeded":**

```bash
# Solución temporal: Desactivar Redis
ENABLE_REDIS=false

# Solución permanente:
# 1. Esperar al 1° del mes (reset de límite)
# 2. O upgrade a plan Pro de Upstash
```

### **Videos no se procesan:**

```bash
# Verificar logs de workers
# Buscar:
✅ [Edit Worker] Started with concurrency 2
✅ [Upload Worker] Connected to Redis

# Si no aparece, verificar REDIS_URL
```

---

## 📝 Notas Finales

- **Event-driven:** Workers NO hacen polling constante, usan Redis Pub/Sub
- **Stalled checks:** Solo verifican trabajos atascados cada 5 minutos
- **Graceful shutdown:** Workers se desconectan correctamente con SIGTERM
- **Rate limiting:** Upload worker respeta límites de TikTok API
