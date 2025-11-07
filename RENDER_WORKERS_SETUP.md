# 🔧 Configuración de Workers Separados en Render

## Por Qué Separar los Workers

El plan gratuito de Render tiene un límite de **512MB de RAM**. Ejecutar el servidor + 2 workers en el mismo proceso excede este límite y causa crashes.

**Solución**: Ejecutar cada componente como un servicio separado.

---

## 📊 Arquitectura de Servicios

```
┌─────────────────────────────────────────────────┐
│  subiteya-api (Web Service)                     │
│  - Express server                               │
│  - Maneja requests HTTP                         │
│  - Encola trabajos en Redis (BullMQ)           │
│  - Memoria: ~200MB                              │
└─────────────────────────────────────────────────┘
                      │
                      ▼ (Redis Queue)
        ┌─────────────────────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐      ┌──────────────────────┐
│ Edit Worker      │      │ Upload Worker        │
│ (Background)     │      │ (Background)         │
│ - Procesa videos │      │ - Sube a TikTok     │
│ - Aplica efectos │      │ - Rate limiting     │
│ - Usa FFmpeg     │      │ - 1 por cuenta      │
│ - Memoria: ~300MB│      │ - Memoria: ~150MB   │
└──────────────────┘      └──────────────────────┘
```

---

## 🚀 Opción 1: Usar render.yaml (Recomendado)

### Paso 1: Push del código actualizado

Ya está listo en el repo. Solo necesitas:

```bash
git pull  # Ya lo tenés actualizado
```

### Paso 2: Crear los servicios en Render

Ve a tu Dashboard de Render y **elimina el servicio actual** (si existe) o crea uno nuevo:

1. **New → Blueprint**
2. Conecta tu repo `SubiteYa`
3. Render detectará automáticamente `render.yaml`
4. Mostrará **3 servicios** para crear:
   - `subiteya-api` (Web Service)
   - `subiteya-edit-worker` (Background Worker)
   - `subiteya-upload-worker` (Background Worker)

### Paso 3: Configurar Variables de Entorno

**IMPORTANTE**: Los 3 servicios necesitan las mismas variables de entorno.

En cada servicio, ve a **Environment** y agrega:

#### Variables Requeridas para Todos:

```
DATABASE_URL=postgresql://postgres.xxx:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxx:5432/postgres
REDIS_URL=rediss://default:xxx@exotic-kid-28613.upstash.io:6379
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=subiteya-videos-bucket
ENCRYPTION_KEY=tu_encryption_key_32_bytes_base64
JWT_SECRET=tu_jwt_secret
```

#### Variables Adicionales para API:

```
PORT=3000
ALLOWED_ORIGINS=https://martinpuli.github.io
TIKTOK_CLIENT_KEY=tu_client_key
TIKTOK_CLIENT_SECRET=tu_client_secret
TIKTOK_REDIRECT_URI=https://tu-app.onrender.com/api/auth/tiktok/callback
```

#### Variables Adicionales para Upload Worker:

```
TIKTOK_CLIENT_KEY=tu_client_key
TIKTOK_CLIENT_SECRET=tu_client_secret
```

### Paso 4: Deploy

1. Click **Apply** en el Blueprint
2. Render creará los 3 servicios automáticamente
3. Esperá 5-10 minutos a que builden (Docker)

---

## 🛠️ Opción 2: Crear Manualmente (Sin Blueprint)

Si preferís crear cada servicio por separado:

### 1. Web Service (API)

- **Type**: Web Service
- **Name**: `subiteya-api`
- **Runtime**: Docker
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `.`
- **Start Command**: (lo lee del Dockerfile - `npm run start`)
- **Health Check Path**: `/health`
- **Plan**: Free
- **Environment**: Agregar todas las variables mencionadas arriba

### 2. Background Worker (Edit)

