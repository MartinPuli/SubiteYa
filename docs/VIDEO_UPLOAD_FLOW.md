# Documentación Técnica: Flujo de Subida de Videos

**Fecha**: Noviembre 12, 2024  
**Versión**: 2.0 (con mejoras de idempotencia y backoff)  
**Autores**: Equipo SubiteYa

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [APIs y Servicios Externos](#apis-y-servicios-externos)
4. [Flujo Completo End-to-End](#flujo-completo-end-to-end)
5. [Workers y Procesamiento](#workers-y-procesamiento)
6. [Idempotencia y Resiliencia](#idempotencia-y-resiliencia)
7. [Rate Limiting y Backoff](#rate-limiting-y-backoff)
8. [Optimizaciones Implementadas](#optimizaciones-implementadas)
9. [Manejo de Errores](#manejo-de-errores)
10. [Monitoreo y Debugging](#monitoreo-y-debugging)

---

## 1. Descripción General

El sistema de subida de videos de SubiteYa permite a los usuarios:

1. **Subir** un video original
2. **Aplicar** patrones de marca automáticamente (logo, efectos, subtítulos)
3. **Publicar** en múltiples cuentas de TikTok simultáneamente

### Características Clave

- ✅ **Procesamiento asíncrono**: Workers independientes vía webhooks HTTP
- ✅ **Idempotencia**: Sin ejecuciones duplicadas por el mismo videoId
- ✅ **Backoff exponencial**: Reintentos inteligentes en fallos transitorios
- ✅ **Límite de concurrencia**: Máximo 3 uploads simultáneos por cuenta
- ✅ **Limpieza automática**: Archivos temporales siempre eliminados
- ✅ **Notificaciones en tiempo real**: SSE para actualizar UI

### Tecnologías Utilizadas

| Componente        | Tecnología                    | Propósito                          |
| ----------------- | ----------------------------- | ---------------------------------- |
| API Principal     | Express.js                    | Recibe uploads, orquesta flujo     |
| Queue System      | Upstash QStash                | Webhooks HTTP para jobs asíncronos |
| Storage           | AWS S3                        | Almacenamiento de videos           |
| Video Processing  | FFmpeg                        | Aplicación de patrones de marca    |
| Database          | PostgreSQL (Supabase)         | Registro de estados y metadatos    |
| Video Publishing  | TikTok Content Posting API v2 | Publicación en TikTok              |
| AI Services       | Whisper AI, ElevenLabs        | Subtítulos y narración             |
| Real-time Updates | Server-Sent Events (SSE)      | Notificaciones al frontend         |

---

## 2. Arquitectura del Sistema

### Diagrama de Componentes

```
┌─────────────────┐
│   FRONTEND      │
│   React/Vite    │
└────────┬────────┘
         │ POST /api/publish
         │ (multipart/form-data)
         ▼
┌─────────────────────────────────────────────────────────────┐
│                      API PRINCIPAL                          │
│                   Express (Puerto 3000)                     │
│                                                             │
│  1. Recibe video (multer disk storage)                     │
│  2. Sube a S3 (streaming)                                  │
│  3. Crea Video record (status: PENDING)                    │
│  4. Obtiene BrandPattern default                           │
│  5. Encola Edit Job → Qstash                               │
└─────────────────────────────────────────────────────────────┘
         │
         │ HTTP Webhook
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   UPSTASH QSTASH                            │
│              (Cola HTTP, reemplazo de Redis)                │
│                                                             │
│  • Recibe publishJSON() del API                             │
│  • Espera delay según prioridad (0-60s)                    │
│  • Envía POST webhook al worker                            │
│  • Reintentos automáticos: 3 veces                         │
│  • Firma con HMAC para seguridad                           │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │ POST /process                │ POST /process
         ▼                              ▼
┌────────────────────────┐    ┌────────────────────────┐
│    EDIT WORKER         │    │   UPLOAD WORKER        │
│   Puerto: 3001         │    │   Puerto: 3002         │
│                        │    │                        │
│ 1. Download from S3    │    │ 1. Get TikTok token    │
│ 2. Apply BrandPattern  │    │ 2. Creator info check  │
│    - Logo overlay      │    │ 3. Download edited     │
│    - Effects (FFmpeg)  │    │ 4. Init TikTok upload  │
│    - Subtitles (AI)    │    │ 5. PUT video binary    │
│    - Narration (AI)    │    │ 6. Mark as POSTED      │
│ 3. Upload edited to S3 │    │                        │
│ 4. Mark as EDITED      │    │                        │
└────────────────────────┘    └────────────────────────┘
         │                              │
         │ SSE Events                   │ SSE Events
         ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND UPDATE                          │
│         (via Server-Sent Events /api/events)                │
│                                                             │
│  • video_status_changed                                     │
│  • Progress bar update                                      │
│  • Error notifications                                      │
└─────────────────────────────────────────────────────────────┘
```

### Separación de Servicios (Render)

En producción, los workers se despliegan como servicios web independientes:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  API Service    │       │  Edit Worker    │       │ Upload Worker   │
│  (type: web)    │       │  (type: web)    │       │  (type: web)    │
│  Puerto: 3000   │       │  Puerto: 3001   │       │  Puerto: 3002   │
│                 │       │                 │       │                 │
│  • Express API  │       │  • FFmpeg       │       │  • TikTok API   │
│  • Auth         │       │  • S3 access    │       │  • S3 access    │
│  • SSE          │       │  • Prisma       │       │  • Prisma       │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         ▲                         ▲                         ▲
         │                         │                         │
         └─────────────────────────┴─────────────────────────┘
                   Shared: PostgreSQL Database
                          (Supabase Pooler)
```

**Ventajas de la separación**:

- ✅ Aislamiento de recursos (FFmpeg no bloquea el API)
- ✅ Escalado independiente por tipo de carga
- ✅ Fallas contenidas (crash de worker no afecta API)
- ✅ Limpieza de /tmp por servicio

---

## 3. APIs y Servicios Externos

### 3.1 AWS S3 (Almacenamiento)

**SDK**: `@aws-sdk/client-s3` v3.926.0

#### Endpoints Usados

```typescript
// Upload (usado por API y Edit Worker)
PUT s3://{bucket}/videos/{hash}-{filename}
Content-Type: video/mp4

// Download (usado por Edit y Upload Workers)
GET s3://{bucket}/videos/{key}
```

#### Configuración

```typescript
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  endpoint: process.env.S3_ENDPOINT, // Para MinIO/LocalStack en dev
});
```

#### Rate Limits

- **Standard tier**: Sin límite en requests (pay-per-use)
- **Bandwidth**: Sin límite (escalado automático de AWS)
- **Recomendaciones**:
  - Usar streaming en lugar de buffers en memoria
  - Implementar multipart upload para archivos >100MB
  - Considerar S3 Transfer Acceleration para uploads internacionales

#### Costos Aproximados

- **PUT Request**: $0.005 por 1,000 requests
- **GET Request**: $0.0004 por 1,000 requests
- **Storage**: $0.023 por GB/mes (Standard)
- **Transfer OUT**: $0.09 por GB (primeros 10TB/mes)

**Optimización**: Usar políticas de lifecycle para mover videos antiguos a S3 Glacier después de 90 días.

---

### 3.2 Upstash QStash (Cola de Jobs)

**SDK**: `@upstash/qstash`

#### Endpoints Usados

```typescript
// Encolar job (usado por API Principal)
POST https://qstash.upstash.io/v2/publish/{worker_url}
Headers:
  Authorization: Bearer {QSTASH_TOKEN}
Body: { videoId: "..." }
```

#### Configuración

```typescript
import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// Encolar edit job
await qstash.publishJSON({
  url: process.env.EDIT_WORKER_URL!,
  body: { videoId },
  delay: prioritySeconds,
  retries: 3,
});
```

#### Rate Limits y Planes

| Plan              | Mensajes/día | Precio/mes  | Notas      |
| ----------------- | ------------ | ----------- | ---------- |
| **Free**          | 500          | $0          | Desarrollo |
| **Pay as you go** | Ilimitado    | $1 por 100k | Producción |
| **Pro 100K**      | 100,000      | $10         | Fixed cost |

**Rate Limits Técnicos**:

- **Publish rate**: 1000 req/s por cuenta
- **Retries**: 3 por defecto (configurable)
- **Max delay**: 7 días
- **Payload size**: 1MB (suficiente para videoId)

#### Características Clave

- ✅ **No requiere Redis**: HTTP puro
- ✅ **Reintentos automáticos**: Con backoff exponencial
- ✅ **Firma HMAC**: Verifica autenticidad de webhooks
- ✅ **Delay configurable**: Priorización de jobs
- ✅ **Dead Letter Queue**: Captura fallos permanentes

#### Consumo Actual Estimado

```
Videos/día: 100
Jobs por video: 2 (edit + upload)
Total jobs/día: 200
Mensajes/mes: ~6,000

Plan recomendado: Pay as you go ($0.06/mes)
```

---

### 3.3 TikTok Content Posting API v2

**Documentación**: https://developers.tiktok.com/doc/content-posting-api-get-started/

#### Autenticación

```
OAuth 2.0 con PKCE (Proof Key for Code Exchange)
Scopes: user.info.basic, video.publish, video.upload
```

**Tokens**:

- **Access Token**: Expira en 24 horas
- **Refresh Token**: Expira en 365 días
- **Almacenamiento**: Encriptados con AES-256-GCM en BD

#### Endpoints Usados

##### 1. Creator Info Query (Validación)

```http
POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/
Headers:
  Authorization: Bearer {access_token}
  Content-Type: application/json

Response 200:
{
  "data": {
    "creator_avatar_url": "https://...",
    "creator_username": "user123",
    "privacy_level_options": ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]
  },
  "error": {
    "code": "ok",
    "message": ""
  }
}
```

**Propósito**: Verificar que la cuenta sigue activa y con permisos.

##### 2. Video Init (Inicializar Upload)

```http
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Headers:
  Authorization: Bearer {access_token}
  Content-Type: application/json
Body:
{
  "post_info": {
    "title": "Video Title",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_comment": false,
    "disable_duet": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 12345678,
    "chunk_size": 12345678,
    "total_chunk_count": 1
  }
}

Response 200:
{
  "data": {
    "publish_id": "v_publish_xxxxx",
    "upload_url": "https://open-upload.tiktokapis.com/video/?upload_id=xxxxx&upload_token=yyyyy"
  },
  "error": {
    "code": "ok"
  }
}
```

**Propósito**: Obtener URL firmada para subir el archivo binario.

##### 3. Video Upload (Subir Binario)

```http
PUT {upload_url}
Headers:
  Content-Type: video/mp4
  Content-Length: 12345678
Body: <binary video data>

Response 200: (sin body)
```

**Propósito**: Subir el archivo de video. TikTok lo procesa y publica automáticamente.

#### Rate Limits de TikTok

| Endpoint     | Límite             | Ventana  | Notas                  |
| ------------ | ------------------ | -------- | ---------------------- |
| Creator Info | 60 requests        | 1 minuto | Por access token       |
| Video Init   | 10 requests        | 1 minuto | Por access token       |
| Video Upload | Sin límite oficial | -        | Limitado por bandwidth |

**Límites por Usuario**:

- **Videos/día**: 10 por cuenta (límite de TikTok, no API)
- **Duración**: 3 segundos - 10 minutos
- **Tamaño**: Máximo 500MB por video
- **Formato**: MP4, MOV, WEBM (recomendado: MP4 H.264)

#### Errores Comunes

| Error Code             | Descripción                     | Solución                           |
| ---------------------- | ------------------------------- | ---------------------------------- |
| `access_token_invalid` | Token expirado o revocado       | Refresh token automático           |
| `scope_not_authorized` | Faltan permisos `video.publish` | Re-autorizar cuenta                |
| `rate_limit_exceeded`  | Superado límite de requests     | Backoff exponencial (implementado) |
| `invalid_video`        | Formato no soportado            | Validar antes de procesar          |
| `video_too_large`      | Archivo >500MB                  | Comprimir con FFmpeg               |
| `video_too_short`      | Duración <3s                    | Validar duración mínima            |

---

### 3.4 FFmpeg (Procesamiento de Video)

**Versión**: >= 4.4 (con filtros avanzados)

#### Uso en Edit Worker

```bash
ffmpeg -i input.mp4 \
  -vf "eq=brightness=0.1:contrast=1.05,
       [logo]overlay=W-w-20:H-h-20:alpha=0.9,
       subtitles=subs.srt" \
  -af "volume=1.2,loudnorm" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  output.mp4
```

#### Filtros Aplicados (según BrandPattern)

1. **Logo Overlay**: `overlay=x:y:alpha={opacity}`
2. **Color Grading**: `eq=brightness:contrast:saturation`
3. **Efectos**: `hue`, `curves`, `vignette`, `sharpen`, `gblur`
4. **Subtítulos**: `subtitles=file.srt:force_style='...'`
5. **Audio**: `volume`, `loudnorm`, `amix` (música de fondo)

#### Performance

- **Tiempo promedio**: 0.5x - 1.5x duración del video
- **CPU intensivo**: 100% de 1-2 cores durante procesamiento
- **Memoria**: ~500MB por video en paralelo
- **Disk I/O**: Read + Write en /tmp

**Optimización**: Render usa workers dedicados para evitar bloquear API.

---

### 3.5 Whisper AI (Transcripción)

**Modelo**: `openai/whisper-large-v3` (via API)

#### Uso

```typescript
// Extrae audio del video
ffmpeg -i video.mp4 -vn -acodec pcm_s16le audio.wav

// Transcribe con Whisper
const transcript = await whisperAPI.transcribe(audioFile, {
  language: 'es',
  model: 'large-v3',
  response_format: 'srt'
});
```

#### Rate Limits

- **Requests/minuto**: Depende del plan de OpenAI
- **Duración máxima**: Sin límite técnico (cobro por minuto)
- **Costo**: ~$0.006 por minuto de audio

**Optimización**: Solo activar si `enableSubtitles: true` en el patrón.

---

### 3.6 ElevenLabs (Narración IA)

**API**: https://api.elevenlabs.io/v1

#### Endpoints Usados

```http
GET /v1/voices
Authorization: Bearer {ELEVENLABS_API_KEY}

Response:
{
  "voices": [
    { "voice_id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel" },
    // ...
  ]
}
```

```http
POST /v1/text-to-speech/{voice_id}
Authorization: Bearer {ELEVENLABS_API_KEY}
Body:
{
  "text": "Script generado por GPT-4...",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.75,
    "similarity_boost": 0.85,
    "style": 0.5,
    "speed": 1.0
  }
}

Response: audio/mpeg (binary)
```

#### Rate Limits y Planes

| Plan        | Caracteres/mes | Voces | Costo |
| ----------- | -------------- | ----- | ----- |
| **Free**    | 10,000         | 3     | $0    |
| **Starter** | 30,000         | 10    | $5    |
| **Creator** | 100,000        | 30    | $22   |
| **Pro**     | 500,000        | Todas | $99   |

**Límites Técnicos**:

- **Caracteres por request**: 5,000
- **Requests/segundo**: 2 (Free), 5 (Starter+)

**Optimización**:

- Cachear narraciones para scripts repetidos
- Comprimir audio generado antes de mezclar

---

## 4. Flujo Completo End-to-End

### Estados del Video

```
PENDING → EDITING → EDITED → UPLOADING → POSTED
   ↓         ↓                    ↓
FAILED_EDIT              FAILED_UPLOAD
```

### Diagrama de Secuencia Detallado

```
Usuario    Frontend    API         S3        Qstash    Edit Worker    Upload Worker    TikTok
  │           │         │          │           │            │               │            │
  │ 1. Sube video.mp4  │          │           │            │               │            │
  ├──────────►│         │          │           │            │               │            │
  │           │ POST /publish      │           │            │               │            │
  │           ├────────►│          │           │            │               │            │
  │           │         │ Upload   │           │            │               │            │
  │           │         ├─────────►│           │            │               │            │
  │           │         │◄─────────┤           │            │               │            │
  │           │         │ URL      │           │            │               │            │
  │           │         │          │           │            │               │            │
  │           │         │ Create Video(PENDING)│            │               │            │
  │           │         │ Get BrandPattern     │            │               │            │
  │           │         │          │           │            │               │            │
  │           │         │ Queue Edit Job       │            │               │            │
  │           │         ├──────────────────────►│           │               │            │
  │           │◄────────┤          │           │            │               │            │
  │◄──────────┤ 202 Accepted       │           │            │               │            │
  │           │         │          │           │            │               │            │
  │           │         │          │           │ Webhook    │               │            │
  │           │         │          │           ├───────────►│               │            │
  │           │         │          │           │            │               │            │
  │           │         │          │           │            │ Check idempotency         │
  │           │         │          │           │            │ Update: EDITING           │
  │           │         │          │           │            │               │            │
  │           │         │          │◄──────────────────────┤               │            │
  │           │         │          │ Download  │            │               │            │
  │           │         │          ├───────────────────────►│               │            │
  │           │         │          │           │            │               │            │
  │           │         │          │           │            │ FFmpeg process│            │
  │           │         │          │           │            │ (logo, effects, subs)     │
  │           │         │          │           │            │               │            │
  │           │         │          │◄──────────────────────┤               │            │
  │           │         │          │ Upload edited          │               │            │
  │           │         │          ├───────────────────────►│               │            │
  │           │         │          │           │            │               │            │
  │           │         │          │           │            │ Update: EDITED│            │
  │           │         │          │           │            │ SSE event     │            │
  │◄──────────────────────────────────────────────────────┤               │            │
  │ "Video editado"    │          │           │            │               │            │
  │           │         │          │           │            │               │            │
  │ 2. Confirma publicación       │           │            │               │            │
  ├──────────►│         │          │           │            │               │            │
  │           │ POST /videos/{id}/queue-upload│            │               │            │
  │           ├────────►│          │           │            │               │            │
  │           │         │ Queue Upload Job     │            │               │            │
  │           │         ├──────────────────────►│           │               │            │
  │           │◄────────┤          │           │            │               │            │
  │◄──────────┤         │          │           │            │               │            │
  │           │         │          │           │            │  Webhook      │            │
  │           │         │          │           │            │  ├───────────►│            │
  │           │         │          │           │            │  │            │            │
  │           │         │          │           │            │  │ Check idempotency      │
  │           │         │          │           │            │  │ Check concurrency      │
  │           │         │          │           │            │  │ Check backoff          │
  │           │         │          │           │            │  │ Update: UPLOADING      │
  │           │         │          │           │            │  │            │            │
  │           │         │          │           │            │  │            │ Creator Info│
  │           │         │          │           │            │  │            ├───────────►│
  │           │         │          │           │            │  │            │◄───────────┤
  │           │         │          │           │            │  │            │            │
  │           │         │          │◄──────────────────────────┤            │            │
  │           │         │          │ Download edited           │            │            │
  │           │         │          ├───────────────────────────►│            │            │
  │           │         │          │           │            │  │            │            │
  │           │         │          │           │            │  │            │ Video Init │
  │           │         │          │           │            │  │            ├───────────►│
  │           │         │          │           │            │  │            │◄───────────┤
  │           │         │          │           │            │  │            │ upload_url │
  │           │         │          │           │            │  │            │            │
  │           │         │          │           │            │  │            │ PUT video  │
  │           │         │          │           │            │  │            ├───────────►│
  │           │         │          │           │            │  │            │◄───────────┤
  │           │         │          │           │            │  │            │ 200 OK     │
  │           │         │          │           │            │  │            │            │
  │           │         │          │           │            │  │ Update: POSTED         │
  │           │         │          │           │            │  │ SSE event  │            │
  │◄──────────────────────────────────────────────────────────┤            │            │
  │ "Video publicado"  │          │           │            │  │            │            │
```

---

## 5. Workers y Procesamiento

### 5.1 Edit Worker (Puerto 3001)

#### Responsabilidades

1. Descargar video original de S3
2. Aplicar BrandPattern (logo, efectos, subtítulos)
3. Subir video editado a S3
4. Actualizar status a EDITED

#### Código Clave

```typescript
// Idempotency check
if (isExecutionInProgress(videoId)) {
  return { skipped: true, reason: 'idempotent' };
}

markExecutionStart(videoId);

// Skip if already in terminal state
if ([EDITED, FAILED_EDIT, POSTED, FAILED_UPLOAD].includes(video.status)) {
  markExecutionEnd(videoId, 'completed');
  return { skipped: true, reason: 'already_processed' };
}

// Atomic transition: PENDING → EDITING
await prisma.video.update({
  where: { id: videoId },
  data: { status: EDITING, progress: 10, error: null },
});

// Download, process, upload
try {
  const tempPath = `/tmp/video-${videoId}-${Date.now()}.mp4`;
  await downloadStreamFromS3(s3Key, tempPath);

  const result = await applyBrandPattern(tempPath, pattern);

  const uploadResult = await uploadToS3({
    file: fs.createReadStream(result.outputPath),
    filename: path.basename(result.outputPath),
  });

  // Atomic transition: EDITING → EDITED
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: EDITED,
      editedUrl: uploadResult.url,
      progress: 100,
      error: null,
    },
  });

  markExecutionEnd(videoId, 'completed');
} catch (error) {
  markExecutionEnd(videoId, 'failed');

  // Only update if not already failed
  await prisma.video.updateMany({
    where: {
      id: videoId,
      status: { notIn: [FAILED_EDIT, FAILED_UPLOAD] },
    },
    data: { status: FAILED_EDIT, error: error.message },
  });
} finally {
  // Always cleanup temp files
  await fs.unlink(tempPath).catch(() => {});
  await fs.unlink(result.outputPath).catch(() => {});
}
```

#### Performance Típica

| Duración Video | Tiempo Procesamiento | CPU          | Memoria |
| -------------- | -------------------- | ------------ | ------- |
| 15 segundos    | ~15-30s              | 100% 1 core  | ~300MB  |
| 1 minuto       | ~60-120s             | 100% 2 cores | ~500MB  |
| 5 minutos      | ~5-10 min            | 100% 2 cores | ~800MB  |

---

### 5.2 Upload Worker (Puerto 3002)

#### Responsabilidades

1. Verificar token de acceso TikTok (refresh si es necesario)
2. Validar cuenta con Creator Info
3. Descargar video editado de S3
4. Inicializar upload en TikTok
5. Subir binario a TikTok
6. Actualizar status a POSTED

#### Código Clave

```typescript
// Idempotency check
if (isExecutionInProgress(videoId)) {
  return { skipped: true, reason: 'idempotent' };
}

// Concurrency check (max 3 per account)
if (getAccountConcurrentJobs(accountId) >= MAX_CONCURRENT_PER_ACCOUNT) {
  return { error: 'Too many concurrent uploads', retryAfter: 30 };
}

// Backoff check (exponential delay after failures)
const backoffInfo = shouldBackoff(accountId);
if (backoffInfo.backoff) {
  return { error: 'Account in backoff', retryAfter: backoffInfo.delayMs };
}

markExecutionStart(videoId);

try {
  // Get access token (decrypt from DB)
  const accessToken = await getTikTokAccessToken(accountId);

  // Validate account
  await getTikTokCreatorInfo(accessToken);

  // Download edited video
  const tempPath = `/tmp/upload-${videoId}-${Date.now()}.mp4`;
  await downloadStreamFromS3(editedKey, tempPath);

  // Initialize TikTok upload
  const { publishId, uploadUrl } = await initTikTokUpload(
    accessToken,
    videoSize,
    title,
    'PUBLIC_TO_EVERYONE'
  );

  // Upload binary
  const videoBuffer = await fs.readFile(tempPath);
  await axios.put(uploadUrl, videoBuffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.length,
    },
  });

  // Atomic transition: UPLOADING → POSTED
  await prisma.video.update({
    where: { id: videoId },
    data: { status: POSTED, progress: 100, error: null },
  });

  recordAccountSuccess(accountId);
  markExecutionEnd(videoId, 'completed');
} catch (error) {
  recordAccountFailure(accountId); // Trigger backoff
  markExecutionEnd(videoId, 'failed');

  await prisma.video.updateMany({
    where: {
      id: videoId,
      status: { notIn: [FAILED_UPLOAD] },
    },
    data: { status: FAILED_UPLOAD, error: error.message },
  });
} finally {
  await fs.unlink(tempPath).catch(() => {});
}
```

#### Performance Típica

| Tamaño Video | Tiempo Upload | Bandwidth | Notas      |
| ------------ | ------------- | --------- | ---------- |
| 10MB         | ~5-10s        | 1-2 Mbps  | Red normal |
| 50MB         | ~30-60s       | 1-2 Mbps  | Red normal |
| 200MB        | ~2-4 min      | 1-2 Mbps  | Red normal |

**Optimización**: Render tiene buena conectividad a TikTok (AWS us-east-1).

---

## 6. Idempotencia y Resiliencia

### 6.1 Tracking de Ejecuciones Activas

Ambos workers mantienen un `Map` en memoria:

```typescript
const activeExecutions = new Map<
  string, // videoId
  {
    startTime: number;
    status: 'running' | 'completed' | 'failed';
  }
