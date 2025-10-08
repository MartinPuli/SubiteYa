import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import './ConnectionsPage.css';

export const ConnectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const {
    connections,
    fetchConnections,
    deleteConnection,
    setDefaultConnection,
  } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      fetchConnections(token).catch(console.error);
    }

    // Check for OAuth callback status
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');

    if (success === 'true') {
      alert('¡Cuenta de TikTok conectada exitosamente!');
      // Clean URL
      window.history.replaceState({}, '', '/connections');
    } else if (error) {
      alert(`Error al conectar cuenta: ${error}`);
      // Clean URL
      window.history.replaceState({}, '', '/connections');
    }
  }, [isAuthenticated, token, navigate, fetchConnections]);

  const handleConnectTikTok = async () => {
    if (!token) {
      alert('Debes iniciar sesión primero');
      navigate('/login');
      return;
    }

    try {
      // Call the OAuth endpoint with the token
      const response = await fetch('http://localhost:3000/api/auth/tiktok', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al iniciar OAuth de TikTok');
      }

      // The backend will redirect to TikTok
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting TikTok:', error);
      alert('Error al conectar con TikTok. Por favor, intenta nuevamente.');
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!token) return;

    if (!confirm('¿Estás seguro de eliminar esta cuenta?')) {
      return;
    }

    try {
      await deleteConnection(token, id);
    } catch (error) {
      console.error('Error deleting connection:', error);
      alert('Error al eliminar la conexión');
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;

    try {
      await setDefaultConnection(token, id);
    } catch (error) {
      console.error('Error setting default:', error);
      alert('Error al establecer cuenta predeterminada');
    }
  };

  return (
    <div className="connections-page">
      <div className="connections-header">
        <div>
          <h1 className="connections-title">Cuentas de TikTok</h1>
          <p className="connections-subtitle">
            Gestiona las cuentas donde publicarás contenido
          </p>
        </div>
        <Button variant="primary" onClick={handleConnectTikTok}>
          + Conectar Cuenta
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card className="empty-state">
          <div className="empty-icon">🔗</div>
          <h3>No tienes cuentas conectadas</h3>
          <p>Conecta tu primera cuenta de TikTok para empezar</p>
          <Button variant="primary" onClick={handleConnectTikTok}>
            Conectar TikTok
          </Button>
        </Card>
      ) : (
        <div className="connections-list">
          {connections.map(connection => (
            <Card key={connection.id} className="connection-card">
              <div className="connection-info">
                <div className="connection-avatar">
                  {connection.avatarUrl ? (
                    <img
                      src={connection.avatarUrl}
                      alt={connection.displayName}
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {connection.displayName[0]}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="connection-name">{connection.displayName}</h3>
                  {connection.isDefault && (
                    <span className="connection-badge">Por defecto</span>
                  )}
                </div>
              </div>

              <div className="connection-actions">
                {!connection.isDefault && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSetDefault(connection.id)}
                  >
                    Establecer por defecto
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDisconnect(connection.id)}
                >
                  Desconectar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="connections-footer">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          ← Volver al Dashboard
        </Button>
      </div>
    </div>
  );
};
