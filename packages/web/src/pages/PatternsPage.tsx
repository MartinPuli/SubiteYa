import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { PatternCard } from '../components/PatternCard/PatternCard';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { API_ENDPOINTS } from '../config/api';
import './PatternsPage.css';

interface Pattern {
  id: string;
  name: string;
  isDefault: boolean;
  version: number;
  logoUrl: string | null;
  logoPosition: string;
  logoSize: number;
  logoOpacity: number;
  thumbnailUrl: string | null;
  tiktokConnection: {
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export const PatternsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();
  const { connections, fetchConnections } = useAppStore();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (token) {
      fetchConnections(token).catch(console.error);
      loadPatterns(token);
    }
  }, [isAuthenticated, token, navigate, fetchConnections]);

  const loadPatterns = async (authToken: string, connectionId?: string) => {
    setLoading(true);
    try {
      const url = connectionId
        ? `${API_ENDPOINTS.patterns}?connectionId=${connectionId}`
        : API_ENDPOINTS.patterns;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPatterns(data.patterns);
      }
    } catch (error) {
      console.error('Error loading patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionFilter = (connectionId: string) => {
    setSelectedConnection(connectionId);
    if (token) {
      loadPatterns(token, connectionId === 'all' ? undefined : connectionId);
    }
  };

  const handleSetDefault = async (patternId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.patterns}/${patternId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isDefault: true }),
      });

      if (response.ok) {
        loadPatterns(
          token,
          selectedConnection === 'all' ? undefined : selectedConnection
        );
      }
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const handleDelete = async (patternId: string) => {
    if (!token || !confirm('¿Eliminar este patrón?')) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.patterns}/${patternId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      if (response.ok) {
        loadPatterns(
          token,
          selectedConnection === 'all' ? undefined : selectedConnection
        );
      }
    } catch (error) {
      console.error('Error deleting pattern:', error);
    }
  };

  return (
    <div className="patterns-page">
      <div className="patterns-header">
        <div>
          <h1 className="patterns-title">Patrones de Marca</h1>
          <p className="patterns-subtitle">
            Editamos tu video automáticamente con tu marca y formato
          </p>
        </div>
        {connections.length > 0 && (
          <Button variant="primary" onClick={() => navigate('/patterns/new')}>
            + Nuevo Patrón
          </Button>
        )}
      </div>

      {connections.length === 0 ? (
        <Card className="empty-state">
          <div className="empty-icon">🎨</div>
          <h3>Conecta una cuenta primero</h3>
          <p>Necesitas tener al menos una cuenta de TikTok conectada</p>
          <Button variant="primary" onClick={() => navigate('/connections')}>
            Conectar Cuenta
          </Button>
        </Card>
      ) : (
        <>
          <div className="patterns-filters">
            <select
              value={selectedConnection}
              onChange={e => handleConnectionFilter(e.target.value)}
              className="connection-filter"
            >
              <option value="all">Todas las cuentas</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>
                  {conn.displayName}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="loading-state">Cargando patrones...</div>
          ) : patterns.length === 0 ? (
            <Card className="empty-state">
              <div className="empty-icon">🎨</div>
              <h3>No tienes patrones aún</h3>
              <p>Crea tu primer patrón para automatizar la edición de videos</p>
              <Button
                variant="primary"
                onClick={() => navigate('/patterns/new')}
              >
                Crear Patrón
              </Button>
            </Card>
          ) : (
            <div className="patterns-grid">
              {patterns.map(pattern => (
                <PatternCard
                  key={pattern.id}
                  pattern={pattern}
                  onEdit={() => navigate(`/patterns/${pattern.id}`)}
                  onSetDefault={() => handleSetDefault(pattern.id)}
                  onDelete={() => handleDelete(pattern.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="patterns-footer">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          ← Volver al Dashboard
        </Button>
      </div>
    </div>
  );
};