>();
```

#### Lógica de Idempotencia

```typescript
function isExecutionInProgress(videoId: string): boolean {
  const execution = activeExecutions.get(videoId);
  if (!execution) return false;

  // Cleanup old entries (5 minutes)
  if (execution.status !== 'running') {
    if (Date.now() - execution.startTime > 5 * 60 * 1000) {
      activeExecutions.delete(videoId);
      return false;
    }
  }

  return execution.status === 'running';
}
```

**Comportamiento**:

- ✅ **Primera ejecución**: Procesa normalmente
- ⏭️ **Duplicado inmediato**: Retorna `{ skipped: true, reason: 'idempotent' }`
- ✅ **Reintentos después de 5 min**: Permite re-ejecutar (útil para fallos transitorios)

### 6.2 Verificación de Estados Terminales

Antes de procesar, ambos workers verifican si el video ya está en un estado final:

```typescript
// Edit Worker: Skip if already EDITED, POSTED, FAILED_*
if ([EDITED, FAILED_EDIT, POSTED, FAILED_UPLOAD].includes(video.status)) {
  return { skipped: true, reason: 'already_processed', status: video.status };
}

// Upload Worker: Skip if already POSTED or FAILED_UPLOAD
if ([POSTED, FAILED_UPLOAD].includes(video.status)) {
  return { skipped: true, reason: 'already_processed', status: video.status };
}
```

### 6.3 Transiciones Atómicas

Las actualizaciones de estado se hacen en una sola operación Prisma:

```typescript
// ❌ INCORRECTO (no atómico)
await prisma.video.update({
  where: { id },
  data: { status: EDITED },
});
await prisma.video.update({
  where: { id },
  data: { editedUrl: url, progress: 100 },
});

