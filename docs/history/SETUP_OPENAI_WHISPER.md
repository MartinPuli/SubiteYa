# 🎙️ Guía de Configuración: OpenAI Whisper

## Resumen

Esta guía te ayudará a configurar OpenAI Whisper para la generación automática de subtítulos en SubiteYa.

## ¿Qué es Whisper?

Whisper es el modelo de reconocimiento de voz (speech-to-text) de OpenAI que convierte audio a texto con alta precisión. Soporta más de 50 idiomas y es ideal para generar subtítulos automáticamente.

## Requisitos Previos

- Cuenta de OpenAI (https://platform.openai.com)
- Créditos o método de pago configurado en OpenAI
- Acceso a las variables de entorno del servidor

## Paso 1: Obtener API Key de OpenAI

1. **Crear cuenta en OpenAI**
   - Ve a https://platform.openai.com/signup
   - Completa el registro con tu email

2. **Agregar método de pago**
   - Ve a https://platform.openai.com/account/billing
   - Agrega una tarjeta de crédito/débito
   - OpenAI cobra por uso: ~$0.006 por minuto de audio

3. **Generar API Key**
   - Ve a https://platform.openai.com/api-keys
   - Haz clic en "Create new secret key"
   - Dale un nombre descriptivo: `SubiteYa-Whisper`
   - **Copia la key inmediatamente** (solo se muestra una vez)
   - Ejemplo: `sk-proj-abc123...xyz789`

## Paso 2: Configurar Variable de Entorno

### Opción A: Desarrollo Local

1. Edita el archivo `.env` en `packages/api/`
2. Agrega la línea:
   ```bash
   OPENAI_API_KEY=sk-proj-tu-key-aqui
   ```
3. Reinicia el servidor

### Opción B: Producción (Render.com)

1. Ve al dashboard de Render: https://dashboard.render.com
2. Selecciona tu servicio backend
3. Ve a la pestaña "Environment"
4. Agrega nueva variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-tu-key-aqui`
5. Guarda y espera el redeploy automático

## Paso 3: Verificar Configuración

1. **Reinicia el servidor backend**

   ```bash
   cd packages/api
   npm run dev
   ```

2. **Verifica los logs al iniciar**
   - Si la key está configurada: No verás warnings
   - Si falta la key: Verás `⚠ OPENAI_API_KEY not configured`

3. **Prueba con un video**
   - Crea un patrón con subtítulos habilitados
   - Sube un video con audio claro
   - Verifica en logs: `Transcribing audio with Whisper...`

## Funcionamiento Técnico

### Flujo de Procesamiento

```
Video con audio
    ↓
1. Extraer audio con FFmpeg
   → Genera archivo_audio.mp3
    ↓
2. Enviar a Whisper API
   → POST https://api.openai.com/v1/audio/transcriptions
   → Model: whisper-1
   → Response: JSON con timestamps y texto
    ↓
3. Convertir a SubtitleSegment[]
   → { start: 0, end: 2.5, text: "Hola mundo" }
    ↓
4. Generar archivo SRT
   → Formato estándar de subtítulos
    ↓
5. Quemar subtítulos en video
   → FFmpeg aplica estilos y posición
    ↓
Video final con subtítulos
```

### Código Implementado

```typescript
// packages/api/src/lib/video-processor.ts

// 1. Extraer audio del video
const audioPath = await extractAudioFromVideo(videoPath);

// 2. Transcribir con Whisper
const transcription = await openai.audio.transcriptions.create({
  file: fs.createReadStream(audioPath),
  model: 'whisper-1',
  response_format: 'verbose_json',
  timestamp_granularities: ['segment'],
});

// 3. Procesar segmentos
const subtitles = transcription.segments.map(segment => ({
  start: segment.start,
  end: segment.end,
  text: segment.text.trim(),
}));
```

## Costos y Límites

### Precios de Whisper API (2025)

- **$0.006 por minuto** de audio
- Ejemplos:
  - Video de 30 segundos: $0.003 (0.3 centavos)
  - Video de 1 minuto: $0.006 (0.6 centavos)
  - Video de 5 minutos: $0.030 (3 centavos)
  - 1000 videos de 1 minuto: $6 USD

### Límites de Tamaño

- Tamaño máximo de archivo: **25 MB**
- Formatos soportados: MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM
- Si tu video excede 25MB, el audio extraído generalmente será menor

### Rate Limits

- **50 requests por minuto** (plan gratuito)
- **3,000 requests por minuto** (plan de pago)
- Para SubiteYa esto es más que suficiente

## Modo Fallback (Sin API Key)

Si **NO** configuras `OPENAI_API_KEY`, el sistema:

1. Detecta que falta la key
2. Muestra advertencia en logs
3. Usa subtítulos mock de prueba
4. El video se procesa igual (con subtítulos de ejemplo)

**Esto es útil para:**

- Desarrollo local sin gastar créditos
- Demos y pruebas de UI
- Ambientes de staging

## Idiomas Soportados

Whisper soporta **57+ idiomas**, incluyendo:

- ✅ Español (Spain, Mexico, Argentina, etc.)
- ✅ Inglés
- ✅ Portugués
- ✅ Francés
- ✅ Alemán
- ✅ Italiano
- ✅ Japonés
- ✅ Coreano
- ✅ Chino

El idioma se detecta **automáticamente**, no necesitas especificarlo.

## Mejores Prácticas

### 1. Audio de Calidad

- ✅ Audio claro sin mucho ruido de fondo
- ✅ Voz bien pronunciada
- ✅ Volumen adecuado
- ❌ Evita música muy alta que tape la voz

### 2. Duración Óptima

- ✅ Videos de 15 segundos a 5 minutos: Excelente
- ⚠️ Videos de 5-10 minutos: Bueno, tarda más
- ❌ Videos +10 minutos: Considera dividir en partes

### 3. Seguridad de la API Key

- ✅ **NUNCA** hagas commit de la API key en Git
- ✅ Usa variables de entorno
- ✅ Rota la key cada 3-6 meses
- ✅ Monitorea uso en OpenAI Dashboard

### 4. Monitoreo de Uso

- Revisa tu dashboard: https://platform.openai.com/usage
- Configura alertas de billing
- Establece límites mensuales

## Troubleshooting

### Error: "Invalid API Key"

**Causa**: API key incorrecta o expirada
**Solución**:

1. Verifica que copiaste la key completa
2. Genera una nueva key en OpenAI
3. Actualiza la variable de entorno
4. Reinicia el servidor

### Error: "Insufficient quota"

**Causa**: No tienes créditos o método de pago
**Solución**:

1. Ve a https://platform.openai.com/account/billing
2. Agrega método de pago
3. Espera 5 minutos y reintenta

### Error: "File too large"

**Causa**: El audio extraído supera 25MB
**Solución**:

1. Reduce la calidad del audio en FFmpeg
2. Divide el video en partes más cortas
3. Comprime el video antes de subirlo

### Subtítulos No Se Generan

**Diagnóstico**:

1. Revisa logs del servidor: `npm run dev`
2. Busca mensajes de error de Whisper
3. Verifica que el video tenga audio

**Soluciones comunes**:

- Si ves "OPENAI_API_KEY not configured": Agrega la key
- Si ves "Error extracting audio": El video no tiene audio
- Si ves "Falling back to mock": Whisper falló, revisa la key

## Testing

### Probar con Audio de Ejemplo

1. **Grabate un video de 30 segundos**
   - Di algo claro en español
   - Ejemplo: "Hola, este es un video de prueba para los subtítulos automáticos de SubiteYa"

2. **Sube el video en SubiteYa**
   - Crea un patrón con subtítulos habilitados
   - Elige estilo: Modern
   - Posición: Bottom
   - Color: Blanco (#FFFFFF)

3. **Verifica los logs**

   ```bash
   Generating subtitles for: /tmp/video123.mp4
   Extracting audio from video...
   Audio extracted successfully
   Transcribing audio with Whisper...
   ✓ Generated 3 subtitle segments
   Burning subtitles into video...
   Subtitles burned successfully
   ```

4. **Revisa el video final**
   - Los subtítulos deben aparecer sincronizados
   - El texto debe ser preciso
   - El estilo debe aplicarse correctamente

## Alternativas a Whisper

Si no quieres usar OpenAI Whisper, puedes integrar:

### 1. Whisper Local (Self-hosted)

- **Pros**: Gratis, privado, sin límites
- **Contras**: Requiere GPU, más lento, más complejo

### 2. Google Cloud Speech-to-Text

- **Pros**: Buena precisión, muchos idiomas
- **Contras**: Similar en precio, más setup

### 3. AWS Transcribe

- **Pros**: Integración con AWS, escalable
- **Contras**: Más caro que Whisper

## Recursos Adicionales

- **Documentación Whisper**: https://platform.openai.com/docs/guides/speech-to-text
- **Pricing**: https://openai.com/pricing
- **OpenAI Status**: https://status.openai.com
- **API Reference**: https://platform.openai.com/docs/api-reference/audio

## Resumen de Pasos

1. ✅ Instalar paquete `openai` (ya instalado)
2. ✅ Crear cuenta en OpenAI
3. ✅ Generar API key
4. ✅ Configurar `OPENAI_API_KEY` en .env
5. ✅ Reiniciar servidor
6. ✅ Probar con video de prueba

---

**¿Necesitas ayuda?** Revisa los logs del servidor o consulta la documentación de OpenAI.
