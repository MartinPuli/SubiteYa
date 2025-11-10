import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { useAuthStore } from '../store/authStore';
import { API_ENDPOINTS } from '../config/api';
import './VoicesPage.css';

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  description?: string;
  preview_url?: string;
}

export const VoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [cloning, setCloning] = useState(false);

  // Clone voice form
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [audioFiles, setAudioFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      loadVoices(token);
    }
  }, [isAuthenticated, token, navigate]);

  const loadVoices = async (authToken: string) => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.elevenlabsVoices, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
      }
    } catch (error) {
      console.error('Error loading voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Limitar a 5 archivos (ElevenLabs requirement)
      setAudioFiles(files.slice(0, 5));
    }
  };

  const handleCloneVoice = async () => {
    if (!token || !voiceName || audioFiles.length === 0) {
      alert('Por favor completa el nombre y sube al menos un archivo de audio');
      return;
    }

    setCloning(true);
    try {
      const formData = new FormData();
      formData.append('name', voiceName);
      if (voiceDescription) {
        formData.append('description', voiceDescription);
      }

      audioFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(API_ENDPOINTS.elevenlabsClone, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        alert('✅ Voz clonada exitosamente!');
        // Reset form
        setVoiceName('');
        setVoiceDescription('');
        setAudioFiles([]);
        // Reload voices
        await loadVoices(token);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'No se pudo clonar la voz'}`);
      }
    } catch (error) {
      console.error('Error cloning voice:', error);
      alert('Error al clonar la voz');
    } finally {
      setCloning(false);
    }
  };

  if (loading) {
    return <div className="loading-page">Cargando voces...</div>;
  }

  return (
    <div className="voices-page">
      <div className="voices-header">
        <div>
          <h1 className="voices-title">🎙️ Gestión de Voces IA</h1>
          <p className="voices-subtitle">
            Clona tu voz o explora voces disponibles para narración
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          ← Volver
        </Button>
      </div>

      {/* Clone Voice Section */}
      <Card className="clone-voice-card">
        <h2 className="section-title">🎤 Clonar Tu Voz</h2>
        <p className="section-description">
          Sube grabaciones de tu voz para crear un clon personalizado. Se
          recomienda subir 2-5 archivos de audio con diferentes tonos y
          emociones.
        </p>

        <div className="clone-form">
          <div className="form-group">
            <label>Nombre de la Voz *</label>
            <Input
              type="text"
              value={voiceName}
              onChange={e => setVoiceName(e.target.value)}
              placeholder="Ej: Mi Voz Profesional"
            />
          </div>

          <div className="form-group">
            <label>Descripción (opcional)</label>
            <Input
              type="text"
              value={voiceDescription}
              onChange={e => setVoiceDescription(e.target.value)}
              placeholder="Ej: Voz para videos documentales"
            />
          </div>

          <div className="form-group">
            <label>Archivos de Audio (2-5 archivos) *</label>
            <input
              type="file"
              accept="audio/mp3,audio/wav,audio/ogg"
              multiple
              onChange={handleFileChange}
              className="file-input"
            />
            {audioFiles.length > 0 && (
              <div className="file-list">
                <p>✅ {audioFiles.length} archivo(s) seleccionado(s):</p>
                <ul>
                  {audioFiles.map((file, idx) => (
                    <li key={idx}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="requirements">
            <h4>📋 Requisitos:</h4>
            <ul>
              <li>Formato: MP3, WAV, o OGG</li>
              <li>Máximo 10MB por archivo</li>
              <li>Mínimo 2 archivos, máximo 5</li>
              <li>Cada grabación debe tener al menos 30 segundos</li>
              <li>Audio claro, sin ruido de fondo</li>
              <li>Varía tonos y emociones entre archivos</li>
            </ul>
          </div>

          <Button
            variant="primary"
            onClick={handleCloneVoice}
            disabled={cloning || !voiceName || audioFiles.length === 0}
          >
            {cloning ? '🔄 Clonando...' : '🎙️ Clonar Mi Voz'}
          </Button>
        </div>
      </Card>

      {/* Available Voices Section */}
      <Card className="voices-list-card">
        <h2 className="section-title">
          🌍 Voces Disponibles ({voices.length})
        </h2>
        <p className="section-description">
          Estas son todas las voces disponibles para usar en tus narraciones
        </p>

        <div className="voices-grid">
          {voices.map(voice => (
            <Card key={voice.voice_id} className="voice-card">
              <div className="voice-info">
                <h3>{voice.name}</h3>
                <span className="voice-category">{voice.category}</span>
                {voice.description && <p>{voice.description}</p>}
                {Object.keys(voice.labels).length > 0 && (
                  <div className="voice-labels">
                    {Object.entries(voice.labels).map(([key, value]) => (
                      <span key={key} className="label">
                        {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {voice.preview_url && (
                <audio controls className="voice-preview">
                  <source src={voice.preview_url} type="audio/mpeg" />
                </audio>
              )}
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
