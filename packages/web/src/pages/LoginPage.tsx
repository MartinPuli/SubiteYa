import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { PasswordInput } from '../components/PasswordInput/PasswordInput';
import { useAuthStore } from '../store/authStore';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">SubiteYa</h1>
          <p className="login-subtitle">
            Publica en múltiples cuentas de TikTok
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            placeholder="tu@email.com"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
            fullWidth
          />

          <PasswordInput
            id="password"
            name="password"
            label="Contraseña"
            placeholder="••••••••"
            value={formData.password}
            onChange={e =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
            autoComplete="current-password"
          />

          {error && <div className="login-error">{error}</div>}

          <Button type="submit" variant="primary" fullWidth loading={loading}>
            Iniciar Sesión
          </Button>

          <div className="login-links">
            <button
              type="button"
              className="forgot-password-link"
              onClick={() => navigate('/forgot-password')}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="button"
            className="login-toggle"
            onClick={() => navigate('/register')}
          >
            ¿No tienes cuenta? Regístrate
          </button>
        </form>
      </div>
    </div>
  );
};
