import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { API_ENDPOINTS } from '../config/api';
import './EmailVerificationPage.css';

export const EmailVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [email, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.verifyEmail, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al verificar el código');
      }

      setSuccess('¡Email verificado exitosamente! Redirigiendo...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    setResending(true);

    try {
      const response = await fetch(API_ENDPOINTS.resendVerification, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al reenviar el código');
      }

      setSuccess('Código reenviado exitosamente. Revisa tu email.');
      setCountdown(60); // 60 segundos antes de poder reenviar nuevamente
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error');
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="verify-email-page">
      <div className="verify-email-container">
        <div className="verify-email-header">
          <div className="email-icon">📧</div>
          <h1 className="verify-email-title">Verifica tu email</h1>
          <p className="verify-email-subtitle">
            Hemos enviado un código de verificación a
          </p>
          <p className="verify-email-address">{email}</p>
        </div>

        <form className="verify-email-form" onSubmit={handleVerify}>
          {error && <div className="verify-error">{error}</div>}
          {success && <div className="verify-success">{success}</div>}

          <div className="form-group">
            <label htmlFor="code">Código de verificación</label>
            <Input
              id="code"
              name="code"
              type="text"
              placeholder="Ingresa el código de 64 caracteres"
              value={code}
              onChange={e => setCode(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="form-hint">
              El código tiene 64 caracteres y es válido por 24 horas
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="verify-button"
            disabled={loading || !code.trim()}
          >
            {loading ? 'Verificando...' : 'Verificar email'}
          </Button>

          <div className="resend-section">
            <p>¿No recibiste el código?</p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleResend}
              disabled={resending || countdown > 0}
            >
              {resending
                ? 'Reenviando...'
                : countdown > 0
                  ? `Reenviar en ${countdown}s`
                  : 'Reenviar código'}
            </Button>
          </div>
        </form>

        <div className="verify-email-footer">
          <Link to="/login" className="back-link">
            ← Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
};
