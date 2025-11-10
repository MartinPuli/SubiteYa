/**
 * FileUploader component
 * Purpose: Drag & drop file uploader with visual feedback
 */

import React, { useState, useRef } from 'react';
import { Button } from '../Button/Button';
import './FileUploader.css';

interface FileUploaderProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeBytes?: number;
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  accept = 'audio/mp3,audio/wav,audio/ogg,audio/webm',
  multiple = true,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  files,
  onFilesChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const validateFiles = (
    newFiles: File[]
  ): { valid: File[]; error: string | null } => {
    setError(null);

    // Check number of files
    const totalFiles = files.length + newFiles.length;
    if (totalFiles > maxFiles) {
      return {
        valid: [],
        error: `Máximo ${maxFiles} archivos permitidos. Ya tienes ${files.length} archivo(s).`,
      };
    }

    // Check file sizes
    const oversizedFiles = newFiles.filter(file => file.size > maxSizeBytes);
    if (oversizedFiles.length > 0) {
      const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
      return {
        valid: [],
        error: `Algunos archivos superan el tamaño máximo de ${maxSizeMB}MB.`,
      };
    }

    // Check file types
    const acceptedTypes = accept.split(',').map(t => t.trim());
    const invalidFiles = newFiles.filter(file => {
      return !acceptedTypes.some(type => {
        if (type.includes('*')) {
          const baseType = type.split('/')[0];
          return file.type.startsWith(baseType);
        }
        return file.type === type;
      });
    });

    if (invalidFiles.length > 0) {
      return {
        valid: [],
        error: 'Algunos archivos tienen un formato no permitido.',
      };
    }

    return { valid: newFiles, error: null };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const { valid, error } = validateFiles(droppedFiles);

    if (error) {
      setError(error);
      return;
    }

    onFilesChange([...files, ...valid]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    const { valid, error } = validateFiles(selectedFiles);

    if (error) {
      setError(error);
      return;
    }

    onFilesChange([...files, ...valid]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    setError(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-uploader">
      {error && (
        <div className="uploader-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <div
        className={`drop-zone ${isDragging ? 'drop-zone--dragging' : ''} ${files.length > 0 ? 'drop-zone--has-files' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFilePicker}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          className="file-input-hidden"
        />

        <div className="drop-zone-content">
          <span className="upload-icon">📁</span>
          <p className="drop-zone-text">
            {isDragging
              ? '¡Suelta los archivos aquí!'
              : 'Arrastra archivos aquí o haz clic para seleccionar'}
          </p>
          <Button variant="ghost" size="sm" type="button">
            📎 Seleccionar Archivos
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="files-list">
          <div className="files-header">
            <h4>
              📎 {files.length} archivo(s) seleccionado(s)
              {maxFiles && ` (máx. ${maxFiles})`}
            </h4>
          </div>
          <div className="files-items">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <span className="file-icon">
                    {file.type.startsWith('audio/') ? '🎵' : '📄'}
                  </span>
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  type="button"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
