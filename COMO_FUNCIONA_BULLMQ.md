# 🎯 Cómo Funciona BullMQ - Explicación Visual

## Flujo Normal (Event-Driven) ⚡

```
┌─────────────┐
│   USUARIO   │
│  Sube Video │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  API (packages/api/src/index.ts)    │
│                                     │
│  POST /api/videos/upload            │
│  → uploadQueue.add({ videoId })     │  ← Agrega trabajo a la cola
└──────┬──────────────────────────────┘
       │
       │ Redis Pub/Sub (inmediato)
       ▼
┌─────────────────────────────────────┐
│  WORKER (upload-worker-bullmq.ts)   │
│                                     │
│  ✅ Recibe notificación INMEDIATA   │
│  ⚙️  Procesa el video               │
│  📤 Sube a TikTok                   │
│  ✅ Marca como completado           │
└─────────────────────────────────────┘
```

**Requests de Redis en flujo normal:**

- `RPUSH video-upload:wait [job]` → 1 comando
- `PUBLISH video-upload:events "new job"` → 1 comando
- Worker recibe notificación (0 comandos adicionales)
- `LMOVE video-upload:wait → video-upload:active` → 1 comando
- `SET video-upload:123:lock` → 1 comando
- `DEL video-upload:123:lock` → 1 comando

**Total: ~5 comandos por video** ✅

---

## Stalled Check (Polling de Seguridad) 🔍

Esto sucede **EN PARALELO** al flujo normal, **24/7**, incluso sin videos:

```
┌─────────────────────────────────────┐
│  WORKER (cada stalledInterval)      │
│                                     │
│  Cada 5 minutos:                    │
│  "¿Hay trabajos atascados?"         │
└──────┬──────────────────────────────┘
       │
       │ Comandos Redis (SIEMPRE)
       ▼
┌─────────────────────────────────────┐
│  REDIS (Upstash)                    │
│                                     │
│  1. EVALSHA (Lua script)            │  → 1 comando
│  2. SCAN video-upload:*:lock        │  → 1-5 comandos
│  3. GET video-upload:active         │  → 1 comando
│  4. LRANGE video-upload:active      │  → 1 comando
│  5. HGETALL video-upload:123        │  → 1 comando (por trabajo activo)
│                                     │
│  Total: ~5-10 comandos              │
└─────────────────────────────────────┘
       │
       │ Resultado
       ▼
┌─────────────────────────────────────┐
│  SI encuentra trabajos atascados:   │
│  → Los reintenta                    │
│                                     │
│  SI NO encuentra nada:              │
│  → Siguiente check en 5 minutos     │
└─────────────────────────────────────┘
```

---

## Cálculo del Problema 📊

### Con stalledInterval: 60 segundos (ANTES)

```
Checks por hora: 60 (cada minuto)
Comandos por check: ~8 (promedio)
Workers activos: 2 (upload + edit)

Requests por hora = 60 × 8 × 2 = 960 requests/hora
Requests por día = 960 × 24 = 23,040 requests/día
Requests por mes = 23,040 × 30 = 691,200 requests/mes ❌

Límite Upstash Free: 500,000/mes
EXCESO: 191,200 requests (38% sobre límite)
```

### Con stalledInterval: 300 segundos / 5 minutos (AHORA)

```
Checks por hora: 12 (cada 5 minutos)
Comandos por check: ~8
Workers activos: 2

Requests por hora = 12 × 8 × 2 = 192 requests/hora
Requests por día = 192 × 24 = 4,608 requests/día
Requests por mes = 4,608 × 30 = 138,240 requests/mes ✅

Límite Upstash Free: 500,000/mes
MARGEN: 361,760 requests (72% disponible)
```

**Reducción: 80% menos polling** 🎉

---

## Ejemplo Real de 24 Horas

### Día sin videos subidos:

```
ANTES (stalledInterval: 60s):
├─ 00:00 - Worker chequea (60 veces/hora × 8 comandos) = 480 req/h
├─ 01:00 - Worker chequea = 480 req/h
├─ 02:00 - Worker chequea = 480 req/h
│  ...
└─ 23:00 - Worker chequea = 480 req/h
Total: 11,520 requests ❌ (SIN SUBIR NINGÚN VIDEO)

DESPUÉS (stalledInterval: 300s):
├─ 00:00 - Worker chequea (12 veces/hora × 8 comandos) = 96 req/h
├─ 01:00 - Worker chequea = 96 req/h
├─ 02:00 - Worker chequea = 96 req/h
│  ...
└─ 23:00 - Worker chequea = 96 req/h
Total: 2,304 requests ✅ (SIN SUBIR NINGÚN VIDEO)
```

### Día con 100 videos subidos:

```
DESPUÉS (stalledInterval: 300s):
├─ Polling de seguridad: 2,304 requests
├─ 100 videos procesados: 100 × 5 = 500 requests
└─ Total: 2,804 requests/día ✅
```

---

## ¿Por Qué Necesitamos el Stalled Check?

### Escenario: Worker se cae mientras procesa

```
┌─────────────────────────────────────┐
│  1. Video empieza a procesarse      │
│     Estado: ACTIVE                  │
│     Lock: video:123:lock = "worker1"│
└──────┬──────────────────────────────┘
       │
       │ ⚡ CRASH! Worker muere
       ▼
┌─────────────────────────────────────┐
│  2. Video queda "atascado"          │
│     Estado: ACTIVE (pero no worker) │
│     Lock: Expiró hace 5 minutos     │
└──────┬──────────────────────────────┘
       │
       │ Stalled Check detecta esto
       ▼
┌─────────────────────────────────────┐
│  3. Worker reintenta el trabajo     │
│     Estado: ACTIVE → WAITING        │
│     Procesa el video nuevamente     │
└─────────────────────────────────────┘
```

**Sin stalled check:** El video quedaría en ACTIVE para siempre 😱

---

## Configuración Óptima por Uso

### App con MUCHO tráfico (1000+ videos/día):

```typescript
stalledInterval: 60000, // 1 minuto - detección rápida
```

El polling es insignificante comparado con el tráfico real.

### App con tráfico MEDIO (100-1000 videos/día):

```typescript
stalledInterval: 300000, // 5 minutos ✅ (tu caso actual)
```

Balance perfecto entre detección y ahorro.

### App con POCO tráfico (<100 videos/día):

```typescript
stalledInterval: 600000, // 10 minutos
```

Máximo ahorro de requests.

### Desarrollo/Testing local:

```typescript
stalledInterval: 30000, // 30 segundos - feedback rápido
```

---

## Monitoreo Recomendado

Agrega esto al endpoint de health:

```typescript
// packages/api/src/index.ts
app.get('/health/redis-usage', async (req, res) => {
  const editStats = await editQueue.getJobCounts();
  const uploadStats = await uploadQueue.getJobCounts();

  res.json({
    edit: editStats,
    upload: uploadStats,
    estimatedRequestsPerDay:
      12 * 8 * 2 * 24 + // Polling
      (editStats.completed + uploadStats.completed) * 5, // Jobs
  });
});
```

---

## Conclusión

1. **Videos se procesan INMEDIATAMENTE** ⚡ (Redis Pub/Sub)
2. **Stalled check es solo seguridad** 🛡️ (para crashes/timeouts)
3. **Polling constante consume requests** 📊 (incluso sin videos)
4. **5 minutos es óptimo para tu caso** ✅ (balance perfecto)

**El fix NO afecta la velocidad de procesamiento, solo reduce el overhead de seguridad.**
