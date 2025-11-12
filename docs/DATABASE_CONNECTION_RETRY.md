# Solución Error de Conexión Intermitente con Supabase

## Problema

Error intermitente en login y otras operaciones:

```
Can't reach database server at `aws-1-us-east-2.pooler.supabase.com:6543`
PrismaClientKnownRequestError: P1001
```

## Causa

Conexiones intermitentes al pooler de Supabase debido a:

- Latencia de red
- Límites de conexiones del pooler
- Timeouts en conexiones inactivas
- Reinicio de instancias en Render

## Solución Implementada

### 1. Configuración de Pool de Conexiones Mejorada

**Archivo**: `packages/api/src/lib/prisma.ts`

```typescript
const datasourceUrl = connectionString
  ? `${connectionString}${connectionString.includes('?') ? '&' : '?'}connection_limit=10&pool_timeout=20`
  : undefined;
```

**Cambios**:

- `connection_limit=10`: Limita conexiones simultáneas para evitar saturar el pooler
- `pool_timeout=20`: Timeout de 20 segundos para obtener conexión del pool

### 2. Sistema de Reintentos Automáticos

**Función `withRetry`** con mejoras:

```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500
): Promise<T> {
  // Backoff exponencial: 500ms, 1000ms, 2000ms
  const waitTime = delayMs * Math.pow(2, attempt - 1);

  // Detecta errores de conexión: P1001, P1002, P1008, P1017
  const isConnectionError =
    error.code?.startsWith('P100') ||
    error.code === 'P1017' ||
    error.message?.includes("Can't reach database server");
}
```

**Características**:

- 3 intentos por defecto
- Backoff exponencial (500ms → 1s → 2s)
- Solo reintenta errores de conexión
- Logging detallado de reintentos

### 3. Aplicación en Rutas Críticas

**Login endpoint** (`packages/api/src/routes/auth.ts`):

```typescript
// Find user with retry
const user = await withRetry(() =>
  prisma.user.findUnique({ where: { email } })
);

// Create audit event with retry
await withRetry(() =>
  prisma.auditEvent.create({ data: {...} })
);

// Store refresh token with retry
await withRetry(() =>
  prisma.refreshToken.create({ data: {...} })
);
```

## Cómo Usar `withRetry`

Para cualquier operación de Prisma que pueda fallar por conexión:

```typescript
import { prisma, withRetry } from '../lib/prisma';

// Operación simple
const user = await withRetry(() => prisma.user.findUnique({ where: { id } }));

// Operación compleja
const result = await withRetry(async () => {
  return await prisma.user.update({
    where: { id },
    data: { name: 'nuevo nombre' },
  });
});

// Con configuración personalizada
const result = await withRetry(
  () => prisma.user.findMany(),
  5, // 5 reintentos
  1000 // 1 segundo inicial
);
```

## Variables de Entorno

Asegúrate de tener configurado:

```env
# URL del pooler de Supabase (Transaction mode)
DATABASE_URL="postgresql://..."

# URL directa para migraciones
DIRECT_URL="postgresql://..."
```

## Monitoreo

Logs de reintento aparecen como:

```
[Prisma] Connection error (attempt 1/3), retrying in 500ms... P1001
[Prisma] Connection error (attempt 2/3), retrying in 1000ms... P1001
```

## Mejores Prácticas

1. **Usa `withRetry` en operaciones críticas**:
   - Login/Register
   - Operaciones de pago
   - Creación de contenido

2. **No uses `withRetry` en**:
   - Operaciones dentro de transacciones (Prisma ya maneja esto)
   - Operaciones en batch que fallan por lógica de negocio

3. **Ajusta reintentos según criticidad**:

   ```typescript
   // Crítico: más reintentos
   await withRetry(operation, 5, 1000);

   // No crítico: reintentos por defecto
   await withRetry(operation);
   ```

## Testing

Para probar la recuperación de errores:

```bash
# Simular latencia
tc qdisc add dev eth0 root netem delay 100ms

# Simular pérdida de paquetes
tc qdisc add dev eth0 root netem loss 5%
```

## Troubleshooting

### Error persiste después de 3 reintentos

**Verificar**:

1. Conexión a Supabase: https://supabase.com/dashboard
2. Estado del pooler en Supabase
3. Límites de conexiones en tu plan de Supabase

**Solución temporal**:

```typescript
// Aumentar reintentos para debugging
await withRetry(operation, 10, 2000);
```

### Error solo en producción (Render)

**Causa**: Cold starts o reinicio de instancias

**Solución**:

- Los reintentos automáticos ya manejan esto
- Considerar Render "keep alive" service

### Muchos logs de reintento

**Normal en**:

- Cold starts
- Despliegues
- Picos de tráfico

**Alerta si**:

- Reintentos constantes por >5 minutos
- Todos los requests reintentan

## Métricas Recomendadas

Monitorea:

- Tasa de reintentos exitosos vs fallidos
- Tiempo promedio de reintento
- Frecuencia de errores P1001

```typescript
// Ejemplo de logging mejorado
console.log({
  event: 'db_retry',
  attempt: 2,
  maxRetries: 3,
  error: 'P1001',
  latency: 1000,
});
```

## Recursos

- [Prisma Connection Pool](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Supabase Pooler](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma Error Codes](https://www.prisma.io/docs/reference/api-reference/error-reference)

## Changelog

- **2024-11-12**: Implementación inicial de sistema de reintentos
  - Pool de conexiones configurado (limit=10, timeout=20s)
  - withRetry con backoff exponencial
  - Aplicado en endpoints de autenticación
