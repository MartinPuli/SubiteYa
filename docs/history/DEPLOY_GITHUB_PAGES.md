# 🚀 Guía de Despliegue en GitHub Pages

Esta guía te ayudará a desplegar SubiteYa en GitHub Pages.

## 📋 Pre-requisitos

1. Tener el código en un repositorio de GitHub
2. Permisos de administrador en el repositorio
3. Node.js 18+ instalado localmente

## 🔧 Configuración de GitHub Pages

### Paso 1: Habilitar GitHub Pages en tu repositorio

1. Ve a tu repositorio en GitHub: `https://github.com/MartinPuli/SubiteYa`
2. Click en **Settings** (Configuración)
3. En el menú lateral, busca **Pages**
4. En **Build and deployment**, selecciona:
   - **Source**: GitHub Actions

### Paso 2: Instalar dependencias

```bash
npm install
```

### Paso 3: Probar el build localmente

```bash
npm run build -w @subiteya/web
```

## 🚀 Opciones de Despliegue

### Opción 1: Despliegue Automático con GitHub Actions (Recomendado)

El archivo `.github/workflows/deploy.yml` ya está configurado. Simplemente:

1. Haz commit de tus cambios:

```bash
git add .
git commit -m "feat: configurar GitHub Pages deployment"
git push origin main
```

2. El workflow se ejecutará automáticamente y desplegará tu aplicación
3. Una vez completado, tu app estará disponible en: `https://martinpuli.github.io/SubiteYa/`

### Opción 2: Despliegue Manual

Si prefieres desplegar manualmente:

1. Instala las dependencias:

```bash
cd packages/web
npm install
```

2. Ejecuta el script de deploy:

```bash
npm run deploy
```

Esto construirá la aplicación y la desplegará en la rama `gh-pages`.

## 🔍 Verificar el Despliegue

1. Ve a la pestaña **Actions** en tu repositorio
2. Verifica que el workflow "Deploy to GitHub Pages" se haya completado exitosamente
3. Accede a tu aplicación en: `https://martinpuli.github.io/SubiteYa/`

## ⚙️ Configuración Realizada

### 1. `vite.config.ts`

- Se configuró el `base` para que funcione con la ruta de GitHub Pages (`/SubiteYa/`)
- Se optimizó el build con chunks manuales para mejor rendimiento

### 2. GitHub Actions Workflow

- Se creó `.github/workflows/deploy.yml`
- Automatiza el build y despliegue en cada push a `main`
- Usa las GitHub Actions oficiales para Pages

### 3. Scripts de Deploy

- Se agregó el script `deploy` en `packages/web/package.json`
- Se instaló `gh-pages` como dependencia de desarrollo

## 🐛 Solución de Problemas

### Error: "No se puede acceder a la API"

Si tu aplicación frontend intenta conectarse a la API del backend, recuerda que:

- GitHub Pages solo sirve contenido estático (HTML, CSS, JS)
- No puede ejecutar código de backend (Node.js, Express)
- Necesitarás desplegar tu API en otro lugar (Vercel, Railway, Render, etc.)

### Error: "404 al refrescar la página"

Para apps React con React Router, necesitas manejar las rutas del lado del cliente:

1. Crea `packages/web/public/404.html` con el mismo contenido que `index.html`
2. O configura un `_redirects` file si usas Netlify

### Error: "Permisos denegados en GitHub Actions"

Verifica que el repositorio tenga los permisos correctos:

1. Settings → Actions → General
2. En "Workflow permissions", selecciona "Read and write permissions"

## 🌐 URLs Importantes

- **Aplicación desplegada**: https://martinpuli.github.io/SubiteYa/
- **Repositorio**: https://github.com/MartinPuli/SubiteYa
- **GitHub Actions**: https://github.com/MartinPuli/SubiteYa/actions

## 📝 Notas Adicionales

### Variables de Entorno

Si tu aplicación usa variables de entorno:

1. No pongas información sensible en el código del frontend
2. Usa GitHub Secrets para información sensible en los workflows
3. Para variables públicas, puedes usar un archivo `.env` con prefijo `VITE_`

### Desplegar el Backend

Para que tu aplicación funcione completamente, necesitarás desplegar también el backend:

**Opciones recomendadas:**

- **Railway**: Fácil despliegue de apps Node.js con PostgreSQL
- **Render**: Plan gratuito con soporte para PostgreSQL
- **Vercel**: Excelente para APIs serverless
- **Fly.io**: Soporte completo para apps full-stack

### Actualizar la URL del API

Una vez desplegado el backend, actualiza la URL de la API en tu código:

```typescript
// En tu código de configuración
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://tu-api.com';
```

## ✅ Checklist de Despliegue

- [ ] Código pusheado a GitHub
- [ ] GitHub Pages habilitado en Settings
- [ ] Dependencias instaladas (`npm install`)
- [ ] Build local exitoso (`npm run build -w @subiteya/web`)
- [ ] GitHub Actions workflow ejecutándose
- [ ] Aplicación accesible en GitHub Pages
- [ ] Backend desplegado por separado (si aplica)
- [ ] Variables de entorno configuradas
- [ ] URLs actualizadas en el código

## 🎉 ¡Listo!

Tu aplicación debería estar ahora desplegada en GitHub Pages. Si tienes problemas, revisa los logs de GitHub Actions para más detalles.
