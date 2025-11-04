import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { Slider } from '../components/Slider/Slider';
import { Toggle } from '../components/Toggle/Toggle';
import { Select } from '../components/Select/Select';
import { ColorPicker } from '../components/ColorPicker/ColorPicker';
import { Tabs, TabPanel } from '../components/Tabs/Tabs';
import { Section } from '../components/Section/Section';
import {
  FilterPresetCard,
  FILTER_PRESETS_VISUAL,
} from '../components/FilterPresetCard/FilterPresetCard';
import { EnhancedSlider } from '../components/EnhancedSlider/EnhancedSlider';
import { BeforeAfterPreview } from '../components/BeforeAfterPreview/BeforeAfterPreview';
import { LogoUploader } from '../components/LogoUploader/LogoUploader';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { API_ENDPOINTS } from '../config/api';
import './PatternEditorPage.css';

interface Pattern {
  id: string;
  name: string;
  isDefault: boolean;
  version: number;
  logoUrl: string | null;
  logoPosition: string;
  logoSize: number;
  logoOpacity: number;
  thumbnailUrl: string | null;
  tiktokConnectionId: string;

  // Color Grading (9 fields)
  enableColorGrading: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  hue: number;
  exposure: number;
  highlights: number;
  shadows: number;

  // Effects (5 fields)
  enableEffects: boolean;
  filterType: string;
  vignette: number;
  sharpen: number;
  blur: number;
  grain: number;

  // Speed & Motion (4 fields)
  speedMultiplier: number;
  enableSmoothSlowMotion: boolean;
  enableStabilization: boolean;
  enableDenoise: boolean;
  denoiseStrength: number;

  // Auto Crop (3 fields)
  enableAutoCrop: boolean;
  aspectRatio: string;
  cropPosition: string;

  // Audio (4 fields)
  audioVolume: number;
  audioNormalize: boolean;
  enableBackgroundMusic: boolean;
  backgroundMusicVolume: number;

  // Subtitles (7 fields)
  enableSubtitles: boolean;
  subtitleStyle: string;
  subtitlePosition: string;
  subtitleColor: string;
  subtitleBgColor: string;
  subtitleFontSize: number;
  subtitleAnimation: string;
  subtitleFontFamily: string;

  // Quality (3 fields)
  outputQuality: string;
  outputBitrate: string;
  outputFps: number;

  // Transitions (1 field)
  transitionType: string;
}

const LOGO_POSITIONS = [
  { value: 'top-left', label: 'Superior Izquierda' },
  { value: 'top-right', label: 'Superior Derecha' },
  { value: 'bottom-left', label: 'Inferior Izquierda' },
  { value: 'bottom-right', label: 'Inferior Derecha' },
  { value: 'center', label: 'Centro' },
];

// Using FILTER_PRESETS_VISUAL from FilterPresetCard instead

const ASPECT_RATIOS = [
  { value: 'original', label: 'Original' },
  { value: '9:16', label: '9:16 (TikTok/Reels)' },
  { value: '16:9', label: '16:9 (YouTube)' },
  { value: '1:1', label: '1:1 (Cuadrado)' },
  { value: '4:5', label: '4:5 (Instagram Feed)' },
];

const CROP_POSITIONS = [
  { value: 'center', label: 'Centro' },
  { value: 'top', label: 'Superior' },
  { value: 'bottom', label: 'Inferior' },
  { value: 'left', label: 'Izquierda' },
  { value: 'right', label: 'Derecha' },
];

const SUBTITLE_ANIMATIONS = [
  { value: 'none', label: 'Sin animación' },
  { value: 'fade', label: 'Fade In/Out' },
  { value: 'slide', label: 'Deslizar' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Máquina de escribir' },
];

const SUBTITLE_FONTS = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Impact', label: 'Impact' },
];

const QUALITY_PRESETS = [
  { value: 'low', label: 'Baja (Rápido)' },
  { value: 'medium', label: 'Media (Recomendada)' },
  { value: 'high', label: 'Alta (Mejor calidad)' },
  { value: 'ultra', label: 'Ultra (Máxima calidad)' },
];

