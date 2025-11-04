import React, { useState } from 'react';
import './PatternCard.css';

interface PatternCardProps {
  pattern: {
    id: string;
    name: string;
    isDefault: boolean;
    version: number;
    logoUrl: string | null;
    thumbnailUrl: string | null;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    filterType?: string;
    tiktokConnection: {
      displayName: string;
      avatarUrl: string | null;
    };
  };
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

export const PatternCard: React.FC<PatternCardProps> = ({
  pattern,
  onEdit,
  onSetDefault,
  onDelete,
}) => {
  const [showPreview, setShowPreview] = useState(false);

  const getFilterStyle = () => {
    const filters: string[] = [];

    if (pattern.brightness && pattern.brightness !== 100) {
      filters.push(`brightness(${pattern.brightness}%)`);
    }
    if (pattern.contrast && pattern.contrast !== 100) {
      filters.push(`contrast(${pattern.contrast}%)`);
    }
    if (pattern.saturation && pattern.saturation !== 100) {
      filters.push(`saturate(${pattern.saturation}%)`);
    }

    // Add preset filters
    switch (pattern.filterType) {
      case 'vintage':
        filters.push('sepia(40%) saturate(120%)');
        break;
      case 'vibrant':
        filters.push('saturate(150%) contrast(110%)');
        break;
      case 'cinematic':
        filters.push('contrast(110%) brightness(95%)');
        break;
      case 'warm':
        filters.push('sepia(20%) saturate(120%)');
        break;
      case 'cool':
        filters.push('hue-rotate(180deg)');
        break;
      case 'bw':
        filters.push('grayscale(100%)');
        break;
      case 'sepia':
        filters.push('sepia(100%)');
        break;
      case 'dramatic':
        filters.push('contrast(130%) brightness(90%)');
        break;
    }

    return filters.length > 0 ? filters.join(' ') : 'none';
  };

  return (
    <article
      className="pattern-card-enhanced"
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      {pattern.isDefault && (
        <div className="pattern-default-badge">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0l2.472 5.008L16 5.854l-4 3.898.944 5.502L8 12.472l-4.944 2.782L4 9.752 0 5.854l5.528-.846z" />
          </svg>
          <span>Predeterminado</span>
        </div>
      )}

      <div className="pattern-preview-container">
        <div className="pattern-preview-wrapper">
          {/* Image without filter (before) */}
          <div className="preview-before">
            <img
              src="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=300&h=533&fit=crop"
              alt="Preview"
              className="pattern-preview-image"
            />
            <div className="preview-label">Original</div>
          </div>

          {/* Image with filter (after) - shown on hover */}
          <div className={`preview-after ${showPreview ? 'visible' : ''}`}>
            <img
              src="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=300&h=533&fit=crop"
              alt="Preview procesado"
              className="pattern-preview-image"
              style={{ filter: getFilterStyle() }}
            />
            {pattern.logoUrl && (
              <div className="preview-logo">
                <img src={pattern.logoUrl} alt="Logo" />
              </div>
            )}
            <div className="preview-label">Con efectos</div>
          </div>
        </div>

        <div className="pattern-effects-summary">
          {pattern.brightness !== 100 && (
            <span className="effect-badge">💡 Brillo</span>
          )}
          {pattern.filterType && pattern.filterType !== 'none' && (
            <span className="effect-badge">✨ {pattern.filterType}</span>
          )}
          {pattern.logoUrl && <span className="effect-badge">🎨 Logo</span>}
        </div>
      </div>

      <div className="pattern-card-content">
        <div className="pattern-header">
          <h3 className="pattern-title">{pattern.name}</h3>
          <span className="pattern-version">v{pattern.version}</span>
        </div>

        <div className="pattern-account">
          {pattern.tiktokConnection.avatarUrl && (
            <img
              src={pattern.tiktokConnection.avatarUrl}
              alt={pattern.tiktokConnection.displayName}
              className="account-avatar"
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span>{pattern.tiktokConnection.displayName}</span>
        </div>

        <div className="pattern-actions">
          <button className="action-button edit" onClick={onEdit}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61z" />
            </svg>
            Editar
          </button>

          {!pattern.isDefault && (
            <button className="action-button default" onClick={onSetDefault}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 0l2.472 5.008L16 5.854l-4 3.898.944 5.502L8 12.472l-4.944 2.782L4 9.752 0 5.854l5.528-.846z" />
              </svg>
              Predeterminar
            </button>
          )}

          <button className="action-button delete" onClick={onDelete}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
};
