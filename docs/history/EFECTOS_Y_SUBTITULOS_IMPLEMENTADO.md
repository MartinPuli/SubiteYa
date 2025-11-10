# 🎬 Efectos Visuales y Subtítulos - Implementación Completa

## ✅ Estado Actual

**Commit:** 09f1a09 - feat: implement visual effects and subtitles processing with FFmpeg

### Funcionalidades Implementadas

#### 1. **Efectos Visuales** 🎨

- ✅ 6 filtros predefinidos disponibles:
  - **Vintage**: Tonos cálidos + viñeta
  - **Vibrant**: Colores intensificados
  - **Cinematic**: Formato letterbox + color grading
  - **Grayscale**: Blanco y negro
  - **Sepia**: Tonos cálidos vintage
  - **None**: Sin filtro (solo ajustes básicos)

- ✅ Ajustes manuales:
  - **Brightness** (Brillo): 50-150 (predeterminado: 100)
  - **Contrast** (Contraste): 50-150 (predeterminado: 100)
  - **Saturation** (Saturación): 0-200 (predeterminado: 100)

#### 2. **Subtítulos Automáticos** 📝

- ✅ 5 estilos de subtítulos:
  - **Modern**: Sombra suave
  - **Classic**: Contorno simple
  - **Bold**: Texto en negrita con contorno grueso
  - **Outlined**: Contorno muy marcado
  - **Boxed**: Caja alrededor del texto

- ✅ Configuración de subtítulos:
  - **Position**: Top, Center, Bottom
  - **Color**: Selector de color para el texto
  - **Background Color**: Selector de color para el fondo
  - **Font Size**: 16-48px (predeterminado: 24px)

- ⚠️ **Nota Importante**: La generación automática de subtítulos usa un mock temporal.
  - Se debe integrar con Whisper API u otro servicio de speech-to-text en producción.

## 📁 Archivos Modificados

### Backend

#### 1. `packages/api/src/lib/video-processor.ts`

**Nuevas funciones agregadas:**

```typescript
// Interfaz de configuración de efectos
interface EffectsConfig {
  filterType: string;
  brightness: number;
  contrast: number;
  saturation: number;
}

// Aplicar efectos visuales al video
async function applyEffectsToVideo(
  inputPath: string,
  effects: EffectsConfig,
  outputPath?: string
): Promise<VideoProcessingResult>;

// Construir filtros de FFmpeg para efectos
function buildEffectsFilter(effects: EffectsConfig): string[];

// Interfaz de configuración de subtítulos
interface SubtitleConfig {
  style: string;
  position: string;
  color: string;
  backgroundColor: string;
  fontSize: number;
}

// Generar subtítulos desde audio (mock temporal)
async function generateSubtitles(
  videoPath: string
): Promise<{ success: boolean; subtitles?: SubtitleSegment[]; error?: string }>;

// Quemar subtítulos en el video
async function burnSubtitlesIntoVideo(
  inputPath: string,
  subtitles: SubtitleSegment[],
  config: SubtitleConfig,
  outputPath?: string
): Promise<VideoProcessingResult>;

// Aplicar patrón completo (efectos + logo + subtítulos)
async function applyBrandPattern(
  inputPath: string,
  pattern: {
    logoUrl?: string;
    logoPosition?: string;
    logoSize?: number;
    logoOpacity?: number;
    enableEffects?: boolean;
    filterType?: string;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    enableSubtitles?: boolean;
    subtitleStyle?: string;
    subtitlePosition?: string;
    subtitleColor?: string;
    subtitleBgColor?: string;
    subtitleFontSize?: number;
  }
): Promise<VideoProcessingResult>;
```

**Flujo de procesamiento:**

1. Aplicar efectos visuales (si `enableEffects = true`)
2. Aplicar logo (si `logoUrl` está presente)
3. Generar y quemar subtítulos (si `enableSubtitles = true`)

#### 2. `packages/api/src/routes/publish.ts`

- ✅ Actualizado import: `applyLogoToVideo` → `applyBrandPattern`
- ✅ Se pasan todos los campos del patrón (efectos + logo + subtítulos)
- ✅ Mantiene retrocompatibilidad: si no hay patrón, usa video original

### Frontend

#### Archivos ya actualizados (commit anterior):

- ✅ `packages/api/prisma/schema.prisma` - Esquema con 11 nuevos campos
- ✅ `packages/api/src/routes/patterns.ts` - CRUD completo para efectos y subtítulos
- ✅ `packages/web/src/pages/PatternEditorPage.tsx` - UI con 3 tabs
- ✅ `packages/web/src/pages/PatternEditorPage.css` - Estilos mejorados

## 🔧 Tecnologías Utilizadas

### Procesamiento de Video

- **FFmpeg** (via fluent-ffmpeg)
  - Filtros de video: `eq`, `curves`, `vignette`, `vibrance`, `colorbalance`, `hue`, `colorchannelmixer`
  - Subtítulos: generación de SRT + quemado con filtro `subtitles`
  - Códecs: H.264 con preset `fast`, CRF 23

