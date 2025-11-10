/**
 * Navigation component
 * Purpose: Main navigation bar with TikTok theme
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../Button/Button';
import './Navigation.css';

export const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navigation">
      <div className="navigation-container">
        <Link to="/dashboard" className="navigation-logo">
          <span className="logo-icon">🚀</span>
          <span className="logo-text">SubiteYa</span>
        </Link>

        <div className="navigation-links">
          <Link
            to="/dashboard"
            className={`nav-link ${isActive('/dashboard') ? 'nav-link--active' : ''}`}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </Link>
          <Link
            to="/connections"
            className={`nav-link ${isActive('/connections') ? 'nav-link--active' : ''}`}
          >
            <span className="nav-icon">🔗</span>
            Conexiones
          </Link>
          <Link
            to="/upload"
            className={`nav-link ${isActive('/upload') ? 'nav-link--active' : ''}`}
          >
            <span className="nav-icon">📤</span>
            Subir
          </Link>
          <Link
            to="/history"
            className={`nav-link ${isActive('/history') ? 'nav-link--active' : ''}`}
          >
            <span className="nav-icon">📜</span>
            Historial
          </Link>
          <Link
            to="/patterns"
            className={`nav-link ${isActive('/patterns') ? 'nav-link--active' : ''}`}
          >
            <span className="nav-icon">🎨</span>
            Patrones
          </Link>
          <Link
            to="/voices"
            className={`nav-link ${isActive('/voices') ? 'nav-link--active' : ''}`}
          >
            <span className="nav-icon">🎙️</span>
            Voces IA
          </Link>
        </div>

        <div className="navigation-user">
          <span className="user-name">{user?.name || 'Usuario'}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </div>
    </nav>
  );
};