const BITRATE_OPTIONS = [
  { value: '1000k', label: '1 Mbps' },
  { value: '2000k', label: '2 Mbps (Recomendado)' },
  { value: '4000k', label: '4 Mbps' },
  { value: '8000k', label: '8 Mbps (Alta)' },
  { value: '15000k', label: '15 Mbps (Ultra)' },
];

const TRANSITION_TYPES = [
  { value: 'none', label: 'Sin transición' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'slide', label: 'Slide' },
];

export const PatternEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, token } = useAuthStore();
  const { connections, fetchConnections } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Basic Info
  const [name, setName] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [logoSize, setLogoSize] = useState(15);
  const [logoOpacity, setLogoOpacity] = useState(100);

  // Active Tab
  const [activeTab, setActiveTab] = useState('colorGrading');

  // Color Grading (9 fields)
  const [enableColorGrading, setEnableColorGrading] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [temperature, setTemperature] = useState(0);
  const [tint, setTint] = useState(0);
  const [hue, setHue] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [highlights, setHighlights] = useState(0);
  const [shadows, setShadows] = useState(0);

  // Effects (5 fields)
  const [enableEffects, setEnableEffects] = useState(false);
  const [filterType, setFilterType] = useState('none');
  const [vignette, setVignette] = useState(0);
  const [sharpen, setSharpen] = useState(0);
  const [blur, setBlur] = useState(0);
  const [grain, setGrain] = useState(0);

  // Speed & Motion (4 fields)
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [enableSmoothSlowMotion, setEnableSmoothSlowMotion] = useState(false);
  const [enableStabilization, setEnableStabilization] = useState(false);
  const [enableDenoise, setEnableDenoise] = useState(false);
  const [denoiseStrength, setDenoiseStrength] = useState(0.5);

  // Auto Crop (3 fields)
  const [enableAutoCrop, setEnableAutoCrop] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('original');
  const [cropPosition, setCropPosition] = useState('center');

  // Audio (4 fields)
  const [audioVolume, setAudioVolume] = useState(100);
  const [audioNormalize, setAudioNormalize] = useState(false);
  const [enableBackgroundMusic, setEnableBackgroundMusic] = useState(false);
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(50);

  // Subtitles (7 fields)
  const [enableSubtitles, setEnableSubtitles] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState('modern');
  const [subtitlePosition, setSubtitlePosition] = useState('bottom');
  const [subtitleColor, setSubtitleColor] = useState('#FFFFFF');
  const [subtitleBgColor, setSubtitleBgColor] = useState('#000000');
  const [subtitleFontSize, setSubtitleFontSize] = useState(24);
  const [subtitleAnimation, setSubtitleAnimation] = useState('none');
  const [subtitleFontFamily, setSubtitleFontFamily] = useState('Arial');

  // Quality (3 fields)
  const [outputQuality, setOutputQuality] = useState('medium');
  const [outputBitrate, setOutputBitrate] = useState('2000k');
  const [outputFps, setOutputFps] = useState(30);

  // Transitions (1 field)
  const [transitionType, setTransitionType] = useState('none');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      fetchConnections(token);
      if (id && id !== 'new') {
        loadPattern(token, id);
      }
    }
  }, [isAuthenticated, token, id, navigate, fetchConnections]);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logoFile]);

  // Generate preview when settings change
  useEffect(() => {
    generatePreview();
  }, [logoUrl, previewUrl, logoPosition, logoSize, logoOpacity]);

  const loadPattern = async (authToken: string, patternId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.patterns}/${patternId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const pattern: Pattern = data.pattern;

        // Basic Info
        setName(pattern.name);
        setConnectionId(pattern.tiktokConnectionId);
        setIsDefault(pattern.isDefault);

        // Logo
        setLogoUrl(pattern.logoUrl || '');
        setLogoPosition(pattern.logoPosition);
        setLogoSize(pattern.logoSize);
        setLogoOpacity(pattern.logoOpacity);

        // Color Grading
        setEnableColorGrading(pattern.enableColorGrading || false);
        setBrightness(pattern.brightness || 100);
        setContrast(pattern.contrast || 100);
        setSaturation(pattern.saturation || 100);
        setTemperature(pattern.temperature || 0);
        setTint(pattern.tint || 0);
        setHue(pattern.hue || 0);
        setExposure(pattern.exposure || 0);
        setHighlights(pattern.highlights || 0);
        setShadows(pattern.shadows || 0);

        // Effects
        setEnableEffects(pattern.enableEffects || false);
        setFilterType(pattern.filterType || 'none');
        setVignette(pattern.vignette || 0);
        setSharpen(pattern.sharpen || 0);
        setBlur(pattern.blur || 0);
        setGrain(pattern.grain || 0);

        // Speed & Motion
        setSpeedMultiplier(pattern.speedMultiplier || 1);
        setEnableSmoothSlowMotion(pattern.enableSmoothSlowMotion || false);
        setEnableStabilization(pattern.enableStabilization || false);
        setEnableDenoise(pattern.enableDenoise || false);
        setDenoiseStrength(pattern.denoiseStrength || 0.5);

        // Auto Crop
        setEnableAutoCrop(pattern.enableAutoCrop || false);
        setAspectRatio(pattern.aspectRatio || 'original');
        setCropPosition(pattern.cropPosition || 'center');

        // Audio
        setAudioVolume(pattern.audioVolume || 100);
        setAudioNormalize(pattern.audioNormalize || false);
        setEnableBackgroundMusic(pattern.enableBackgroundMusic || false);
        setBackgroundMusicVolume(pattern.backgroundMusicVolume || 50);

        // Subtitles
        setEnableSubtitles(pattern.enableSubtitles || false);
        setSubtitleStyle(pattern.subtitleStyle || 'modern');
        setSubtitlePosition(pattern.subtitlePosition || 'bottom');
        setSubtitleColor(pattern.subtitleColor || '#FFFFFF');
        setSubtitleBgColor(pattern.subtitleBgColor || '#000000');
        setSubtitleFontSize(pattern.subtitleFontSize || 24);
        setSubtitleAnimation(pattern.subtitleAnimation || 'none');
        setSubtitleFontFamily(pattern.subtitleFontFamily || 'Arial');

        // Quality
        setOutputQuality(pattern.outputQuality || 'medium');
        setOutputBitrate(pattern.outputBitrate || '2000k');
        setOutputFps(pattern.outputFps || 30);

        // Transitions
        setTransitionType(pattern.transitionType || 'none');
      }
    } catch (error) {
      console.error('Error loading pattern:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (9:16 aspect ratio - TikTok format)
    const width = 360;
    const height = 640;
    canvas.width = width;
    canvas.height = height;

    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw safe zones guides
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Top safe zone
    ctx.strokeRect(0, 0, width, 80);
    // Bottom safe zone
    ctx.strokeRect(0, height - 120, width, 120);

    // Draw sample text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Preview del Patrón', width / 2, height / 2);

    // Load and draw logo
    const logoSrc = previewUrl || logoUrl;
    if (logoSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const logoWidth = (width * logoSize) / 100;
        const logoHeight = (img.height / img.width) * logoWidth;

        let x = 0;
        let y = 0;

        // Calculate position
        switch (logoPosition) {
          case 'top-left':
            x = 20;
            y = 20;
            break;
          case 'top-right':
            x = width - logoWidth - 20;
            y = 20;
            break;
          case 'bottom-left':
            x = 20;
            y = height - logoHeight - 20;
            break;
          case 'bottom-right':
            x = width - logoWidth - 20;
            y = height - logoHeight - 20;
            break;
          case 'center':
            x = (width - logoWidth) / 2;
            y = (height - logoHeight) / 2;
            break;
        }

        // Apply opacity
        ctx.globalAlpha = logoOpacity / 100;
        ctx.drawImage(img, x, y, logoWidth, logoHeight);
        ctx.globalAlpha = 1;

        // Highlight safe zone violations
        if (y < 80 || y + logoHeight > height - 120) {
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.lineWidth = 3;
          ctx.setLineDash([]);
          ctx.strokeRect(x - 2, y - 2, logoWidth + 4, logoHeight + 4);
        }
      };
      img.src = logoSrc;
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !token) return null;

    const formData = new FormData();
    formData.append('logo', logoFile);

    try {
      const response = await fetch(API_ENDPOINTS.uploadLogo, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.logoUrl;
      }
      return null;
    } catch (error) {
      console.error('Error uploading logo:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!token || !name || !connectionId) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setSaving(true);
    try {
      // Upload logo if there's a new file
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        const uploaded = await uploadLogo();
        if (uploaded) {
          finalLogoUrl = uploaded;
        }
      }

      // Generate thumbnail from canvas
      const canvas = canvasRef.current;
      const thumbnailUrl = canvas?.toDataURL('image/png') || null;

      const body = {
        name,
        tiktokConnectionId: connectionId,
        logoUrl: finalLogoUrl,
        logoPosition,
        logoSize,
        logoOpacity,
        thumbnailUrl,
        isDefault,

        // Color Grading
        enableColorGrading,
        brightness,
        contrast,
        saturation,
        temperature,
        tint,
        hue,
        exposure,
        highlights,
        shadows,

        // Effects
        enableEffects,
        filterType,
        vignette,
        sharpen,
        blur,
        grain,

        // Speed & Motion
        speedMultiplier,
        enableSmoothSlowMotion,
        enableStabilization,
        enableDenoise,
        denoiseStrength,

        // Auto Crop
        enableAutoCrop,
        aspectRatio,
        cropPosition,

        // Audio
        audioVolume,
        audioNormalize,
        enableBackgroundMusic,
        backgroundMusicVolume,

        // Subtitles
        enableSubtitles,
        subtitleStyle,
        subtitlePosition,
        subtitleColor,
        subtitleBgColor,
        subtitleFontSize,
        subtitleAnimation,
        subtitleFontFamily,

        // Quality
        outputQuality,
        outputBitrate,
        outputFps,

        // Transitions
        transitionType,
      };

      const url =
        id && id !== 'new'
          ? `${API_ENDPOINTS.patterns}/${id}`
          : API_ENDPOINTS.patterns;

      const method = id && id !== 'new' ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (response.ok) {
        navigate('/patterns');
      } else {
        const error = await response.json();
        alert(error.message || 'Error al guardar patrón');
      }
    } catch (error) {
      console.error('Error saving pattern:', error);
      alert('Error al guardar patrón');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-page">Cargando patrón...</div>;
  }

  const tabs = [
    { id: 'logo', label: 'Logo', icon: '🎨' },
    { id: 'colorGrading', label: 'Color', icon: '🌈' },
    { id: 'effects', label: 'Efectos', icon: '✨' },
    { id: 'speed', label: 'Velocidad', icon: '⚡' },
    { id: 'crop', label: 'Recorte', icon: '✂️' },
    { id: 'audio', label: 'Audio', icon: '🎵' },
    { id: 'subtitles', label: 'Subtítulos', icon: '💬' },
    { id: 'quality', label: 'Calidad', icon: '⚙️' },
  ];

  return (
    <div className="pattern-editor-page">
      <div className="editor-header">
        <div>
          <h1 className="editor-title">
            {id && id !== 'new' ? 'Editar Patrón' : 'Nuevo Patrón'}
          </h1>
          <p className="editor-subtitle">
            Configura el estilo de tu marca con opciones profesionales al estilo
            CapCut
          </p>
        </div>
        <div className="editor-actions">
          <Button variant="ghost" onClick={() => navigate('/patterns')}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Patrón'}
          </Button>
        </div>
      </div>

      <div className="editor-layout">
        {/* Left Panel - Settings */}
        <Card className="editor-settings">
          <h2 className="section-title">
            ⚙️ Configuración Avanzada del Patrón
          </h2>

          {/* Basic Info */}
          <Section title="Información Básica" columns={1}>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del patrón"
            />

            <Select
              label="Cuenta de TikTok *"
              value={connectionId}
              onChange={setConnectionId}
              options={[
                { value: '', label: 'Selecciona una cuenta' },
                ...connections.map(conn => ({
                  value: conn.id,
                  label: conn.displayName,
                })),
              ]}
              disabled={id !== 'new'}
            />

            <Toggle
              label="Patrón Predeterminado"
              description="Se aplicará automáticamente a todos los videos"
              checked={isDefault}
              onChange={setIsDefault}
            />
          </Section>

          {/* Tabs for Settings */}
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
            {/* Logo Tab */}
            <TabPanel id="logo" activeTab={activeTab}>
              <Section title="Logo / Marca de Agua" columns={1}>
                <LogoUploader
                  currentLogo={logoUrl}
                  previewUrl={previewUrl}
                  onFileSelect={setLogoFile}
                />

                <Select
                  label="Posición del Logo"
                  value={logoPosition}
                  onChange={setLogoPosition}
                  options={LOGO_POSITIONS}
                />

                <Slider
                  label="Tamaño del Logo"
                  value={logoSize}
                  onChange={setLogoSize}
                  min={5}
                  max={40}
                  step={1}
                  unit="%"
                />

                <Slider
                  label="Opacidad"
                  value={logoOpacity}
                  onChange={setLogoOpacity}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
              </Section>
            </TabPanel>

            {/* Color Grading Tab */}
            <TabPanel id="colorGrading" activeTab={activeTab}>
              <Section
                title="Corrección de Color"
                description="Ajusta los colores del video con controles profesionales"
                columns={2}
              >
                <Toggle
                  label="Activar Corrección de Color"
                  checked={enableColorGrading}
                  onChange={setEnableColorGrading}
                />
              </Section>

              {enableColorGrading && (
                <>
                  <Section title="Ajustes Básicos" columns={1}>
                    <EnhancedSlider
                      label="Brillo"
                      value={brightness}
                      onChange={setBrightness}
                      min={50}
                      max={150}
                      step={1}
                      unit="%"
                      type="brightness"
                      description="Ajusta la luminosidad general del video"
                    />

                    <EnhancedSlider
                      label="Contraste"
                      value={contrast}
                      onChange={setContrast}
                      min={50}
                      max={150}
                      step={1}
                      unit="%"
                      type="contrast"
                      description="Diferencia entre áreas claras y oscuras"
                    />

                    <EnhancedSlider
                      label="Saturación"
                      value={saturation}
                      onChange={setSaturation}
                      min={0}
                      max={200}
                      step={1}
                      unit="%"
                      type="saturation"
                      description="Intensidad de los colores"
                    />

                    <EnhancedSlider
                      label="Exposición"
                      value={exposure}
                      onChange={setExposure}
                      min={-100}
                      max={100}
                      step={1}
                      unit=""
                      type="exposure"
                      description="Cantidad de luz en la imagen"
                    />
                  </Section>

                  <Section title="Balance de Color" columns={1}>
                    <EnhancedSlider
                      label="Temperatura"
                      value={temperature}
                      onChange={setTemperature}
                      min={-100}
                      max={100}
                      step={1}
                      unit=""
                      type="temperature"
                      description="Tonos cálidos (naranja) o fríos (azul)"
                    />

                    <EnhancedSlider
                      label="Tinte"
                      value={tint}
                      onChange={setTint}
                      min={-100}
                      max={100}
                      step={1}
                      unit=""
                      type="tint"
                      description="Balance entre magenta y verde"
                    />

                    <EnhancedSlider
                      label="Matiz (Hue)"
                      value={hue}
                      onChange={setHue}
                      min={-180}
                      max={180}
                      step={1}
                      unit="°"
                      type="hue"
                      description="Desplaza todos los colores en el espectro"
                    />
                  </Section>

                  <Section title="Tonos" columns={1}>
                    <EnhancedSlider
                      label="Altas Luces"
                      value={highlights}
                      onChange={setHighlights}
                      min={-100}
                      max={100}
                      step={1}
                      unit=""
                      type="default"
                      description="Recupera detalle en las zonas más brillantes"
                    />

                    <EnhancedSlider
                      label="Sombras"
                      value={shadows}
                      onChange={setShadows}
                      min={-100}
                      max={100}
                      step={1}
                      unit=""
                      type="default"
                      description="Ilumina o oscurece las áreas oscuras"
                    />
                  </Section>
                </>
              )}
            </TabPanel>

            {/* Effects Tab */}
            <TabPanel id="effects" activeTab={activeTab}>
              <Section
                title="Efectos Visuales"
                description="Aplica filtros y efectos artísticos"
                columns={1}
              >
                <Toggle
                  label="Activar Efectos"
                  checked={enableEffects}
                  onChange={setEnableEffects}
                />
              </Section>

              {enableEffects && (
                <>
                  <Section title="Filtros Predefinidos" columns={1}>
                    <div className="filter-presets-grid">
                      {FILTER_PRESETS_VISUAL.map(preset => (
                        <FilterPresetCard
                          key={preset.value}
                          preset={preset}
                          selected={filterType === preset.value}
                          onClick={() => setFilterType(preset.value)}
                        />
                      ))}
                    </div>

                    <Select
                      label="Transiciones entre clips"
                      value={transitionType}
                      onChange={setTransitionType}
                      options={TRANSITION_TYPES}
                    />
                  </Section>

                  <Section title="Efectos Personalizados" columns={1}>
                    <EnhancedSlider
                      label="Viñeta"
                      value={vignette}
                      onChange={setVignette}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      type="default"
                      description="Oscurece las esquinas para enfocar al centro"
                    />

                    <EnhancedSlider
                      label="Nitidez (Sharpen)"
                      value={sharpen}
                      onChange={setSharpen}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      type="default"
                      description="Aumenta la definición de bordes y detalles"
                    />

                    <EnhancedSlider
                      label="Desenfoque"
                      value={blur}
                      onChange={setBlur}
                      min={0}
                      max={10}
                      step={0.1}
                      unit=""
                      type="default"
                      description="Suaviza la imagen (útil para fondos)"
                    />

                    <EnhancedSlider
                      label="Grano de Película"
                      value={grain}
                      onChange={setGrain}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      type="default"
                      description="Añade textura de película analógica"
                    />
                  </Section>
                </>
              )}
            </TabPanel>

            {/* Speed & Motion Tab */}
            <TabPanel id="speed" activeTab={activeTab}>
              <Section
                title="Velocidad y Movimiento"
                description="Control de velocidad y estabilización del video"
                columns={1}
              >
                <EnhancedSlider
                  label="Velocidad"
                  value={speedMultiplier}
                  onChange={setSpeedMultiplier}
                  min={0.25}
                  max={4}
                  step={0.25}
                  unit="x"
                  type="speed"
                  description="0.25x-0.75x = Slow Motion, 1.0x = Normal, 1.5x-4.0x = Fast Forward"
                />
              </Section>

              <Section title="Opciones Avanzadas" columns={2}>
                <Toggle
                  label="Cámara Lenta Suave"
                  description="Interpolación de frames para slow motion fluido"
                  checked={enableSmoothSlowMotion}
                  onChange={setEnableSmoothSlowMotion}
                />

                <Toggle
                  label="Estabilización"
                  description="Reduce el movimiento de cámara"
                  checked={enableStabilization}
                  onChange={setEnableStabilization}
                />

                <Toggle
                  label="Reducción de Ruido"
                  description="Limpia el ruido visual del video"
                  checked={enableDenoise}
                  onChange={setEnableDenoise}
                />
              </Section>

              {enableDenoise && (
                <Section
                  title="Configuración de Reducción de Ruido"
                  columns={1}
                >
                  <EnhancedSlider
                    label="Intensidad"
                    value={denoiseStrength}
                    onChange={setDenoiseStrength}
                    min={0}
                    max={1}
                    step={0.1}
                    unit=""
                    type="default"
                    description="Mayor valor = Menos ruido pero puede perder detalles"
                  />
                </Section>
              )}
            </TabPanel>

            {/* Auto Crop Tab */}
            <TabPanel id="crop" activeTab={activeTab}>
              <Section
                title="Recorte Inteligente"
                description="Ajusta el formato del video automáticamente"
                columns={2}
              >
                <Toggle
                  label="Recorte Automático"
                  description="Convierte automáticamente al formato seleccionado"
                  checked={enableAutoCrop}
                  onChange={setEnableAutoCrop}
                />

                {enableAutoCrop && (
                  <>
                    <Select
                      label="Relación de Aspecto"
                      value={aspectRatio}
                      onChange={setAspectRatio}
                      options={ASPECT_RATIOS}
                    />

                    <Select
                      label="Posición de Recorte"
                      value={cropPosition}
                      onChange={setCropPosition}
                      options={CROP_POSITIONS}
                    />
                  </>
                )}
              </Section>
            </TabPanel>

            {/* Audio Tab */}
            <TabPanel id="audio" activeTab={activeTab}>
              <Section
                title="Ajustes de Audio"
                description="Control de volumen y música de fondo"
                columns={1}
              >
                <EnhancedSlider
                  label="Volumen del Audio"
                  value={audioVolume}
                  onChange={setAudioVolume}
                  min={0}
                  max={200}
                  step={5}
                  unit="%"
                  type="volume"
                  description="100% = Normal, >100% = Amplificado, <100% = Reducido"
                />
              </Section>

              <Section title="Optimización" columns={2}>
                <Toggle
                  label="Normalizar Audio"
                  description="Ajusta el volumen para evitar picos y distorsiones"
                  checked={audioNormalize}
                  onChange={setAudioNormalize}
                />

                <Toggle
                  label="Música de Fondo"
                  description="Agrega una pista musical al video"
                  checked={enableBackgroundMusic}
                  onChange={setEnableBackgroundMusic}
                />
              </Section>

              {enableBackgroundMusic && (
                <Section title="Configuración de Música" columns={1}>
                  <EnhancedSlider
                    label="Volumen de Música de Fondo"
                    value={backgroundMusicVolume}
                    onChange={setBackgroundMusicVolume}
                    min={0}
                    max={100}
                    step={5}
                    unit="%"
                    type="volume"
                    description="Balance entre la música y el audio original"
                  />
                </Section>
              )}
            </TabPanel>

            {/* Subtitles Tab */}
            <TabPanel id="subtitles" activeTab={activeTab}>
              <Section
                title="Subtítulos Automáticos"
                description="Transcripción con IA y subtítulos estilizados"
                columns={1}
              >
                <Toggle
                  label="Generar Subtítulos"
                  description="Usa IA para transcribir el audio automáticamente"
                  checked={enableSubtitles}
                  onChange={setEnableSubtitles}
                />
              </Section>

              {enableSubtitles && (
                <>
                  <Section title="Estilo de Subtítulos" columns={2}>
                    <Select
                      label="Estilo"
                      value={subtitleStyle}
                      onChange={setSubtitleStyle}
                      options={[
                        { value: 'modern', label: 'Moderno (TikTok)' },
                        { value: 'classic', label: 'Clásico' },
                        { value: 'bold', label: 'Negrita + Sombra' },
                        { value: 'outlined', label: 'Contorneado' },
                        { value: 'boxed', label: 'Con Fondo' },
                      ]}
                    />

                    <Select
                      label="Posición"
                      value={subtitlePosition}
                      onChange={setSubtitlePosition}
                      options={[
                        { value: 'top', label: 'Superior' },
                        { value: 'center', label: 'Centro' },
                        { value: 'bottom', label: 'Inferior' },
                      ]}
                    />

                    <Select
                      label="Animación"
                      value={subtitleAnimation}
                      onChange={setSubtitleAnimation}
                      options={SUBTITLE_ANIMATIONS}
                    />

                    <Select
                      label="Fuente"
                      value={subtitleFontFamily}
                      onChange={setSubtitleFontFamily}
                      options={SUBTITLE_FONTS}
                    />
                  </Section>

                  <Section title="Colores y Tamaño" columns={2}>
                    <ColorPicker
                      label="Color del Texto"
                      value={subtitleColor}
                      onChange={setSubtitleColor}
                    />

                    <ColorPicker
                      label="Color del Fondo"
                      value={subtitleBgColor}
                      onChange={setSubtitleBgColor}
                    />
                  </Section>

                  <Section title="Tamaño de Texto" columns={1}>
                    <EnhancedSlider
                      label="Tamaño de Fuente"
                      value={subtitleFontSize}
                      onChange={setSubtitleFontSize}
                      min={16}
                      max={72}
                      step={2}
                      unit="px"
                      type="default"
                      description="16-24px = Pequeño, 32-48px = Medio, 56-72px = Grande"
                    />
                  </Section>
                </>
              )}
            </TabPanel>

            {/* Quality Tab */}
            <TabPanel id="quality" activeTab={activeTab}>
              <Section
                title="Configuración de Salida"
                description="Calidad y formato del video procesado"
                columns={2}
              >
                <Select
                  label="Calidad de Salida"
                  value={outputQuality}
                  onChange={setOutputQuality}
                  options={QUALITY_PRESETS}
                />

                <Select
                  label="Bitrate"
                  value={outputBitrate}
                  onChange={setOutputBitrate}
                  options={BITRATE_OPTIONS}
                />
              </Section>

              <Section title="FPS y Fluidez" columns={1}>
                <EnhancedSlider
                  label="Frames por Segundo (FPS)"
                  value={outputFps}
                  onChange={setOutputFps}
                  min={24}
                  max={60}
                  step={6}
                  unit=" fps"
                  type="default"
                  description="24fps = Cinemático, 30fps = Standard, 60fps = Ultra Suave"
                />
              </Section>
            </TabPanel>
          </Tabs>
        </Card>

        {/* Right Panel - Preview */}
        <Card className="editor-preview">
          <h2 className="section-title">👁️ Vista Previa Interactiva</h2>
          <p className="preview-description">
            Compara cómo se verá tu video antes y después de aplicar los
            efectos. Arrastra el control para ver la diferencia en tiempo real.
          </p>

          <BeforeAfterPreview
            brightness={brightness}
            contrast={contrast}
            saturation={saturation}
            filterType={filterType}
            vignette={vignette}
            logoUrl={previewUrl || logoUrl}
            logoPosition={logoPosition}
            logoSize={logoSize}
            logoOpacity={logoOpacity}
            enableSubtitles={enableSubtitles}
            subtitleStyle={subtitleStyle}
            subtitlePosition={subtitlePosition}
            subtitleColor={subtitleColor}
            subtitleBgColor={subtitleBgColor}
            subtitleFontSize={subtitleFontSize}
            subtitleAnimation={subtitleAnimation}
            subtitleFontFamily={subtitleFontFamily}
            enableAutoCrop={enableAutoCrop}
            aspectRatio={aspectRatio}
            cropPosition={cropPosition}
          />

          <div className="preview-info">
            <div className="info-item">
              <span className="info-label">Formato:</span>
              <span className="info-value">9:16 (TikTok)</span>
            </div>
            <div className="info-item">
              <span className="info-label">Resolución:</span>
              <span className="info-value">1080x1920</span>
            </div>
            <div className="info-item">
              <span className="info-label">Configuración:</span>
              <span className="info-value">
                {enableColorGrading ? '✓ Color' : ''}{' '}
                {enableEffects ? '✓ Efectos' : ''}{' '}
                {enableSubtitles ? '✓ Subtítulos' : ''}
                {!enableColorGrading && !enableEffects && !enableSubtitles
                  ? 'Básica'
                  : ''}
              </span>
            </div>
          </div>

          {logoPosition !== 'center' && (
            <div className="preview-tips">
              <strong>💡 Tip:</strong> El logo está en zona segura ✓
            </div>
          )}

          {/* Legacy canvas preview (hidden) */}
          <div style={{ display: 'none' }}>
            <canvas ref={canvasRef} className="preview-canvas" />
          </div>
        </Card>
      </div>
    </div>
  );
};
