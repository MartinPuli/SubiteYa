import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { API_ENDPOINTS } from '../config/api';
import './UploadPage.css';

interface Video {
  id: string;
  status: string;
  progress: number;
  srcUrl: string;
  thumbnailUrl?: string;
  error?: string;
}

export const QueueUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const { connections, fetchConnections } = useAppStore();

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Queue states
  const [editing, setEditing] = useState<Video[]>([]);
  const [edited, setEdited] = useState<Video[]>([]);
  const [uploading, setUploading] = useState<Video[]>([]);
  const [posted, setPosted] = useState<Video[]>([]);
  const [failed, setFailed] = useState<Video[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      fetchConnections(token).catch(console.error);
      fetchQueues();
    }
  }, [isAuthenticated, token, navigate, fetchConnections]);

  // Poll queues every 3 seconds
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      fetchQueues();
    }, 3000);

    return () => clearInterval(interval);
  }, [token]);

  const fetchQueues = async () => {
    if (!token) return;

    try {
      const response = await fetch(API_ENDPOINTS.meQueues, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch queues');
      }

      const data = await response.json();
      setEditing(data.editing || []);
      setEdited(data.edited || []);
      setUploading(data.uploading || []);
      setPosted(data.posted || []);
      setFailed(data.failed || []);
    } catch (error) {
      console.error('Error fetching queues:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !token || !selectedAccount) {
      alert('Por favor selecciona un archivo y una cuenta');
      return;
    }

    if (!caption.trim()) {
      alert('Por favor ingresa un título/descripción');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      // Step 1: Upload file as DRAFT
      const formData = new FormData();
      formData.append('video', file);

      const uploadResponse = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            setUploadProgress(Math.round(percent));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // In production, this would return a cloud storage URL
              // For now, we'll use a placeholder
              resolve(`/uploads/${file.name}`);
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));

        // Simulated upload - in production this would go to cloud storage
        xhr.open('POST', '/api/upload-temp');
        xhr.send(formData);
      });

      // Step 2: Create video in DRAFT state
      const createResponse = await fetch(API_ENDPOINTS.videos, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          srcUrl: uploadResponse,
          accountId: selectedAccount,
          title: caption,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create video');
      }

      const { video } = await createResponse.json();

      // Step 3: Confirm video to start editing
      const confirmResponse = await fetch(
        `${API_ENDPOINTS.videos}/${video.id}/confirm`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!confirmResponse.ok) {
        throw new Error('Failed to start editing');
      }

      alert('¡Video en cola! Se está procesando...');
      setFile(null);
      setCaption('');
      setUploadProgress(0);
      fetchQueues();
    } catch (error) {
      console.error('Upload error:', error);
      alert(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const queueForUpload = async (videoId: string) => {
    if (!token) return;

    try {
      const response = await fetch(
        `${API_ENDPOINTS.videos}/${videoId}/queue-upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to queue for upload');
      }

      fetchQueues();
    } catch (error) {
      console.error('Queue error:', error);
      alert(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  return (
    <div className="upload-page">
      <div className="upload-container">
        <h1>Subir Video con Cola</h1>

        <Card>
          <h2>1. Selecciona tu archivo</h2>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={loading}
          />
          {file && (
            <p className="file-info">
              📹 {file.name} ({Math.round(file.size / 1024 / 1024)}MB)
            </p>
          )}
        </Card>

        <Card>
          <h2>2. Título/Descripción</h2>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Escribe el título de tu video..."
            rows={4}
            disabled={loading}
          />
        </Card>

        <Card>
          <h2>3. Selecciona cuenta</h2>
          <div className="accounts-grid">
            {connections.map(conn => (
              <div
                key={conn.id}
                className={`account-card ${selectedAccount === conn.id ? 'selected' : ''}`}
                onClick={() => setSelectedAccount(conn.id)}
              >
                <img
                  src={conn.avatarUrl || '/default-avatar.png'}
                  alt={conn.displayName}
                />
                <p>{conn.displayName}</p>
              </div>
            ))}
          </div>
        </Card>

        {loading && (
          <Card>
            <h3>Subiendo archivo...</h3>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p>{uploadProgress}%</p>
          </Card>
        )}

        <Button
          onClick={handleUpload}
          disabled={loading || !file || !selectedAccount}
        >
          {loading ? 'Subiendo...' : 'Subir y Procesar'}
        </Button>

        <hr />

        <h2>📋 Cola de Videos</h2>

        {editing.length > 0 && (
          <Card>
            <h3>✂️ Editando ({editing.length})</h3>
            {editing.map(v => (
              <div key={v.id} className="queue-item">
                <p>📹 Video #{v.id.slice(0, 8)}</p>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${v.progress}%` }}
                  />
                </div>
                <p>{v.progress}%</p>
              </div>
            ))}
          </Card>
        )}

        {edited.length > 0 && (
          <Card>
            <h3>✅ Editados ({edited.length})</h3>
            {edited.map(v => (
              <div key={v.id} className="queue-item">
                <p>📹 Video #{v.id.slice(0, 8)}</p>
                <Button onClick={() => queueForUpload(v.id)}>
                  Subir a TikTok
                </Button>
              </div>
            ))}
          </Card>
        )}

        {uploading.length > 0 && (
          <Card>
            <h3>📤 Subiendo a TikTok ({uploading.length})</h3>
            {uploading.map(v => (
              <div key={v.id} className="queue-item">
                <p>📹 Video #{v.id.slice(0, 8)}</p>
                <p>Subiendo...</p>
              </div>
            ))}
          </Card>
        )}

        {posted.length > 0 && (
          <Card>
            <h3>🎉 Publicados ({posted.length})</h3>
            {posted.map(v => (
              <div key={v.id} className="queue-item">
                <p>📹 Video #{v.id.slice(0, 8)}</p>
                <p>✓ Publicado</p>
              </div>
            ))}
          </Card>
        )}

        {failed.length > 0 && (
          <Card>
            <h3>❌ Fallidos ({failed.length})</h3>
            {failed.map(v => (
              <div key={v.id} className="queue-item">
                <p>📹 Video #{v.id.slice(0, 8)}</p>
                <p className="error">Error: {v.error}</p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
};