// ✅ CORRECTO (atómico)
await prisma.video.update({
  where: { id },
  data: {
    status: EDITED,
    editedUrl: url,
    progress: 100,
    error: null,
  },
});
```

### 6.4 Protección contra Sobrescritura de Errores

No se sobrescriben estados de error si ya están establecidos:

```typescript
// Solo actualizar a FAILED_EDIT si NO está ya en FAILED_*
await prisma.video.updateMany({
  where: {
    id: videoId,
    status: { notIn: [FAILED_EDIT, FAILED_UPLOAD] },
  },
  data: { status: FAILED_EDIT, error: errorMessage },
});
```

---

## 7. Rate Limiting y Backoff

### 7.1 Límite de Concurrencia por Cuenta

**Problema**: Si un usuario sube 10 videos simultáneos para la misma cuenta de TikTok, podríamos exceder los rate limits de TikTok.

**Solución**: Máximo 3 uploads simultáneos por cuenta.

```typescript
const MAX_CONCURRENT_PER_ACCOUNT = 3;

function getAccountConcurrentJobs(accountId: string): number {
  let count = 0;
  for (const [, execution] of activeExecutions) {
    if (execution.status === 'running') count++;
  }
  return count;
}

// En el webhook handler
if (getAccountConcurrentJobs(accountId) >= MAX_CONCURRENT_PER_ACCOUNT) {
  return res.status(429).json({
    error: 'Too many concurrent uploads',
    retryAfter: 30,
  });
}
```

**Comportamiento**:

- Qstash reintentará automáticamente después de 30 segundos
- Reduce probabilidad de `rate_limit_exceeded` de TikTok

### 7.2 Backoff Exponencial por Cuenta

**Problema**: Si TikTok rechaza requests de una cuenta (token inválido, rate limit, etc.), seguir intentando empeora el problema.

**Solución**: Backoff exponencial por cuenta después de fallos.

```typescript
const accountBackoff = new Map<
  string, // accountId
  { consecutiveFailures: number; lastFailureTime: number }
