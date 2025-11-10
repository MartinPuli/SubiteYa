# Configuración de ElevenLabs para SubiteYa

## 📋 Resumen

ElevenLabs es un servicio de IA que permite:

- 🎙️ Clonar voces desde muestras de audio
- 🗣️ Generar narración con voces naturales en múltiples idiomas
- 🎬 Agregar narración de IA a tus videos de TikTok

## 🔑 Obtener API Key

### 1. Crear cuenta en ElevenLabs

1. Ve a: https://elevenlabs.io/
2. Haz clic en **"Sign Up"**
3. Completa el registro (puedes usar Google)

### 2. Obtener la API Key

1. Ve a: https://elevenlabs.io/app/settings/api-keys
2. Haz clic en **"Create API Key"**
3. Dale un nombre: **"SubiteYa Production"**
4. Copia la API Key generada

⚠️ **Importante:** La API Key solo se muestra una vez, guárdala en un lugar seguro.

## ⚙️ Configuración Local

### 1. Agregar en `.env`

Edita `packages/api/.env` y agrega:

```bash
# ElevenLabs - Get from https://elevenlabs.io/app/settings/api-keys
# Required for AI voice generation and cloning
ELEVENLABS_API_KEY=tu_api_key_aqui
```

### 2. Reiniciar el servidor

```bash
npm run dev
```

## 🚀 Configuración en Render

Para que funcione en producción:

1. Ve a: https://dashboard.render.com
2. Selecciona tu servicio **subiteya**
3. Ve a **Environment**
4. Haz clic en **"Add Environment Variable"**
5. Agrega:
   - **Key:** `ELEVENLABS_API_KEY`
   - **Value:** `tu_api_key_aqui`
6. Haz clic en **"Save Changes"**
7. Render re-deployará automáticamente

## 📊 Plan y Límites

ElevenLabs ofrece diferentes planes:

### Free Tier

- ✅ 10,000 caracteres/mes
- ✅ Acceso a voces predefinidas
- ✅ Text-to-Speech básico
- ❌ Sin clonación de voz

### Starter ($5/mes)

- ✅ 30,000 caracteres/mes
- ✅ Clonación de voz instantánea
- ✅ Todas las voces
- ✅ Descarga de audio

### Creator ($22/mes)

- ✅ 100,000 caracteres/mes
- ✅ Clonación de voz profesional
- ✅ Sin límite de clonas
- ✅ Audio comercial

**Recomendación:** Comienza con Free tier para pruebas, luego actualiza a Starter para producción.

## 🔊 Endpoints Disponibles

Una vez configurado, tendrás acceso a:

### 1. Listar Voces

```bash
GET /api/elevenlabs/voices
Authorization: Bearer {token}
```

### 2. Clonar Voz

```bash
POST /api/elevenlabs/clone
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "name": "Mi Voz",
  "description": "Voz clonada para narración",
  "files": [audio_file]
}
```

### 3. Generar Audio

```bash
POST /api/elevenlabs/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "text": "Hola, este es un video increíble",
  "voice_id": "21m00Tcm4TlvDq8ikWAM"
}
```

## 🎤 Usar Voces en Videos

1. **Accede a `/voices`** en la app web
2. **Clona tu voz** subiendo un audio de 30-60 segundos
3. **Selecciona la voz** al subir un video
4. El sistema generará automáticamente la narración

## 🌍 Voces Predefinidas por Idioma

El sistema incluye voces curadas para cada idioma:

- **Español:** Rachel (ES) - Voz clara y profesional
- **Inglés:** Adam (EN) - Voz profunda estilo documental
- **Portugués:** Sam (PT-BR) - Voz brasileña natural
- **Francés:** Charlotte (FR)
- **Alemán:** Elli (DE)
- **Italiano:** Thomas (IT)
- **Japonés:** Yuki (JA)
- **Chino:** Matilda (ZH)

## 🐛 Troubleshooting

### Error: "ELEVENLABS_API_KEY not configured"

**Solución:** Verifica que agregaste la variable de entorno correctamente y reiniciaste el servidor.

### Error: "401 Unauthorized"

**Solución:** Tu API Key es inválida o expiró. Genera una nueva en ElevenLabs.

### Error: "429 Too Many Requests"

**Solución:** Alcanzaste el límite de caracteres del mes. Espera al próximo ciclo o actualiza tu plan.

### Error: "Failed to clone voice"

**Solución:**

- El audio debe ser claro y sin ruido de fondo
- Duración mínima: 30 segundos
- Formatos soportados: MP3, WAV, OGG, WEBM, M4A

## 📝 Notas Importantes

1. **Calidad del Audio:** Para mejores resultados al clonar:
   - Usa audio limpio sin ruido de fondo
   - Habla de forma natural y clara
   - Graba al menos 1 minuto de audio variado

2. **Costos:** Cada vez que generas audio se descuentan caracteres de tu cuota mensual. Ejemplo:
   - "Hola mundo" = 10 caracteres
   - Un script de 1 minuto ≈ 150 palabras ≈ 750 caracteres

3. **Latencia:** Generar audio toma 1-3 segundos dependiendo de la longitud del texto.

4. **Idiomas:** ElevenLabs soporta 29 idiomas. El modelo `eleven_multilingual_v2` detecta automáticamente el idioma.

## 🔗 Links Útiles

- Dashboard: https://elevenlabs.io/app
- API Keys: https://elevenlabs.io/app/settings/api-keys
- Documentación: https://elevenlabs.io/docs
- Voice Library: https://elevenlabs.io/voice-library
- Pricing: https://elevenlabs.io/pricing

## ✅ Checklist de Configuración

- [ ] Cuenta creada en ElevenLabs
- [ ] API Key generada
- [ ] Variable `ELEVENLABS_API_KEY` agregada en `.env` local
- [ ] Variable `ELEVENLABS_API_KEY` agregada en Render
- [ ] Servidor reiniciado
- [ ] Probado endpoint GET `/api/elevenlabs/voices`
- [ ] Accedido a `/voices` en el frontend
- [ ] Clonada primera voz (opcional)
- [ ] Generado primer audio de prueba

## 🎯 Próximos Pasos

Una vez configurado ElevenLabs:

1. **Prueba las voces predefinidas** en `/voices`
2. **Clona tu propia voz** para personalización
3. **Sube un video** y agrega narración con IA
4. **Ajusta la configuración** de voz (estabilidad, similitud)
5. **Monitorea tu uso** en el dashboard de ElevenLabs

---

**¿Problemas?** Revisa la consola del backend para logs detallados de errores de ElevenLabs.
