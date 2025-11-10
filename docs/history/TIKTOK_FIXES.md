# 🔧 Fixes Aplicados - TikTok OAuth

## ✅ 3 Problemas Resueltos

### 1. **Redirección a localhost después de conectar** 🏠

**Problema:** Después de autorizar TikTok, redirigía a `http://localhost:5173/connections?success=true`

**Solución:**

- Ya estaba usando `FRONTEND_URL` en las redirecciones
- **DEBES agregar la variable en Render**: `FRONTEND_URL=https://martinpuli.github.io/SubiteYa`

---

### 2. **No se guardaba nombre ni avatar correctamente** 👤

**Problema:** Los campos `display_name` y `avatar_url` aparecían como "TikTok User" y null

**Causa:** La API de TikTok `/v2/user/info/` **requiere** especificar los campos en el query parameter `fields`

**Solución:**

```typescript
// ANTES (❌ No funcionaba)
fetch('https://open.tiktokapis.com/v2/user/info/', {
  headers: { Authorization: `Bearer ${access_token}` },
});

// AHORA (✅ Funciona)
const url = new URL('https://open.tiktokapis.com/v2/user/info/');
url.searchParams.set(
  'fields',
  'open_id,union_id,avatar_url,avatar_url_100,display_name'
);
fetch(url.toString(), {
  headers: { Authorization: `Bearer ${access_token}` },
});
```

**Cambios:**

- Agregado parámetro `fields=open_id,union_id,avatar_url,avatar_url_100,display_name`
- Usamos `avatar_url_100` (100x100px) como prioridad, con fallback a `avatar_url`
- Agregado logging para debug: `console.log('TikTok user info response:', ...)`

---

### 3. **No podía agregar segunda cuenta con cookies del navegador** 🍪

**Problema:** Si ya tenías sesión de TikTok, no te permitía agregar una segunda cuenta (solo funcionaba en modo incógnito)

**Causa:** TikTok por defecto hace "auto-auth" si detecta una sesión activa, saltándose la pantalla de selección de cuenta

**Solución:**

```typescript
authUrl.searchParams.set('disable_auto_auth', '1');
```

**Qué hace:**

- `disable_auto_auth=1` **fuerza** mostrar la pantalla de autorización siempre
- Permite al usuario elegir qué cuenta de TikTok usar
- Esencial para aplicaciones multi-cuenta como SubiteYa

---

## 📋 Próximos Pasos

### 1. Agrega la variable en Render (CRÍTICO)

```
FRONTEND_URL=https://martinpuli.github.io/SubiteYa
```

**Cómo:**

- https://dashboard.render.com/
- Selecciona `subiteya-1` → Environment
- Add Environment Variable
- Save Changes (auto-redeploy)

### 2. Espera el redespliegue (~1-2 min)

### 3. Prueba en producción:

1. **Logout** de tu cuenta actual de SubiteYa (si estás logueado)
2. **Login** nuevamente
3. Ve a **Connections**
4. Haz clic en **"Conectar TikTok"**
5. Deberías ver:
   - ✅ Pantalla de autorización de TikTok (incluso si ya tienes sesión)
   - ✅ Redirige a `https://martinpuli.github.io/SubiteYa/connections?success=true`
   - ✅ Tu nombre y avatar de TikTok aparecen correctamente
6. Prueba agregar **segunda cuenta**:
   - Haz clic nuevamente en "Conectar TikTok"
   - Selecciona "Usar otra cuenta" en TikTok
   - Autoriza con segunda cuenta
   - ✅ Debería agregar la segunda cuenta sin problemas

---

## 🐛 Debug

Si algo no funciona, revisa los logs de Render:

1. Dashboard → `subiteya-1` → Logs
2. Busca: `"TikTok user info response:"`
3. Verifica que tenga `display_name` y `avatar_url`

**Ejemplo de respuesta exitosa:**

```json
{
  "data": {
    "user": {
      "open_id": "xxx",
      "union_id": "yyy",
      "display_name": "Tu Nombre",
      "avatar_url": "https://...",
      "avatar_url_100": "https://..."
    }
  },
  "error": {
    "code": "ok",
    "message": ""
  }
}
```

---

## 📚 Referencias

- [TikTok API - Get User Info](https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info)
- [Login Kit for Web - disable_auto_auth](https://developers.tiktok.com/doc/login-kit-web)