>();

function shouldBackoff(accountId: string): {
  backoff: boolean;
  delayMs?: number;
} {
  const info = accountBackoff.get(accountId);
  if (!info || info.consecutiveFailures === 0) return { backoff: false };

  // Exponential: 2^failures seconds (max 5 minutes)
  const delayMs = Math.min(
    Math.pow(2, info.consecutiveFailures) * 1000,
    5 * 60 * 1000
  );

  const timeSinceLastFailure = Date.now() - info.lastFailureTime;

  if (timeSinceLastFailure < delayMs) {
    return { backoff: true, delayMs: delayMs - timeSinceLastFailure };
  }

  return { backoff: false };
}

function recordAccountFailure(accountId: string): void {
  const info = accountBackoff.get(accountId) || {
    consecutiveFailures: 0,
    lastFailureTime: 0,
  };
  info.consecutiveFailures++;
  info.lastFailureTime = Date.now();
  accountBackoff.set(accountId, info);
}

function recordAccountSuccess(accountId: string): void {
  accountBackoff.delete(accountId); // Reset counter
}
```

**Tiempos de backoff**:

- **1er fallo**: 2 segundos
- **2do fallo**: 4 segundos
- **3er fallo**: 8 segundos
- **4to fallo**: 16 segundos
- **5to fallo**: 32 segundos
- **6to+ fallo**: 5 minutos (cap)

**Reseteo**: Al primer éxito, se resetea el contador.

### 7.3 Reintentos Automáticos de Qstash

Qstash reintenta automáticamente 3 veces con backoff:

```
Intento 1: Inmediato
Intento 2: +30 segundos
Intento 3: +60 segundos
Intento 4: Dead Letter Queue (fallo permanente)
```

**Combinado con backoff por cuenta**:

- Si la cuenta está en backoff, el worker retorna 429
- Qstash reintenta según su programación
- Eventualmente el backoff expira y el job se procesa

---

## 8. Optimizaciones Implementadas

### 8.1 Eliminación de Polling

**Antes** (❌ Malo):

```typescript
// Worker consultaba BD cada 5 segundos buscando jobs
setInterval(async () => {
  const pendingJobs = await prisma.job.findMany({
    where: { status: 'queued', type: 'edit' },
  });
  for (const job of pendingJobs) {
    await processJob(job);
  }
}, 5000);
```

**Después** (✅ Bueno):

```typescript
// Worker solo responde a webhooks HTTP de Qstash
app.post('/process', async (req, res) => {
  const { videoId } = req.body;
  await processVideo(videoId);
  res.json({ success: true });
});
```

**Beneficios**:

- ✅ Cero consumo de recursos en idle
- ✅ Sin queries innecesarias a BD
- ✅ Escalado horizontal automático (múltiples workers)
- ✅ Respuesta inmediata (no espera a polling cycle)

### 8.2 Streaming en lugar de Buffers

**S3 Downloads**:

```typescript
// ❌ Antes: Carga todo en memoria
const buffer = await s3.getObject({ Key }).promise();
await fs.writeFile(tempPath, buffer.Body);

