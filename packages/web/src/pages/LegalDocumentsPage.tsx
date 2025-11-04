import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './LegalDocumentsPage.css';

type DocumentType = 'terms' | 'privacy';

export const LegalDocumentsPage: React.FC = () => {
  const { type } = useParams<{ type: DocumentType }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      try {
        let url = '';
        const basePath = import.meta.env.PROD ? '/SubiteYa' : '';
        if (type === 'terms') {
          url = `${basePath}/TERMINOS_Y_CONDICIONES.md`;
        } else if (type === 'privacy') {
          url = `${basePath}/POLITICA_DE_PRIVACIDAD.md`;
        } else {
          navigate('/');
          return;
        }

        const response = await fetch(url);
        const text = await response.text();
        setContent(text);
      } catch (error) {
        console.error('Error loading document:', error);
        setContent(
          'Error al cargar el documento. Por favor, intenta nuevamente.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [type, navigate]);

  const getTitle = () => {
    if (type === 'terms') return 'Términos y Condiciones';
    if (type === 'privacy') return 'Política de Privacidad';
    return '';
  };

  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-header">
          <button
            className="back-button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/register');
              }
            }}
          >
            ← Volver
          </button>
          <h1 className="legal-title">{getTitle()}</h1>
        </div>

        <div className="legal-content">
          {loading ? (
            <div className="loading">Cargando documento...</div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="legal-footer">
          <p>Última actualización: Octubre 2025</p>
          <p>
            Para consultas:{' '}
            <a href="mailto:legalessubiteya@gmail.com">
              legalessubiteya@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
