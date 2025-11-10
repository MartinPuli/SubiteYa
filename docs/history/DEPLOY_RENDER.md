# 🚀 Guía Completa: Desplegar Backend en Render

Esta guía te llevará paso a paso para desplegar tu API de SubiteYa en Render.

## 📋 Requisitos Previos

- ✅ Cuenta en Render (gratuita): https://render.com
- ✅ Cuenta en GitHub
- ✅ Código pusheado a GitHub

## 🎯 Opciones de Despliegue

### Opción 1: Despliegue Automático con render.yaml (Recomendado)

El archivo `render.yaml` ya está configurado. Incluye:

- ✅ Web Service (tu API)
- ✅ PostgreSQL Database (base de datos)
- ✅ Variables de entorno configuradas
- ✅ Migraciones automáticas

### Opción 2: Despliegue Manual desde el Dashboard

Configuración paso a paso desde la interfaz web de Render.

---

## 🚀 OPCIÓN 1: Despliegue con Blueprint (render.yaml)

### Paso 1: Ir a Render Dashboard

1. Ve a: https://render.com
2. Inicia sesión o crea una cuenta gratuita
3. Click en **"Dashboard"**

### Paso 2: Crear un nuevo Blueprint

1. Click en **"New +"** (botón arriba a la derecha)
2. Selecciona **"Blueprint"**
3. Conecta tu repositorio de GitHub:
   - Click en **"Connect to GitHub"**
   - Autoriza a Render para acceder a tus repos
   - Busca y selecciona **"SubiteYa"**
4. Render detectará automáticamente el archivo `render.yaml`
5. Click en **"Apply"**

### Paso 3: Configurar Variables de Entorno Adicionales

Render creará automáticamente:

- ✅ `DB_URL` - URL de PostgreSQL
- ✅ `DIRECT_URL` - URL directa de PostgreSQL
- ✅ `JWT_SECRET` - Generado automáticamente
- ✅ `ALLOWED_ORIGINS` - Ya configurado

**Variables que debes agregar manualmente:**

1. En tu servicio, ve a **"Environment"**
2. Agrega estas variables:

```
TIKTOK_CLIENT_KEY=tu_client_key_aqui
TIKTOK_CLIENT_SECRET=tu_client_secret_aqui
TIKTOK_REDIRECT_URI=https://subiteya-api.onrender.com/api/auth/tiktok/callback
```

