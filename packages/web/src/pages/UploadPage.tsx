import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { API_ENDPOINTS } from '../config/api';
import './UploadPage.css';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const { connections, fetchConnections } = useAppStore();

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('PUBLIC_TO_EVERYONE');
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishResults, setPublishResults] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      fetchConnections(token).catch(console.error);
    }
  }, [isAuthenticated, token, navigate, fetchConnections]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || selectedAccounts.length === 0 || !token) return;

    setLoading(true);
    setPublishResults(null);
    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('caption', caption);
      formData.append('accountIds', JSON.stringify(selectedAccounts));
      formData.append('privacyLevel', privacyLevel);
      formData.append('disableComment', String(disableComment));
      formData.append('disableDuet', String(disableDuet));
      formData.append('disableStitch', String(disableStitch));

      if (scheduleDate) {
        formData.append('scheduleTime', new Date(scheduleDate).toISOString());
      }

      const response = await fetch(API_ENDPOINTS.publish, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al publicar');
      }

      const data = await response.json();
      setPublishResults(data);

      // Show success message with details
      const successCount =
        data.results?.filter((r: any) => r.success).length || 0;
      const failedCount =
        data.results?.filter((r: any) => !r.success).length || 0;

      if (failedCount === 0) {
        alert(`✅ ${data.message}`);
        navigate('/history');
      } else {
        alert(
          `⚠️ ${data.message}\n\n✅ Exitosos: ${successCount}\n❌ Fallidos: ${failedCount}`
        );
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Error al publicar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <div className="upload-header">
        <h1 className="upload-title">Nueva Publicación</h1>
        <p className="upload-subtitle">
          Sube un video y selecciona las cuentas
        </p>
      </div>

      <form onSubmit={handleSubmit} className="upload-form">
        <Card>
          <h3>📹 Video</h3>
          <div className="upload-dropzone">
            {file ? (
              <div className="file-preview">
                <div className="file-info">
                  <strong>{file.name}</strong>
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  ✕ Eliminar
                </Button>
              </div>
            ) : (
              <label className="upload-label">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  hidden
                />
                <div className="upload-placeholder">
                  <span className="upload-icon">⬆️</span>
                  <span>Haz clic para seleccionar video</span>
                  <span className="upload-hint">MP4, MOV - Máx 500MB</span>
                </div>
              </label>
            )}
          </div>
        </Card>

        <Card>
          <h3>✍️ Descripción</h3>
          <textarea
            className="upload-textarea"
            placeholder="Escribe la descripción del video..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={4}
            maxLength={2200}
          />
          <div className="char-count">{caption.length} / 2200</div>
        </Card>

        <Card>
          <h3>👥 Seleccionar Cuentas ({selectedAccounts.length})</h3>
          {connections.length === 0 ? (
            <div className="no-accounts">
              <p>No tienes cuentas conectadas</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/connections')}
              >
                Conectar Cuenta
              </Button>
            </div>
          ) : (
            <div className="accounts-grid">
              {connections.map(conn => (
                <div
                  key={conn.id}
                  className={`account-item ${
                    selectedAccounts.includes(conn.id)
                      ? 'account-item--selected'
                      : ''
                  }`}
                  onClick={() => toggleAccount(conn.id)}
                >
                  <div className="account-checkbox">
                    {selectedAccounts.includes(conn.id) && '✓'}
                  </div>
                  <span>{conn.displayName}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3>🔒 Configuración de Privacidad</h3>
          <div className="privacy-settings">
            <label className="privacy-label">
              Privacidad del video:
              <select
                className="privacy-select"
                value={privacyLevel}
                onChange={e => setPrivacyLevel(e.target.value)}
              >
                <option value="PUBLIC_TO_EVERYONE">Público</option>
                <option value="MUTUAL_FOLLOW_FRIENDS">Solo amigos</option>
                <option value="SELF_ONLY">Solo yo</option>
              </select>
            </label>

            <div className="privacy-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={disableComment}
                  onChange={e => setDisableComment(e.target.checked)}
                />
                <span>Desactivar comentarios</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={disableDuet}
                  onChange={e => setDisableDuet(e.target.checked)}
                />
                <span>Desactivar duetos</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={disableStitch}
                  onChange={e => setDisableStitch(e.target.checked)}
                />
                <span>Desactivar stitch</span>
              </label>
            </div>
          </div>
        </Card>

        <Card>
          <h3>⏰ Programar (Opcional)</h3>
          <Input
            type="datetime-local"
            value={scheduleDate}
            onChange={e => setScheduleDate(e.target.value)}
            fullWidth
          />
          <small style={{ color: '#888', marginTop: '8px', display: 'block' }}>
            ⚠️ La programación aún no está implementada
          </small>
        </Card>

        <div className="upload-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/dashboard')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!file || selectedAccounts.length === 0}
          >
            Publicar en {selectedAccounts.length} cuenta(s)
          </Button>
        </div>
      </form>
    </div>
  );
};