- **Type**: Background Worker
- **Name**: `subiteya-edit-worker`
- **Runtime**: Docker
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `.`
- **Docker Command**: `npm run worker:edit -w @subiteya/api`
- **Plan**: Free (o Starter si necesitás más memoria)
- **Environment**: Agregar variables (excepto TIKTOK, PORT, ALLOWED_ORIGINS)

### 3. Background Worker (Upload)

- **Type**: Background Worker
- **Name**: `subiteya-upload-worker`
- **Runtime**: Docker
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `.`
- **Docker Command**: `npm run worker:upload -w @subiteya/api`
- **Plan**: Free
- **Environment**: Agregar variables (incluir TIKTOK_CLIENT_KEY/SECRET)

---

## ✅ Verificación Post-Deploy

### 1. Verificar API

```bash
curl https://tu-app.onrender.com/health
# Debería devolver: {"status":"ok","timestamp":"...","uptime":123}
```

### 2. Verificar Redis Connectivity

```bash
curl https://tu-app.onrender.com/health/redis
# Debería devolver: {"status":"ok","redis":"connected","queues":{...}}
```

### 3. Verificar Logs de Workers

En Render Dashboard:

**Edit Worker Logs** debería mostrar:

```
🎬 Starting Edit Worker (standalone)...
✅ Connected to Redis
[Edit Worker] Started with concurrency 2
```

**Upload Worker Logs** debería mostrar:

```
📤 Starting Upload Worker (standalone)...
✅ Connected to Redis
[Upload Worker] Started with concurrency 1
```

### 4. Probar Flujo Completo

1. Subir video desde frontend
2. Confirmar video (debería quedar en `EDITING_QUEUED`)
3. En ~30 segundos, debería cambiar a `EDITING` y luego `EDITED`
4. Queue upload
5. En ~1-2 minutos, debería subir a TikTok (`POSTED`)

---

## 💰 Costos en Render

### Plan Free (cada servicio):

- **Web Service**: Siempre activo
- **Background Workers**: Se duermen después de 15 min sin actividad
- **Total**: $0/mes pero con limitaciones

### Plan Starter ($7/mes por servicio):

- Nunca se duerme
- 512MB RAM garantizados
- **Recomendado para Edit Worker** (procesa videos pesados)

---

## 🐛 Troubleshooting

### Error: "Out of memory"

- Edit Worker necesita plan pago (videos largos consumen mucha RAM)
- O reduce `concurrency` de 2 a 1 en `edit-worker-bullmq.ts`

### Error: "ECONNRESET" en Redis

- Normal durante reconexión, ya está manejado
- Verificá REDIS_URL en variables de entorno

### Workers no procesan trabajos

- Verificá que los workers estén corriendo (no dormidos)
- Verificá logs para errores de FFmpeg o AWS
- Verificá que REDIS_URL sea el mismo en todos los servicios

### Videos quedan en "EDITING_QUEUED" forever

- Edit Worker probablemente está dormido (plan free)
- Trigger actividad visitando los logs del worker
- O upgrade a plan pago

---

## 📝 Notas Importantes

1. **Variables de Entorno**: Deben ser idénticas en los 3 servicios (especialmente DATABASE_URL y REDIS_URL)
2. **Region**: Los 3 servicios deben estar en la misma región (Oregon recomendado)
3. **Auto-Deploy**: Cuando hagas `git push`, los 3 servicios se redesplegarán automáticamente
4. **Logs**: Cada servicio tiene logs separados, facilita debugging
5. **Escalabilidad**: Podés tener múltiples instancias de cada worker (plan pago)

---

## 🎯 Próximos Pasos

1. ✅ Push código con `render.yaml` actualizado
2. ⏳ Crear servicios en Render (Blueprint o Manual)
3. ⏳ Configurar variables de entorno
4. ⏳ Esperar a que builden
5. ⏳ Verificar health checks
6. ⏳ Probar flujo completo
7. ⏳ Monitorear logs por 24hs

¿Necesitás ayuda con algún paso específico?
