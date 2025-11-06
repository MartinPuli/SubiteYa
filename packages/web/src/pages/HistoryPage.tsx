import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
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
    queued: '⏳ En cola',
    uploading: '⬆️ Subiendo',
    publishing: '🚀 Publicando',
    completed: '✅ Publicado',
    published: '✅ Publicado',
    failed: '❌ Fallido',
    scheduled: '📅 Programado',
    canceled: '🚫 Cancelado',
  };
  return labels[state.toLowerCase()] || state;
};

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const { jobs, fetchJobs } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      fetchJobs(token).catch(console.error);
    }
  }, [isAuthenticated, token, navigate, fetchJobs]);

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
                <span className={`job-status ${getStateColor(job.state)}`}>
                  {getStateLabel(job.state)}
                </span>
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

      <div className="history-footer">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          ← Volver al Dashboard
        </Button>
      </div>
    </div>
  );
};
