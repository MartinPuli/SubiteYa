# Documentación Técnica: Módulo de Patrones de Marca

**Fecha**: Noviembre 12, 2024  
**Versión**: 1.0  
**Autores**: Equipo SubiteYa

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Estructura de Datos](#estructura-de-datos)
3. [Campos y Funcionalidad](#campos-y-funcionalidad)
4. [APIs y Endpoints](#apis-y-endpoints)
5. [Vista Previa Interactiva](#vista-previa-interactiva)
6. [Procesamiento de Video](#procesamiento-de-video)
7. [Validaciones y Restricciones](#validaciones-y-restricciones)
8. [Guía de Extensión](#guía-de-extensión)

---

## 1. Descripción General

El **Módulo de Patrones de Marca** (Brand Patterns) permite a los usuarios crear configuraciones reutilizables de edición de video que se aplican automáticamente a sus publicaciones de TikTok. Cada patrón está asociado a una cuenta de TikTok específica y puede incluir:

- Logo/Marca de agua
- Corrección de color avanzada (9 parámetros)
- Efectos visuales y filtros
- Velocidad y estabilización
- Recorte automático
- Audio y música de fondo
- Narración con IA (ElevenLabs)
- Subtítulos automáticos
- Configuración de calidad de salida

### Arquitectura del Sistema

```
Frontend (React)           Backend (Express)         Procesamiento
─────────────────          ──────────────────        ──────────────
PatternEditorPage   ───►   /api/patterns      ───►   video-processor.ts
PatternsPage               patterns.ts               applyBrandPattern()
BeforeAfterPreview         upload-logo                 │
                           Prisma ORM                   │
                              │                         ▼
                              ▼                    FFmpeg + Filters
                        PostgreSQL (Supabase)     Logo Overlay
                        BrandPattern Model        Subtitles (Whisper AI)
```

---

## 2. Estructura de Datos

### Modelo de Base de Datos: `BrandPattern`

**Tabla**: `brand_patterns`  
**ORM**: Prisma  
**Base de Datos**: PostgreSQL (Supabase)

#### Campos Principales

```typescript
model BrandPattern {
  // Identificación y Metadata
  id                   String           @id @default(uuid())
  userId               String           @map("user_id")
  tiktokConnectionId   String           @map("tiktok_connection_id")
  name                 String                        // Nombre del patrón
  isDefault            Boolean          @default(false)  // Si es predeterminado
  version              Int              @default(1)      // Control de versiones
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  // Logo (4 campos)
  logoUrl              String?                       // Data URL base64
  logoPosition         String           @default("bottom-right")
  logoSize             Int              @default(15)      // Porcentaje (5-40)
  logoOpacity          Int              @default(100)     // 0-100
  thumbnailUrl         String?                       // Preview del patrón

  // Corrección de Color (9 campos)
  enable_color_grading Boolean          @default(false)
  brightness           Int              @default(100)     // 50-150%
  contrast             Int              @default(100)     // 50-150%
  saturation           Int              @default(100)     // 0-200%
  temperature          Int              @default(100)     // 0-200 (cálido/frío)
  tint                 Int              @default(100)     // 0-200 (magenta/verde)
  hue                  Int              @default(0)       // -180 a 180°
  exposure             Int              @default(100)     // 0-200
  highlights           Int              @default(100)     // 0-200
  shadows              Int              @default(100)     // 0-200

  // Efectos Visuales (6 campos)
  enableEffects        Boolean          @default(false)
  filterType           String           @default("none")  // vintage, vibrant, etc.
  vignette             Int              @default(0)       // 0-100
  sharpen              Int              @default(0)       // 0-100
  blur                 Int              @default(0)       // 0-10
  grain                Int              @default(0)       // 0-100

  // Velocidad y Movimiento (5 campos)
  speed_multiplier     Float            @default(1.0)     // 0.25-4.0
  enable_smooth_slow   Boolean          @default(false)
  enable_stabilization Boolean          @default(false)
  enable_denoise       Boolean          @default(false)
  denoise_strength     Int              @default(50)      // 0-100

  // Recorte Automático (3 campos)
  enable_auto_crop     Boolean          @default(false)
  target_aspect_ratio  String           @default("original") // 9:16, 16:9, 1:1, 4:5
  crop_position        String           @default("center")   // top, center, bottom

  // Audio (5 campos)
  audio_volume         Int              @default(100)     // 0-200%
  audio_normalize      Boolean          @default(false)
  enable_bg_music      Boolean          @default(false)
  bg_music_url         String?
  bg_music_volume      Int              @default(50)      // 0-100

  // Narración con IA - ElevenLabs (7 campos)
  enable_voice_narration Boolean        @default(false)
  narration_language     String?                       // es, en, pt, fr, etc.
  narration_voice_id     String?                       // ID de voz ElevenLabs
  narration_style        String?                       // documentary, educational, etc.
  narration_volume       Int             @default(80)      // 0-100
  narration_speed        Float           @default(1.0)     // 0.5-2.0
  original_audio_volume  Int             @default(30)      // 0-100

  // Subtítulos (8 campos)
  enableSubtitles      Boolean          @default(false)
  subtitleStyle        String           @default("modern")  // modern, classic, bold, etc.
  subtitlePosition     String           @default("bottom")  // top, center, bottom
  subtitleColor        String           @default("#FFFFFF")
  subtitleBgColor      String           @default("#000000")
  subtitleFontSize     Int              @default(24)      // 16-72 px
  subtitle_animation   String           @default("none")   // fade, slide, pop, typewriter
  subtitle_font_family String           @default("Inter")

  // Calidad de Salida (3 campos)
  output_quality       String           @default("high")   // low, medium, high, ultra
  output_bitrate       String           @default("auto")   // 1000k, 2000k, 4000k, 8000k
  output_fps           Int              @default(30)       // 24, 30, 60

  // Transiciones (2 campos)
  transition_type      String           @default("none")   // fade, dissolve, wipe, slide
  transition_duration  Float            @default(0.5)      // segundos

  // Relaciones
  tiktokConnection     TikTokConnection @relation(...)
  user                 User             @relation(...)

  @@index([userId])
  @@index([tiktokConnectionId])
  @@index([isDefault])
}
```

### Relaciones

- **Uno a Muchos**: `User` → `BrandPattern[]`
- **Uno a Muchos**: `TikTokConnection` → `BrandPattern[]`
- **Cascada**: Al eliminar User o TikTokConnection, se eliminan sus patrones

---

## 3. Campos y Funcionalidad

### 3.1 Información Básica

#### `name` (String, requerido)

**Propósito**: Nombre descriptivo del patrón  
**Validación**: No vacío  
**Ejemplo**: "Mi Estilo Corporativo", "Videos Coloridos TikTok"

#### `tiktokConnectionId` (UUID, requerido)

**Propósito**: Vincula el patrón a una cuenta de TikTok específica  
**Validación**: Debe existir y pertenecer al usuario  
**Nota**: No se puede cambiar después de crear el patrón

#### `isDefault` (Boolean)

**Propósito**: Marca el patrón como predeterminado para la cuenta  
**Comportamiento**:

- Solo puede haber un patrón predeterminado por cuenta
- Se aplica automáticamente a nuevas publicaciones
- Al establecer uno como default, los demás se desactivan

### 3.2 Logo y Marca de Agua

#### `logoUrl` (String, base64 data URL)

**Propósito**: Imagen del logo en formato base64  
**Formato**: `data:image/png;base64,...`  
**Tamaño máximo**: 2MB antes de comprimir, <500KB recomendado  
**Formatos aceptados**: PNG, JPG, JPEG, WebP  
**Procesamiento**: Se comprime y convierte a data URL en el endpoint `/patterns/upload-logo`

#### `logoPosition` (String)

**Opciones**:

- `top-left`: Superior izquierda
- `top-right`: Superior derecha
- `bottom-left`: Inferior izquierda (⚠️ puede violar zona segura de TikTok)
- `bottom-right`: Inferior derecha (predeterminado)
- `center`: Centro

**Zonas seguras de TikTok**:

- Top: primeros 80px (interfaz de usuario)
- Bottom: últimos 120px (botones de acción, likes, comentarios)

#### `logoSize` (Int, 5-40)

**Unidad**: Porcentaje del ancho del video  
**Recomendado**: 10-20% para videos TikTok 9:16  
**Efecto en procesamiento**: FFmpeg calcula dimensiones proporcionales

#### `logoOpacity` (Int, 0-100)

**Unidad**: Porcentaje de opacidad  
**0**: Transparente (invisible)  
**100**: Opaco (predeterminado)  
**Uso típico**: 70-90 para marca de agua sutil

### 3.3 Corrección de Color (Color Grading)

#### `enable_color_grading` (Boolean)

**Propósito**: Activa/desactiva todos los ajustes de color  
**Performance**: Si false, se omiten los filtros de color en FFmpeg

#### `brightness` (Int, 50-150)

**Unidad**: Porcentaje  
**100**: Sin cambio  
**>100**: Más brillante  
**<100**: Más oscuro  
**FFmpeg**: `eq=brightness=(value-100)/100`

#### `contrast` (Int, 50-150)

**Unidad**: Porcentaje  
**100**: Sin cambio  
**>100**: Mayor contraste  
**<100**: Menor contraste  
**FFmpeg**: `eq=contrast=value/100`

#### `saturation` (Int, 0-200)

**Unidad**: Porcentaje  
**0**: Blanco y negro (grayscale)  
**100**: Saturación normal  
**>100**: Colores más vibrantes  
**FFmpeg**: `eq=saturation=value/100`

#### `temperature` (Int, 0-200)

**Propósito**: Balance de temperatura de color  
**<100**: Tonos fríos (azulados)  
**100**: Neutral  
**>100**: Tonos cálidos (naranjas/rojos)  
**FFmpeg**: Ajusta curvas RGB

#### `tint` (Int, 0-200)

**Propósito**: Balance magenta/verde  
**<100**: Más verde  
**100**: Neutral  
**>100**: Más magenta  
**FFmpeg**: Ajusta canal G vs. M

#### `hue` (Int, -180 a 180)

**Unidad**: Grados en el círculo cromático  
**0**: Sin cambio  
**±180**: Inversión de colores  
**Ejemplo**: +60° convierte azul en amarillo  
**FFmpeg**: `hue=h=value`

#### `exposure` (Int, 0-200)

**Propósito**: Simula ajuste de exposición de cámara  
**<100**: Subexpuesto  
**100**: Normal  
**>100**: Sobreexpuesto  
**FFmpeg**: Combina brightness y gamma

#### `highlights` (Int, 0-200)

**Propósito**: Recupera o intensifica detalles en zonas brillantes  
**<100**: Oscurece highlights (recupera cielo quemado)  
**100**: Sin cambio  
**>100**: Intensifica brillos  
**FFmpeg**: Curvas tonales selectivas

#### `shadows` (Int, 0-200)

**Propósito**: Aclara u oscurece zonas oscuras  
**<100**: Sombras más oscuras  
**100**: Sin cambio  
**>100**: Levanta sombras (revela detalles)  
**FFmpeg**: Curvas tonales selectivas

### 3.4 Efectos Visuales

#### `enableEffects` (Boolean)

**Propósito**: Activa/desactiva filtros y efectos  
**Performance**: Si false, se omiten en FFmpeg

#### `filterType` (String)

**Opciones**:

- `none`: Sin filtro
- `vintage`: Sepia(40%) + saturación + rotación de hue
- `vibrant`: Saturación 150% + contraste 110%
- `cinematic`: Look de película (contraste ↑, saturación ↓)
- `warm`: Tonos cálidos (sepia ligero)
- `cool`: Tonos fríos (rotación de hue azul)
- `bw`: Blanco y negro (grayscale 100%)
- `sepia`: Tono sepia (antiguo)
- `dramatic`: Alto contraste + brillo reducido

**Implementación**: Cada filtro es una combinación predefinida de ajustes de color en FFmpeg

#### `vignette` (Int, 0-100)

**Propósito**: Oscurece bordes para focalizar en el centro  
**0**: Sin viñeta  
**100**: Viñeta muy pronunciada  
**FFmpeg**: `vignette=angle=PI/4:mode=forward`

#### `sharpen` (Int, 0-100)

**Propósito**: Aumenta nitidez y definición de bordes  
**0**: Sin efecto  
**50**: Nitidez moderada  
**100**: Máxima nitidez (puede causar artefactos)  
**FFmpeg**: `unsharp=5:5:value/20`

#### `blur` (Int, 0-10)

**Propósito**: Desenfoque gaussiano  
**0**: Sin desenfoque  
**5**: Blur moderado  
**10**: Muy difuminado  
**Uso**: Fondos, efectos artísticos  
**FFmpeg**: `gblur=sigma=value`

#### `grain` (Int, 0-100)

**Propósito**: Añade textura de grano de película  
**0**: Sin grano  
**50**: Grano moderado (estilo vintage)  
**100**: Grano pronunciado  
**FFmpeg**: `noise=alls=value:allf=t+u`

### 3.5 Velocidad y Movimiento

#### `speed_multiplier` (Float, 0.25-4.0)

**Propósito**: Cambia velocidad de reproducción  
**0.25x**: Cámara super lenta (4x más lento)  
**0.5x**: Cámara lenta  
**1.0x**: Velocidad normal  
**1.5x**: Ligeramente acelerado  
**2.0x-4.0x**: Time-lapse  
**FFmpeg**: `setpts=PTS/speed_multiplier`

#### `enable_smooth_slow` (Boolean)

**Propósito**: Interpolación de frames para slow motion fluido  
**Uso**: Cuando speed < 1.0  
**FFmpeg**: `minterpolate=fps=60:mi_mode=mci`  
**Nota**: Computacionalmente intensivo

#### `enable_stabilization` (Boolean)

**Propósito**: Reduce vibración de cámara  
**FFmpeg**: Filtro `deshake` o `vidstab`  
**Recomendado**: Videos grabados con dispositivo móvil

#### `enable_denoise` (Boolean)

**Propósito**: Reduce ruido visual (granos no deseados)  
**Uso**: Videos con poca luz o alta ISO

#### `denoise_strength` (Int, 0-100)

**Propósito**: Intensidad de reducción de ruido  
**Recomendado**: 30-70  
**FFmpeg**: `hqdn3d=luma_spatial:chroma_spatial`

### 3.6 Recorte Automático

#### `enable_auto_crop` (Boolean)

**Propósito**: Convierte automáticamente al formato seleccionado

#### `target_aspect_ratio` (String)

**Opciones**:

- `original`: Sin recorte
- `9:16`: TikTok/Instagram Reels (vertical)
- `16:9`: YouTube (horizontal)
- `1:1`: Instagram Feed (cuadrado)
- `4:5`: Instagram Feed (vertical)

**Procesamiento**: FFmpeg calcula crop automático según posición

#### `crop_position` (String)

**Opciones**:

- `center`: Centro (predeterminado)
- `top`: Parte superior
- `bottom`: Parte inferior
- `left`: Izquierda
- `right`: Derecha

**FFmpeg**: `crop=w:h:x:y` calculado dinámicamente

### 3.7 Audio

#### `audio_volume` (Int, 0-200)

**Unidad**: Porcentaje  
**100**: Volumen original  
**>100**: Amplificado (puede distorsionar)  
**FFmpeg**: `volume=value/100`

#### `audio_normalize` (Boolean)

**Propósito**: Ajusta volumen para evitar picos y distorsiones  
**FFmpeg**: `loudnorm` (normalización EBU R128)

#### `enable_bg_music` (Boolean)

**Propósito**: Añade pista musical de fondo

#### `bg_music_url` (String)

**Formato**: URL de audio (MP3, WAV, AAC)  
**Descarga**: Se descarga y mezcla con FFmpeg

#### `bg_music_volume` (Int, 0-100)

**Propósito**: Balance entre música y audio original  
**50**: 50/50 mix  
**FFmpeg**: `amix=inputs=2:weights=...`

### 3.8 Narración con IA (ElevenLabs)

#### `enable_voice_narration` (Boolean)

**Propósito**: Genera narración profesional con IA  
**Flujo**:

1. Extrae audio con FFmpeg
2. Transcribe con Whisper AI
3. Traduce con GPT-4
4. Genera script según estilo
5. Sintetiza voz con ElevenLabs
6. Mezcla con video

#### `narration_language` (String)

**Opciones**: `es`, `en`, `pt`, `fr`, `de`, `it`, `ja`, `zh`  
**Propósito**: Idioma de salida de la narración

#### `narration_voice_id` (String)

**Formato**: ID de voz de ElevenLabs (UUID)  
**Obtención**: GET `/api/elevenlabs/voices`

#### `narration_style` (String)

**Opciones**:

- `documentary`: Estilo National Geographic
- `educational`: Explicativo, claro
- `news`: Formal, noticiero
- `storytelling`: Narrativo, emotivo
- `casual`: Amigable, conversacional
- `professional`: Corporativo, serio

**Procesamiento**: GPT-4 adapta el script según el estilo

#### `narration_volume` (Int, 0-100)

**Propósito**: Volumen de la voz narradora

#### `narration_speed` (Float, 0.5-2.0)

**Propósito**: Velocidad de lectura  
**1.0**: Normal  
**<1.0**: Más lento  
**>1.0**: Más rápido

#### `original_audio_volume` (Int, 0-100)

**Propósito**: Volumen del audio original cuando la narración está activa  
**0**: Silenciado (solo narración)  
**30**: Recomendado (narración predominante)  
**100**: Sin reducción

### 3.9 Subtítulos Automáticos

#### `enableSubtitles` (Boolean)

**Propósito**: Genera y quema subtítulos en el video  
**Flujo**:

1. Extrae audio
2. Transcribe con Whisper AI
3. Genera archivo SRT
4. Quema subtítulos con FFmpeg `subtitles` filter

#### `subtitleStyle` (String)

**Opciones**:

- `modern`: Estilo TikTok (fondo semi-transparente)
- `classic`: Texto simple centrado
- `bold`: Negrita con sombra pronunciada
- `outlined`: Contorno negro (karaoke)
- `boxed`: Caja de fondo sólido

**Implementación**: Estilos ASS personalizados en FFmpeg

#### `subtitlePosition` (String)

**Opciones**: `top`, `center`, `bottom`

#### `subtitleColor` (String)

**Formato**: HEX color (`#FFFFFF`)  
**Predeterminado**: Blanco

#### `subtitleBgColor` (String)

**Formato**: HEX color (`#000000`)  
**Predeterminado**: Negro  
**Uso**: En estilos `modern`, `boxed`

#### `subtitleFontSize` (Int, 16-72)

**Unidad**: Píxeles  
**Recomendado**: 24-32 para TikTok 9:16

#### `subtitle_animation` (String)

**Opciones**: `none`, `fade`, `slide`, `pop`, `typewriter`

#### `subtitle_font_family` (String)

**Opciones**: `Arial`, `Helvetica`, `Roboto`, `Montserrat`, `Poppins`, `Impact`

### 3.10 Calidad de Salida

#### `output_quality` (String)

**Opciones**:

- `low`: Rápido, menor calidad (móviles lentos)
- `medium`: Balance calidad/velocidad (recomendado)
- `high`: Alta calidad, más tiempo
- `ultra`: Máxima calidad, muy lento

**FFmpeg preset**: `ultrafast`, `medium`, `slow`, `veryslow`

#### `output_bitrate` (String)

**Opciones**: `1000k`, `2000k`, `4000k`, `8000k`, `15000k`, `auto`  
**TikTok recomendado**: 2000k para 9:16  
**YouTube recomendado**: 8000k+ para 1080p

#### `output_fps` (Int)

**Opciones**: `24`, `30`, `60`  
**24**: Cinemático  
**30**: Standard (TikTok, Instagram)  
**60**: Ultra suave (gaming, deportes)

### 3.11 Transiciones

#### `transition_type` (String)

**Opciones**: `none`, `fade`, `dissolve`, `wipe`, `slide`  
**Uso**: Entre clips si el video tiene múltiples segmentos

#### `transition_duration` (Float)

**Unidad**: Segundos  
**Rango**: 0.1 - 2.0  
**Recomendado**: 0.3 - 0.8

---

## 4. APIs y Endpoints

### Base URL

```
Development: http://localhost:3000/api
Production: https://api.subiteya.com/api
```

### Autenticación

Todas las rutas requieren header:

```
Authorization: Bearer <JWT_TOKEN>
```

### 4.1 Listar Patrones

**Endpoint**: `GET /patterns`

**Query Parameters**:

```typescript
connectionId?: string  // Filtrar por cuenta de TikTok
```

**Response** (200 OK):

```json
{
  "patterns": [
    {
      "id": "uuid",
      "name": "Mi Patrón",
      "isDefault": true,
      "version": 2,
      "logoUrl": "data:image/png;base64,...",
      "logoPosition": "bottom-right",
      "logoSize": 15,
      "logoOpacity": 100,
      "thumbnailUrl": "data:image/png;base64,...",
      "tiktokConnectionId": "uuid",
      "enable_color_grading": true,
      "brightness": 110,
      "contrast": 105,
      // ... todos los campos
      "tiktokConnection": {
        "displayName": "Mi Cuenta TikTok",
        "avatarUrl": "https://..."
      },
      "createdAt": "2024-11-12T...",
      "updatedAt": "2024-11-12T..."
    }
  ]
}
```

**Ordenamiento**: Por `isDefault DESC`, luego `updatedAt DESC`

### 4.2 Obtener Patrón Específico

**Endpoint**: `GET /patterns/:id`

**Response** (200 OK):

```json
{
  "pattern": {
    // ... igual que en el listado, pero un solo objeto
  }
}
```

**Errores**:

- `404 Not Found`: Patrón no existe o no pertenece al usuario

### 4.3 Crear Patrón

**Endpoint**: `POST /patterns`

**Content-Type**: `application/json`

**Body** (campos requeridos):

```json
{
  "tiktokConnectionId": "uuid",
  "name": "Nuevo Patrón",
  "isDefault": false,
  // Todos los demás campos son opcionales con valores por defecto
  "logoUrl": "data:image/png;base64,...",
  "logoPosition": "bottom-right",
  "logoSize": 15,
  "logoOpacity": 100,
  "enableColorGrading": true,
  "brightness": 110
  // ...
}
```

**Response** (201 Created):

```json
{
  "pattern": {
    // ... objeto completo del patrón creado
  }
}
```

**Validaciones**:

- `tiktokConnectionId` y `name` son obligatorios
- `tiktokConnectionId` debe existir y pertenecer al usuario
- Si `isDefault: true`, se desactiva el default anterior de esa cuenta

**Errores**:

- `400 Bad Request`: Faltan campos requeridos
- `404 Not Found`: Cuenta de TikTok no encontrada
- `500 Internal Server Error`: Error de base de datos

### 4.4 Actualizar Patrón

**Endpoint**: `PATCH /patterns/:id`

**Content-Type**: `application/json`

**Body** (todos los campos opcionales):

```json
{
  "name": "Nombre Actualizado",
  "isDefault": true,
  "brightness": 120
  // Solo incluir campos que se quieren cambiar
}
```

**Response** (200 OK):

```json
{
  "pattern": {
    // ... objeto actualizado
    "version": 3 // Se incrementa automáticamente
  }
}
```

**Validaciones**:

- El patrón debe existir y pertenecer al usuario
- Si `isDefault: true`, se desactiva el default anterior

**Errores**:

- `404 Not Found`: Patrón no encontrado o no pertenece al usuario

### 4.5 Eliminar Patrón

**Endpoint**: `DELETE /patterns/:id`

**Response** (200 OK):

```json
{
  "message": "Patrón eliminado"
}
```

**Errores**:

- `404 Not Found`: Patrón no encontrado o no pertenece al usuario

### 4.6 Subir Logo

**Endpoint**: `POST /patterns/upload-logo`

**Content-Type**: `multipart/form-data`

**Body**:

```
logo: File (imagen)
```

**Validaciones**:

- Tamaño máximo: 2MB
- Formatos: PNG, JPG, JPEG, WebP

**Response** (200 OK):

```json
{
  "logoUrl": "data:image/png;base64,iVBORw0KGgo...",
  "originalName": "logo.png",
  "size": 123456
}
```

**Procesamiento**:

1. Multer recibe el archivo en memoria
2. Se convierte a data URL base64
3. Si >500KB, se recomienda comprimir (actualmente solo warning)

**Notas**:

- El logo NO se guarda automáticamente en el patrón
- El frontend debe incluir el `logoUrl` devuelto al crear/actualizar el patrón
- Se recomienda implementar compresión con Sharp library

---

## 5. Vista Previa Interactiva

### Componente: `BeforeAfterPreview`

**Ubicación**: `packages/web/src/components/BeforeAfterPreview/`

### Tecnología

- **React**: Componente funcional con hooks
- **Canvas HTML5**: NO se usa (solo para preview legacy del editor)
- **CSS Filters**: Para aplicar efectos en tiempo real
- **Clip-path**: Para el efecto de deslizamiento

### Funcionamiento

#### 1. Selector de Imágenes de Muestra

```typescript
const PREVIEW_IMAGES = [
  'https://images.unsplash.com/photo-...', // 5 imágenes diferentes
  // Formato: 400x711 (9:16 para TikTok)
];
```

**Usuario puede**:

- Cambiar entre 5 imágenes de muestra
- Ver cómo se aplican los efectos a diferentes tipos de contenido

#### 2. Control Deslizante (Slider)

**Interacción**:

- **Mouse**: Click and drag
- **Touch**: Funciona en móviles
- **Teclado**: Flechas izq/der (accesibilidad)

**Estado**: `sliderPosition` (0-100%)

**Efecto visual**:

```css
.image-after {
  clip-path: inset(0 ${100 - sliderPosition}% 0 0);
}
```

Esto "recorta" la imagen procesada revelando el original debajo

#### 3. Aplicación de Filtros CSS

```typescript
const getFilterStyle = () => {
  const filters: string[] = [];

  if (brightness !== 100) {
    filters.push(`brightness(${brightness}%)`);
  }
  if (contrast !== 100) {
    filters.push(`contrast(${contrast}%)`);
  }
  if (saturation !== 100) {
    filters.push(`saturate(${saturation}%)`);
  }

  // Filtros predefinidos
  switch (filterType) {
    case 'vintage':
      filters.push('sepia(40%) saturate(120%) hue-rotate(-10deg)');
      break;
    // ...
  }

  return filters.join(' ');
};
```

**Limitaciones**:

- Los filtros CSS NO son exactamente iguales a FFmpeg
- Es una **aproximación visual** para feedback rápido
- El procesamiento real de FFmpeg puede diferir ligeramente

#### 4. Overlay de Logo

```typescript
{logoUrl && (
  <img
    src={logoUrl}
    className="logo-overlay"
    style={getLogoPositionStyle()}
  />
)}
```

**Posicionamiento**: Absolute positioning con `top`, `left`, `bottom`, `right`

#### 5. Viñeta

```tsx
{
  vignette > 0 && (
    <div className="vignette-overlay" style={{ opacity: vignette / 100 }} />
  );
}
```

**CSS**:

```css
.vignette-overlay {
  background: radial-gradient(
    ellipse at center,
    transparent 0%,
    transparent 40%,
    rgba(0, 0, 0, 0.7) 100%
  );
}
```

#### 6. Simulación de Subtítulos

```tsx
{
  enableSubtitles && (
    <div
      className={getSubtitleStyleClass()}
      style={{
        color: subtitleColor,
        backgroundColor: subtitleBgColor,
        fontSize: `${subtitleFontSize}px`,
        fontFamily: subtitleFontFamily,
      }}
    >
      Este es un ejemplo de subtítulo
    </div>
  );
}
```

**Nota**: Solo muestra un ejemplo estático, NO transcribe

#### 7. Indicador de Recorte

```tsx
{
  enableAutoCrop && aspectRatio !== 'original' && (
    <div className="crop-indicator">
      <div className="crop-label">Recorte: {aspectRatio}</div>
    </div>
  );
}
```

**Cálculo de recorte**:

```typescript
switch (aspectRatio) {
  case '16:9':
    cropHeight = '56.25%'; // 9/16
    break;
  case '1:1':
    cropWidth = '56.25%';
    break;
  // ...
}
```

### Performance

- **Tiempo real**: Todos los cambios se reflejan inmediatamente
- **No hay renderizado de video**: Solo imágenes estáticas con CSS
- **Ligero**: No consume recursos de procesamiento pesado

### Limitaciones

1. **No procesa video real**: Solo simulación visual
2. **Filtros aproximados**: CSS filters ≠ FFmpeg exacto
3. **Sin audio**: No se puede previsualizar narración ni subtítulos reales
4. **Imágenes estáticas**: No muestra efectos de velocidad, estabilización

---

## 6. Procesamiento de Video

### Función Principal: `applyBrandPattern()`

**Ubicación**: `packages/api/src/lib/video-processor.ts`

### Pipeline de Procesamiento

```
1. Video Original (S3)
      │
      ▼
2. Aplicar Efectos Visuales (si enableEffects)
   - filterType
   - brightness, contrast, saturation
   - FFmpeg: eq, hue, curves
      │
      ▼
3. Aplicar Logo (si logoUrl existe)
   - Descargar logo (data URL → file)
   - Overlay con FFmpeg
   - Position, size, opacity
      │
      ▼
4. Generar Subtítulos (si enableSubtitles)
   - Extraer audio
   - Whisper AI: audio → texto
   - Crear archivo SRT
   - Quemar subtítulos: FFmpeg subtitles filter
      │
      ▼
5. Aplicar Efectos de Velocidad (si speed !== 1.0)
   - setpts=PTS/speed
   - minterpolate (si smooth_slow)
      │
      ▼
6. Estabilización (si enable_stabilization)
   - vidstab o deshake filter
      │
      ▼
7. Corrección de Color (si enable_color_grading)
   - curves, eq filters
   - temperature, tint, hue, exposure
      │
      ▼
8. Reducción de Ruido (si enable_denoise)
   - hqdn3d filter
      │
      ▼
9. Ajustes de Audio
   - volume, loudnorm
   - Mezcla de música de fondo
   - Narración IA (si enable_voice_narration)
      │
      ▼
10. Recorte Automático (si enable_auto_crop)
    - crop filter según aspect_ratio
      │
      ▼
11. Codificación Final
    - codec: libx264
    - preset: según output_quality
    - bitrate: output_bitrate
    - fps: output_fps
      │
      ▼
12. Video Procesado (S3)
```

### Comandos FFmpeg

#### Ejemplo: Efectos + Logo + Subtítulos

```bash
ffmpeg -i input.mp4 \
  -vf "eq=brightness=0.1:contrast=1.05:saturation=1.1,\
       [0:v]overlay=W-w-20:H-h-20:format=auto:alpha=0.9,\
       subtitles=subtitles.srt:force_style='FontSize=24,PrimaryColour=&HFFFFFF'" \
  -af "volume=1.2,loudnorm" \
  -c:v libx264 -preset medium -crf 23 -r 30 \
  output.mp4
```

### Archivos Temporales

**Directorio**: `/tmp/subiteya-{timestamp}-{random}/`

**Limpieza**: Se eliminan automáticamente después de procesar

### Integración con Narración IA

**Flujo completo**:

```typescript
if (enable_voice_narration) {
  // 1. Extraer audio
  const audioPath = await extractAudio(videoPath);

  // 2. Transcribir con Whisper
  const transcript = await whisperTranscribe(audioPath);

  // 3. Traducir y adaptar con GPT-4
  const script = await generateNarrationScript(
    transcript,
    narration_language,
    narration_style
  );

  // 4. Sintetizar voz con ElevenLabs
  const narrationAudio = await elevenlabsTextToSpeech(
    script,
    narration_voice_id
  );

  // 5. Mezclar audios
  await mixAudioWithFFmpeg(videoPath, narrationAudio, {
    narrationVolume,
    originalAudioVolume,
    narrationSpeed,
  });
}
```

---

## 7. Validaciones y Restricciones

### Backend (routes/patterns.ts)

#### Validaciones de Creación

```typescript
// Campos requeridos
if (!tiktokConnectionId || !name) {
  return 400 Bad Request
}

// Verificar propiedad de cuenta
const connection = await prisma.tikTokConnection.findFirst({
  where: { id: tiktokConnectionId, userId }
});

if (!connection) {
  return 404 Not Found
}
```

#### Restricciones de Logo

```typescript
// En /upload-logo endpoint
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB máximo
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new Error('Solo PNG, JPG o WebP'));
    }
  },
});
```

**Warnings**:

- Logo >500KB: Se recomienda comprimir
- Base64 >1MB: Puede causar problemas de performance

#### Validaciones de Patrón Predeterminado

```typescript
if (isDefault) {
  // Desactivar otros defaults de la misma cuenta
  await prisma.brandPattern.updateMany({
    where: {
      userId,
      tiktokConnectionId,
      isDefault: true,
    },
    data: { isDefault: false },
  });
}
```

### Frontend (PatternEditorPage.tsx)

#### Validaciones de UI

```typescript
// Antes de guardar
if (!token || !name || !connectionId) {
  alert('Por favor completa todos los campos requeridos');
  return;
}

// Sliders con límites
<Slider
  min={5}
  max={40}
  step={1}
  value={logoSize}
/>
```

#### Restricciones de Valores

| Campo                 | Min  | Max | Step | Default |
| --------------------- | ---- | --- | ---- | ------- |
| logoSize              | 5    | 40  | 1    | 15      |
| logoOpacity           | 0    | 100 | 5    | 100     |
| brightness            | 50   | 150 | 1    | 100     |
| contrast              | 50   | 150 | 1    | 100     |
| saturation            | 0    | 200 | 1    | 100     |
| temperature           | -100 | 100 | 1    | 0       |
| tint                  | -100 | 100 | 1    | 0       |
| hue                   | -180 | 180 | 1    | 0       |
| exposure              | -100 | 100 | 1    | 0       |
| highlights            | -100 | 100 | 1    | 0       |
| shadows               | -100 | 100 | 1    | 0       |
| vignette              | 0    | 100 | 1    | 0       |
| sharpen               | 0    | 100 | 1    | 0       |
| blur                  | 0    | 10  | 0.1  | 0       |
| grain                 | 0    | 100 | 1    | 0       |
| speedMultiplier       | 0.25 | 4.0 | 0.25 | 1.0     |
| denoiseStrength       | 0    | 1   | 0.1  | 0.5     |
| audioVolume           | 0    | 200 | 5    | 100     |
| backgroundMusicVolume | 0    | 100 | 5    | 50      |
| narrationVolume       | 0    | 100 | 5    | 80      |
| narrationSpeed        | 0.5  | 2.0 | 0.1  | 1.0     |
| originalAudioVolume   | 0    | 100 | 5    | 30      |
| subtitleFontSize      | 16   | 72  | 2    | 24      |
| outputFps             | 24   | 60  | 6    | 30      |

### Restricciones de Procesamiento

#### Video

- **Duración mínima**: 3 segundos (TikTok)
- **Duración máxima**: 10 minutos (TikTok)
- **Formatos soportados**: MP4, MOV, AVI, MKV
- **Codecs**: H.264, H.265, VP9

#### Audio

- **Formatos**: MP3, WAV, AAC, OGG
- **Sample rate**: 44.1kHz o 48kHz recomendado

#### ElevenLabs (Narración IA)

- **Límite de caracteres**: 5000 por request
- **Rate limit**: Ver documentación de ElevenLabs API
- **Voces**: Límite según plan (Starter: 10 voces)

---

## 8. Guía de Extensión

### 8.1 Agregar Nuevo Campo de Configuración

#### Paso 1: Actualizar Modelo de Base de Datos

```prisma
// packages/api/prisma/schema.prisma
model BrandPattern {
  // ...campos existentes...

  // Nuevo campo
  nuevo_campo          Int              @default(50)
  enable_nuevo_efecto  Boolean          @default(false)
}
```

**Ejecutar migración**:

```bash
cd packages/api
npx prisma migrate dev --name add_nuevo_campo
npx prisma generate
```

#### Paso 2: Actualizar Backend Route

```typescript
// packages/api/src/routes/patterns.ts

// En POST /patterns
const {
  // ... campos existentes...
  nuevoField = 50,
  enableNuevoEfecto = false,
} = req.body;

// En el create
const pattern = await prisma.brandPattern.create({
  data: {
    // ... datos existentes...
    nuevo_campo: nuevoField,
    enable_nuevo_efecto: enableNuevoEfecto,
  },
});

// En PATCH también
```

#### Paso 3: Actualizar Interface Frontend

```typescript
// packages/web/src/pages/PatternEditorPage.tsx

interface Pattern {
  // ... campos existentes...
  nuevoField: number;
  enableNuevoEfecto: boolean;
}

// Agregar estado
const [nuevoField, setNuevoField] = useState(50);
const [enableNuevoEfecto, setEnableNuevoEfecto] = useState(false);

// En loadPattern()
setNuevoField(pattern.nuevoField || 50);
setEnableNuevoEfecto(pattern.enableNuevoEfecto || false);

// En handleSave()
body: JSON.stringify({
  // ... campos existentes...
  nuevoField,
  enableNuevoEfecto,
}),
```

#### Paso 4: Agregar UI en Editor

```tsx
<TabPanel id="nuevoTab" activeTab={activeTab}>
  <Section title="Nuevo Efecto" columns={1}>
    <Toggle
      label="Activar Nuevo Efecto"
      checked={enableNuevoEfecto}
      onChange={setEnableNuevoEfecto}
    />

    {enableNuevoEfecto && (
      <EnhancedSlider
        label="Intensidad"
        value={nuevoField}
        onChange={setNuevoField}
        min={0}
        max={100}
        step={1}
        unit="%"
      />
    )}
  </Section>
</TabPanel>
```

#### Paso 5: Implementar en Procesamiento

```typescript
// packages/api/src/lib/video-processor.ts

if (pattern.enableNuevoEfecto) {
  const intensity = pattern.nuevoField / 100;

  ffmpegCommand.videoFilter(`nuevo_filtro=intensity=${intensity}`);
}
```

#### Paso 6: (Opcional) Agregar Vista Previa

```typescript
// packages/web/src/components/BeforeAfterPreview/BeforeAfterPreview.tsx

const getFilterStyle = () => {
  const filters: string[] = [];
  // ... filtros existentes...

  if (nuevoField !== 50) {
    filters.push(`nuevo-css-filter(${nuevoField}%)`);
  }

  return filters.join(' ');
};
```

### 8.2 Agregar Nuevo Filtro Predefinido

```typescript
// packages/web/src/components/FilterPresetCard/FilterPresetCard.tsx

export const FILTER_PRESETS_VISUAL = [
  // ... presets existentes...
  {
    value: 'nuevo_filtro',
    label: 'Nuevo Filtro',
    description: 'Descripción del efecto',
    icon: '✨',
    preview: {
      brightness: 105,
      contrast: 110,
      saturation: 95,
      // ... otros valores
    },
  },
];
```

**FFmpeg**:

```typescript
// video-processor.ts
switch (filterType) {
  case 'nuevo_filtro':
    filters.push('eq=brightness=0.05:contrast=1.1:saturation=0.95');
    filters.push('hue=h=15');
    break;
}
```

### 8.3 Consideraciones de Compatibilidad

#### Migración de Datos

**Siempre** usar valores por defecto en el schema de Prisma:

```prisma
nuevo_campo  Int  @default(50)
```

Esto asegura que patrones existentes funcionen sin necesidad de actualización.

#### Versioning

El campo `version` se incrementa automáticamente en cada actualización:

```typescript
data: {
  // ...
  version: { increment: 1 },
}
```

**Uso**: Permite rastrear cambios y revertir si es necesario

#### Backward Compatibility

Al cargar patrones en el frontend:

```typescript
setNuevoField(pattern.nuevoField || 50); // Fallback a default
```

#### Testing

1. **Crear patrón nuevo**: Con nuevo campo
2. **Cargar patrón antiguo**: Verificar defaults
3. **Actualizar patrón antiguo**: Sin tocar nuevo campo
4. **Procesar video**: Con nuevo campo activo/inactivo

### 8.4 Optimizaciones de Performance

#### Lazy Loading de Efectos

```typescript
if (pattern.enableEffects) {
  // Solo cargar procesamiento pesado si está activo
  await applyHeavyEffect();
}
```

#### Caché de Filtros Comunes

```typescript
const filterCache = new Map();

function getCachedFilter(key: string) {
  if (!filterCache.has(key)) {
    filterCache.set(key, computeExpensiveFilter(key));
  }
  return filterCache.get(key);
}
```

#### Procesamiento Paralelo

```typescript
// Procesar logo y subtítulos en paralelo
const [logoResult, subtitlesResult] = await Promise.all([
  applyLogo(videoPath, logoConfig),
  generateSubtitles(videoPath),
]);
```

### 8.5 Errores Comunes y Soluciones

#### Error: "Property X does not exist on type BrandPattern"

**Causa**: Prisma Client no regenerado después de cambio en schema

**Solución**:

```bash
cd packages/api
npx prisma generate
npm run build  # Regenera tipos TypeScript
```

#### Error: "Pattern not found" después de actualizar

**Causa**: Cache de frontend desactualizado

**Solución**:

- Limpiar localStorage
- Refrescar conexión a API

#### Video procesado sin cambios

**Causa**: Flag de activación (`enableX`) en false

**Solución**: Verificar que:

1. El toggle esté activo en UI
2. El flag se guarde en la BD
3. El procesador lo lea correctamente

### 8.6 Documentación de Cambios

Al modificar el módulo, **siempre** actualizar:

1. **Este documento**: Agregar nuevo campo a sección 3
2. **Schema Prisma**: Comentarios inline
3. **API Docs**: Actualizar ejemplos de request/response
4. **CHANGELOG.md**: Registrar cambio con versión
5. **Tests**: Agregar casos de prueba

### 8.7 Pruebas Recomendadas

```typescript
// tests/patterns.test.ts

describe('Brand Patterns', () => {
  it('should create pattern with default values', async () => {
    const pattern = await createPattern({
      name: 'Test',
      tiktokConnectionId: 'uuid',
    });

    expect(pattern.brightness).toBe(100);
    expect(pattern.logoSize).toBe(15);
  });

  it('should apply pattern to video', async () => {
    const result = await applyBrandPattern(videoPath, pattern);
    expect(result.success).toBe(true);
    expect(result.outputPath).toBeDefined();
  });

  it('should handle missing logo gracefully', async () => {
    pattern.logoUrl = null;
    const result = await applyBrandPattern(videoPath, pattern);
    expect(result.success).toBe(true);
  });
});
```

---

## 9. Diagrama de Flujo Completo

```
Usuario                 Frontend                Backend              Procesamiento
───────                 ────────                ───────              ─────────────

1. Accede a /patterns
                    ────► GET /patterns
                                         ────► Prisma: findMany
                                         ◄──── patterns[]
                    ◄──── JSON response
   └─► Lista de patrones

2. Click "Nuevo Patrón"
                    ────► Navega a /patterns/new
   └─► PatternEditorPage

3. Sube logo
   └─► Selecciona archivo
                    ────► POST /patterns/upload-logo
                          (multipart/form-data)
                                         ────► Multer procesa
                                         ────► Base64 encode
                                         ◄──── logoUrl (data URL)
                    ◄──── JSON: { logoUrl }
   └─► Preview actualizado

4. Ajusta sliders
   └─► Brightness: 110
   └─► Contrast: 105
                    ────► BeforeAfterPreview
                          actualiza CSS filters
   └─► Ve cambios en tiempo real

5. Click "Guardar"
                    ────► POST /patterns
                          Body: { name, logoUrl,
                                 brightness, ... }
                                         ────► Validaciones
                                         ────► Prisma: create
                                         ◄──── pattern
                    ◄──── JSON: { pattern }
   └─► Redirige a /patterns

6. Usuario sube video
                    ────► POST /publish
                          (video file)
                                         ────► Upload to S3
                                         ────► Get default pattern
                                         ────► Create Video record
                                         ────► Queue edit job
                                                     │
                                                     ▼
                                              Edit Worker
                                              (Qstash HTTP)
                                                     │
                                                     ▼
                                              Download from S3
                                                     │
                                                     ▼
                                              applyBrandPattern()
                                              - Efectos
                                              - Logo
                                              - Subtítulos
                                              - Narración IA
                                                     │
                                                     ▼
                                              Upload to S3
                                                     │
                                                     ▼
                                              Update Video status
                                                     │
                                                     ▼
                                              Queue upload job
                                                     │
                                                     ▼
                                              Upload Worker
                                              (Qstash HTTP)
                                                     │
                                                     ▼
                                              TikTok API
                                              POST /share/video/upload

7. Usuario ve progreso
                    ────► GET /videos/:id
                                         ────► Prisma: findUnique
                                         ◄──── video { status, progress }
                    ◄──── JSON response
   └─► Barra de progreso actualizada
```

---

## 10. Referencias

### Documentación Externa

- **FFmpeg**: https://ffmpeg.org/documentation.html
- **FFmpeg Filters**: https://ffmpeg.org/ffmpeg-filters.html
- **Prisma ORM**: https://www.prisma.io/docs
- **ElevenLabs API**: https://elevenlabs.io/docs/api-reference
- **TikTok Content Posting API**: https://developers.tiktok.com/doc/content-posting-api-get-started/
- **Whisper AI**: https://openai.com/research/whisper
- **Upstash Qstash**: https://upstash.com/docs/qstash

### Documentación Interna

- `docs/RENDER_WORKERS_SETUP.md`: Configuración de workers
- `docs/DATABASE_CONNECTION_RETRY.md`: Sistema de reintentos de BD
- `VOICE_NARRATION_FEATURE.md`: Feature de narración con IA
- `VOICE_NARRATION_COMPLETE.md`: Implementación completa

### Contacto

Para preguntas o asistencia técnica:

- **Equipo Backend**: backend@subiteya.com
- **Equipo Frontend**: frontend@subiteya.com
- **DevOps**: devops@subiteya.com

---

**Última actualización**: 2024-11-12  
**Mantenido por**: Equipo de Desarrollo SubiteYa
