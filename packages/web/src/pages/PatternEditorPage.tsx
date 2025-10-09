import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
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
}

const LOGO_POSITIONS = [
  { value: 'top-left', label: 'Superior Izquierda' },
  { value: 'top-right', label: 'Superior Derecha' },
  { value: 'bottom-left', label: 'Inferior Izquierda' },
  { value: 'bottom-right', label: 'Inferior Derecha' },
  { value: 'center', label: 'Centro' },
];

export const PatternEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, token } = useAuthStore();
  const { connections, fetchConnections } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [logoSize, setLogoSize] = useState(15);
  const [logoOpacity, setLogoOpacity] = useState(100);
  const [isDefault, setIsDefault] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/patterns/${patternId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        const pattern: Pattern = data.pattern;
        setName(pattern.name);
        setConnectionId(pattern.tiktokConnectionId);
        setLogoUrl(pattern.logoUrl || '');
        setLogoPosition(pattern.logoPosition);
        setLogoSize(pattern.logoSize);
        setLogoOpacity(pattern.logoOpacity);
        setIsDefault(pattern.isDefault);
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setLogoFile(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !token) return null;

    const formData = new FormData();
    formData.append('logo', logoFile);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/patterns/upload-logo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: formData,
        }
      );

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
      };

      const url =
        id && id !== 'new'
          ? `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/patterns/${id}`
          : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/patterns`;

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

  return (
    <div className="pattern-editor-page">
      <div className="editor-header">
        <div>
          <h1 className="editor-title">
            {id && id !== 'new' ? 'Editar Patrón' : 'Nuevo Patrón'}
          </h1>
          <p className="editor-subtitle">
            Configura el estilo de tu marca para todos los videos
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
          <h2 className="section-title">⚙️ Configuración</h2>

          <div className="form-group">
            <label htmlFor="name">Nombre del Patrón *</label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Mi Marca Principal"
            />
          </div>

          <div className="form-group">
            <label htmlFor="connection">Cuenta de TikTok *</label>
            <select
              id="connection"
              value={connectionId}
              onChange={e => setConnectionId(e.target.value)}
              className="form-select"
              disabled={id !== 'new'}
            >
              <option value="">Selecciona una cuenta</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>
                  {conn.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="logo">Logo / Marca de Agua</label>
            <input
              id="logo"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="file-input"
            />
            {(previewUrl || logoUrl) && (
              <div className="logo-preview-small">
                <img src={previewUrl || logoUrl} alt="Logo preview" />
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="position">Posición del Logo</label>
            <select
              id="position"
              value={logoPosition}
              onChange={e => setLogoPosition(e.target.value)}
              className="form-select"
            >
              {LOGO_POSITIONS.map(pos => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="size">
              Tamaño del Logo ({logoSize}% del ancho)
            </label>
            <input
              id="size"
              type="range"
              min="5"
              max="40"
              value={logoSize}
              onChange={e => setLogoSize(Number(e.target.value))}
              className="range-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="opacity">Opacidad ({logoOpacity}%)</label>
            <input
              id="opacity"
              type="range"
              min="0"
              max="100"
              value={logoOpacity}
              onChange={e => setLogoOpacity(Number(e.target.value))}
              className="range-input"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
              />
              <span>Establecer como predeterminado</span>
            </label>
          </div>
        </Card>

        {/* Right Panel - Preview */}
        <Card className="editor-preview">
          <h2 className="section-title">👁️ Vista Previa</h2>
          <p className="preview-description">
            Así se verá tu logo en los videos. Las líneas punteadas marcan las
            zonas seguras (evita que UI de TikTok tape tu logo).
          </p>

          <div className="canvas-container">
            <canvas ref={canvasRef} className="preview-canvas" />
          </div>

          <div className="preview-info">
            <div className="info-item">
              <span className="info-label">Formato:</span>
              <span className="info-value">9:16 (TikTok)</span>
            </div>
            <div className="info-item">
              <span className="info-label">Resolución:</span>
              <span className="info-value">1080x1920</span>
            </div>
          </div>

          {logoPosition !== 'center' && (
            <div className="preview-tips">
              <strong>💡 Tip:</strong> El logo está en zona segura ✓
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
