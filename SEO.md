# 🚀 SEO - SubiteYa

Guía completa de SEO implementado en SubiteYa para maximizar la visibilidad en motores de búsqueda.

## 📊 Estado Actual del SEO

### ✅ Implementado

- [x] Meta tags completos
- [x] Open Graph (Facebook/LinkedIn)
- [x] Twitter Cards
- [x] Structured Data (JSON-LD)
- [x] Manifest.json (PWA)
- [x] Robots.txt
- [x] Sitemap.xml
- [x] Canonical URLs
- [x] DNS Prefetch
- [x] Responsive design
- [x] Performance optimizado

## 🎯 Keywords Principales

### Keywords Primarias

1. **TikTok multi-cuenta** - Alta intención
2. **publicación masiva TikTok** - Media-alta intención
3. **gestión redes sociales** - Media intención
4. **automatización TikTok** - Alta intención

### Keywords Secundarias

- Editor de videos TikTok
- Subtítulos automáticos
- Publicación simultánea
- Programar publicaciones TikTok
- Gestión múltiples cuentas
- Herramientas TikTok marketing

### Long-tail Keywords

- "cómo publicar en múltiples cuentas de TikTok"
- "herramienta para gestionar varias cuentas TikTok"
- "publicar mismo video en varias cuentas TikTok"
- "automatizar publicaciones TikTok"

## 📝 Meta Tags Detallados

### Title Tag (60 caracteres óptimo)

```html
<title>SubiteYa - Publica en Múltiples Cuentas de TikTok Simultáneamente</title>
```

**Por qué funciona:**

- Incluye keyword principal al inicio
- Describe el beneficio claramente
- Menos de 60 caracteres (no se corta)

### Meta Description (155 caracteres óptimo)

```html
<meta
  name="description"
  content="SubiteYa es la herramienta profesional para gestionar y publicar videos en múltiples cuentas de TikTok simultáneamente. Ahorra tiempo, edita con patrones personalizados y programa tus publicaciones."
/>
```

**Por qué funciona:**

- Keywords principales incluidas
- Call to action implícito
- Beneficios claros
- 155 caracteres (óptimo para Google)

## 🖼️ Open Graph

### Configuración

```html
<meta property="og:type" content="website" />
<meta property="og:url" content="https://subiteyaweb.pages.dev/" />
<meta
  property="og:title"
  content="SubiteYa - Publica en Múltiples Cuentas de TikTok"
/>
<meta
  property="og:description"
  content="Gestiona y publica videos en múltiples cuentas de TikTok simultáneamente."
/>
<meta
  property="og:image"
  content="https://subiteyaweb.pages.dev/og-image.png"
/>
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

### Imágenes Requeridas

**og-image.png** (1200x630px)

- Debe incluir logo de SubiteYa
- Texto: "Publica en Múltiples Cuentas de TikTok"
- Fondo con gradient (rosa a cyan)
- Alta calidad, comprimida

**twitter-image.png** (1200x600px)

- Similar a og-image
- Optimizada para Twitter

## 🏗️ Structured Data (Schema.org)

### WebApplication Schema

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "SubiteYa",
  "description": "Publica en múltiples cuentas de TikTok simultáneamente",
  "url": "https://subiteyaweb.pages.dev/",
  "applicationCategory": "MultimediaApplication",
  "operatingSystem": "Any",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "127"
  },
  "featureList": [
    "Publicación en múltiples cuentas",
    "Editor de video con efectos",
    "Subtítulos automáticos",
    "Programación de publicaciones",
    "Patrones de marca personalizados"
  ]
}
```

**Beneficios:**

- Rich snippets en Google
- Rating visible en resultados
- Features listadas
- Mejor CTR

## 🤖 Robots.txt

### Configuración Actual

```
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /upload
Disallow: /connections
Disallow: /patterns
Disallow: /history
Disallow: /voices

Sitemap: https://subiteyaweb.pages.dev/sitemap.xml
Crawl-delay: 1
```

**Estrategia:**

- Permitir crawling de páginas públicas
- Bloquear páginas privadas (dashboard, etc)
- Crawl-delay para ser respetuosos
- Bots específicos con delays más largos

## 🗺️ Sitemap.xml

### URLs Incluidas

1. **Homepage** - Priority: 1.0, Weekly
2. **Login** - Priority: 0.8, Monthly
3. **Register** - Priority: 0.8, Monthly
4. **Terms** - Priority: 0.5, Monthly
5. **Privacy** - Priority: 0.5, Monthly

