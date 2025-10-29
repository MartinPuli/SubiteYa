import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { API_ENDPOINTS } from '../config/api';
import './ResetPasswordPage.css';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = location.state?.email;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: emailFromState || '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!emailFromState) {
      // Si no hay email en el state, redirigir a forgot-password
      navigate('/forgot-password');
    }
  }, [emailFromState, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.resetPassword, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          code: formData.code.trim(),
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || 'Error al restablecer la contraseña'
        );
      }

      setSuccess(true);
      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError(
          'No se pudo conectar con el servidor. Por favor, verifica tu conexión.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Ocurrió un error');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!emailFromState) {
    return null;
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-container">
        <div className="reset-password-header">
          <div className="key-icon">🔑</div>
          <h1 className="reset-password-title">Restablecer contraseña</h1>
          <p className="reset-password-subtitle">
            Ingresa el código que recibiste por email y tu nueva contraseña
          </p>
        </div>

        {success ? (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>¡Contraseña restablecida!</h2>
            <p>Tu contraseña ha sido actualizada exitosamente.</p>
            <p className="redirect-message">
              Redirigiendo al login en 3 segundos...
            </p>
            <Button variant="primary" onClick={() => navigate('/login')}>
              Ir al login
            </Button>
          </div>
        ) : (
          <form className="reset-password-form" onSubmit={handleSubmit}>
            {error && <div className="reset-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="code">Código de verificación</label>
              <Input
                id="code"
                name="code"
                type="text"
                placeholder="Código de 64 caracteres"
                value={formData.code}
                onChange={handleChange}
                required
                autoComplete="off"
              />
              <p className="form-hint">
                El código es válido por 1 hora desde que lo solicitaste
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">Nueva contraseña</label>
              <div className="password-input-wrapper">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <div className="password-input-wrapper">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repite tu nueva contraseña"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="reset-button"
              disabled={loading}
            >
              {loading ? 'Restableciendo...' : 'Restablecer contraseña'}
            </Button>
          </form>
        )}

        <div className="reset-password-footer">
          <Link to="/login" className="back-link">
            ← Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
};
