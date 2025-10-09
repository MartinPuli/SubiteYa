# 🔍 Diagnóstico de CORS

## Paso 1: Verificar que Render se Redesplegó

1. Ve a tu servicio en Render: https://dashboard.render.com
2. Ve a la pestaña **"Events"**
3. Deberías ver un evento reciente que diga: "Deploy triggered by push to main"
4. Verifica que el estado sea **"Live"** y no "Failed"

## Paso 2: Verificar los Logs

1. En tu servicio, ve a **"Logs"**
2. Busca esta línea cuando el servidor inicia:
   ```
   🔧 CORS allowed origins: [ 'https://martinpuli.github.io' ]
   ```
3. Si NO aparece, el servidor no se redesplegó correctamente

## Paso 3: Verificar Auto-Deploy

1. En tu servicio, ve a **"Settings"**
2. Busca la sección **"Build & Deploy"**
3. Verifica que **"Auto-Deploy"** esté en **"Yes"**
4. Si está en "No", cámbialo a "Yes" y guarda

## Paso 4: Forzar Redespliegue Manual

Si Auto-Deploy estaba desactivado:

1. Ve a la pestaña principal de tu servicio
2. Click en **"Manual Deploy"** (botón arriba a la derecha)
3. Selecciona **"Deploy latest commit"**
4. Espera 3-5 minutos

## Paso 5: Probar el Health Check

Abre esta URL en tu navegador:
```
https://subiteya.onrender.com/health
```

Debería devolver algo como:
```json
{
  "status": "ok",
  "timestamp": "2025-10-08T...",
  "uptime": 123.45
}
```

## Paso 6: Verificar Variable de Entorno

1. En Render, ve a **"Environment"**
2. Verifica que exista:
   ```
   ALLOWED_ORIGINS = https://martinpuli.github.io
   ```
3. **IMPORTANTE**: NO debe tener:
   - Espacios antes o después
   - Comillas adicionales
   - Múltiples valores (solo uno)

## Paso 7: Si Nada Funciona - Cambiar la Variable

Prueba agregando AMBAS versiones (con y sin barra):

```
ALLOWED_ORIGINS=https://martinpuli.github.io,https://martinpuli.github.io/
```

Luego guarda y espera el redespliegue.

## Paso 8: Verificar CORS con curl

Abre tu terminal y ejecuta:

```bash
curl -H "Origin: https://martinpuli.github.io" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     --verbose \
     https://subiteya.onrender.com/api/auth/login
```

Busca en la respuesta:
```
< access-control-allow-origin: https://martinpuli.github.io
```

Si no aparece, CORS no está configurado correctamente.

---

## 🆘 Solución de Emergencia

Si nada de lo anterior funciona, el problema puede ser que Render no está ejecutando el código actualizado.

**Haz esto:**

1. Ve a Render → tu servicio
2. **Settings** → **Build & Deploy**
3. Limpia la caché: Click en **"Clear Build Cache"**
4. Luego haz un **"Manual Deploy" → "Deploy latest commit"**
5. Espera 5-7 minutos
6. Prueba de nuevo

---

¿Qué ves en los logs de Render cuando el servidor inicia? ¿Aparece el mensaje de CORS?
