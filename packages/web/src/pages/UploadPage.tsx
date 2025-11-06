import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { API_ENDPOINTS } from '../config/api';
import './UploadPage.css';

interface VideoUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  results?: Array<{ accountName: string; success: boolean; error?: string }>;
}

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const { connections, fetchConnections } = useAppStore();

  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<VideoUploadStatus[]>([]);
  const [caption, setCaption] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [privacyLevel, setPrivacyLevel] = useState('PUBLIC_TO_EVERYONE');
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [loading, setLoading] = useState(false);

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
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(newFiles);
      setUploadStatuses(
        newFiles.map(file => ({
          file,
          status: 'pending' as const,
          progress: 0,
        }))
      );
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setUploadStatuses(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const uploadSingleVideo = async (
    file: File,
    index: number
  ): Promise<void> => {
    if (!token) return;

    // Update status to uploading
    setUploadStatuses(prev =>
      prev.map((status, i) =>
        i === index
          ? { ...status, status: 'uploading' as const, progress: 0 }
          : status
      )
    );

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('caption', caption);
      formData.append('accountIds', JSON.stringify(selectedAccounts));
      formData.append('privacyLevel', privacyLevel);
      formData.append('disableComment', String(disableComment));
      formData.append('disableDuet', String(disableDuet));
      formData.append('disableStitch', String(disableStitch));

      const response = await fetch(API_ENDPOINTS.publish, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al publicar');
      }

      // Extract results for each account
      const accountResults = selectedAccounts.map((accountId, idx) => {
        const connection = connections.find(c => c.id === accountId);
        const result = data.results?.[idx];
        return {
          accountName: connection?.displayName || 'Cuenta desconocida',
          success: result?.success || false,
          error: result?.error,
        };
      });

      // Update status to completed
      setUploadStatuses(prev =>
        prev.map((status, i) =>
          i === index
            ? {
                ...status,
                status: 'completed' as const,
                progress: 100,
                results: accountResults,
              }
            : status
        )
      );
    } catch (error) {
      // Update status to error
      setUploadStatuses(prev =>
        prev.map((status, i) =>
          i === index
            ? {
                ...status,
                status: 'error' as const,
                progress: 0,
                error:
                  error instanceof Error ? error.message : 'Error desconocido',
              }
            : status
        )
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 || selectedAccounts.length === 0 || !token) return;

    setLoading(true);

    try {
      // Upload videos one by one
      for (let i = 0; i < files.length; i++) {
        await uploadSingleVideo(files[i], i);
        // Small delay between uploads to avoid rate limiting
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Check if all uploads were successful
      const allSuccessful = uploadStatuses.every(
        status => status.status === 'completed'
      );

      if (allSuccessful) {
        alert(`✅ Todos los videos fueron publicados exitosamente`);
        setTimeout(() => navigate('/history'), 2000);
      } else {
        alert(
          `⚠️ Algunos videos no pudieron ser publicados. Revisa el estado de cada uno.`
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
          <h3>📹 Videos ({files.length})</h3>
          <div className="upload-dropzone">
            {files.length > 0 ? (
              <div className="files-list">
                {uploadStatuses.map((status, index) => (
                  <div key={index} className="file-item">
                    <div className="file-info">
                      <div className="file-header">
                        <strong>{status.file.name}</strong>
                        <span className="file-size">
                          {(status.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>

                      {/* Status indicator */}
                      <div className="file-status">
                        {status.status === 'pending' && (
                          <span className="status-badge status-pending">
                            ⏳ Pendiente
                          </span>
                        )}
                        {status.status === 'uploading' && (
                          <span className="status-badge status-uploading">
                            ⬆️ Subiendo...
                          </span>
                        )}
                        {status.status === 'completed' && (
                          <span className="status-badge status-completed">
                            ✅ Completado
                          </span>
                        )}
                        {status.status === 'error' && (
                          <span className="status-badge status-error">
                            ❌ Error
                          </span>
                        )}
                      </div>

                      {/* Show results per account if completed */}
                      {status.status === 'completed' && status.results && (
                        <div className="account-results">
                          {status.results.map((result, idx) => (
                            <div key={idx} className="account-result">
                              <span
                                className={result.success ? 'success' : 'error'}
                              >
                                {result.success ? '✓' : '✗'}
                              </span>
                              <span>{result.accountName}</span>
                              {result.error && <small>{result.error}</small>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Show error message */}
                      {status.status === 'error' && status.error && (
                        <div className="error-message">
                          <small>{status.error}</small>
                        </div>
                      )}
                    </div>

                    {status.status === 'pending' && !loading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <label className="upload-label" onClick={e => e.stopPropagation()}>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={handleFileChange}
                onClick={e => e.stopPropagation()}
                disabled={loading}
                hidden
              />
              <div className="upload-placeholder">
                <span className="upload-icon">⬆️</span>
                <span>Haz clic para seleccionar videos</span>
                <span className="upload-hint">
                  Múltiples archivos - MP4, MOV - Máx 500MB c/u
                </span>
              </div>
            </label>
          </div>
        </Card>

        <Card>
          <h3>✍️ Descripción</h3>
          <textarea
            className="upload-textarea"
            placeholder="Escribe la descripción del video..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onClick={e => e.stopPropagation()}
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
                onClick={e => e.stopPropagation()}
              >
                <option value="PUBLIC_TO_EVERYONE">Público</option>
                <option value="MUTUAL_FOLLOW_FRIENDS">Solo amigos</option>
                <option value="SELF_ONLY">Solo yo</option>
              </select>
            </label>

            <div className="privacy-options">
              <label
                className="checkbox-label"
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={disableComment}
                  onChange={e => setDisableComment(e.target.checked)}
                />
                <span>Desactivar comentarios</span>
              </label>

              <label
                className="checkbox-label"
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={disableDuet}
                  onChange={e => setDisableDuet(e.target.checked)}
                />
                <span>Desactivar duetos</span>
              </label>

              <label
                className="checkbox-label"
                onClick={e => e.stopPropagation()}
              >
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

        {(files.length === 0 || selectedAccounts.length === 0) && (
          <Card className="warning-card">
            <div className="warning-content">
              <span className="warning-icon">⚠️</span>
              <div>
                <strong className="warning-title">
                  Para publicar necesitas:
                </strong>
                <ul className="warning-list">
                  {files.length === 0 && <li>Subir al menos un video</li>}
                  {selectedAccounts.length === 0 && (
                    <li>Seleccionar al menos una cuenta</li>
                  )}
                </ul>
              </div>
            </div>
          </Card>
        )}

        <div className="upload-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={files.length === 0 || selectedAccounts.length === 0}
          >
            {loading
              ? `Publicando ${uploadStatuses.filter(s => s.status === 'uploading').length}/${files.length}...`
              : `Publicar ${files.length} video(s) en ${selectedAccounts.length} cuenta(s)`}
          </Button>
        </div>
      </form>
    </div>
  );
};