// ✅ Ahora: Streaming directo
const stream = await downloadStreamFromS3(key);
const writeStream = fs.createWriteStream(tempPath);
stream.pipe(writeStream);
```

**S3 Uploads**:

```typescript
// ❌ Antes: Lee todo el archivo en memoria
const buffer = await fs.readFile(outputPath);
await s3.putObject({ Key, Body: buffer });

// ✅ Ahora: Streaming directo
const readStream = fs.createReadStream(outputPath);
await uploadToS3({ file: readStream, filename });
```

**Beneficios**:

- ✅ Memoria constante (~50MB) vs. N×videoSize
- ✅ Soporta videos grandes (>1GB) sin OOM
- ✅ Menor latencia (empieza a procesar antes)

### 8.3 Limpieza Robusta de /tmp

**Implementación**:

```typescript
let tempFilePath: string | null = null;
let outputFilePath: string | null = null;

try {
  tempFilePath = `/tmp/video-${videoId}-${Date.now()}.mp4`;
  // ... procesamiento ...
  outputFilePath = result.outputPath;
  // ... upload ...
} catch (error) {
  // ... manejo de error ...
} finally {
  // SIEMPRE se ejecuta, incluso si hay error o return temprano
  if (tempFilePath) {
    await fs.unlink(tempFilePath).catch(() => {});
  }
  if (outputFilePath) {
    await fs.unlink(outputFilePath).catch(() => {});
  }
}
```

**Protección adicional**: Render limpia /tmp automáticamente al reiniciar el worker.

### 8.4 SSE Solo en Cambios Reales

**Antes** (❌ Malo):

```typescript
setInterval(() => {
  notifyUser(userId, { type: 'heartbeat' }); // Cada 5s
}, 5000);
```

**Después** (✅ Bueno):

```typescript
// Solo emitir cuando cambia status o progress significativo
if (oldStatus !== newStatus) {
  notifyUser(userId, {
    type: 'video_status_changed',
    videoId,
    status: newStatus,
  });
}
```

**Beneficios**:

- ✅ Menos bandwidth
- ✅ Menos re-renders en frontend
- ✅ Escalable a miles de usuarios

### 8.5 Caché de Conexiones de Base de Datos

**Prisma con Connection Pooling**:

```typescript
// prisma.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=20',
    },
  },
});
```

**Configuración Supabase Pooler**:

- **Pool size**: 10 conexiones por worker
- **Timeout**: 20 segundos
- **Modo**: Transaction (mejor para queries cortas)

---

## 9. Manejo de Errores

### 9.1 Clasificación de Errores

#### Errores Transitorios (Reintentar)

- `ECONNRESET`: Red inestable
- `ETIMEDOUT`: Timeout de red
- `503 Service Unavailable`: Servicio temporalmente caído
- `429 Too Many Requests`: Rate limit (esperar y reintentar)
- TikTok `rate_limit_exceeded`

**Estrategia**: Backoff exponencial + reintentos automáticos de Qstash.

#### Errores Permanentes (No Reintentar)

- `401 Unauthorized`: Token inválido (requiere re-autenticación manual)
- `400 Bad Request`: Datos inválidos (no se arreglará reintentando)
- `404 Not Found`: Recurso inexistente
- TikTok `invalid_video`: Formato no soportado
- FFmpeg error: Video corrupto

**Estrategia**: Marcar como FAILED\_\* inmediatamente, notificar al usuario.

### 9.2 Mapeo de Errores a Mensajes Útiles

```typescript
function mapErrorToUserMessage(error: Error): string {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('econnreset') || message.includes('etimedout')) {
    return 'Error de conexión. Reintentando automáticamente...';
  }

  // S3 errors
  if (message.includes('nosuchkey') || message.includes('s3')) {
    return 'Video no encontrado en almacenamiento. Por favor sube de nuevo.';
  }

  // FFmpeg errors
  if (message.includes('invalid data') || message.includes('ffmpeg')) {
    return 'Video corrupto o formato no soportado. Verifica el archivo.';
  }

  // TikTok errors
  if (message.includes('access_token_invalid')) {
    return 'Sesión de TikTok expirada. Por favor reconecta tu cuenta.';
  }

  if (message.includes('rate_limit')) {
    return 'Límite de publicaciones alcanzado. Intenta en unos minutos.';
  }

  if (message.includes('video_too_large')) {
    return 'Video muy pesado. Máximo 500MB permitido.';
  }

  // Generic
  return `Error: ${error.message}`;
}
```

### 9.3 Recuperación Automática

**Casos manejados automáticamente**:

1. **Token expirado**: El upload worker detecta `401` y solicita refresh del token
2. **Rate limit temporal**: Backoff + reintentos de Qstash
3. **Red inestable**: Reintentos con delay creciente
4. **Worker crash**: Qstash reintenta en otro worker (si hay múltiples instancias)

**Casos que requieren intervención**:

1. **Cuenta desconectada**: Usuario debe re-autorizar en TikTok
2. **Video corrupto**: Usuario debe subir nuevo archivo
3. **Límite de publicaciones diario**: Esperar 24 horas (límite de TikTok)

---

## 10. Monitoreo y Debugging

### 10.1 Logs Estructurados

Cada worker genera logs con prefijos claros:

```
[Edit Worker] 📥 Received job for video abc123
[Edit Worker] ⬇️  Downloading from S3...
[Edit Worker] 🎨 Processing with design: Mi Patrón
[Edit Worker] 🎬 Applying branding...
[Edit Worker] ⬆️  Uploading to S3...
[Edit Worker] ✅ Completed video abc123 in 45000ms

