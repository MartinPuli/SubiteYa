import React, { useState } from 'react';
import { Card } from '../Card/Card';
import { Button } from '../Button/Button';
import './VideoPreview.css';

interface VideoPreviewProps {
  videoUrl: string;
  videoId: string;
  title: string;
  onClose: () => void;
  onPublish?: () => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoUrl,
  videoId,
  title,
  onClose,
  onPublish,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);

  const handleSave = () => {
    // TODO: Implementar guardado de cambios
    console.log('Saving changes:', { videoId, title: editedTitle });
    setIsEditing(false);
  };

  return (
    <div className="video-preview-overlay" onClick={onClose}>
      <div className="video-preview-modal" onClick={e => e.stopPropagation()}>
        <Card className="video-preview-card">
          <div className="video-preview-header">
            <h2>Vista Previa del Video</h2>
            <button className="close-button" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="video-preview-content">
            <div className="video-player">
              <video
                src={videoUrl}
                controls
                autoPlay
                style={{ width: '100%', maxHeight: '500px' }}
              >
                Tu navegador no soporta el tag de video.
              </video>
            </div>

            <div className="video-preview-info">
              {isEditing ? (
                <div className="edit-section">
                  <label>Título:</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={e => setEditedTitle(e.target.value)}
                    className="title-input"
                  />
                  <div className="edit-actions">
                    <Button variant="ghost" onClick={() => setIsEditing(false)}>
                      Cancelar
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                      Guardar Cambios
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="info-section">
                  <div className="info-row">
                    <strong>Título:</strong>
                    <span>{title}</span>
                  </div>
                  <Button variant="ghost" onClick={() => setIsEditing(true)}>
                    ✏️ Editar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="video-preview-footer">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {onPublish && (
              <Button variant="primary" onClick={onPublish}>
                🚀 Subir a TikTok
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
