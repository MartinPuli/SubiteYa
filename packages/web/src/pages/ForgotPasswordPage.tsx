import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { API_ENDPOINTS } from '../config/api';
import './ForgotPasswordPage.css';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.forgotPassword, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar el código');
      }

      setSuccess(true);
      // Redirigir a la página de reset después de 3 segundos
      setTimeout(() => {
        navigate('/reset-password', { state: { email } });
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        <div className="forgot-password-header">
          <div className="lock-icon">🔒</div>
          <h1 className="forgot-password-title">¿Olvidaste tu contraseña?</h1>
          <p className="forgot-password-subtitle">
            Ingresa tu email y te enviaremos un código para restablecer tu
            contraseña
          </p>
        </div>

        {success ? (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>¡Código enviado!</h2>
            <p>
              Si existe una cuenta con el email <strong>{email}</strong>,
              recibirás un código de restablecimiento.
            </p>
            <p className="redirect-message">Redirigiendo en 3 segundos...</p>
            <Button
              variant="primary"
              onClick={() => navigate('/reset-password', { state: { email } })}
            >
              Ir a restablecer contraseña
            </Button>
          </div>
        ) : (
          <form className="forgot-password-form" onSubmit={handleSubmit}>
            {error && <div className="forgot-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="forgot-button"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </Button>
          </form>
        )}

        <div className="forgot-password-footer">
          <Link to="/login" className="back-link">
            ← Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
};
