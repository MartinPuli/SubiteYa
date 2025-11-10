# 🚨 SOLUCIÓN RÁPIDA: Backend 503 y CORS

## Problema Actual

Tu backend en Render está devolviendo **503 Service Unavailable** y además CORS está bloqueando las peticiones desde `https://subiteya.com.ar`.

## ✅ Solución en 3 Pasos

### 1️⃣ Verifica el Estado del Backend en Render

1. Ve a https://dashboard.render.com
2. Busca el servicio `subiteya-h9ol`
3. Verifica el estado:
   - 🟢 **Live** = Funcionando
   - 🔴 **Failed** / 🟡 **Building** = Hay un problema

**Si está Failed o Building:**

- Revisa los logs en la pestaña "Logs"
- Busca errores de compilación o crash
- Espera a que termine el deploy (2-3 minutos)

### 2️⃣ Configura CORS (URGENTE)

El backend está bloqueando peticiones desde `https://subiteya.com.ar` porque falta configurar CORS.

**En Render Dashboard:**

1. Ve a tu servicio → **Environment**
2. Busca la variable `ALLOWED_ORIGINS`
3. Si no existe, créala. Si existe, edítala:

```bash
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://subiteya.com.ar
```

**⚠️ IMPORTANTE:**

- NO incluyas espacios después de las comas
- NO incluyas `/` al final de las URLs
- Después de guardar, Render hará un redeploy automático (espera 2-3 minutos)

### 3️⃣ Verifica en los Logs

Después del redeploy, en los logs deberías ver:

```
🔧 CORS allowed origins: [ 'http://localhost:5173', 'http://localhost:3000', 'https://subiteya.com.ar' ]
✅ CORS allowed origin: https://subiteya.com.ar
```

## 🔍 Diagnóstico del Error 503

El **503 Service Unavailable** puede ser causado por:

### Causa 1: Backend Crasheado

**Síntomas:** Logs muestran errores de Node.js
**Solución:** Revisar errores en logs y corregir código

### Causa 2: Timeout en Cold Start

**Síntomas:** Primera petición después de inactividad
**Solución:** Render Free tier tiene cold start. Espera 30-60 segundos

### Causa 3: Falta de Memoria

**Síntomas:** Error "Out of memory" en logs
**Solución:** Optimizar código o upgrade plan

### Causa 4: Variables de Entorno Faltantes

**Síntomas:** Backend arranca pero crashea al recibir peticiones
**Solución:** Verifica que todas estas variables estén configuradas:

```bash
# Esenciales
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=...
JWT_SECRET=...

# OAuth TikTok
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
REDIRECT_URI=https://subiteya.com.ar/auth/tiktok/callback

# APIs
ELEVENLABS_API_KEY=... (opcional)
OPENAI_API_KEY=... (opcional)

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://subiteya.com.ar
```

## 🧪 Prueba Rápida

Una vez configurado CORS y el backend esté Live:

1. Abre https://subiteya.com.ar
2. Abre DevTools (F12) → Console
3. Si ves **"✅ CORS allowed origin"** en Network → Headers: ¡Funciona!
4. Si sigues viendo errores CORS: Limpia caché (Ctrl+Shift+R)

## 📊 Monitoreo

Para verificar que todo esté bien:

```bash
# Test CORS desde terminal
curl -I -H "Origin: https://subiteya.com.ar" https://subiteya-h9ol.onrender.com/api/health
```

Deberías ver en la respuesta:

```
Access-Control-Allow-Origin: https://subiteya.com.ar
```

## 🆘 Si el Problema Persiste

Si después de configurar CORS y esperar el redeploy sigues teniendo problemas:

1. **Verifica que el backend compile:**

   ```bash
   cd packages/api
   npm run build
   ```

2. **Revisa logs de Render:** Busca líneas que digan "ERROR" o "CRASH"

3. **Verifica la conexión a base de datos:** El error 503 puede ser por fallo de DB

4. **Intenta un Manual Deploy:** En Render Dashboard → "Manual Deploy" → "Clear build cache & deploy"

## ✅ Checklist Final

- [ ] Backend en estado "Live" en Render
- [ ] Variable `ALLOWED_ORIGINS` incluye `https://subiteya.com.ar`
- [ ] Redeploy completado (esperar 2-3 minutos)
- [ ] Logs muestran "CORS allowed origins" correcto
- [ ] Frontend limpiado de caché (Ctrl+Shift+R)
- [ ] Peticiones desde https://subiteya.com.ar funcionan

---

**Prioridad:** 🔥 **CRÍTICA** - La app no funciona hasta que esto se resuelva.

**Tiempo estimado:** 5-10 minutos si sigues los pasos correctamente.
