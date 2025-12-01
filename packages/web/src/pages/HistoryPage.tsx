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
  const { jobs, fetchJobs, deleteVideo, deletePublishJob } = useAppStore();
  const [previewVideo, setPreviewVideo] = useState<{
    id: string;
    url: string;
    title: string;
  } | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [generatingPreviewId, setGeneratingPreviewId] = useState<string | null>(
    null
  );

  const canDeleteJob = (job: (typeof jobs)[number]) => {
    const state = job.state?.toLowerCase?.() || '';
    const deletableStates = new Set(['failed', 'completed', 'published']);

    if (job.jobType === 'video' && job.status) {
      const normalizedStatus = job.status.toUpperCase();
      const deletableVideoStatuses = new Set([
        'EDITED',
        'FAILED_EDIT',
        'FAILED_UPLOAD',
      ]);
      return deletableVideoStatuses.has(normalizedStatus);
    }

    return deletableStates.has(state);
  };

  const handleDelete = async (job: (typeof jobs)[number]) => {
    if (!token) return;

    const confirmation = window.confirm(
      `¿Descartar "${job.caption || 'este video'}" de tu historial? Esta acción no se puede deshacer.`
    );

    if (!confirmation) return;

    setDeletingJobId(job.id);

    try {
      if (job.jobType === 'video') {
        await deleteVideo(token, job.id);
      } else {
        await deletePublishJob(token, job.id);
      }
      if (previewVideo?.id === job.id) {
        setPreviewVideo(null);
      }
      alert('🧹 Video descartado del historial');
    } catch (error) {
      console.error('Delete job error:', error);
      alert(
        `Error al eliminar video: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      );
    } finally {
      setDeletingJobId(null);
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

  const generatePreview = async (videoId: string, title: string) => {
    if (!token) return;

    setGeneratingPreviewId(videoId);

    try {
      const response = await fetch(`${API_ENDPOINTS.base}/preview/${videoId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate preview');
      }

      const data = await response.json();

      // Show preview modal with generated preview URL
      setPreviewVideo({
        id: videoId,
        url: data.previewUrl,
        title: `Preview: ${title}`,
      });
    } catch (error) {
      console.error('Preview generation error:', error);
      alert(
        `Error al generar preview: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setGeneratingPreviewId(null);
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
          {jobs.map(job => {
            const jobState = job.state.toLowerCase();
            const isVideoJob = job.jobType === 'video';
            const isCompletedVideo = isVideoJob && jobState === 'completed';
            const showDelete = canDeleteJob(job);

            return (
              <Card key={job.id} className="history-item">
                <div className="job-info">
                  <div>
                    <h3 className="job-caption">{job.caption}</h3>
                    <p className="job-account">
                      {job.tiktokConnection.displayName}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <span className={`job-status ${getStateColor(job.state)}`}>
                      {getStateLabel(job.state)}
                    </span>
                    {isCompletedVideo && (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const jobWithUrl = job as typeof job & {
                              editedUrl?: string;
                            };
                            console.log('[Ver Video] Clicking with job:', {
                              id: job.id,
                              caption: job.caption,
                              editedUrl: jobWithUrl.editedUrl,
                              status: job.status,
                              state: job.state,
                              fullJob: job,
                            });
                            if (jobWithUrl.editedUrl) {
                              console.log(
                                '[Ver Video] Opening video:',
                                jobWithUrl.editedUrl
                              );
                              setPreviewVideo({
                                id: job.id,
                                url: jobWithUrl.editedUrl,
                                title: job.caption,
                              });
                            } else {
                              console.error('[Ver Video] No editedUrl found');
                              alert('Video aún no disponible para preview');
                            }
                          }}
                          style={{ fontSize: '14px', padding: '6px 12px' }}
                        >
                          👁️ Ver Video
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => generatePreview(job.id, job.caption)}
                          disabled={generatingPreviewId === job.id}
                          style={{ fontSize: '14px', padding: '6px 12px' }}
                        >
                          {generatingPreviewId === job.id
                            ? '⏳ Generando...'
                            : '🎬 Preview con Efectos'}
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
                    {showDelete && (
                      <Button
                        variant="danger"
                        onClick={() => handleDelete(job)}
                        disabled={deletingJobId === job.id}
                        style={{ fontSize: '14px', padding: '6px 12px' }}
                      >
                        {deletingJobId === job.id
                          ? '⏳ Descartando…'
                          : '🗑️ Descartar'}
                      </Button>
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
            );
          })}
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
