# 🎙️ Voice Narration Feature - ElevenLabs Integration

## Descripción General

Esta funcionalidad permite agregar **narración de voz profesional con IA** a tus videos usando **ElevenLabs**. La voz narradora puede:

- 🌍 **Traducir** el contenido del video a cualquier idioma
- 🎬 **Narrar** con estilo profesional (tipo National Geographic)
- 🗣️ **Usar voces personalizadas** o clonadas del usuario
- 🎚️ **Ajustar volúmenes** automáticamente entre voz narrador y audio original

## Cómo Funciona

### Flujo Automático

1. **Transcripción**: El audio del video se extrae y transcribe con Whisper AI
2. **Traducción**: El contenido se traduce al idioma seleccionado con GPT-4
3. **Generación de Script**: Se crea un guion profesional según el estilo elegido
4. **Síntesis de Voz**: ElevenLabs genera la narración con la voz seleccionada
5. **Mezcla de Audio**: FFmpeg combina la voz con el video, ajustando volúmenes

### Estilos de Narración Disponibles

- **🎬 Documental (National Geographic)**: Voz grave y autorizada, perfecta para naturaleza y viajes
- **📚 Educativo**: Tono claro y explicativo, ideal para tutoriales
- **📰 Noticias**: Voz profesional y neutral, similar a noticieros
- **📖 Narrativo**: Narración emotiva, perfecta para historias
- **😊 Casual**: Tono conversacional y amigable, ideal para vlogs
- **💼 Profesional**: Voz seria y confiable, corporativo

## Configuración

### 1. Obtener API Key de ElevenLabs

1. Crea una cuenta en [ElevenLabs](https://elevenlabs.io/)
2. Ve a tu perfil → API Keys
3. Copia tu API key

### 2. Configurar Variables de Entorno

Agrega tu API key al archivo `.env` del backend:

```env
ELEVENLABS_API_KEY=tu_api_key_aqui
```

### 3. Actualizar Base de Datos

Ejecuta la migración de Prisma para agregar los nuevos campos:

```bash
cd packages/api
npx prisma migrate dev --name add_voice_narration
```

## Uso en la Interfaz

### Crear Patrón con Narración

1. Ve a **Patrones** → **Nuevo Patrón**
2. Configura logo, efectos, etc. como siempre
3. Ve a la pestaña **"🎙️ Voz IA"**
4. Activa **"Habilitar Narración con IA"**
5. Configura:
   - **Idioma**: Español, Inglés, Portugués, etc.
   - **Voz**: Selecciona de las voces disponibles de ElevenLabs
   - **Estilo**: Documentary, Educational, News, etc.
   - **Volumen de Narración**: 0-100%
   - **Velocidad**: 0.5x - 2.0x
   - **Volumen de Audio Original**: 0-100% (recomendado: 30%)
6. Guarda el patrón

### Subir Video con Narración

1. Ve a **Subir Video**
2. Selecciona tus archivos de video
3. **Selecciona el patrón** que tiene narración habilitada
4. Selecciona las cuentas donde publicar
5. Click en **"Subir Videos"**

El sistema automáticamente:

- Procesará el video
- Generará la narración
- Mezclará el audio
- Publicará en las plataformas seleccionadas

## API Endpoints

### Listar Voces Disponibles

```http
GET /api/elevenlabs/voices
Authorization: Bearer {token}
```

Respuesta:

```json
{
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "category": "premade"
    }
  ]
}
```

### Clonar Voz del Usuario

```http
POST /api/elevenlabs/clone
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "name": "Mi Voz",
  "description": "Voz clonada para narración",
  "files": [audio1.mp3, audio2.mp3]
}
```

### Generar Audio de Prueba

```http
POST /api/elevenlabs/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "text": "Texto a narrar",
  "voice_id": "21m00Tcm4TlvDq8ikWAM",
  "model_id": "eleven_multilingual_v2"
}
```

## Schema de Base de Datos

Nuevos campos en `BrandPattern`:

```prisma
model BrandPattern {
  // ... campos existentes ...

  // Voice Narration (ElevenLabs)
  enable_voice_narration Boolean  @default(false)
  narration_language     String?  // 'es', 'en', 'pt', 'fr', etc.
  narration_voice_id     String?  // ElevenLabs voice ID
  narration_style        String?  // 'documentary', 'educational', etc.
  narration_volume       Int      @default(80)   // 0-100
  narration_speed        Float    @default(1.0)  // 0.5-2.0
  original_audio_volume  Int      @default(30)   // 0-100
}
```

## Arquitectura de Procesamiento

### Worker de Edición (`edit-worker-bullmq.ts`)

El worker detecta si un patrón tiene narración habilitada:

```typescript
if (pattern.enable_voice_narration) {
  // 1. Extraer audio del video
  const audioPath = await extractAudio(videoPath);

  // 2. Transcribir con Whisper
  const transcription = await whisperTranscribe(audioPath);

  // 3. Traducir y generar script con GPT-4
  const script = await generateNarrationScript(
    transcription,
    pattern.narration_language,
    pattern.narration_style
  );

  // 4. Generar voz con ElevenLabs
  const narrationAudio = await elevenlabs.generateSpeech({
    text: script,
    voice_id: pattern.narration_voice_id,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  });

  // 5. Mezclar audios con FFmpeg
  await mixAudioWithVideo(
    videoPath,
    narrationAudio,
    pattern.narration_volume,
    pattern.original_audio_volume
  );
}
```

## Costos y Límites

### ElevenLabs Pricing

- **Free Tier**: 10,000 caracteres/mes
- **Starter**: $5/mes - 30,000 caracteres
- **Creator**: $22/mes - 100,000 caracteres
- **Pro**: $99/mes - 500,000 caracteres

### Optimización de Uso

- Los scripts se generan de forma concisa
- Se usa el modelo multilingual v2 (mejor calidad/costo)
- Se cachean voces clonadas para reutilizar

## Mejores Prácticas

### Para Mejores Resultados

1. **Usa videos con contenido claro**: Mejor audio original = mejor transcripción
2. **Define bien el estilo**: Cada estilo genera diferentes tipos de guiones
3. **Ajusta el volumen del audio original**: Recomendado 20-30% cuando hay narración
4. **Prueba diferentes voces**: Cada voz tiene características únicas
5. **Velocidad de narración**: 1.0x es lo más natural, ajusta solo si es necesario

### Debugging

Si la narración no se genera:

1. Verifica que `ELEVENLABS_API_KEY` esté configurada
2. Revisa los logs del worker: `docker logs subiteya-edit-worker`
3. Verifica que Whisper esté funcionando
4. Comprueba que el patrón tenga `enable_voice_narration = true`

## Roadmap

- [ ] Soporte para múltiples narradores (diálogo)
- [ ] Ajuste automático de timing de la narración con el video
- [ ] Efectos de audio (reverb, equalizer)
- [ ] Previsualización de narración antes de procesar
- [ ] Clonación de voz directamente desde la interfaz
- [ ] Soporte para más idiomas (árabe, ruso, turco)

## Contribuir

Para agregar nuevos estilos de narración:

1. Edita `PatternEditorPage.tsx` → sección de estilos
2. Agrega el nuevo estilo al array de opciones
3. Crea el prompt correspondiente en el worker
4. Actualiza esta documentación

## Soporte

Si tienes problemas:

1. Revisa los logs del backend
2. Verifica la configuración de ElevenLabs
3. Abre un issue en GitHub con:
   - Descripción del problema
   - Logs del worker
   - Configuración del patrón utilizado

---

**Desarrollado con ❤️ por el equipo de SubiteYa**
