import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { Input } from '../components/Input/Input';
import { API_ENDPOINTS } from '../config/api';
import './RegisterPage.css';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
    acceptedPrivacy: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (!formData.acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones');
      return;
    }

    if (!formData.acceptedPrivacy) {
      setError('Debes aceptar la Política de Privacidad');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.register, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          acceptedTerms: formData.acceptedTerms,
          acceptedPrivacy: formData.acceptedPrivacy,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Error al registrarse');
      }

      // Registro exitoso, redirigir a verificación de email
      navigate('/verify-email', { state: { email: formData.email } });
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

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <h1 className="register-title">Crear cuenta</h1>
          <p className="register-subtitle">
            Únete a SubiteYa y publica en múltiples cuentas de TikTok
          </p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          {error && <div className="register-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Nombre</label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Tu nombre"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

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
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Repite tu contraseña"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="acceptedTerms"
                checked={formData.acceptedTerms}
                onChange={handleChange}
                required
              />
              <span>
                Acepto los{' '}
                <Link
                  to="/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Términos y Condiciones
                </Link>
              </span>
            </label>
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="acceptedPrivacy"
                checked={formData.acceptedPrivacy}
                onChange={handleChange}
                required
              />
              <span>
                Acepto la{' '}
                <Link
                  to="/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Política de Privacidad
                </Link>
              </span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="register-button"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
        </form>

        <div className="register-footer">
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="register-link">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
