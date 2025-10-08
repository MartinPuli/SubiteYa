# 🚀 Deploy a Render - Pasos Rápidos

## ✅ Lo que ya está configurado:

1. ✅ `render.yaml` - Configuración automática
2. ✅ Scripts de build y start
3. ✅ package.json actualizado
4. ✅ Variables de entorno documentadas

## 📝 Pasos para Desplegar:

### 1. Hacer Push de los Nuevos Archivos

```bash
git add .
git commit -m "feat: configurar despliegue en Render"
git push origin main
```

### 2. Ir a Render

1. Ve a: https://render.com
2. Crea una cuenta gratuita o inicia sesión
3. Click en **"New +"** → **"Blueprint"**

### 3. Conectar GitHub

1. Autoriza Render a acceder a tu GitHub
2. Selecciona el repositorio **"SubiteYa"**
3. Render detectará el `render.yaml`
4. Click en **"Apply"**

### 4. Agregar Variables de Entorno de TikTok

Después de crear el servicio, agrega:

```
TIKTOK_CLIENT_KEY=tu_client_key
TIKTOK_CLIENT_SECRET=tu_client_secret
TIKTOK_REDIRECT_URI=https://subiteya-api.onrender.com/api/auth/tiktok/callback
```

*(Obtén las credenciales en: https://developers.tiktok.com/)*

### 5. Esperar el Deploy

- Tarda 5-10 minutos la primera vez
- Render creará automáticamente:
  - ✅ Base de datos PostgreSQL
  - ✅ Web Service (API)
  - ✅ Variables de entorno

### 6. Obtener tu URL

Tu API estará en:
```
https://subiteya-api.onrender.com
```

Prueba: `https://subiteya-api.onrender.com/health`

---

## 🔧 Conectar Frontend con Backend

Una vez desplegado el backend, actualiza tu frontend:

### 1. Crear configuración de API

`packages/web/src/config/api.ts`:
```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://subiteya-api.onrender.com'
    : 'http://localhost:3000');
```

### 2. Crear .env.production

`packages/web/.env.production`:
```
VITE_API_URL=https://subiteya-api.onrender.com
```

### 3. Push para redesplegar frontend

```bash
git add .
git commit -m "feat: conectar frontend con API"
git push origin main
```

---

## ⚠️ Importante: Plan Free

El plan gratuito de Render:
- ✅ Es completamente gratis
- ⚠️ Se duerme después de 15 minutos sin uso
- ⚠️ Tarda ~30 segundos en "despertar"
- ✅ Suficiente para desarrollo y pruebas

Para producción: Plan Starter ($7/mes) - sin sleep

---

## 📚 Documentación Completa

Lee `DEPLOY_RENDER.md` para:
- Despliegue manual paso a paso
- Solución de problemas
- Configuración avanzada
- Tips de optimización

---

## ✅ Checklist

- [ ] Push de archivos a GitHub
- [ ] Cuenta de Render creada
- [ ] Blueprint aplicado
- [ ] Variables de TikTok agregadas
- [ ] Build completado
- [ ] Health check funcionando
- [ ] Frontend actualizado con URL del API

---

¿Necesitas ayuda? Lee `DEPLOY_RENDER.md` o pregúntame! 🚀
