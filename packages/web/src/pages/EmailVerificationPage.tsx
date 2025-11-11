import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';
import './EmailVerificationPage.css';

export const EmailVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get email and code from URL params only
  const urlParams = new URLSearchParams(location.search);
  const emailFromUrl = urlParams.get('email');
  const codeFromUrl = urlParams.get('code');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const verifyEmail = async (emailToVerify: string, codeToVerify: string) => {
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
          email: emailToVerify,
          code: codeToVerify.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || 'Error al verificar el código'
        );
      }

      setSuccess('¡Email verificado exitosamente! Redirigiendo...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
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

  // Auto-verify if code is in URL
  useEffect(() => {
    if (emailFromUrl && codeFromUrl) {
      verifyEmail(emailFromUrl, codeFromUrl);
    } else {
      setError(
        'Enlace de verificación inválido. Por favor, revisa tu email y usa el botón de verificación.'
      );
    }
  }, [emailFromUrl, codeFromUrl]);

  return (
    <div className="verify-email-page">
      <div className="verify-email-container">
        <div className="verify-email-header">
          <div className="email-icon">
            {loading ? '⏳' : success ? '✅' : '❌'}
          </div>
          <h1 className="verify-email-title">
            {loading
              ? 'Verificando tu email...'
              : success
                ? '¡Email verificado!'
                : 'Error de verificación'}
          </h1>
          <p className="verify-email-subtitle">
            {loading
              ? 'Por favor espera mientras verificamos tu cuenta'
              : success
                ? 'Tu cuenta ha sido verificada exitosamente'
                : error}
          </p>
        </div>

        {loading && (
          <div className="auto-verify-message">
            <div className="spinner"></div>
            <p>Verificando automáticamente...</p>
          </div>
        )}

        {error && (
          <div className="verify-error-box">
            <p>{error}</p>
            <Link to="/login" className="back-button">
              Ir al login
            </Link>
          </div>
        )}

        {success && (
          <div className="verify-success-box">
            <p>Serás redirigido al login en unos segundos...</p>
          </div>
        )}

        <div className="verify-email-footer">
          <Link to="/login" className="back-link">
            ← Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
};
