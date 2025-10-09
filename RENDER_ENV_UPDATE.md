# 🔧 Actualización de Variables de Entorno en Render

## Variable Nueva Requerida

Acabamos de agregar soporte para URLs dinámicas en el callback de TikTok. Ahora necesitas agregar esta variable en Render:

### ⚙️ FRONTEND_URL

**Valor para producción:**

```
FRONTEND_URL=https://martinpuli.github.io/SubiteYa
```

**⚠️ IMPORTANTE:** No incluyas la barra final `/` en la URL

---

## 📝 Cómo agregar la variable en Render

1. Ve a tu dashboard de Render: https://dashboard.render.com/
2. Selecciona tu servicio `subiteya-1`
3. Ve a la pestaña **Environment**
4. Haz clic en **Add Environment Variable**
5. Agrega:
   - **Key:** `FRONTEND_URL`
   - **Value:** `https://martinpuli.github.io/SubiteYa`
6. Haz clic en **Save Changes**

Render automáticamente redesplegará el servicio con la nueva variable.

---

## ✅ Variables de Entorno Completas

Después de agregar `FRONTEND_URL`, deberías tener todas estas variables configuradas:

```
NODE_ENV=production
PORT=10000
ALLOWED_ORIGINS=https://martinpuli.github.io,https://martinpuli.github.io/
FRONTEND_URL=https://martinpuli.github.io/SubiteYa

# Database
DB_URL=postgresql://postgres.xxx:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# JWT
JWT_SECRET=[tu-secret]

# Encryption
ENCRYPTION_KEY=[tu-key]

# TikTok OAuth
TIKTOK_CLIENT_KEY=sbawzqfs69au63lgs0
TIKTOK_CLIENT_SECRET=[tu-secret]
TIKTOK_REDIRECT_URI=https://subiteya-1.onrender.com/api/auth/tiktok/callback
```

---

## 🎯 Resultado

Una vez que agregues `FRONTEND_URL` y Render redespliegue:

- ✅ Después de autorizar TikTok, te redirigirá a: `https://martinpuli.github.io/SubiteYa/connections?success=true`
- ✅ En caso de error, te redirigirá a: `https://martinpuli.github.io/SubiteYa/connections?error=...`
- ❌ Ya no te redirigirá a `localhost:5173`

---

## ⏱️ Tiempo estimado

- Agregar variable: 1 minuto
- Redespliegue automático: 1-2 minutos

**Total: ~3 minutos**