[Upload Worker] 📥 Received job for video abc123
[Upload Worker] 🔑 Getting access token...
[Upload Worker] 👤 Fetching creator info...
[Upload Worker] ⬇️  Downloading from S3...
[Upload Worker] 📊 Video size: 15.32 MB
[Upload Worker] 🚀 Initializing TikTok upload...
[Upload Worker] ⬆️  Uploading to TikTok...
[Upload Worker] ✅ Completed video abc123 in 35000ms
```

### 10.2 Métricas Clave

**Por Worker**:

- `video_processed_total`: Contador de videos procesados
- `video_process_duration_seconds`: Histograma de duración
- `video_process_errors_total`: Contador de errores por tipo
- `active_jobs_gauge`: Jobs en ejecución actualmente

**Por Cuenta**:

- `account_uploads_total`: Uploads por cuenta TikTok
- `account_failures_total`: Fallos por cuenta
- `account_backoff_active`: Cuentas en backoff

**Sistema**:

- `temp_files_size_bytes`: Tamaño de archivos en /tmp
- `s3_operations_total`: Requests a S3 (upload/download)
- `tiktok_api_requests_total`: Requests a TikTok API

#### API de métricas unificadas

- `GET /api/monitor/metrics` (requiere JWT) expone en un solo payload:
  - `runtime`: counters/gauges/histogramas provenientes del collector en memoria (`video_*`, `s3_*`, `tiktok_api_*`).
  - `database.videosByStatus`, `jobsByStatus`, `jobsByType`: agregados en tiempo real usando Prisma `groupBy`.
  - `database.dailyThroughput`: lista `{ day, created, processed, failed }` para los últimos 7 días (ideal para charts de líneas).
  - `database.topicLeaders`: top 5 hashtags/temas inferidos del título (`#crypto`, `impuestos 2025`, etc.).
  - `database.accountsWithFailures`: top 5 cuentas con más fallos en los últimos 7 días.
  - `database.recentFailures`: últimos 5 videos fallidos con mensaje y cuenta.
