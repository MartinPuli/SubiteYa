# Troubleshooting: Clonación de Voz en ElevenLabs

## Error: "There was an error parsing the body"

### Causa

Este error ocurría porque el paquete `form-data` enviaba buffers de audio directamente, lo cual causaba problemas con la API de ElevenLabs.

### Solución Aplicada

Se cambió la implementación para usar **file streams** en lugar de buffers:

```typescript
// ❌ ANTES (causaba error)
const audioBuffer = fs.readFileSync(fileInfo.path);
formData.append('files', audioBuffer, {...});

// ✅ DESPUÉS (correcto)
const fileStream = fs.createReadStream(fileInfo.path);
formData.append('files', fileStream, {
  filename,
  contentType: fileInfo.mimetype,
  knownLength: fs.statSync(fileInfo.path).size,
});
```

## Requisitos de Audio para Clonación

### Formato de Audio

✅ **Formatos soportados:**

- MP3 (recomendado)
- WAV
- OGG
- WEBM (grabaciones del navegador)
- M4A
- MP4 (audio)

### Calidad del Audio

Para mejores resultados:

- **Duración:** 30 segundos a 3 minutos por archivo
- **Tamaño:** Máximo 10MB por archivo
- **Calidad:** Sin ruido de fondo
- **Contenido:** Habla clara y natural
- **Cantidad:** 1-25 archivos (más archivos = mejor clonación)

### Recomendaciones para Grabar

1. **Ambiente:**
   - Lugar silencioso sin eco
   - Sin música de fondo
   - Sin ruido de tráfico, ventiladores, etc.

2. **Micrófono:**
   - Usa un micrófono de calidad (auriculares con micrófono funcionan bien)
   - Mantén distancia constante del micrófono
   - Evita tocar el micrófono durante la grabación

3. **Contenido:**
   - Lee un texto variado (no solo "hola, hola, hola")
   - Incluye diferentes emociones y tonos
   - Habla a velocidad normal, no muy rápido ni muy lento
   - Pronuncia claramente

4. **Duración:**
   - **Mínimo:** 30 segundos
   - **Óptimo:** 1-2 minutos
   - **Máximo por archivo:** 3 minutos

## Cómo Probar la Clonación

### Desde el Frontend

1. Ve a: https://subite-ya-web.vercel.app/voices
2. Haz clic en **"Clonar Nueva Voz"**
3. Sube un archivo de audio (MP3, WAV, etc.)
4. Ingresa un nombre para la voz
5. (Opcional) Agrega una descripción
6. Haz clic en **"Clonar Voz"**
7. Espera 10-30 segundos

### Usando la API Directamente

```bash
# 1. Obtén tu token de autenticación
TOKEN="tu_jwt_token_aqui"

# 2. Clona la voz
curl -X POST https://subiteya-1.onrender.com/api/elevenlabs/clone \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Mi Voz" \
  -F "description=Voz clonada para narración" \
  -F "files=@/path/to/audio.mp3"

# Respuesta exitosa:
# {
#   "success": true,
#   "voice": {
#     "voice_id": "xyz123...",
#     "name": "Mi Voz",
#     "category": "cloned"
#   },
#   "message": "Voice cloned successfully"
# }
```

## Errores Comunes

### 1. "Invalid file type"

**Problema:** El archivo no es un formato de audio válido
**Solución:** Usa MP3, WAV, OGG, o WEBM

### 2. "File too large"

**Problema:** El archivo supera 10MB
**Solución:** Comprime el audio o reduce la duración

### 3. "At least one audio file is required"

**Problema:** No se envió ningún archivo
**Solución:** Verifica que el campo se llame `files` en el form-data

### 4. "ELEVENLABS_API_KEY not configured"

**Problema:** Falta la API Key en variables de entorno
**Solución:** Agrega `ELEVENLABS_API_KEY` en Render

### 5. "401 Unauthorized" desde ElevenLabs

**Problema:** API Key inválida o expirada
**Solución:** Verifica tu API Key en https://elevenlabs.io/app/settings/api-keys

### 6. "429 Too Many Requests"

**Problema:** Límite de caracteres alcanzado
**Solución:** Espera al próximo ciclo o actualiza tu plan

### 7. "422 Unprocessable Entity"

**Problema:** El audio no cumple requisitos de calidad
**Solución:**

- Verifica que el audio sea claro
- Asegúrate que tenga al menos 30 segundos
- Re-graba en un lugar más silencioso

## Verificar el Deploy

Después de que Render termine el deploy (2-3 minutos):

```bash
# Verificar que el servicio esté corriendo
curl https://subiteya-1.onrender.com/api/health

# Deberías ver: {"status":"ok",...}
```

## Logs Útiles

Para diagnosticar problemas, revisa los logs en Render:

```
# Logs exitosos de clonación:
📥 Clone request body: { name: 'Mi Voz', description: '...' }
📁 Files received: [ { originalname: 'audio.mp3', mimetype: 'audio/mpeg', size: 512000 } ]
✅ Voice cloned successfully

# Logs de error:
❌ Multer error: File too large
❌ Error cloning voice: ElevenLabs voice cloning error: 422 - {...}
```

## Planes de ElevenLabs y Límites de Clonación

| Plan          | Caracteres/mes | Voces Clonadas    | Calidad     |
| ------------- | -------------- | ----------------- | ----------- |
| Free          | 10,000         | 0 (sin clonación) | Básica      |
| Starter ($5)  | 30,000         | 10 voces          | Instantánea |
| Creator ($22) | 100,000        | Ilimitadas        | Profesional |
| Pro ($99)     | 500,000        | Ilimitadas        | Premium     |

**Nota:** Para usar la clonación de voz necesitas al menos el plan **Starter**.

## Próximos Pasos

Una vez que la voz esté clonada:

1. **Selecciona la voz** en el editor de patrones
2. **Sube un video**
3. **El sistema genera automáticamente** la narración con tu voz
4. **El worker procesa** el video agregando el audio
5. **Publica en TikTok** con tu voz personalizada

---

**¿Problema no resuelto?**

- Revisa los logs del servicio en Render
- Verifica que tu plan de ElevenLabs soporte clonación
- Asegúrate de que el audio cumpla todos los requisitos
