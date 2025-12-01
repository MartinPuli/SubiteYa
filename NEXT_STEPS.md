# Next Steps & Improvement Plan

_Last updated: 2024-04-XX_

## 1. Observabilidad y Métricas

1. **Dashboard en Grafana/Metabase**: Consumir `GET /api/monitor/metrics` y graficar `dailyThroughput`, `videoStatus` y `accountsWithFailures` para detectar cuellos de botella por cuenta.
2. **Alertas proactivas**: Crear alertas cuando `tiktok_api_failures_total` crezca >3 en 5 minutos o cuando `active_jobs` supere el 80% de la capacidad histórica.
3. **Trazas detalladas**: Instrumentar `@subiteya/observability` con IDs de job en logs estructurados y propagar `traceId` desde `publish` hasta workers para poder seguir un video extremo a extremo.

## 2. Confiabilidad y Workers

1. **Circuit breaker para TikTok**: Pausar envíos por cuenta cuando detectemos `accountsWithFailures[x].failures >= 3` en la última hora para evitar bans.
2. **Re-try inteligente en video editing**: Persistir en DB la ruta de los assets temporales para permitir reintentos manuales sin volver a descargar del bucket.
3. **Chunked uploads**: Evaluar el endpoint resumable de TikTok para videos > 540s y evitar timeouts.

## 3. Producto y Experiencia de Usuario

1. **Feedback al usuario**: Exponer `jobsByStatus` y `recentFailures` en el dashboard interno para que los CM sepan qué video está trabado.
2. **Etiquetas automáticas**: Aprovechar `topicLeaders` para sugerir hashtags que están funcionando por sector.
3. **A/B en subtítulos**: Medir con las métricas cuántos videos con subtítulos automáticos tienen mejor `publish_success_rate` vs. los que no lo usan.

## 4. Seguridad y Cumplimiento

1. **Rotación de claves TikTok**: Registrar en métricas el tiempo restante del token (`expires_in`) y alertar 48h antes de expirar.
2. **Hardening del monitor**: Limitar `GET /api/monitor/metrics` solo a roles `admin` y agregar rate limit bajo (ej. 30 req/min).

> Cada bloque tiene responsables distintos (Observabilidad, Backend, Producto). Recomiendo priorizar las acciones de Observabilidad para cerrar el ciclo de métricas recién instrumentado y luego atacar confiabilidad con el breaker por cuenta.