- Ejemplo de consumo:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.subiteya.com/api/monitor/metrics | jq '.database.dailyThroughput'
```

> Tip: montar un dashboard (Grafana/Metabase) leyendo este endpoint cada minuto para graficar throughput vs. fallos y detectar picos en cuentas específicas.

### 10.3 Health Checks

Ambos workers exponen `GET /health`:

```json
{
  "status": "healthy",
  "service": "edit-worker",
  "qstash": {
    "enabled": true,
    "signatureVerification": true
  },
  "uptime": 345678,
  "timestamp": 1699825200000,
  "activeJobs": 2,
  "processedToday": 47
}
```

**Monitoreo de Render**: Llama a `/health` cada 30 segundos. Si falla 3 veces consecutivas, reinicia el worker.

### 10.4 Debugging de Fallos

**Investigar video específico**:

```sql
-- Ver estado y error
SELECT id, status, error, progress, created_at
FROM videos
WHERE id = 'abc123';

-- Ver jobs asociados
SELECT * FROM jobs WHERE video_id = 'abc123' ORDER BY created_at DESC;

-- Ver eventos de auditoría
SELECT * FROM audit_events
WHERE details_json->>'videoId' = 'abc123'
ORDER BY timestamp DESC;
```

**Logs de Render**:

```bash
# Ver logs en tiempo real
render logs --tail -s edit-worker

