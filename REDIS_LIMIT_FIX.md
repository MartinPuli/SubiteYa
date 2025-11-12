# 🚨 Fix Redis Limit Exceeded (Upstash 500k requests)

## Problema

```
ERR max requests limit exceeded. Limit: 500000, Usage: 500007
```

Agotaste el límite mensual de 500,000 requests de Upstash Redis.

## Causa Raíz

**BullMQ workers están haciendo polling excesivo:**

1. **stalledInterval: 60000** (60 segundos) → Verifica trabajos estancados cada minuto
2. **2 workers activos** (edit + upload) × 1440 minutos/día = **2,880 checks/día**
3. **Cada check genera múltiples comandos Redis** (EVALSHA, GET, SET, etc.)
4. **En 30 días**: ~86,400 checks + requests normales = **>500k requests**

## Soluciones Aplicadas ✅

### 1. Aumentar stalledInterval (CRÍTICO)

**Cambio realizado:**

```typescript
// ANTES (en ambos workers)
stalledInterval: 60000, // 60 segundos = mucho polling

// DESPUÉS
stalledInterval: 300000, // 5 minutos = 80% menos polling
```

**Impacto:** Reduce el polling de Redis en **80%**

**Archivos modificados:**

- `packages/api/src/workers/upload-worker-bullmq.ts` ✅
- `packages/api/src/workers/edit-worker-bullmq.ts` ✅

### 2. Optimizaciones Adicionales (Ya implementadas)

Estas ya estaban en el código:

- ✅ `lazyConnect: true` - No conecta hasta que sea necesario
- ✅ `maxRetriesPerRequest: null` - Evita reintentos infinitos
- ✅ `enableReadyCheck: false` - Reduce health checks
- ✅ `removeOnComplete: { age: 3600, count: 10 }` - Limpia trabajos completados
- ✅ `attempts: 2` - Solo 2 intentos por trabajo

## Próximos Pasos

### Inmediato (AHORA) 🔥

1. **Deploy el fix:**

   ```bash
   cd packages/api
   npm run build
   git add .
   git commit -m "fix: Reduce Redis polling - stalledInterval 60s → 5min"
   git push
   ```

2. **Reinicia los workers en Render:**
   - Ve a Render Dashboard
   - Encuentra el servicio de workers
   - Click "Manual Deploy" → "Clear build cache & deploy"

3. **Monitorea Upstash:**
   - Ve a https://console.upstash.com/
   - Revisa el dashboard de requests
   - Verifica que el uso baje después del deploy

### Si el problema persiste (Temporal)

**Opción A: Desactivar workers temporalmente**

Añade esta variable de entorno en Render:

```
DISABLE_WORKERS=true
```

Esto desactiva completamente BullMQ hasta que se resetee el límite.

**Opción B: Desactivar Redis temporalmente**

```
ENABLE_REDIS=false
```

Los videos se procesarán síncronamente (más lento, pero funcional).

### Mediano plazo (Esta semana)

1. **Upgrade Upstash plan:**
   - Free: 500k requests/mes
   - Pay as you go: $0.20 per 100k requests
   - Pro: 1M requests/mes + $0.20 por 100k adicionales

2. **Implementar monitoreo:**

   ```typescript
   // Agregar en index.ts
   app.get('/api/redis-usage', async (req, res) => {
     const info = await redisConnection.info();
     res.json({ usage: parseUsage(info) });
   });
   ```

3. **Configurar alertas:**
   - Upstash envía emails al 80% de uso
   - Implementar webhook para Slack/Discord

### Largo plazo (Próximo mes)

1. **Migrar workers a servicio separado:**
   - 1 Render service para API
   - 1 Render service para workers
   - Reduce memoria y aísla problemas

2. **Implementar cache local:**

   ```typescript
   // En workers, cachear resultados frecuentes
   const cache = new Map<string, CachedData>();
   ```

3. **Batch processing:**
   - Procesar múltiples videos en un solo trabajo
   - Reduce overhead de BullMQ

## Cálculos de Impacto

### ANTES del fix:

```
stalledInterval: 60s
Checks por día: 1440 (24h × 60min)
Checks por worker: 1440
Workers: 2 (edit + upload)
Total checks/día: 2,880
Comandos por check: ~10 (EVALSHA, GET, SET, etc)
Total requests/día: ~28,800
Total requests/mes: ~864,000 ❌ EXCEDE 500k
```

### DESPUÉS del fix:

```
stalledInterval: 300s (5 min)
Checks por día: 288 (24h × 12 checks/hora)
Workers: 2
Total checks/día: 576
Comandos por check: ~10
Total requests/día: ~5,760
Total requests/mes: ~172,800 ✅ Dentro del límite
```

**Reducción: 80% menos requests de polling**

## Validación

Después del deploy, verifica:

1. **Logs de Render:**

   ```
   [Upload Worker] Started with concurrency 1
   [Edit Worker] Started with concurrency 2
   ✅ No errors de "max requests limit exceeded"
   ```

2. **Upstash Dashboard:**
   - Requests/hora debería bajar de ~1,200/h a ~240/h
   - Usage total debería estabilizarse

3. **Funcionalidad:**
   - Sube un video de prueba
   - Verifica que se procese correctamente
   - Revisa que la publicación funcione

## Recursos

- [BullMQ Optimization Guide](https://docs.bullmq.io/guide/optimization)
- [Upstash Pricing](https://upstash.com/docs/redis/troubleshooting/max_requests_limit)
- [Redis Commands Reference](https://redis.io/commands/)

## Notas

- El `stalledInterval` de 5 minutos es seguro porque:
  - Los trabajos normales se completan en <2 minutos
  - Si un trabajo se atasca, 5 minutos es aceptable para detectarlo
  - Puedes ajustarlo a 10 minutos si necesitas reducir más

- Si necesitas respuesta más rápida:
  - Mantén 5 minutos para workers en producción
  - Usa 1 minuto solo para desarrollo/testing local
