import React, { useState } from 'react';
import './BeforeAfterPreview.css';

interface BeforeAfterPreviewProps {
  brightness: number;
  contrast: number;
  saturation: number;
  filterType: string;
  vignette: number;
  logoUrl?: string | null;
  logoPosition: string;
  logoSize: number;
  logoOpacity: number;
}

export const BeforeAfterPreview: React.FC<BeforeAfterPreviewProps> = ({
  brightness,
  contrast,
  saturation,
  filterType,
  vignette,
  logoUrl,
  logoPosition,
  logoSize,
  logoOpacity,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => setIsDragging(true);

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  // Apply filters to create the "after" effect
  const getFilterStyle = () => {
    const filters: string[] = [];

    if (brightness !== 100) {
      filters.push(`brightness(${brightness}%)`);
    }
    if (contrast !== 100) {
      filters.push(`contrast(${contrast}%)`);
    }
    if (saturation !== 100) {
      filters.push(`saturate(${saturation}%)`);
    }

    // Add preset filters
    switch (filterType) {
      case 'vintage':
        filters.push('sepia(40%) saturate(120%) hue-rotate(-10deg)');
        break;
      case 'vibrant':
        filters.push('saturate(150%) contrast(110%)');
        break;
      case 'cinematic':
        filters.push('contrast(110%) brightness(95%) saturate(90%)');
        break;
      case 'warm':
        filters.push('sepia(20%) saturate(120%)');
        break;
      case 'cool':
        filters.push('hue-rotate(180deg) saturate(90%)');
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

  const getLogoPositionStyle = () => {
    const size = `${logoSize}%`;
    const baseStyle = {
      width: size,
      height: 'auto',
      maxHeight: size,
      opacity: logoOpacity / 100,
      objectFit: 'contain' as const,
    };

    switch (logoPosition) {
      case 'top-left':
        return { ...baseStyle, top: '5%', left: '5%' };
      case 'top-right':
        return { ...baseStyle, top: '5%', right: '5%' };
      case 'bottom-left':
        return { ...baseStyle, bottom: '5%', left: '5%' };
      case 'bottom-right':
        return { ...baseStyle, bottom: '5%', right: '5%' };
      case 'center':
        return {
          ...baseStyle,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
      default:
        return { ...baseStyle, bottom: '5%', right: '5%' };
    }
  };

  return (
    <div className="before-after-preview">
      <div className="preview-labels">
        <span className="label-before">ANTES</span>
        <span className="label-after">DESPUÉS</span>
      </div>

      <div
        className="comparison-container"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        {/* Before Image */}
        <div className="image-before">
          <img
            src="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&h=711&fit=crop"
            alt="Original"
            draggable={false}
          />
        </div>

        {/* After Image */}
        <div
          className="image-after"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img
            src="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&h=711&fit=crop"
            alt="Procesado"
            style={{ filter: getFilterStyle() }}
            draggable={false}
          />

          {/* Logo overlay on "after" side */}
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className="logo-overlay"
              style={getLogoPositionStyle()}
              draggable={false}
            />
          )}

          {/* Vignette effect */}
          {vignette > 0 && (
            <div
              className="vignette-overlay"
              style={{ opacity: vignette / 100 }}
            />
          )}
        </div>

        {/* Slider Handle */}
        <div className="slider-handle" style={{ left: `${sliderPosition}%` }}>
          <div className="handle-line" />
          <div className="handle-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 19l-7-7 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M9 19l7-7-7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="preview-hint">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 1.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM6 5.5l4 2.5-4 2.5V5.5z" />
        </svg>
        Arrastra el control para comparar antes y después
      </div>
    </div>
  );
};
