# 🔗 Guía de Integración Frontend + Backend

## ✅ Configuración Completada

Tu proyecto ahora está configurado para funcionar automáticamente en:

### 🏠 Desarrollo Local

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api

### 🌐 Producción

- **Frontend**: https://martinpuli.github.io/SubiteYa/
- **Backend API**: https://subiteya.onrender.com/api

---

## 📁 Archivos Creados/Actualizados

### Frontend (`packages/web/`)

1. **`src/config/api.ts`** - Configuración central de la API
   - Detecta automáticamente el entorno (dev/prod)
   - Exporta todas las URLs de endpoints
   - Helper para construir URLs con query params

2. **`src/config/api-examples.ts`** - Ejemplos de uso
   - Cómo hacer login
   - Cómo obtener datos
   - Cómo subir archivos
   - Cómo usar OAuth de TikTok

3. **`src/vite-env.d.ts`** - Tipos TypeScript
   - Define tipos para variables de entorno

4. **`.env.development`** - Variables de desarrollo

   ```
   VITE_API_URL=http://localhost:3000/api
   ```

5. **`.env.production`** - Variables de producción
   ```
   VITE_API_URL=https://subiteya.onrender.com/api
   ```

---

## 🚀 Cómo Usar en tu Código

### Importar la configuración

```typescript
import { API_ENDPOINTS, buildUrl } from '@/config/api';
```

### Ejemplo: Login

```typescript
async function handleLogin(email: string, password: string) {
  try {
    const response = await fetch(API_ENDPOINTS.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include', // Importante para cookies
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    console.log('Login exitoso:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Ejemplo: Obtener Conexiones de TikTok

```typescript
async function getMyConnections() {
  try {
    const response = await fetch(API_ENDPOINTS.connections, {
      method: 'GET',
      credentials: 'include',
    });

    const connections = await response.json();
    return connections;
  } catch (error) {
    console.error('Error obteniendo conexiones:', error);
  }
}
```

### Ejemplo: OAuth TikTok

```typescript
function connectTikTok() {
  // Redirige automáticamente a la URL correcta según el entorno
  window.location.href = API_ENDPOINTS.tiktokAuth;
}
```

---

## 🔧 Variables de Entorno del Backend (Render)

Asegúrate de configurar estas variables en Render Dashboard:

```bash
# Base de Datos
DB_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:PyQC3ES3L6vf0j7H@aws-1-us-east-2.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:PyQC3ES3L6vf0j7H@aws-1-us-east-2.pooler.supabase.com:5432/postgres

# App
NODE_ENV=production
PORT=3000

# Seguridad
JWT_SECRET=0DwyB1iOUeKCuVm6dc7A4tblpLEfIMN5
ENCRYPTION_KEY=ZTBwY0EO6AWNlmrSgLtXnH5MxqkUfFKR

# TikTok OAuth
TIKTOK_CLIENT_KEY=sbawzqfs69au63lgs0
TIKTOK_CLIENT_SECRET=mpVhZbH7321lI11P5jRgSxDw5XGz2TLj
TIKTOK_REDIRECT_URI=https://subiteya.onrender.com/api/auth/tiktok/callback

# CORS - IMPORTANTE: Tu frontend de GitHub Pages
ALLOWED_ORIGINS=https://martinpuli.github.io

# Supabase (opcional)
SUPABASE_URL=https://xfvjfakdlcfgdolryuck.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdmpmYWtkbGNmZ2RvbHJ5dWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTAzODUsImV4cCI6MjA3NTQ2NjM4NX0.4KjgIPGvOYIXmfdSs91lEjemBcTb1ifYRkh_q0VVRps
```

**Ver detalles completos en**: `RENDER_ENV_VARS.md`

---

## 🔄 Flujo de Desarrollo

### 1. Desarrollo Local

```bash
# Terminal 1 - Backend
cd packages/api
npm run dev

# Terminal 2 - Frontend
cd packages/web
npm run dev
```

El frontend automáticamente usará `http://localhost:3000/api`

### 2. Desplegar a Producción

```bash
# Hacer commit y push
git add .
git commit -m "feat: tu cambio aquí"
git push origin main
```

- **GitHub Actions** desplegará automáticamente el frontend a GitHub Pages
- **Render** desplegará automáticamente el backend (si está configurado con auto-deploy)

El frontend automáticamente usará `https://subiteya.onrender.com/api`

---

## ✅ Checklist de Integración

### Frontend

- [x] `src/config/api.ts` creado
- [x] `.env.development` configurado
- [x] `.env.production` configurado
- [x] `vite-env.d.ts` con tipos
- [ ] Actualizar componentes para usar `API_ENDPOINTS`
- [ ] Probar localmente
- [ ] Desplegar a GitHub Pages

### Backend

- [ ] Servicio creado en Render
- [ ] Variables de entorno configuradas
- [ ] `ALLOWED_ORIGINS` incluye GitHub Pages
- [ ] `TIKTOK_REDIRECT_URI` actualizado
- [ ] Build exitoso
- [ ] Health check funcionando

### TikTok Developer Portal

- [ ] Redirect URI actualizado a producción
- [ ] Redirect URI de desarrollo agregado (opcional)

---

## 🧪 Probar la Integración

### 1. Localmente

```bash
# Terminal 1 - Backend
cd packages/api
npm run dev

# Terminal 2 - Frontend
cd packages/web
npm run dev
```

Abre http://localhost:5173 y prueba:

- Login/Register
- Conectar cuenta de TikTok
- Ver conexiones

### 2. En Producción

Una vez desplegado:

1. Ve a https://martinpuli.github.io/SubiteYa/
2. Prueba las mismas funcionalidades
3. Verifica que OAuth redirige correctamente
4. Verifica los logs en Render si algo falla

---

## 🐛 Troubleshooting

### Error: "CORS policy blocking"

**Problema**: El backend bloquea requests del frontend

**Solución**:

1. Verifica que `ALLOWED_ORIGINS` en Render incluya tu URL de GitHub Pages
2. Debe ser exacta: `https://martinpuli.github.io` (sin trailing slash)

### Error: "Failed to fetch"

**Problema**: No puede conectarse a la API

**Solución**:

1. Verifica que el backend esté corriendo
2. En producción: verifica que Render no esté dormido (plan free)
3. Verifica la URL en `.env.production`

### OAuth de TikTok no funciona

**Problema**: Redirige pero da error

**Solución**:

1. Verifica `TIKTOK_REDIRECT_URI` en Render
2. Verifica que coincida con TikTok Developer Portal
3. Debe ser: `https://subiteya.onrender.com/api/auth/tiktok/callback`

---

## 📚 Archivos de Referencia

- **Configuración API**: `packages/web/src/config/api.ts`
- **Ejemplos de uso**: `packages/web/src/config/api-examples.ts`
- **Variables Render**: `RENDER_ENV_VARS.md`
- **Deploy Frontend**: `CONFIGURAR_ACTIONS.md`
- **Deploy Backend**: `DEPLOY_SIMPLE.md`

---

## 🎉 ¡Siguiente Paso!

1. **Hacer commit y push** de estos cambios
2. **Configurar variables** en Render
3. **Probar localmente** que todo funciona
4. **Desplegar a producción**
5. **Actualizar TikTok Developer Portal**

```bash
git add .
git commit -m "feat: configurar integración frontend-backend para prod y dev"
git push origin main
```

¿Necesitas ayuda con algún paso específico? 🚀