_(Obtén estas credenciales en: https://developers.tiktok.com/)_

### Paso 4: Esperar el Despliegue

1. Render comenzará a:
   - ✅ Crear la base de datos PostgreSQL
   - ✅ Instalar dependencias
   - ✅ Construir tu aplicación
   - ✅ Ejecutar migraciones de Prisma
   - ✅ Iniciar el servidor

2. El proceso tarda **5-10 minutos** la primera vez

3. Verás los logs en tiempo real

### Paso 5: Obtener la URL de tu API

Una vez completado:

```
https://subiteya-api.onrender.com
```

Prueba el health check:

```
https://subiteya-api.onrender.com/health
```

---

## 🛠️ OPCIÓN 2: Despliegue Manual

### Paso 1: Crear la Base de Datos

1. En Render Dashboard, click **"New +"** → **"PostgreSQL"**
2. Configura:
   - **Name**: `subiteya-db`
   - **Database**: `subiteya`
   - **User**: (se genera automáticamente)
   - **Region**: Oregon (o el más cercano)
   - **Plan**: Free
3. Click en **"Create Database"**
4. **Guarda estas credenciales** (las necesitarás):
   - Internal Database URL
   - External Database URL

### Paso 2: Crear el Web Service

1. Click **"New +"** → **"Web Service"**
2. Conecta tu repositorio de GitHub: **SubiteYa**
3. Configura:
   - **Name**: `subiteya-api`
   - **Region**: Oregon (mismo que la BD)
   - **Branch**: `main`
   - **Root Directory**: (dejar vacío)
   - **Runtime**: Node
   - **Build Command**: `bash scripts/build.sh`
   - **Start Command**: `bash scripts/start.sh`
   - **Plan**: Free

### Paso 3: Configurar Variables de Entorno

En **"Environment Variables"**, agrega:

```
NODE_ENV=production
PORT=3000
DB_URL=postgresql://user:password@host/database?sslmode=require
DIRECT_URL=postgresql://user:password@host/database?sslmode=require
JWT_SECRET=tu_secreto_super_seguro_cambiar_esto
ALLOWED_ORIGINS=https://martinpuli.github.io
TIKTOK_CLIENT_KEY=tu_client_key
TIKTOK_CLIENT_SECRET=tu_client_secret
TIKTOK_REDIRECT_URI=https://subiteya-api.onrender.com/api/auth/tiktok/callback
```

**Para `DB_URL` y `DIRECT_URL`:**

- Usa la "Internal Database URL" de tu base de datos PostgreSQL
- Cópiala desde el dashboard de la base de datos

### Paso 4: Desplegar

1. Click en **"Create Web Service"**
2. Render comenzará el build automáticamente
3. Espera 5-10 minutos

---

## 🔧 Configurar el Frontend para Usar tu API

Una vez desplegada tu API, actualiza el frontend:

### 1. Crear archivo de configuración del API

Crea `packages/web/src/config/api.ts`:

```typescript
const API_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.PROD
    ? 'https://subiteya-api.onrender.com'
    : 'http://localhost:3000';

export { API_BASE_URL };
```

### 2. Agregar variable de entorno

Crea `packages/web/.env.production`:

```
VITE_API_URL=https://subiteya-api.onrender.com
```

### 3. Actualizar el Frontend en GitHub Pages

```bash
git add .
git commit -m "feat: conectar frontend con API en Render"
git push origin main
```

El workflow de GitHub Actions redesplegará automáticamente.

---

## 📊 Verificar que Todo Funciona

### 1. Probar Health Check

```bash
curl https://subiteya-api.onrender.com/health
```

Debería devolver:

```json
{
  "status": "ok",
  "timestamp": "2025-10-08T...",
  "uptime": 123.45
}
```

### 2. Probar Endpoint de API

```bash
curl https://subiteya-api.onrender.com/api
```

### 3. Verificar Base de Datos

En el dashboard de Render, ve a tu base de datos:

- Click en **"Connect"** para ver las credenciales
- Puedes conectarte con herramientas como TablePlus, pgAdmin, etc.

---

## 🐛 Solución de Problemas

### Error: "Build failed"

**Problema**: Falló la construcción
**Solución**:

1. Revisa los logs de build en Render
2. Verifica que `scripts/build.sh` y `scripts/start.sh` existan
3. Asegúrate de que `packages/api/tsconfig.json` esté correctamente configurado

### Error: "Application failed to respond"

**Problema**: El servidor no responde
**Solución**:

1. Verifica que la variable `PORT` esté configurada
2. Revisa los logs de runtime
3. Asegúrate de que el servidor escuche en `0.0.0.0`, no `localhost`

### Error: "Database connection failed"

**Problema**: No puede conectarse a PostgreSQL
**Solución**:

1. Verifica que `DB_URL` y `DIRECT_URL` estén correctamente configuradas
2. Asegúrate de usar la "Internal Database URL"
3. Verifica que incluya `?sslmode=require` al final

### Error: "Prisma migrations failed"

**Problema**: Las migraciones no se aplicaron
**Solución**:

1. Ve a tu servicio → Shell
2. Ejecuta manualmente:
   ```bash
   cd packages/api
   npx prisma migrate deploy
   ```

### Plan Free se duerme después de 15 minutos

**Problema**: En el plan gratuito, Render apaga tu servicio después de 15 minutos de inactividad
**Soluciones**:

1. **Actualizar a plan pagado** ($7/mes) - sin sleep
2. **Usar un ping service** (UptimeRobot, cron-job.org)
3. **Aceptar el cold start** - Primera request tarda ~30 segundos

---

## 💰 Costos

### Plan Free (Gratis)

- ✅ 750 horas/mes de servicio web
- ✅ PostgreSQL con 1GB de almacenamiento
- ⚠️ Se duerme después de 15 minutos sin uso
- ⚠️ Tarda ~30 segundos en "despertar"

### Plan Starter ($7/mes por servicio)

- ✅ Sin sleep (siempre activo)
- ✅ 0.5 CPU / 512 MB RAM
- ✅ Mejor para producción

---

## 📝 Checklist de Despliegue

- [ ] Cuenta de Render creada
- [ ] Repositorio conectado a Render
- [ ] Base de datos PostgreSQL creada
- [ ] Web Service creado
- [ ] Variables de entorno configuradas
- [ ] Credenciales de TikTok agregadas
- [ ] Build completado exitosamente
- [ ] Health check funcionando
- [ ] Migraciones aplicadas
- [ ] Frontend actualizado con URL del API
- [ ] CORS configurado correctamente

---

## 🔗 Links Importantes

- **Render Dashboard**: https://dashboard.render.com
- **Documentación Render**: https://render.com/docs
- **TikTok Developer Portal**: https://developers.tiktok.com/
- **Tu API (una vez desplegada)**: https://subiteya-api.onrender.com

---

## 🎉 ¡Siguiente Paso!

Una vez que tu API esté desplegada y funcionando:

1. ✅ Actualiza el frontend para conectarse a la API
2. ✅ Configura las credenciales de TikTok
3. ✅ Prueba el flujo completo de autenticación
4. ✅ Despliega un video de prueba

---

## 💡 Tips Pro

1. **Usa variables de entorno**: Nunca hardcodees URLs o secretos
2. **Monitorea los logs**: Render tiene logs en tiempo real
3. **Configura alertas**: Render puede enviarte emails si el servicio falla
4. **Backups de BD**: El plan free no incluye backups automáticos
5. **Health checks**: Render verifica `/health` automáticamente

---

¿Necesitas ayuda con algún paso específico? ¡Avísame!