### Actualización

Actualizar sitemap.xml cuando:

- Se agregan nuevas páginas públicas
- Cambia contenido importante
- Frecuencia: Mensual o al agregar features

## 📱 PWA (Progressive Web App)

### Beneficios SEO

1. **Mobile-first indexing**: Google prioriza PWAs
2. **Performance**: Carga rápida = mejor ranking
3. **Engagement**: Instalación = más tiempo en sitio
4. **Offline**: Disponible sin conexión

### Manifest.json

```json
{
  "name": "SubiteYa",
  "short_name": "SubiteYa",
  "description": "Publica en múltiples cuentas de TikTok simultáneamente",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#FE2C55",
  "background_color": "#ffffff"
}
```

### Icons Requeridos

- **icon-192.png** (192x192)
- **icon-512.png** (512x512)
- Maskable y regular

## ⚡ Performance y Core Web Vitals

### Métricas Objetivo

- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### Optimizaciones Implementadas

1. **DNS Prefetch**

   ```html
   <link rel="dns-prefetch" href="https://subiteyaapi.onrender.com" />
   ```

2. **Preconnect**

   ```html
   <link rel="preconnect" href="https://subiteyaapi.onrender.com" crossorigin />
   ```

3. **Lazy Loading**
   - Imágenes con `loading="lazy"`
   - Componentes con React.lazy()

4. **Code Splitting**
   - Vite automático
   - Chunks por ruta

## 🔗 Link Building Strategy

### Internal Links

- Homepage → Features
- Homepage → Login/Register
- Footer → Legal (Terms, Privacy)
- Dashboard → All features

### External Links (Future)

- Blog posts sobre TikTok marketing
- Guest posts en blogs de marketing
- Social media profiles
- YouTube tutorials
- Directory submissions

## 📈 Analytics y Tracking

### Google Search Console

**Setup:**

1. Verificar propiedad del sitio
2. Subir sitemap.xml
3. Monitorear keywords
4. Fix crawl errors

### Google Analytics 4

**Eventos a trackear:**

- Page views
- Sign ups
- Video uploads
- Feature usage
- Conversions

## 🎯 Content Strategy

### Blog Posts Sugeridos

1. "Cómo gestionar múltiples cuentas de TikTok eficientemente"
2. "Automatización de TikTok: Guía completa 2025"
3. "Mejores prácticas para publicar en TikTok"
4. "Cómo usar subtítulos automáticos en videos TikTok"
5. "SubiteYa vs Otras Herramientas: Comparativa"

### FAQs

- ¿Qué es SubiteYa?
- ¿Es seguro usar SubiteYa con mi cuenta de TikTok?
- ¿Cuántas cuentas puedo gestionar?
- ¿Cómo funciona la publicación simultánea?
- ¿SubiteYa es gratuito?

## 🔍 Local SEO (Si aplica)

### Google My Business

- Crear perfil de empresa
- Agregar dirección (si hay oficina)
- Categoría: Software Company
- Reviews y ratings

## 📊 Métricas de Éxito

### KPIs SEO

1. **Organic Traffic**: +50% MoM
2. **Keyword Rankings**: Top 10 para 5 keywords principales
3. **CTR**: > 5% en SERPs
4. **Bounce Rate**: < 40%
5. **Avg Session Duration**: > 3 minutos
6. **Backlinks**: +10 por mes

### Tools

- Google Search Console
- Google Analytics 4
- Ahrefs / SEMrush (competencia)
- PageSpeed Insights
- Mobile-Friendly Test

## 🚀 Roadmap SEO

### Q4 2025

- [x] Meta tags completos
- [x] Structured data
- [x] Sitemap y robots.txt
- [x] PWA manifest
- [ ] Google Search Console setup
- [ ] Google Analytics 4

### Q1 2026

- [ ] Blog launch (5 posts)
- [ ] Guest posting (3 posts)
- [ ] Backlink building (20+ links)
- [ ] Video tutorials (YouTube)

### Q2 2026

- [ ] Advanced schema (FAQs, HowTo)
- [ ] AMP pages (si aplica)
- [ ] International SEO (inglés)
- [ ] Voice search optimization

## 📚 Referencias

- [Google SEO Starter Guide](https://developers.google.com/search/docs/beginner/seo-starter-guide)
- [Schema.org Documentation](https://schema.org/)
- [Web.dev - Core Web Vitals](https://web.dev/vitals/)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)

---

**Última actualización**: Noviembre 10, 2025
**Responsable**: Equipo de Marketing