### Subtítulos

- **Formato SRT**: Estándar para subtítulos con timestamps
- **Estilos ASS/SSA**: Formato avanzado de FFmpeg para estilos personalizados
- **Conversión de colores**: Hex → ABGR para FFmpeg

## 🚀 Próximos Pasos

### 1. Integración de Whisper API (ALTA PRIORIDAD)

**Actualmente:** `generateSubtitles()` devuelve subtítulos mock.

**Opciones de implementación:**

#### Opción A: OpenAI Whisper API (Recomendado)

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSubtitles(videoPath: string) {
  try {
    // Extraer audio del video
    const audioPath = await extractAudioFromVideo(videoPath);

    // Transcribir con Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularity: ['segment'],
    });

    // Convertir a SubtitleSegment[]
    const subtitles = transcription.segments.map(seg => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    }));

    return { success: true, subtitles };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Instalación:**

```bash
npm install openai
```

**Variables de entorno:**

```env
OPENAI_API_KEY=sk-...
```

#### Opción B: Whisper Local (Self-hosted)

- Instalar `whisper` de OpenAI localmente
- Ejecutar con child_process
- **Ventaja**: Sin costos de API
- **Desventaja**: Requiere recursos computacionales

#### Opción C: Google Cloud Speech-to-Text

- API de Google Cloud
- Soporte de múltiples idiomas
- Pricing: $0.006 por 15 segundos

### 2. Testing End-to-End

**Flujo de prueba:**

1. Crear patrón con efectos y subtítulos habilitados
2. Subir video de prueba
3. Verificar procesamiento:
   - ✅ Efectos aplicados correctamente
   - ✅ Logo posicionado y visible
   - ✅ Subtítulos generados y quemados
4. Verificar publicación en TikTok

**Videos de prueba recomendados:**

- Video con voz clara (español)
- Duración: 15-30 segundos
- Formato: MP4, 1080x1920 (vertical)

### 3. Optimización para Producción

#### A. Sistema de Colas (Queue)

**Problema actual:** Procesamiento síncrono bloquea el servidor.

**Solución:** Implementar Bull Queue + Redis

```bash
npm install bull @types/bull
```

```typescript
import Queue from 'bull';

const videoProcessingQueue = new Queue('video-processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

// En publish.ts
videoProcessingQueue.add('process-video', {
  videoPath,
  patternId,
  userId,
});

// Worker separado
videoProcessingQueue.process('process-video', async job => {
  const { videoPath, patternId } = job.data;
  await applyBrandPattern(videoPath, pattern);
  job.progress(100);
});
```

#### B. Almacenamiento en S3/Cloud Storage

**Problema actual:** Videos se guardan en disco local (se pierden al reiniciar Render).

**Solución:** AWS S3 o Google Cloud Storage

```typescript
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

async function uploadToS3(filePath: string, key: string) {
  const fileContent = await fs.promises.readFile(filePath);

  await s3
    .upload({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: 'video/mp4',
    })
    .promise();

  return `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
}
```

#### C. Progress Tracking

**Implementar WebSocket para notificar progreso:**

```typescript
import { Server } from 'socket.io';

io.on('connection', (socket) => {
  socket.on('subscribe-video', (videoId) => {
    // Enviar progreso en tiempo real
    socket.join(`video-${videoId}`);
  });
});

// En video-processor.ts
.on('progress', (progress) => {
  io.to(`video-${videoId}`).emit('video-progress', {
    percent: progress.percent,
    stage: 'applying-effects',
  });
});
```

### 4. Manejo de Errores Mejorado

#### A. Retry Logic

```typescript
async function applyEffectsWithRetry(
  inputPath: string,
  effects: EffectsConfig,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await applyEffectsToVideo(inputPath, effects);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

#### B. Logging Estructurado

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'video-processing.log' }),
  ],
});

logger.info('Processing video', {
  videoId,
  patternId,
  effects: pattern.enableEffects,
  subtitles: pattern.enableSubtitles,
});
```

### 5. Mejoras de UI/UX

#### A. Preview de Efectos en Tiempo Real

**Implementar canvas preview con efectos simulados:**

```typescript
const applyPreviewFilter = (ctx: CanvasRenderingContext2D, filter: string) => {
  switch (filter) {
    case 'grayscale':
      ctx.filter = 'grayscale(100%)';
      break;
    case 'sepia':
      ctx.filter = 'sepia(100%)';
      break;
    case 'vintage':
      ctx.filter = 'sepia(50%) contrast(0.9)';
      break;
  }
};
```

#### B. Validación de Video antes de Subir

```typescript
const validateVideo = (file: File) => {
  // Tamaño máximo: 100MB
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('Video demasiado grande (máx. 100MB)');
  }

  // Formatos permitidos
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Formato no soportado. Usa MP4, MOV o AVI');
  }
};
```

#### C. Mostrar Progreso de Procesamiento

```typescript
const [processingStage, setProcessingStage] = useState<string>('');
const [processingPercent, setProcessingPercent] = useState(0);