# Buscar errores de un video específico
render logs -s edit-worker | grep "abc123"

# Ver solo errores
render logs -s edit-worker | grep "❌"
```

### 10.5 Testing en Producción

**Caso 1: Video normal (camino feliz)**

```bash
# Subir video de prueba
curl -X POST https://api.subiteya.com/api/publish \
  -H "Authorization: Bearer $TOKEN" \
  -F "video=@test.mp4" \
  -F "title=Test Video" \
  -F "accountIds=[\"account-id\"]"

# Monitorear progreso vía SSE
curl -H "Authorization: Bearer $TOKEN" \
  https://api.subiteya.com/api/events
```

**Caso 2: Doble disparo (idempotencia)**

```bash
# Disparar edit job manualmente dos veces
curl -X POST $EDIT_WORKER_URL/process \
  -H "Content-Type: application/json" \
  -d '{"videoId":"abc123"}'

# Segunda llamada debe retornar:
# { "success": true, "skipped": true, "reason": "idempotent" }
```

**Caso 3: Simular fallo de red**

```bash
# Agregar regla de firewall temporal para bloquear TikTok
# (en staging environment)

# Subir video → debe entrar en backoff
# Ver logs: "Account in backoff period"

# Remover bloqueo → debe recuperarse automáticamente
```

---

## 11. Próximos Pasos y Mejoras

### 11.1 Optimizaciones Pendientes

1. **Multipart Upload para S3**: Videos >100MB deberían usar multipart
2. **Compresión de Videos**: FFmpeg con H.265 para reducir tamaño 50%
3. **CDN para Videos Procesados**: CloudFront delante de S3
4. **Caché de Patrones**: No re-aplicar si el patrón no cambió
5. **Procesamiento Paralelo**: Multiple audio tracks simultáneas

### 11.2 Features Futuros

1. **Scheduling**: Programar publicaciones para fechas futuras
2. **Analytics**: Métricas de performance de videos publicados
3. **A/B Testing**: Probar múltiples versiones del mismo video
4. **Thumbnail Personalizado**: Seleccionar frame específico
5. **Multi-Platform**: Publicar en Instagram Reels, YouTube Shorts

### 11.3 Escalabilidad

**Proyección de Crecimiento**:

| Métrica                  | Actual | 6 meses | 1 año   |
| ------------------------ | ------ | ------- | ------- |
| Videos/día               | 100    | 1,000   | 5,000   |
| Edit Worker instancias   | 1      | 3       | 10      |
| Upload Worker instancias | 1      | 2       | 5       |
| S3 storage (GB)          | 50     | 500     | 2,500   |
| Qstash mensajes/mes      | 6,000  | 60,000  | 300,000 |
| Costo mensual estimado   | $50    | $300    | $1,200  |

**Bottlenecks anticipados**:

1. **FFmpeg CPU**: Necesitará workers más potentes (c6i instances)
2. **TikTok Rate Limits**: Considerar distribución geográfica de cuentas
3. **Database Connections**: Aumentar pool size de Supabase
4. **S3 Bandwidth**: Considerar S3 Transfer Acceleration

---

## 12. Referencias

### Documentación Externa

- **TikTok Content Posting API**: https://developers.tiktok.com/doc/content-posting-api-get-started/
- **Upstash QStash**: https://upstash.com/docs/qstash
- **AWS S3**: https://docs.aws.amazon.com/s3/
- **FFmpeg**: https://ffmpeg.org/documentation.html
- **Prisma ORM**: https://www.prisma.io/docs
- **ElevenLabs API**: https://elevenlabs.io/docs/api-reference
- **Whisper AI**: https://openai.com/research/whisper

### Documentación Interna

- `docs/BRAND_PATTERNS_MODULE.md`: Detalle de patrones de edición
- `docs/RENDER_WORKERS_SETUP.md`: Configuración de workers en Render
- `docs/DATABASE_CONNECTION_RETRY.md`: Sistema de reintentos de BD
- `VOICE_NARRATION_FEATURE.md`: Feature de narración con IA

### Contacto y Soporte

- **Backend**: backend@subiteya.com
- **DevOps**: devops@subiteya.com
- **TikTok API Issues**: https://developers.tiktok.com/support

---

## 13. Changelog

### v2.0 (2024-11-12)

- ✅ Implementada idempotencia con tracking de ejecuciones activas
- ✅ Agregado backoff exponencial por cuenta
- ✅ Límite de concurrencia (3 uploads/cuenta)
- ✅ Transiciones atómicas de estado
- ✅ Limpieza robusta de archivos temporales en `finally` blocks
- ✅ Protección contra sobrescritura de estados FAILED\_\*
- ✅ Eliminación de polling (solo webhooks)
- ✅ SSE solo en cambios reales (no heartbeats)

### v1.0 (2024-11-01)

- ✅ Implementación inicial de Edit y Upload Workers
- ✅ Integración con Upstash QStash
- ✅ Soporte para BrandPatterns
- ✅ TikTok Content Posting API v2
- ✅ Streaming de S3 uploads/downloads

---

**Última actualización**: 2024-11-12  
**Mantenido por**: Equipo de Desarrollo SubiteYa
