# Redis Setup para SubiteYa (Upstash)

## 1. Crear Base de Datos Upstash

1. Ir a https://console.upstash.com/
2. Crear cuenta (gratis para hasta 10,000 comandos/día)
3. Click en **Create Database**
4. Configuración:
   - **Name**: subiteya-redis
   - **Type**: Regional
   - **Region**: us-east-1 (misma región que S3 para baja latencia)
   - **Primary Region**: us-east-1
   - **Read Regions**: Ninguna (no necesario por ahora)
   - **Eviction**: allkeys-lru (elimina keys menos usadas cuando se llena)
   - **TLS**: Enabled (seguridad)

## 2. Obtener Connection String

Después de crear la base de datos, verás:

```env
REDIS_URL=redis://default:Ac-XXXXXXXXXXXXXXXXXXXXX@us1-xxxxx-xxxxx.upstash.io:6379
```

Copia este valor completo (incluye el password).

## 3. Configurar en Render

Ir a tu servicio en Render → Environment:

```env
REDIS_URL=redis://default:Ac-XXXXXXXXXXXXXXXXXXXXX@us1-xxxxx-xxxxx.upstash.io:6379
```

**IMPORTANTE**: Usar la URL completa que incluye `redis://`, credenciales y puerto.

## 4. Verificar Conexión Local

```bash
# Instalar redis-cli (Windows con Chocolatey)
choco install redis

# O descargar desde https://github.com/tporadowski/redis/releases

# Probar conexión
redis-cli -u "redis://default:YOUR_PASSWORD@us1-xxxxx-xxxxx.upstash.io:6379" ping
# Debe devolver: PONG
```

## 5. Comandos Útiles para Monitoreo

```bash
# Ver todas las keys (cuidado en producción)
redis-cli -u $REDIS_URL keys "*"

# Ver colas de BullMQ
redis-cli -u $REDIS_URL keys "bull:*"

# Ver estadísticas de una cola
redis-cli -u $REDIS_URL hgetall "bull:video-edit:meta"

# Ver jobs en espera
redis-cli -u $REDIS_URL lrange "bull:video-edit:wait" 0 -1

# Ver jobs activos
redis-cli -u $REDIS_URL lrange "bull:video-edit:active" 0 -1

# Ver jobs completados recientes
redis-cli -u $REDIS_URL lrange "bull:video-edit:completed" 0 9

# Limpiar todas las keys (solo desarrollo)
redis-cli -u $REDIS_URL flushall
```

## 6. Instalar BullMQ Dashboard (Opcional)

Para ver las colas en una UI web:

```bash
cd packages/api
npm install @bull-board/api @bull-board/express
```

Agregar a `index.ts`:

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { editQueue, uploadQueue } from './lib/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(editQueue), new BullMQAdapter(uploadQueue)],
  serverAdapter,
});

// Después de definir 'app'
app.use('/admin/queues', serverAdapter.getRouter());
```

Luego acceder a: `https://subiteya-api-xxxx.onrender.com/admin/queues`

## 7. Plan de Upstash Free

**Límites gratuitos**:

- 10,000 comandos/día
- 256 MB memoria
- 100 conexiones concurrentes
- Sin límite de bandwidth

**Estimación de uso**:

- 1 edit job: ~50 comandos (queue, update progress, complete)
- 1 upload job: ~50 comandos
- 100 videos/día: ~5,000 comandos

✅ **Plan gratuito es suficiente** para hasta 200 videos/día.

## 8. Plan de Pago (si necesitas escalar)

**Pay as you go**:

- $0.20 por 100,000 comandos
- 1,000 videos/mes: ~1.5M comandos/mes = $3/mes
- Storage adicional: $0.25/GB/mes (probablemente no necesario)

## 9. Alternativas

### Redis Local (Desarrollo)

```bash
# Con Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Variable de entorno local
REDIS_URL=redis://localhost:6379
```

### Railway.app

- Redis managed similar a Upstash
- $5/mes plan básico
- Menos límites que Upstash free

### Render Redis (más caro)

- $7/mes plan mínimo
- 25 MB memoria

## 10. Troubleshooting

**Error: ECONNREFUSED**

- Verifica que `REDIS_URL` esté correctamente configurado
- Verifica que incluya `redis://` al inicio
- Verifica que Upstash database esté "Active" (no paused)

**Error: WRONGPASS invalid username-password pair**

- El password en `REDIS_URL` cambió (Upstash permite rotar)
- Regenerar password en Upstash dashboard

**Error: maxmemory limit reached**

- Upstash free tiene límite de 256 MB
- Ver keys más grandes: `redis-cli -u $REDIS_URL --bigkeys`
- Considerar reducir `JOB_RETENTION` en queues.ts
- O actualizar a plan de pago

**Workers no procesan jobs**

- Verificar logs: "Connected to Redis successfully"
- Verificar que jobs se están agregando: `redis-cli -u $REDIS_URL llen "bull:video-edit:wait"`
- Verificar que no haya workers pausados: `redis-cli -u $REDIS_URL hget "bull:video-edit:meta" "paused"`

## 11. Seguridad

✅ **TLS habilitado** - Conexión encriptada
✅ **Password fuerte** - Generado por Upstash
✅ **No exponer REDIS_URL** - Es una credencial sensible
✅ **IP Whitelist** (opcional) - En Upstash settings, restringir acceso por IP

## 12. Monitoreo en Upstash Dashboard

El dashboard muestra:

- **Commands/sec**: Actividad actual
- **Memory usage**: Cuánto espacio usan los jobs
- **Keys**: Número total de keys (queues, jobs, locks)
- **Connected clients**: Número de workers conectados

**Normal**:

- 2-3 clients (edit worker, upload worker, API server)
- 10-100 keys (dependiendo de jobs en cola)
- <1 MB memory (los jobs son pequeños)

## 13. Testing Redis Connection

Crear script de prueba `packages/api/test-redis.ts`:

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => console.log('✅ Connected to Redis'));
redis.on('error', err => console.error('❌ Redis error:', err));

(async () => {
  await redis.set('test-key', 'hello');
  const value = await redis.get('test-key');
  console.log('Value:', value); // Debe ser 'hello'
  await redis.del('test-key');
  console.log('✅ Test passed');
  process.exit(0);
})();
```

Ejecutar:

```bash
npm run ts-node test-redis.ts
```

## Próximos Pasos

Una vez configurado Redis:

1. ✅ Agregar `REDIS_URL` a `.env` local
2. ✅ Agregar `REDIS_URL` a Render environment variables
3. ✅ Deploy en Render
4. ✅ Verificar logs: "Edit Worker started with concurrency 2"
5. ✅ Probar subir un video y verificar que se procese
