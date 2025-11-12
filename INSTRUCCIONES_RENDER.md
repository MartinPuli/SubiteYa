# 🚨 Configurar ENABLE_REDIS=false en Render

## Problema

Redis ha excedido el límite de 500,000 comandos/mes en Upstash. Necesitamos deshabilitar Redis **INMEDIATAMENTE** para detener el consumo.

## ⚠️ IMPORTANTE

Una vez deshabilitado Redis:

- ✅ El API seguirá funcionando (login, voces, etc.)
- ✅ No se consumirán más comandos de Redis
- ❌ El procesamiento de videos **NO funcionará** (workers deshabilitados)
- ❌ No podrás subir videos a TikTok hasta que reactives Redis

## 📋 Pasos a seguir en Render.com

### Servicio 1: subiteya-api (Principal)

1. Ve a https://dashboard.render.com/
2. Busca el servicio **subiteya-api**
3. Click en el servicio
4. Ve a la pestaña **"Environment"** (en el menú izquierdo)
5. Click en **"Add Environment Variable"**
6. Agrega:
   - **Key:** `ENABLE_REDIS`
   - **Value:** `false`
7. Click **"Save Changes"**
8. Render redesplegará automáticamente (toma ~2-3 minutos)

### Servicio 2: subite-ya-edit-worker

1. Busca el servicio **subite-ya-edit-worker**
2. Repite los pasos 3-8 del servicio anterior
3. Agrega la misma variable: `ENABLE_REDIS=false`

### Servicio 3: subiteya-upload-worker

1. Busca el servicio **subiteya-upload-worker**
2. Repite los pasos 3-8 del servicio anterior
3. Agrega la misma variable: `ENABLE_REDIS=false`

## ✅ Verificación

Después de configurar los 3 servicios, verifica en los logs:

1. Ve a cada servicio en Render
2. Click en **"Logs"**
3. Deberías ver algo como:
   ```
   🚫 Redis/Upstash está DESHABILITADO (ENABLE_REDIS=false)
   ```
   o
   ```
   Redis is disabled. Workers will not process jobs.
   ```

## 📊 Monitorear el uso

Después de 10-15 minutos, verifica que el uso no está aumentando:

```bash
curl https://subiteya-api.onrender.com/api/monitor/redis-usage \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

Deberías ver que `commandCount` no aumenta.

## 🔄 Cuándo reactivar Redis

### Opción A: Esperar al reset mensual (Diciembre 1, 2025)

- Gratis, pero tendrás que esperar 20 días sin procesamiento de videos

### Opción B: Upgrade a Upstash Pro ($10/mes)

1. Ve a https://console.upstash.com/redis
2. Selecciona tu database "exotic-kid-28613"
3. Click "Upgrade to Pro"
4. Obtendrás 10 millones de comandos/mes (20x más)
5. Luego en Render, cambia `ENABLE_REDIS=false` a `ENABLE_REDIS=true`

### Opción C: Render Redis ($7/mes)

- Comandos ilimitados pero mayor latencia
- Tendrías que actualizar `REDIS_URL` en todos los servicios

## 📞 Siguiente paso

Una vez configurado, avísame y:

1. Revisaré los logs para confirmar que Redis está deshabilitado
2. Verificaré que el consumo se ha detenido
3. Te ayudaré a decidir entre las 3 opciones para el futuro

---

**Tiempo estimado:** 5-10 minutos para configurar los 3 servicios
