# Configurar CORS para SubiteYa

## Problema

El frontend en `https://subiteya.com.ar` no puede hacer peticiones al backend en `https://subiteya-h9ol.onrender.com` porque CORS está bloqueando las requests.

## Solución: Agregar el dominio a las variables de entorno en Render

### Paso 1: Ir al Dashboard de Render

1. Abre https://dashboard.render.com
2. Busca el servicio del backend: `subiteya-h9ol`
3. Haz clic en el servicio

### Paso 2: Editar Variables de Entorno

1. En el menú lateral, haz clic en **Environment**
2. Busca la variable `ALLOWED_ORIGINS`
3. Si existe, edítala. Si no existe, créala

### Paso 3: Agregar el Dominio

Actualiza `ALLOWED_ORIGINS` para incluir todos los dominios permitidos separados por comas:

```
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://subiteya.com.ar
```

**IMPORTANTE**: No incluyas espacios después de las comas y NO incluyas `/` al final de las URLs.

### Paso 4: Re-deploy

1. Después de guardar, Render hará un **re-deploy automático**
2. Espera 2-3 minutos a que termine el deploy
3. Verifica en los logs que aparezca:
   ```
   🔧 CORS allowed origins: [ 'http://localhost:5173', 'http://localhost:3000', 'https://subiteya.com.ar' ]
   ```

### Paso 5: Verificar

1. Abre https://subiteya.com.ar
2. Ve a la página de Voces IA
3. Intenta cargar o clonar una voz
4. Los errores de CORS deberían desaparecer

## Variables de Entorno Requeridas

Asegúrate de que estas variables estén configuradas en Render:

```bash
# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://subiteya.com.ar

# Database
DATABASE_URL=postgresql://...

# Encryption
ENCRYPTION_KEY=<tu-encryption-key>

# JWT
JWT_SECRET=<tu-jwt-secret>

# TikTok OAuth
TIKTOK_CLIENT_KEY=<tu-client-key>
TIKTOK_CLIENT_SECRET=<tu-client-secret>
REDIRECT_URI=https://subiteya.com.ar/auth/tiktok/callback

# ElevenLabs
ELEVENLABS_API_KEY=<tu-api-key>

# OpenAI (opcional, para scripts)
OPENAI_API_KEY=<tu-api-key>
```

## Verificación Local

Si quieres probar localmente antes de hacer cambios en producción:

1. Edita tu archivo `.env` local:

   ```bash
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://subiteya.com.ar
   ```

2. Reinicia el servidor local:

   ```bash
   npm run dev
   ```

3. Verifica en los logs de la consola:
   ```
   ✅ CORS allowed origin: https://subiteya.com.ar
   ```

## Problemas Comunes

### Error persiste después del deploy

- **Causa**: El navegador tiene la respuesta en caché
- **Solución**: Abre DevTools (F12) → Network → Marca "Disable cache" → Recarga la página (Ctrl+Shift+R)

### Aparece "CORS blocked" solo para OPTIONS

- **Causa**: El backend está respondiendo 404 o 500 al preflight request
- **Solución**: Verifica que la ruta existe y que el middleware CORS está antes de las rutas en `index.ts`

### Funciona en localhost pero no en producción

- **Causa**: La variable `ALLOWED_ORIGINS` no está configurada en Render
- **Solución**: Sigue los pasos de arriba para agregar la variable en Render

## Documentación del Código CORS

El código CORS está en `packages/api/src/index.ts` líneas 38-91:

```typescript
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);

    // Normalize origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');

    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.replace(/\/$/, '');
      return normalizedOrigin === normalizedAllowed;
    });

    // Also allow Vercel preview deployments
    const isVercelPreview =
      normalizedOrigin.endsWith('.vercel.app') &&
      normalizedOrigin.startsWith('https://');

    if (isAllowed || isVercelPreview) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
```

## Próximos Pasos

Una vez que hayas configurado CORS:

1. ✅ Las voces se cargarán correctamente
2. ✅ Podrás clonar tu voz sin errores
3. ✅ Todos los endpoints de ElevenLabs funcionarán
4. ✅ Los mensajes de error mejorados se mostrarán cuando haya problemas reales

---

**Nota**: Este documento debe ejecutarse MANUALMENTE en Render ya que no podemos modificar las variables de entorno desde el código.