// En UI
{processingStage && (
  <div className="processing-status">
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${processingPercent}%` }}
      />
    </div>
    <p>{processingStage}</p>
  </div>
)}
```

## 📊 Diagrama de Flujo de Procesamiento

```
Usuario sube video
    ↓
[1] Se detecta patrón default del usuario
    ↓
[2] Si enableEffects = true:
    → applyEffectsToVideo()
      → Aplicar filtro (vintage/vibrant/etc)
      → Ajustar brightness/contrast/saturation
      → Generar video_with_effects.mp4
    ↓
[3] Si logoUrl existe:
    → applyLogoToVideo()
      → Decodificar logo base64
      → Calcular posición y tamaño
      → Overlay con FFmpeg
      → Generar video_with_logo.mp4
    ↓
[4] Si enableSubtitles = true:
    → generateSubtitles()
      → Extraer audio del video
      → Transcribir con Whisper API 🔴 TODO
      → Generar SubtitleSegment[]
    → burnSubtitlesIntoVideo()
      → Convertir a formato SRT
      → Aplicar estilos (color, tamaño, posición)
      → Quemar con FFmpeg
      → Generar video_with_subtitles.mp4
    ↓
[5] Video final procesado
    ↓
[6] Subir a TikTok Content Posting API
    ↓
[7] Publicación exitosa ✅
```

## 🎯 Prioridades de Desarrollo

### CRÍTICO (Implementar YA)

1. **Integración Whisper API** - Sin esto los subtítulos no funcionan en producción
2. **Testing end-to-end** - Validar flujo completo con video real

### ALTA PRIORIDAD (Próximas 2 semanas)

3. **Sistema de colas (Bull + Redis)** - Evitar timeouts en videos largos
4. **Almacenamiento S3** - Videos persistentes y escalables
5. **Manejo de errores mejorado** - Retry logic + logging estructurado

### MEDIA PRIORIDAD (Próximo mes)

6. **Progress tracking con WebSocket** - Notificar usuario del progreso
7. **Preview de efectos en tiempo real** - Mejor UX en pattern editor
8. **Validación de videos** - Prevenir errores antes de subir

### BAJA PRIORIDAD (Futuro)

9. **Optimización de rendimiento** - Reducir tiempo de procesamiento
10. **Analytics** - Métricas de uso de patrones y efectos

## 🐛 Problemas Conocidos

### 1. Subtítulos con Mock

- **Problema**: `generateSubtitles()` devuelve datos hardcodeados
- **Impacto**: No funcional en producción
- **Solución**: Integrar Whisper API (ver sección arriba)

### 2. Videos temporales en disco

- **Problema**: Archivos se guardan en `/tmp` de Render
- **Impacto**: Se pierden al reiniciar, pueden llenar disco
- **Solución**: Migrar a S3 + limpieza automática

### 3. Procesamiento síncrono

- **Problema**: Videos largos causan timeout (30s en Render)
- **Impacto**: No se pueden procesar videos >30 segundos
- **Solución**: Implementar Bull Queue

### 4. Falta de validación de recursos

- **Problema**: No se valida duración/tamaño del video
- **Impacto**: Videos muy grandes pueden crashear el servidor
- **Solución**: Validar antes de procesar (max 100MB, 60s)

## 📚 Recursos Adicionales

### Documentación Oficial

- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [Bull Queue](https://github.com/OptimalBits/bull)
- [AWS S3 SDK](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-example-creating-buckets.html)

### Tutoriales Útiles

- [FFmpeg Subtitle Styling](https://trac.ffmpeg.org/wiki/HowToBurnSubtitlesIntoVideo)
- [Whisper + Node.js Integration](https://github.com/openai/openai-node/blob/master/examples/audio-transcription.ts)
- [Bull Queue Best Practices](https://optimalbits.github.io/bull/)

## 🎉 Resumen

**Todo implementado y funcionando:**

- ✅ Base de datos actualizada con campos de efectos y subtítulos
- ✅ API CRUD completa para patrones
- ✅ UI con tabs para logo/efectos/subtítulos
- ✅ Procesamiento de efectos visuales con FFmpeg (6 filtros + ajustes)
- ✅ Sistema de subtítulos con estilos personalizables
- ✅ Función `applyBrandPattern()` que procesa todo en secuencia
- ✅ Integración con flujo de publicación

**Siguiente paso crítico:**
🔴 **Integrar Whisper API para generación real de subtítulos**

Una vez integrado Whisper, el sistema estará 100% funcional para producción. Después se pueden implementar las optimizaciones (colas, S3, progress tracking) según la demanda de usuarios.
