# 📚 Documentación - SubiteYa

## 🚀 Guías de Deploy

# SubiteYa Documentation

Welcome to SubiteYa's technical documentation.

## Table of Contents

1. [Architecture Decision Records (ADRs)](./adr/README.md)
2. [Render Workers Setup](./RENDER_WORKERS_SETUP.md)
3. [Render Workers Quick Start](./RENDER_WORKERS_QUICKSTART.md)
4. [Database Connection Retry System](./DATABASE_CONNECTION_RETRY.md) - Solución a errores de conexión intermitentes

## 🏗️ Arquitectura

Ver carpeta `/docs/adr/` para decisiones de arquitectura (ADRs).

## 📖 Historial

Ver carpeta `/docs/history/` para documentación de implementaciones pasadas.

---

## ✅ Checklist de Producción

### Pre-Deploy

- [ ] Variables de entorno configuradas en Render
- [ ] Base de datos Supabase activa
- [ ] Redis Upstash activo
- [ ] Bucket S3 creado y configurado
- [ ] TikTok OAuth configurado
- [ ] Frontend deployado en GitHub Pages

### Post-Deploy

- [ ] `/health` responde OK
- [ ] `/health/redis` responde OK
- [ ] Workers activos (logs sin errores)
- [ ] Test de subida de video
- [ ] Test de publicación en TikTok

---

## 🐛 Troubleshooting

### Workers no procesan videos

1. Verificar que REDIS_URL sea idéntico en los 3 servicios
2. Verificar logs de workers para errores
3. En plan free, workers se duermen después de 15 min sin actividad

### Out of Memory

1. Edit Worker necesita más RAM (upgrade a plan Starter $7/mes)
2. O reducir `EDIT_WORKER_CONCURRENCY` de 2 a 1

### Database Connection Failed

1. Verificar que `DATABASE_URL` use puerto **6543** (pooler)
2. Verificar que `DIRECT_URL` use puerto **5432** (direct)

### CORS Errors

1. Verificar `ALLOWED_ORIGINS` incluya la URL del frontend
2. En TikTok Developer Console, agregar redirect URI

---

## 📞 Soporte

Para issues o preguntas: [GitHub Issues](https://github.com/MartinPuli/SubiteYa/issues)
