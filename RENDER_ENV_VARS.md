# 🔧 Variables de Entorno para Render

Copia estas variables en el dashboard de Render (Environment Variables):

## Base de Datos (Supabase)

```
DB_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:PyQC3ES3L6vf0j7H@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

```
DIRECT_URL=postgresql://postgres.xfvjfakdlcfgdolryuck:PyQC3ES3L6vf0j7H@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

## Configuración de App

```
NODE_ENV=production
```

```
PORT=3000
```

## Seguridad

```
JWT_SECRET=0DwyB1iOUeKCuVm6dc7A4tblpLEfIMN5
```

```
ENCRYPTION_KEY=ZTBwY0EO6AWNlmrSgLtXnH5MxqkUfFKR
```

## TikTok OAuth

```
TIKTOK_CLIENT_KEY=sbawzqfs69au63lgs0
```

```
TIKTOK_CLIENT_SECRET=mpVhZbH7321lI11P5jRgSxDw5XGz2TLj
```

⚠️ **IMPORTANTE**: Actualiza esta URL con tu URL real de Render:
```
TIKTOK_REDIRECT_URI=https://subiteya.onrender.com/api/auth/tiktok/callback
```

## CORS (URLs permitidas)

```
ALLOWED_ORIGINS=https://martinpuli.github.io
```

## Supabase (opcional)

```
SUPABASE_URL=https://xfvjfakdlcfgdolryuck.supabase.co
```

```
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdmpmYWtkbGNmZ2RvbHJ5dWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTAzODUsImV4cCI6MjA3NTQ2NjM4NX0.4KjgIPGvOYIXmfdSs91lEjemBcTb1ifYRkh_q0VVRps
```

---

## 📋 Checklist

Después de agregar estas variables en Render:

- [ ] DB_URL configurado
- [ ] DIRECT_URL configurado
- [ ] JWT_SECRET configurado
- [ ] ENCRYPTION_KEY configurado
- [ ] TIKTOK_* variables configuradas
- [ ] TIKTOK_REDIRECT_URI actualizado con tu URL de Render
- [ ] ALLOWED_ORIGINS incluye tu GitHub Pages
- [ ] Servicio redesplegado (automático al guardar)

---

## ⚠️ NO OLVIDES

Después de desplegar en Render, también debes actualizar en **TikTok Developer Portal**:

1. Ve a: https://developers.tiktok.com/
2. Tu app → Settings
3. Actualiza **Redirect URI** a: `https://subiteya.onrender.com/api/auth/tiktok/callback`
4. Guarda cambios

---

## 🔄 Actualizar Configuración

Si cambias la URL de Render más tarde:

1. Actualiza `TIKTOK_REDIRECT_URI` en Render
2. Actualiza la Redirect URI en TikTok Developer Portal
3. El frontend no necesita cambios (usa la variable de entorno)
