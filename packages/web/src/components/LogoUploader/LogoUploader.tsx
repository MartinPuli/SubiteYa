import React, { useState, useRef } from 'react';
import './LogoUploader.css';

interface LogoUploaderProps {
  currentLogo?: string | null;
  previewUrl?: string | null;
  onFileSelect: (file: File | null) => void;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({
  currentLogo,
  previewUrl,
  onFileSelect,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      onFileSelect(imageFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.startsWith('image/')) {
      onFileSelect(file);
    }
  };

  const handleRemove = () => {
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const displayUrl = previewUrl || currentLogo;

  return (
    <div className="logo-uploader">
      <div className="uploader-label">Logo / Marca de Agua</div>
      <p className="uploader-description">
        Arrastra una imagen o haz clic para seleccionar. Formatos: PNG, JPG, SVG
      </p>

      <label
        htmlFor="logo-upload-input"
        className={`uploader-dropzone ${isDragging ? 'is-dragging' : ''} ${
          displayUrl ? 'has-file' : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          id="logo-upload-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="uploader-input"
          aria-label="Upload logo"
        />

        {displayUrl ? (
          <div className="uploader-preview">
            <img
              src={displayUrl}
              alt="Logo preview"
              className="preview-image"
            />
            <div className="preview-overlay">
              <div className="preview-actions">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleClick();
                  }}
                  className="action-button action-change"
                  aria-label="Change logo"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  className="action-button action-remove"
                  aria-label="Remove logo"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="uploader-placeholder">
            <div className="placeholder-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <p className="placeholder-text">
              {isDragging ? (
                <strong>Suelta la imagen aquí</strong>
              ) : (
                <strong>Arrastra una imagen o haz clic para seleccionar</strong>
              )}
            </p>
            <p className="placeholder-formats">PNG, JPG, SVG hasta 5MB</p>
          </div>
        )}
      </label>
    </div>
  );
};
