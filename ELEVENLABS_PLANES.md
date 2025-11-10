# Funcionalidades de ElevenLabs por Plan

## 🆓 Plan FREE (Actual)

### ✅ Lo que SÍ funciona:

- **Listar voces predefinidas** (`GET /api/elevenlabs/voices`)
- **Generar audio con voces predefinidas** (`POST /api/elevenlabs/generate`)
- **10,000 caracteres/mes** de generación de audio
- **Acceso a 29+ voces en múltiples idiomas**

### ❌ Lo que NO funciona:

- ~~Clonar tu propia voz~~ (requiere plan Starter)
- ~~Subir muestras de audio~~ (requiere plan Starter)
- ~~Voces personalizadas~~ (requiere plan Starter)

## 💎 Plan STARTER ($5/mes)

### ✅ Todo del plan Free +

- **✨ Clonación instantánea de voz** (Instant Voice Cloning)
- **10 voces clonadas**
- **30,000 caracteres/mes** (3x más que Free)
- **Descarga de audio**
- **Acceso comercial**

## 🎯 ¿Qué puedes hacer AHORA sin pagar?

### 1. Usar Voces Predefinidas

Puedes generar narración con las voces que vienen incluidas:

```bash
# Español - Rachel (voz femenina clara)
voice_id: 21m00Tcm4TlvDq8ikWAM

# Inglés - Adam (voz masculina profunda, estilo documental)
voice_id: pNInz6obpgDQGcFmaJgB

# Y muchas más en diferentes idiomas...
```

### 2. Probar la Generación de Audio

Desde el frontend o con curl:

```bash
curl -X POST https://subiteya-1.onrender.com/api/elevenlabs/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hola, este es un video increíble sobre tecnología",
    "voice_id": "21m00Tcm4TlvDq8ikWAM"
  }' \
  --output narration.mp3
```

### 3. Integrar con Videos

Puedes usar las voces predefinidas para agregar narración automática a tus videos de TikTok:

1. Ve a `/patterns` (editor de patrones)
2. Selecciona una voz predefinida de la lista
3. Sube un video
4. El sistema generará la narración automáticamente

## 🔄 Flujo Recomendado

### Opción A: Sin Pagar (Plan Free)

```
1. Usa voces predefinidas de ElevenLabs
2. Genera narración para tus videos
3. 10,000 caracteres/mes es suficiente para ~70 videos cortos
4. Prueba diferentes voces hasta encontrar la que te guste
```

### Opción B: Con Plan Starter ($5/mes)

```
1. Actualiza a plan Starter en elevenlabs.io/pricing
2. Graba 1-2 minutos de tu voz leyendo texto variado
3. Clona tu voz en /voices
4. Usa tu voz clonada para todos tus videos
5. 30,000 caracteres/mes = ~200 videos cortos
```

## 📊 Comparación de Planes

| Feature            | Free   | Starter ($5)  | Creator ($22)   |
| ------------------ | ------ | ------------- | --------------- |
| Caracteres/mes     | 10,000 | 30,000        | 100,000         |
| Voces predefinidas | ✅     | ✅            | ✅              |
| Clonación de voz   | ❌     | ✅ (10 voces) | ✅ (Ilimitadas) |
| Calidad            | Básica | Instantánea   | Profesional     |
| Uso comercial      | ❌     | ✅            | ✅              |
| API access         | ✅     | ✅            | ✅              |

## 🎤 Voces Predefinidas Recomendadas

### Para Español (ES)

- **Rachel** (`21m00Tcm4TlvDq8ikWAM`) - Mujer, clara y profesional
- **Liam** - Hombre, joven y energético
- **Grace** - Mujer, cálida y amigable

### Para Inglés (EN)

- **Adam** (`pNInz6obpgDQGcFmaJgB`) - Hombre, profundo estilo documental
- **Bella** - Mujer, suave y relajante
- **Josh** - Hombre, narrador profesional

### Listar TODAS las voces:

```bash
curl https://subiteya-1.onrender.com/api/elevenlabs/voices \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 💡 Recomendación

**Para empezar:** Usa el plan Free con voces predefinidas. Prueba diferentes voces hasta encontrar una que te guste.

**Si necesitas personalización:** Actualiza a Starter cuando:

- Quieras usar tu propia voz
- Necesites más de 10k caracteres/mes
- Quieras uso comercial

## 🔗 Links Útiles

- **Actualizar Plan:** https://elevenlabs.io/pricing
- **Ver Planes:** https://elevenlabs.io/app/subscription
- **Voice Library:** https://elevenlabs.io/voice-library
- **Documentación:** https://elevenlabs.io/docs

## ✅ Próximos Pasos (Sin Pagar)

1. ✅ Listar voces disponibles desde `/voices`
2. ✅ Probar generación de audio con diferentes voces
3. ✅ Integrar voz predefinida en un video de prueba
4. ⏱️ Monitorear uso de caracteres en ElevenLabs dashboard
5. 🎯 Decidir si necesitas plan pago basado en tu uso

---

**¿Preguntas?** El plan Free es suficiente para empezar y hacer pruebas. Solo necesitas pagar si quieres clonar tu propia voz o generar más de 10k caracteres/mes.
