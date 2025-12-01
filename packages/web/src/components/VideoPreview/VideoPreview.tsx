import React from 'react';
import { Card } from '../Card/Card';
import { Button } from '../Button/Button';
import './VideoPreview.css';

interface VideoPreviewProps {
  videoUrl: string;
  videoId: string;
  title: string;
  onClose: () => void;
  onPublish?: () => void;
  onEdit?: (videoId: string) => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoUrl,
  videoId,
  title,
  onClose,
  onPublish,
  onEdit,
}) => {
  console.log('[VideoPreview] Rendering with:', {
    videoUrl,
    videoId,
    title,
  });

  const handleEditVideo = () => {
    if (onEdit) {
      onEdit(videoId);
    } else {
      // Fallback: abrir en nueva pestaña para editar
      window.open(`/editor?videoId=${videoId}`, '_blank');
    }
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
            <div className="video-player-container">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="video-player"
                onError={e => {
                  console.error('[VideoPreview] Video load error:', {
                    videoUrl,
                    error: e,
                    target: e.currentTarget,
                  });
                }}
                onLoadStart={() => {
                  console.log(
                    '[VideoPreview] Video started loading:',
                    videoUrl
                  );
                }}
                onLoadedData={() => {
                  console.log('[VideoPreview] Video loaded successfully');
                }}
              >
                Tu navegador no soporta el tag de video.
              </video>
            </div>

            <div className="video-preview-info">
              <div className="info-section">
                <div className="info-row">
                  <strong>Título:</strong>
                  <span>{title}</span>
                </div>
                <div className="action-buttons">
                  <Button
                    variant="ghost"
                    onClick={handleEditVideo}
                    style={{ gap: '8px' }}
                  >
                    ✂️ Editar Video
                  </Button>
                </div>
              </div>
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
