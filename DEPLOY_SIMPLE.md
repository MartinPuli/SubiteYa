# 🚀 Deploy Rápido a Render (con tu PostgreSQL existente)

Ya tienes PostgreSQL configurado, así que solo necesitas desplegar el Web Service.

## ⚡ Pasos Rápidos (5 minutos)

### 1. Hacer Push (ya lo hiciste ✅)

### 2. Ir a Render

1. Ve a: https://render.com
2. Crea cuenta gratuita o inicia sesión

### 3. Crear Web Service (la forma fácil)

**Opción A: Con Blueprint**

1. Click **"New +"** → **"Blueprint"**
2. Conecta GitHub → Selecciona **"SubiteYa"**
3. Click **"Apply"**

**Opción B: Directo (más rápido)**

1. Click **"New +"** → **"Web Service"**
2. Conecta GitHub → Selecciona **"SubiteYa"**
3. Configura:
   - **Name**: `subiteya-api`
   - **Region**: Oregon
   - **Branch**: `main`
   - **Root Directory**: (vacío)
   - **Runtime**: Node
   - **Build Command**: `bash scripts/build.sh`
   - **Start Command**: `bash scripts/start.sh`
   - **Plan**: Free

### 4. Agregar Variables de Entorno

En **"Environment"**, agrega estas variables:

```bash
# Tu PostgreSQL/Supabase existente
DB_URL=postgresql://user:password@host:5432/database?sslmode=require
DIRECT_URL=postgresql://user:password@host:5432/database?sslmode=require

# JWT Secret (genera uno nuevo)
JWT_SECRET=un_secreto_super_seguro_cambialo

# TikTok OAuth
TIKTOK_CLIENT_KEY=tu_client_key
TIKTOK_CLIENT_SECRET=tu_client_secret
TIKTOK_REDIRECT_URI=https://subiteya-api.onrender.com/api/auth/tiktok/callback

# Ya configurado automáticamente
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://martinpuli.github.io
```

### 5. Deploy

1. Click **"Create Web Service"**
2. Espera 3-5 minutos
3. ¡Listo!

---

## 📝 Dónde Obtener las URLs de PostgreSQL

### Si usas **Supabase**:

1. Ve a tu proyecto en https://supabase.com
2. Settings → Database
3. Copia el **Connection String** (modo "Session")
4. Úsalo para `DB_URL`
5. Copia el **Connection String** (modo "Transaction" o "Direct")
6. Úsalo para `DIRECT_URL`

**Ejemplo de URL de Supabase:**
```
postgresql://postgres.abc123:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

### Si usas **PostgreSQL normal**:

Tu URL debería verse así:
```
postgresql://usuario:contraseña@host:5432/nombre_base_datos?sslmode=require
```

---

## 🎯 Tu API estará en:

```
https://subiteya-api.onrender.com
```

Prueba: `https://subiteya-api.onrender.com/health`

---

## 🔧 Conectar Frontend

Una vez desplegado:

### 1. Crear archivo de config

`packages/web/src/config/api.ts`:
```typescript
export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://subiteya-api.onrender.com/api'
    : 'http://localhost:3000/api');
```

### 2. Usar en tu código

```typescript
import { API_BASE_URL } from './config/api';

// Ejemplo de uso
fetch(`${API_BASE_URL}/auth/login`, {
  method: 'POST',
  // ...
});
```

### 3. Push para actualizar frontend

```bash
git add .
git commit -m "feat: conectar con API en Render"
git push origin main
```

---

## ✅ Checklist

- [ ] Cuenta de Render creada
- [ ] Web Service creado
- [ ] Variables de entorno agregadas (especialmente DB_URL)
- [ ] Build completado exitosamente
- [ ] Health check funcionando
- [ ] Frontend actualizado

---

## ⚠️ Importante

### Plan Free de Render:
- ✅ Completamente gratis
- ⚠️ Se duerme tras 15 min sin uso
- ⚠️ Tarda ~30 seg en despertar
- ✅ Perfecto para desarrollo

### Tu PostgreSQL:
- ✅ Ya lo tienes configurado
- ✅ Render solo se conecta a él
- ✅ No hay costos adicionales

---

## 🐛 Problemas Comunes

### "Database connection failed"

**Solución:**
1. Verifica que `DB_URL` tenga el formato correcto
2. Asegúrate de incluir `?sslmode=require` al final
3. Si es Supabase, usa el connection string en modo "Session"

### "Build failed"

**Solución:**
1. Revisa los logs en Render
2. Verifica que los scripts existan: `scripts/build.sh` y `scripts/start.sh`

---

## 💡 Tips

1. **Genera JWT_SECRET seguro:**
   ```bash
   # En tu terminal local:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **CORS**: Ya está configurado para GitHub Pages

3. **Logs**: Render muestra logs en tiempo real

---

¿Listo para desplegar? ¡Solo 5 minutos! 🚀
