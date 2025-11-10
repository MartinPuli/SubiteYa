# ⚡ Configuración Rápida de Workers en Render

## 📝 Paso 1: Crear Edit Worker

1. En Render Dashboard, click **"+ New service"**
2. Selecciona **"Background Worker"**
3. Completa estos campos:

```
Name: subite-ya-edit-worker
Language: Docker
Branch: main
Region: Oregon (US West)

Dockerfile Path: ./Dockerfile
Docker Context: .
Docker Command: npm run worker:edit -w @subiteya/api
```

4. **Environment Variables** (copiar del archivo RENDER_ENV_VARS.md - líneas 7-19)

5. Click **"Create Background Worker"**

---

## 📝 Paso 2: Crear Upload Worker

1. Click **"+ New service"** de nuevo
2. Selecciona **"Background Worker"**
3. Completa estos campos:

```
Name: subite-ya-upload-worker
Language: Docker
Branch: main
Region: Oregon (US West)

Dockerfile Path: ./Dockerfile
Docker Context: .
Docker Command: npm run worker:upload -w @subiteya/api
```

4. **Environment Variables** (copiar del archivo RENDER_ENV_VARS.md - líneas 7-19 + 37-39)

5. Click **"Create Background Worker"**

---

## ✅ Verificación (en 10 minutos)

### 1. Verificar Estados

Los 3 servicios deben estar **Live** (🟢):

- `subiteya` (Web Service)
- `subite-ya-edit-worker` (Background Worker)
- `subite-ya-upload-worker` (Background Worker)

### 2. Verificar Logs

**Edit Worker** debe mostrar:

```
🎬 Starting Edit Worker (standalone)...
[Edit Worker] Started with concurrency 2
```

**Upload Worker** debe mostrar:

```
📤 Starting Upload Worker (standalone)...
[Upload Worker] Started with concurrency 1
```

### 3. Probar Video

1. Sube un video desde el frontend
2. Confirmalo
3. En ~30-60 segundos debería pasar de `EDITING_QUEUED` → `EDITING` → `EDITED`

---

## 🎯 ¿Listo para Producción?

- [ ] 3 servicios en estado "Live"
- [ ] Logs sin errores
- [ ] Test de video procesado exitosamente
- [ ] BORRAR archivo RENDER_ENV_VARS.md (contiene secrets)

```bash
rm RENDER_ENV_VARS.md
```

---

## 💰 Costos

- **Plan Free**: $0/mes (workers se duermen después de 15 min sin actividad)
- **Recomendado**: Upgrade Edit Worker a Starter ($7/mes) para mejor performance
