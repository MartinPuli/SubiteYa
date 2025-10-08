import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, token } = useAuthStore();
  const { connections, jobs, fetchConnections, fetchJobs } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      fetchConnections(token).catch(console.error);
      fetchJobs(token).catch(console.error);
    }
  }, [isAuthenticated, token, navigate, fetchConnections, fetchJobs]);

  const stats = {
    connections: connections.length,
    pending: jobs.filter(j => j.state === 'queued' || j.state === 'processing')
      .length,
    completed: jobs.filter(j => j.state === 'completed').length,
    failed: jobs.filter(j => j.state === 'failed').length,
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Hola, {user?.name || 'Usuario'}</h1>
          <p className="dashboard-subtitle">
            Gestiona tus publicaciones de TikTok
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/upload')}>
          + Nueva Publicación
        </Button>
      </div>

      <div className="dashboard-stats">
        <Card>
          <div className="stat-card">
            <div className="stat-value">{stats.connections}</div>
            <div className="stat-label">Cuentas Conectadas</div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pendientes</div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-value stat-value--success">
              {stats.completed}
            </div>
            <div className="stat-label">Completadas</div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-value stat-value--error">{stats.failed}</div>
            <div className="stat-label">Fallidas</div>
          </div>
        </Card>
      </div>

      <div className="dashboard-actions">
        <Card className="action-card" onClick={() => navigate('/connections')}>
          <h3>🔗 Gestionar Cuentas</h3>
          <p>Conecta o desconecta cuentas de TikTok</p>
        </Card>

        <Card className="action-card" onClick={() => navigate('/upload')}>
          <h3>📹 Subir Video</h3>
          <p>Publica en múltiples cuentas</p>
        </Card>

        <Card className="action-card" onClick={() => navigate('/history')}>
          <h3>📜 Ver Historial</h3>
          <p>Revisa tus publicaciones anteriores</p>
        </Card>
      </div>
    </div>
  );
};
