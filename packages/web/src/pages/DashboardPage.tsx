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
    enColaEdicion: jobs.filter(j => j.state === 'queued').length,
    editando: jobs.filter(j => j.state === 'uploading').length,
    editados: jobs.filter(j => j.state === 'completed').length,
    publicando: jobs.filter(j => j.state === 'publishing').length,
    publicados: jobs.filter(j => j.state === 'published').length,
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
            <div className="stat-value">{stats.enColaEdicion}</div>
            <div className="stat-label">⏳ En Cola de Edición</div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-value">{stats.editando}</div>
            <div className="stat-label">✂️ Editando</div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-value stat-value--success">
              {stats.editados}
            </div>
            <div className="stat-label">✅ Editados</div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-value">{stats.publicando}</div>
            <div className="stat-label">📤 Publicando</div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-value stat-value--success">
              {stats.publicados}
            </div>
            <div className="stat-label">🎉 Publicados</div>
          </div>
        </Card>

        <Card>
          <div className="stat-card">
            <div className="stat-value stat-value--error">{stats.failed}</div>
            <div className="stat-label">❌ Fallidos</div>
          </div>
        </Card>
      </div>

      <div className="dashboard-actions">
        <Card className="action-card" onClick={() => navigate('/connections')}>
          <h3>🔗 Gestionar Cuentas</h3>
          <p>Conecta o desconecta cuentas de TikTok</p>
        </Card>

        <Card className="action-card" onClick={() => navigate('/voices')}>
          <h3>🎙️ Gestionar Voces IA</h3>
          <p>Clona tu voz o explora voces para narración</p>
        </Card>

        <Card className="action-card" onClick={() => navigate('/patterns')}>
          <h3>🎨 Patrones de Marca</h3>
          <p>Configura logo, efectos, subtítulos y voz</p>
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
