# 🎯 Pasos Finales para Subir a GitHub Pages

## ✅ Lo que ya está listo:

1. ✅ Configuración de Vite para GitHub Pages
2. ✅ Script de deploy en package.json
3. ✅ GitHub Actions workflow configurado
4. ✅ Dependencia gh-pages instalada
5. ✅ Archivo .nojekyll creado

## 🚀 Siguiente: Hacer Push a GitHub

**Ejecuta estos comandos en orden:**

```bash
# 1. Agregar todos los cambios
git add .

# 2. Hacer commit
git commit -m "feat: configurar despliegue en GitHub Pages"

# 3. Hacer push a GitHub
git push origin main
```

## 📍 Una vez hecho el push:

1. **Ve a tu repositorio en GitHub**: https://github.com/MartinPuli/SubiteYa

2. **Habilita GitHub Pages**:
   - Click en **Settings**
   - Busca **Pages** en el menú lateral
   - En **Build and deployment**, selecciona:
     - **Source**: GitHub Actions ⚠️ *(IMPORTANTE)*

3. **Verifica el despliegue**:
   - Ve a la pestaña **Actions**
   - Verás el workflow "Deploy to GitHub Pages" ejecutándose
   - Espera a que termine (tarda 2-3 minutos)

4. **Accede a tu app**:
   - Una vez completado, tu app estará en: 
   - `https://martinpuli.github.io/SubiteYa/`

## ⚠️ IMPORTANTE: Backend

Recuerda que GitHub Pages **solo sirve el frontend** (HTML, CSS, JS estáticos).

Tu API de backend NO estará disponible. Necesitarás desplegarla por separado en:
- Railway
- Render  
- Vercel
- Fly.io

Una vez desplegado el backend, actualiza la URL de la API en tu código frontend.

## 🔧 Comandos Útiles

```bash
# Construir localmente para probar
npm run build -w @subiteya/web

# Preview del build local
npm run preview -w @subiteya/web

# Deploy manual (alternativa a GitHub Actions)
cd packages/web
npm run deploy
```

## 📝 Checklist Final

- [ ] Hacer commit de los cambios
- [ ] Push a GitHub (main branch)
- [ ] Habilitar GitHub Pages en Settings
- [ ] Verificar que el workflow se ejecute
- [ ] Acceder a la URL de GitHub Pages
- [ ] Desplegar el backend por separado
- [ ] Actualizar URL del API en el código

## 🎉 ¡Eso es todo!

Sigue los pasos y tu aplicación estará en línea en pocos minutos.
