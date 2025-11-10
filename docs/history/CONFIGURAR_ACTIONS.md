# 🔧 Guía de Configuración de GitHub Actions

## ✅ Checklist de Configuración

Sigue estos pasos en orden:

### 1️⃣ Habilitar GitHub Pages

1. Ve a: `https://github.com/MartinPuli/SubiteYa/settings/pages`
2. En **"Build and deployment"**:
   - **Source**: Selecciona `GitHub Actions` (NO "Deploy from a branch")
3. Guarda (se guarda automáticamente)

### 2️⃣ Configurar Permisos de Workflow

1. Ve a: `https://github.com/MartinPuli/SubiteYa/settings/actions`
2. Baja hasta **"Workflow permissions"**
3. Selecciona: `Read and write permissions`
4. Marca: `Allow GitHub Actions to create and approve pull requests`
5. Click en **"Save"**

### 3️⃣ Verificar el Workflow

1. Ve a: `https://github.com/MartinPuli/SubiteYa/actions`
2. Busca el workflow **"Deploy to GitHub Pages"**
3. Debería estar ejecutándose o completado

### 4️⃣ Ejecutar Manualmente (opcional)

Si el workflow no se ejecutó automáticamente:

1. En la pestaña **Actions**
2. Click en **"Deploy to GitHub Pages"** (menú izquierdo)
3. Click en **"Run workflow"** (botón derecho)
4. Selecciona branch: `main`
5. Click en **"Run workflow"** verde

### 5️⃣ Esperar el Despliegue

- El proceso tarda 2-3 minutos
- Verás 2 jobs:
  - ✅ `build` - Construye la aplicación
  - ✅ `deploy` - Despliega a GitHub Pages

### 6️⃣ Acceder a tu Aplicación

Una vez completado, tu app estará disponible en:

```
https://martinpuli.github.io/SubiteYa/
```

## 🔍 URLs Importantes

- **Settings → Pages**: https://github.com/MartinPuli/SubiteYa/settings/pages
- **Settings → Actions**: https://github.com/MartinPuli/SubiteYa/settings/actions
- **Actions Tab**: https://github.com/MartinPuli/SubiteYa/actions
- **Tu App Desplegada**: https://martinpuli.github.io/SubiteYa/

## ⚠️ Problemas Comunes

### Error: "Resource not accessible by integration"

**Solución:**

1. Ve a Settings → Actions → General
2. Cambia a "Read and write permissions"
3. Guarda y re-ejecuta el workflow

### Error: "Page build failed"

**Solución:**

1. Verifica que en Settings → Pages, Source esté en "GitHub Actions"
2. NO debe estar en "Deploy from a branch"

### El workflow no aparece

**Solución:**

1. Verifica que el archivo exista: `.github/workflows/deploy.yml`
2. Verifica que esté en la rama `main`
3. Ve a Actions y busca si hay errores de sintaxis

### La página muestra 404

**Causas posibles:**

1. El workflow aún no terminó (espera 2-3 minutos)
2. GitHub Pages no está habilitado correctamente
3. El build falló (revisa los logs en Actions)

## 📊 Cómo Ver los Logs

Si algo falla:

1. Ve a **Actions**
2. Click en el workflow que falló
3. Click en el job que falló (`build` o `deploy`)
4. Expande los pasos para ver el error

## 🎯 Siguientes Pasos

Una vez que el despliegue funcione:

1. ✅ Tu frontend estará en GitHub Pages
2. ⚠️ Necesitas desplegar el backend por separado
3. 🔧 Actualiza las URLs del API en tu código
4. 🧪 Prueba la aplicación desplegada

## 🆘 ¿Necesitas Ayuda?

Si después de seguir estos pasos algo no funciona:

1. Copia el mensaje de error de los logs de Actions
2. Verifica la configuración de permisos
3. Asegúrate de que el archivo `.github/workflows/deploy.yml` existe

---

**¡Recuerda!** Cada push a `main` desplegará automáticamente los cambios.
