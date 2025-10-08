# ✅ TikTok OAuth Implementado

## 🎯 Cambios Realizados

### Backend (`packages/api`)

1. **Nueva ruta**: `src/routes/tiktok.ts`
   - `GET /api/auth/tiktok` - Inicia el flujo OAuth
   - `GET /api/auth/tiktok/callback` - Maneja el callback de TikTok
   - `POST /api/auth/tiktok/refresh` - Renueva tokens expirados

2. **Funcionalidades**:
   - ✅ Encriptación de tokens con AES-256-GCM
   - ✅ Exchange de authorization code por access token
   - ✅ Obtención de información del usuario (display name, avatar)
   - ✅ Guardado en base de datos con tokens encriptados
   - ✅ Audit events para trazabilidad
   - ✅ Refresh de tokens automático

### Frontend (`packages/web`)

1. **ConnectionsPage actualizado**:
   - ❌ Removido botón de "crear conexión mock"
   - ✅ Botón "+ Conectar Cuenta" ahora redirige a OAuth de TikTok
   - ✅ Manejo de callbacks (success/error)
   - ✅ Limpieza de URL después del callback

## 📋 Cómo Usarlo

### 1. Configurar TikTok Developer App

**Ve a**: https://developers.tiktok.com/

1. Inicia sesión con tu cuenta de TikTok
2. Ve a "My apps" → "Create new app"
3. Completa:
   - App name: SubiteYa
   - Category: Developer tools
   - Description: Multi-account video publishing

4. En "Login Kit", configura:
   - **Redirect URI**: `http://localhost:3000/api/auth/tiktok/callback`
   - **Scopes**:
     - `user.info.basic`
     - `video.upload`
     - `video.publish`

5. Copia tus credenciales:
   - **Client Key**
   - **Client Secret**

### 2. Actualizar .env

Abrí `packages/api/.env` y actualizá:

```env
# TikTok OAuth - Credenciales reales
TIKTOK_CLIENT_KEY=tu_client_key_aqui
TIKTOK_CLIENT_SECRET=tu_client_secret_aqui
TIKTOK_REDIRECT_URI=http://localhost:3000/api/auth/tiktok/callback
```

### 3. Reiniciar el Servidor

```bash
# Presiona Ctrl+C
npm run dev
```

### 4. Conectar una Cuenta

1. Abre http://localhost:5173
2. Ve a "Cuentas de TikTok"
3. Click en "+ Conectar Cuenta"
4. Serás redirigido a TikTok
5. Inicia sesión y autoriza la app
6. Serás redirigido de vuelta a SubiteYa
7. ¡Tu cuenta estará conectada!

## 🔐 Seguridad

✅ **Tokens Encriptados**: Los access tokens y refresh tokens se guardan encriptados con AES-256-GCM

✅ **CSRF Protection**: El parámetro `state` previene ataques CSRF

✅ **Scopes Limitados**: Solo pedimos los permisos necesarios

## 📊 Flujo Completo

```
Usuario → Frontend
  ↓
Frontend → GET /api/auth/tiktok
  ↓
Backend → Genera URL de TikTok con state
  ↓
Redirect → TikTok OAuth
  ↓
Usuario autoriza en TikTok
  ↓
TikTok → GET /api/auth/tiktok/callback?code=...
  ↓
Backend → Exchange code por access token
  ↓
Backend → Obtiene info del usuario
  ↓
Backend → Guarda en DB (tokens encriptados)
  ↓
Backend → Redirect a frontend?success=true
  ↓
Frontend → Muestra mensaje de éxito
  ↓
Frontend → Recarga lista de conexiones
```

## 🚀 Próximos Pasos

Una vez que tengas cuentas reales conectadas:

### 1. Implementar Upload a TikTok

Crear un worker que:

- Lea los `publish_jobs` en estado `queued`
- Desencripte el access token
- Suba el video a TikTok usando su API
- Actualice el estado del job

### 2. Manejar Tokens Expirados

- Detectar cuando un token expira (check `expiresAt`)
- Llamar automáticamente a `/api/auth/tiktok/refresh`
- Reintentar la operación con el nuevo token

### 3. Webhooks de TikTok

- Recibir notificaciones cuando un video se publica
- Actualizar el estado en la DB
- Notificar al usuario

## 🧪 Testing

### Probar OAuth sin Client Key

Si no tenés las credenciales aún, podés probar que el flujo funciona:

1. Intenta conectar una cuenta
2. Verás un error: "TikTok OAuth not configured"
3. Esto confirma que la ruta funciona

### Con Credenciales Reales

1. Configura el `.env` con tus credenciales
2. Conecta tu propia cuenta de TikTok
3. Verifica en la DB que se guardó:
   ```sql
   SELECT * FROM tiktok_connections;
   ```

## ⚠️ Limitaciones

### Plan Free de TikTok

- **Rate Limits**: Límite de requests por día
- **Review Required**: Algunas apps necesitan aprobación para publicar videos de otros usuarios
- **Test Mode**: Durante desarrollo solo podés usar tu propia cuenta

### Producción

Cuando subas a producción:

1. Actualiza el Redirect URI en TikTok Developer a tu dominio real
2. Actualiza `TIKTOK_REDIRECT_URI` en el `.env`
3. Asegurate de que el frontend también use HTTPS

---

¡El MVP ahora soporta cuentas reales de TikTok! 🎉

**IMPORTANTE**: No olvides configurar las credenciales en el `.env` para que funcione.
