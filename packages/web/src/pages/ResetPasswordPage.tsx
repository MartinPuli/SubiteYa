import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { PasswordInput } from '../components/PasswordInput/PasswordInput';
import { API_ENDPOINTS } from '../config/api';
import './ResetPasswordPage.css';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Only get email and code from URL params (no manual entry)
  const urlParams = new URLSearchParams(location.search);
  const emailFromUrl = urlParams.get('email');
  const codeFromUrl = urlParams.get('code');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!emailFromUrl || !codeFromUrl) {
      // Si no hay email ni code en la URL, mostrar error
      setError(
        'Enlace de recuperación inválido. Por favor, solicita un nuevo enlace de recuperación desde la página de login.'
      );
    }
  }, [emailFromUrl, codeFromUrl]);

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

    if (!emailFromUrl || !codeFromUrl) {
      setError('Enlace de recuperación inválido');
      return;
    }

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
          email: emailFromUrl,
          code: codeFromUrl.trim(),
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

  // Si no hay email o code, mostrar error
  if (!emailFromUrl || !codeFromUrl) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-header">
            <div className="key-icon">❌</div>
            <h1 className="reset-password-title">Enlace inválido</h1>
            <p className="reset-password-subtitle">
              {error || 'El enlace de recuperación no es válido o ha expirado'}
            </p>
          </div>
          <div className="error-actions">
            <Link to="/forgot-password" className="action-button">
              Solicitar nuevo enlace
            </Link>
            <Link to="/login" className="back-link">
              ← Volver al login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-container">
        <div className="reset-password-header">
          <div className="key-icon">🔑</div>
          <h1 className="reset-password-title">Nueva Contraseña</h1>
          <p className="reset-password-subtitle">
            Ingresa tu nueva contraseña para tu cuenta
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
              <label htmlFor="newPassword">Nueva contraseña</label>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                label=""
                placeholder="Mínimo 8 caracteres"
                value={formData.newPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                label=""
                placeholder="Repite tu nueva contraseña"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
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
