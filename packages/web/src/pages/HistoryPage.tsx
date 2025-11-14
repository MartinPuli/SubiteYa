import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { VideoPreview } from '../components/VideoPreview/VideoPreview';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { API_ENDPOINTS } from '../config/api';
import './HistoryPage.css';

const getStateColor = (state: string) => {
  const normalized = state.toLowerCase();
  switch (normalized) {
    case 'completed':
    case 'published':
      return 'status--success';
    case 'failed':
      return 'status--error';
    case 'queued':
    case 'scheduled':
    case 'pending':
      return 'status--pending';
    case 'uploading':
    case 'publishing':
      return 'status--processing';
    default:
      return '';
  }
};

const getStateLabel = (state: string) => {
  const labels: Record<string, string> = {
    queued: '⏳ En Cola de Edición',
    uploading: '✂️ Editando Video',
    completed: '✅ Editado',
    publishing: '📤 En Cola de Publicación',
    published: '🎉 Publicado',
    failed: '❌ Fallido',
    scheduled: '📅 Programado',
    canceled: '🚫 Cancelado',
  };
  return labels[state.toLowerCase()] || state;
};

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const { jobs, fetchJobs, deleteVideo } = useAppStore();
  const [previewVideo, setPreviewVideo] = useState<{
    id: string;
    url: string;
    title: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      // Refresh jobs to show updated status
      await fetchJobs(token);
      alert('✅ Video agregado a la cola de subida a TikTok');
    } catch (error) {
      console.error('Queue error:', error);
      alert(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!token) return;

    const confirmDelete = window.confirm(
      '¿Seguro que deseas descartar este video del historial?'
    );

    if (!confirmDelete) return;

    setDeletingId(jobId);

    try {
      await deleteVideo(token, jobId);
      if (previewVideo?.id === jobId) {
        setPreviewVideo(null);
      }
      alert('🗑️ Video eliminado del historial');
    } catch (error) {
      console.error('Delete video error:', error);
      alert(
        `Error al eliminar video: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      );
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Solo cargar si no hay datos o si está vacío
    if (token && jobs.length === 0) {
      fetchJobs(token).catch(console.error);
    }
  }, [isAuthenticated, token, navigate, fetchJobs, jobs.length]);

  // Auto-refresh every 5 seconds if there are jobs in progress
  useEffect(() => {
    if (!token) return;

    const hasInProgressJobs = jobs.some(job =>
      ['queued', 'uploading', 'publishing'].includes(job.state.toLowerCase())
    );

    if (hasInProgressJobs) {
      const interval = setInterval(() => {
        fetchJobs(token).catch(console.error);
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [token, jobs, fetchJobs]);

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1 className="history-title">Historial</h1>
          <p className="history-subtitle">Todas tus publicaciones</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/upload')}>
          + Nueva Publicación
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card className="empty-state">
          <div className="empty-icon">📜</div>
          <h3>No tienes publicaciones aún</h3>
          <p>Sube tu primer video para comenzar</p>
          <Button variant="primary" onClick={() => navigate('/upload')}>
            Subir Video
          </Button>
        </Card>
      ) : (
        <div className="history-list">
          {jobs.map(job => (
            <Card key={job.id} className="history-item">
              <div className="job-info">
                <div>
                  <h3 className="job-caption">{job.caption}</h3>
                  <p className="job-account">
                    {job.tiktokConnection.displayName}
                  </p>
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <span className={`job-status ${getStateColor(job.state)}`}>
                    {getStateLabel(job.state)}
                  </span>
                  {job.status &&
                    ['failed', 'completed', 'edited'].includes(
                      job.state.toLowerCase()
                    ) && (
                      <Button
                        variant="danger"
                        onClick={() => handleDeleteJob(job.id)}
                        loading={deletingId === job.id}
                        style={{ fontSize: '14px', padding: '6px 12px' }}
                      >
                        🗑️ Descartar
                      </Button>
                    )}
                  {job.state.toLowerCase() === 'completed' && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const jobWithUrl = job as typeof job & {
                            editedUrl?: string;
                          };
                          if (jobWithUrl.editedUrl) {
                            setPreviewVideo({
                              id: job.id,
                              url: jobWithUrl.editedUrl,
                              title: job.caption,
                            });
                          } else {
                            alert('Video aún no disponible para preview');
                          }
                        }}
                        style={{ fontSize: '14px', padding: '6px 12px' }}
                      >
                        👁️ Ver/Editar
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => queueForUpload(job.id)}
                        style={{ fontSize: '14px', padding: '6px 12px' }}
                      >
                        🚀 Subir a TikTok
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="job-date">
                {new Date(job.createdAt).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {previewVideo && (
        <VideoPreview
          videoUrl={previewVideo.url}
          videoId={previewVideo.id}
          title={previewVideo.title}
          onClose={() => setPreviewVideo(null)}
          onPublish={() => {
            queueForUpload(previewVideo.id);
            setPreviewVideo(null);
          }}
          onEdit={videoId => {
            // TODO: Implementar navegación al editor
            console.log('Edit video:', videoId);
            alert(
              'Editor de video próximamente. Por ahora puedes re-subir el video con diferentes ajustes.'
            );
          }}
        />
      )}

      <div className="history-footer">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          ← Volver al Dashboard
        </Button>
      </div>
    </div>
  );
};
