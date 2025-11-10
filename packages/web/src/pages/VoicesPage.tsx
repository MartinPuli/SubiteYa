import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { AudioRecorder } from '../components/AudioRecorder/AudioRecorder';
import { FileUploader } from '../components/FileUploader/FileUploader';
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

interface DefaultVoice {
  language: string;
  voice_id: string;
  name: string;
  flag: string;
}

export const VoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [defaultVoices, setDefaultVoices] = useState<DefaultVoice[]>([]);
  const [cloning, setCloning] = useState(false);
  const [showCloneForm, setShowCloneForm] = useState(false);

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
      loadDefaultVoices(token);
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

  const loadDefaultVoices = async (authToken: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.elevenlabsDefaultVoices, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDefaultVoices(data.defaultVoices || []);
      }
    } catch (error) {
      console.error('Error loading default voices:', error);
    }
  };

  const handleFilesChange = (files: File[]) => {
    setAudioFiles(files);
  };

  const handleAudioRecorded = (file: File) => {
    // Add recorded audio to the list
    if (audioFiles.length < 5) {
      setAudioFiles([...audioFiles, file]);
    } else {
      alert('Ya tienes 5 archivos. Elimina alguno para agregar este.');
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
            Usa voces por defecto o clona tu propia voz para narración
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          ← Volver
        </Button>
      </div>

      {/* Default Voices Section - FIRST */}
      {defaultVoices.length > 0 && (
        <Card className="default-voices-card">
          <h2 className="section-title">⭐ Voces Recomendadas por Idioma</h2>
          <p className="section-description">
            Voces profesionales listas para usar. Selecciónalas directamente en
            tus patrones.
          </p>

          <div className="default-voices-grid">
            {defaultVoices.map(voice => (
              <Card key={voice.voice_id} className="default-voice-card">
                <div className="voice-flag">{voice.flag}</div>
                <h3>{voice.name}</h3>
                <p className="voice-language">{voice.language}</p>
                <span className="voice-id">ID: {voice.voice_id}</span>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Clone Voice Section */}
      <Card className="clone-voice-card">
        <div className="clone-header">
          <div>
            <h2 className="section-title">🎤 Clonar Tu Propia Voz</h2>
            <p className="section-description">
              Crea una voz personalizada con tu propio audio. Ideal para marca
              personal.
            </p>
          </div>
          <Button
            variant={showCloneForm ? 'ghost' : 'primary'}
            onClick={() => setShowCloneForm(!showCloneForm)}
          >
            {showCloneForm ? '✕ Cerrar' : '+ Clonar Mi Voz'}
          </Button>
        </div>

        {showCloneForm && (
          <div className="clone-form">
            {/* Clone Voice Section */}
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
              <label>Opción 1: Grabar Audio Directamente 🎙️</label>
              <AudioRecorder
                onAudioRecorded={handleAudioRecorded}
                maxDuration={180}
              />
            </div>

            <div className="form-group">
              <label>Opción 2: Subir Archivos de Audio 📁</label>
              <FileUploader
                accept="audio/mp3,audio/wav,audio/ogg,audio/webm"
                multiple={true}
                maxFiles={5}
                maxSizeBytes={10 * 1024 * 1024}
                files={audioFiles}
                onFilesChange={handleFilesChange}
              />
            </div>

            <div className="requirements">
              <h4>📋 Requisitos:</h4>
              <ul>
                <li>Formato: MP3, WAV, OGG o WebM</li>
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
        )}
      </Card>

      {/* Available Voices Section */}
      <Card className="voices-list-card">
        <h2 className="section-title">🌍 Todas las Voces ({voices.length})</h2>
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
