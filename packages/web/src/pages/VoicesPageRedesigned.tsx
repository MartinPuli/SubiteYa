import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { AudioRecorder } from '../components/AudioRecorder/AudioRecorder';
import { FileUploader } from '../components/FileUploader/FileUploader';
import { useAuthStore } from '../store/authStore';
import { API_ENDPOINTS } from '../config/api';
import './VoicesPage.css';

interface VoiceCard {
  voice_id: string;
  name: string;
  language: string;
  flag: string;
  description: string;
  gender?: string;
  isCloned?: boolean;
  preview_url?: string;
}

export const VoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();

  // State
  const [loading, setLoading] = useState(true);
  const [allVoices, setAllVoices] = useState<VoiceCard[]>([]);
  const [clonedVoices, setClonedVoices] = useState<VoiceCard[]>([]);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

  // Clone form
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [audioFiles, setAudioFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      loadAllVoices(token);
    }
  }, [isAuthenticated, token, navigate]);

  const loadAllVoices = async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      // Load default voices
      const defaultResponse = await fetch(
        API_ENDPOINTS.elevenlabsDefaultVoices,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          credentials: 'include',
        }
      );

      if (!defaultResponse.ok) {
        throw new Error('Error al cargar voces predeterminadas');
      }

      const defaultData = await defaultResponse.json();
      const defaultVoices = (defaultData.defaultVoices || []).map((v: any) => ({
        ...v,
        isCloned: false,
      }));

      // Load user's cloned voices
      const clonedResponse = await fetch(API_ENDPOINTS.elevenlabsVoices, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
      });

      let clonedVoicesList: VoiceCard[] = [];
      if (clonedResponse.ok) {
        const clonedData = await clonedResponse.json();
        const voices = clonedData.voices || [];
        clonedVoicesList = voices
          .filter((v: any) => v.category === 'cloned')
          .map((v: any) => ({
            voice_id: v.voice_id,
            name: v.name,
            language: 'Personalizada',
            flag: '🎤',
            description: v.description || 'Tu voz clonada',
            isCloned: true,
            preview_url: v.preview_url,
          }));
      }

      setAllVoices(defaultVoices);
      setClonedVoices(clonedVoicesList);
    } catch (error) {
      console.error('Error loading voices:', error);
      setError('No se pudieron cargar las voces. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  // Get unique languages for filter
  const languages = useMemo(() => {
    const langs = new Set(allVoices.map(v => v.language));
    return ['all', ...Array.from(langs)];
  }, [allVoices]);

  // Filter voices
  const filteredVoices = useMemo(() => {
    let filtered = allVoices;

    // Filter by language
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(v => v.language === selectedLanguage);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        v =>
          v.name.toLowerCase().includes(query) ||
          v.description.toLowerCase().includes(query) ||
          v.language.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allVoices, selectedLanguage, searchQuery]);

  const handleTestVoice = async (voiceId: string) => {
    if (!token) return;

    setTestingVoiceId(voiceId);
    try {
      const testText = 'Hola, esta es una prueba de audio de tres segundos.';

      const response = await fetch(API_ENDPOINTS.elevenlabsGenerate, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testText,
          voice_id: voiceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al generar audio');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setTestingVoiceId(null);
      };
    } catch (error) {
      console.error('Error testing voice:', error);
      alert('Error al probar la voz. Intenta nuevamente.');
      setTestingVoiceId(null);
    }
  };

  const handleCloneVoice = async () => {
    if (!token || !voiceName || audioFiles.length < 2) {
      setError('Se requiere nombre y al menos 2 archivos de audio');
      return;
    }

    setCloning(true);
    setError(null);
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
        setVoiceName('');
        setVoiceDescription('');
        setAudioFiles([]);
        setShowCloneForm(false);
        await loadAllVoices(token);
      } else {
        const errorData = await response.json();
        setError(
          `Error al clonar: ${errorData.message || 'Error desconocido'}`
        );
      }
    } catch (error) {
      setError('Error de conexión al clonar la voz');
    } finally {
      setCloning(false);
    }
  };

  const handleFilesChange = (files: File[]) => {
    setAudioFiles(files);
  };

  const handleAudioRecorded = (file: File) => {
    if (audioFiles.length < 5) {
      setAudioFiles([...audioFiles, file]);
    } else {
      alert('Ya tienes 5 archivos. Elimina alguno para agregar este.');
    }
  };

  if (loading) {
    return (
      <div className="voices-page-loading">
        <div className="loading-spinner"></div>
        <p>Cargando voces...</p>
      </div>
    );
  }

  return (
    <div className="voices-page-redesigned">
      {/* Header */}
      <div className="voices-header-redesigned">
        <div className="header-content">
          <h1 className="page-title">🎙️ Biblioteca de Voces IA</h1>
          <p className="page-subtitle">
            Explora 20 voces profesionales en múltiples idiomas o clona tu
            propia voz
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          ← Volver al Dashboard
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-error">
          <span className="alert-icon">⚠️</span>
          <span className="alert-message">{error}</span>
          <button className="alert-close" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Cloned Voices Section (if any) */}
      {clonedVoices.length > 0 && (
        <section className="cloned-voices-section">
          <div className="section-header">
            <h2 className="section-title">🎤 Tu Voz Clonada</h2>
            <span className="badge-cloned">Personalizada</span>
          </div>
          <div className="voices-grid-compact">
            {clonedVoices.map(voice => (
              <Card key={voice.voice_id} className="voice-card-cloned">
                <div className="voice-icon-large">{voice.flag}</div>
                <div className="voice-card-content">
                  <h3 className="voice-name">{voice.name}</h3>
                  <p className="voice-description">{voice.description}</p>
                  <span className="voice-id-small">ID: {voice.voice_id}</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleTestVoice(voice.voice_id)}
                  disabled={testingVoiceId === voice.voice_id}
                  className="test-voice-button"
                >
                  {testingVoiceId === voice.voice_id
                    ? '▶️ Reproduciendo...'
                    : '🎧 Probar (3s)'}
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Clone Voice Button */}
      <section className="clone-section">
        <Button
          variant={showCloneForm ? 'ghost' : 'primary'}
          size="lg"
          onClick={() => setShowCloneForm(!showCloneForm)}
          className="clone-toggle-button"
        >
          {showCloneForm ? '✕ Cerrar Formulario' : '+ Clonar Mi Propia Voz'}
        </Button>

        {showCloneForm && (
          <Card className="clone-form-card">
            <h3 className="form-title">Clonar Tu Voz</h3>
            <p className="form-subtitle">
              Crea una réplica de tu voz subiendo varios audios de muestra
            </p>

            <div className="form-row">
              <label className="form-label">Nombre de la voz *</label>
              <Input
                type="text"
                value={voiceName}
                onChange={e => setVoiceName(e.target.value)}
                placeholder="Ej: Mi Voz Profesional"
              />
            </div>

            <div className="form-row">
              <label className="form-label">Descripción (opcional)</label>
              <Input
                type="text"
                value={voiceDescription}
                onChange={e => setVoiceDescription(e.target.value)}
                placeholder="Ej: Para videos corporativos"
              />
            </div>

            <div className="form-row">
              <label className="form-label">Grabar Audio 🎙️</label>
              <AudioRecorder
                onAudioRecorded={handleAudioRecorded}
                maxDuration={180}
              />
            </div>

            <div className="form-row">
              <label className="form-label">O Subir Archivos 📁</label>
              <FileUploader
                accept="audio/mp3,audio/wav,audio/ogg,audio/webm"
                multiple={true}
                maxFiles={5}
                maxSizeBytes={10 * 1024 * 1024}
                files={audioFiles}
                onFilesChange={handleFilesChange}
              />
            </div>

            <div className="requirements-box">
              <h4>📋 Requisitos:</h4>
              <ul>
                <li>Mínimo 2 archivos, máximo 5</li>
                <li>Formato: MP3, WAV, OGG o WebM</li>
                <li>Cada archivo: 30 segundos mínimo, 10MB máximo</li>
                <li>Audio claro, sin ruido de fondo</li>
              </ul>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleCloneVoice}
              disabled={cloning || !voiceName || audioFiles.length < 2}
              className="submit-button"
            >
              {cloning ? '🔄 Clonando...' : '🎙️ Crear Voz Clonada'}
            </Button>
          </Card>
        )}
      </section>

      {/* Filters and Search */}
      <section className="filters-section">
        <div className="filters-container">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por nombre o idioma..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="language-filter">
            <label className="filter-label">Filtrar por idioma:</label>
            <select
              className="filter-select"
              value={selectedLanguage}
              onChange={e => setSelectedLanguage(e.target.value)}
            >
              <option value="all">
                Todos los idiomas ({allVoices.length})
              </option>
              {languages
                .filter(l => l !== 'all')
                .map(lang => (
                  <option key={lang} value={lang}>
                    {lang} ({allVoices.filter(v => v.language === lang).length})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <p className="results-count">
          Mostrando {filteredVoices.length} de {allVoices.length} voces
        </p>
      </section>

      {/* Voices Grid */}
      <section className="voices-section">
        <h2 className="section-title-main">
          🌍 Voces Profesionales Disponibles
        </h2>
        <div className="voices-grid-main">
          {filteredVoices.map(voice => (
            <Card key={voice.voice_id} className="voice-card-main">
              <div className="voice-header">
                <div className="voice-flag-main">{voice.flag}</div>
                <div className="voice-metadata">
                  <h3 className="voice-name-main">{voice.name}</h3>
                  <span className="voice-language-badge">{voice.language}</span>
                </div>
              </div>

              <p className="voice-description-main">{voice.description}</p>

              <span className="voice-id-display">ID: {voice.voice_id}</span>

              <Button
                variant="primary"
                size="md"
                onClick={() => handleTestVoice(voice.voice_id)}
                disabled={testingVoiceId === voice.voice_id}
                className="test-button-main"
              >
                {testingVoiceId === voice.voice_id ? (
                  <>
                    <span className="button-icon">▶️</span>
                    Reproduciendo...
                  </>
                ) : (
                  <>
                    <span className="button-icon">🎧</span>
                    Probar Voz (3s)
                  </>
                )}
              </Button>
            </Card>
          ))}
        </div>

        {filteredVoices.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p className="empty-message">
              No se encontraron voces con esos criterios
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setSearchQuery('');
                setSelectedLanguage('all');
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};
