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

  // Subtitles
  enableSubtitles?: boolean;
  subtitleStyle?: string;
  subtitlePosition?: string;
  subtitleColor?: string;
  subtitleBgColor?: string;
  subtitleFontSize?: number;
  subtitleAnimation?: string;
  subtitleFontFamily?: string;

  // Crop
  enableAutoCrop?: boolean;
  aspectRatio?: string;
  cropPosition?: string;
}

// Sample preview images
const PREVIEW_IMAGES = [
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=711&fit=crop', // Person with phone
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=711&fit=crop', // Colorful makeup
  'https://images.unsplash.com/photo-1492138786289-d35ec6ac9508?w=400&h=711&fit=crop', // Golden hour portrait
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=711&fit=crop', // Portrait
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=711&fit=crop', // Urban portrait
];

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
  enableSubtitles = false,
  subtitleStyle = 'modern',
  subtitlePosition = 'bottom',
  subtitleColor = '#FFFFFF',
  subtitleBgColor = '#000000',
  subtitleFontSize = 24,
  subtitleAnimation = 'none',
  subtitleFontFamily = 'Arial',
  enableAutoCrop = false,
  aspectRatio = 'original',
  cropPosition = 'center',
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Allow keyboard control for accessibility
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      setSliderPosition(p => Math.max(0, p - 5));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      setSliderPosition(p => Math.min(100, p + 5));
    } else if (e.key === 'Home') {
      setSliderPosition(0);
    } else if (e.key === 'End') {
      setSliderPosition(100);
    }
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

  const getSubtitlePositionStyle = () => {
    switch (subtitlePosition) {
      case 'top':
        return { top: '10%' };
      case 'center':
        return { top: '50%', transform: 'translateY(-50%)' };
      case 'bottom':
      default:
        return { bottom: '15%' };
    }
  };

  const getSubtitleStyleClass = () => {
    return `subtitle-overlay subtitle-${subtitleStyle} subtitle-animation-${subtitleAnimation}`;
  };

  const getCropStyle = () => {
    if (!enableAutoCrop || aspectRatio === 'original') {
      return {};
    }

    // Calculate crop dimensions based on aspect ratio
    let cropWidth = '100%';
    let cropHeight = '100%';
    let cropTransform = '';

    switch (aspectRatio) {
      case '16:9': // YouTube
        cropWidth = '100%';
        cropHeight = '56.25%'; // 9/16 ratio
        break;
      case '1:1': // Square
        cropWidth = '56.25%'; // To maintain aspect in 9:16 container
        cropHeight = '100%';
        break;
      case '4:5': // Instagram
        cropWidth = '80%';
        break;
      case '9:16': // TikTok/Reels (default)
      default:
        // Keep 100% width and height
        break;
    }

    // Adjust position based on cropPosition
    switch (cropPosition) {
      case 'top':
        cropTransform = 'translateY(0)';
        break;
      case 'bottom':
        cropTransform = 'translateY(-100%)';
        break;
      case 'left':
        cropTransform = 'translateX(0)';
        break;
      case 'right':
        cropTransform = 'translateX(-100%)';
        break;
      case 'center':
      default:
        cropTransform = 'translate(-50%, -50%)';
        break;
    }

    return {
      width: cropWidth,
      height: cropHeight,
      position: 'absolute' as const,
      top: cropPosition === 'center' || cropPosition === 'bottom' ? '50%' : '0',
      left: cropPosition === 'center' || cropPosition === 'right' ? '50%' : '0',
      transform: cropTransform,
    };
  };

  const currentImage = PREVIEW_IMAGES[selectedImageIndex];

  return (
    <div className="before-after-preview">
      <div className="preview-header">
        <div className="preview-labels">
          <span className="label-after">DESPUÉS</span>
          <span className="label-before">ANTES</span>
        </div>
        <div className="image-selector">
          {PREVIEW_IMAGES.map((img, index) => (
            <button
              key={`preview-img-${img}`}
              className={`image-selector-btn ${selectedImageIndex === index ? 'active' : ''}`}
              onClick={() => setSelectedImageIndex(index)}
              aria-label={`Seleccionar imagen ${index + 1}`}
              type="button"
            >
              {index + 1}
            </button>
          ))}
        </div>
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
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(sliderPosition)}
        aria-label="Comparación antes y después"
      >
        {/* After Image - Now on the left (full background) */}
        <div className="image-after">
          <div className="image-content" style={getCropStyle()}>
            <img
              src={currentImage}
              alt="Procesado"
              style={{ filter: getFilterStyle() }}
              draggable={false}
            />

            {/* Crop indicator overlay */}
            {enableAutoCrop && aspectRatio !== 'original' && (
              <div className="crop-indicator">
                <div className="crop-label">Recorte: {aspectRatio}</div>
              </div>
            )}

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

            {/* Subtitles overlay */}
            {enableSubtitles && (
              <div
                className={getSubtitleStyleClass()}
                style={{
                  ...getSubtitlePositionStyle(),
                  color: subtitleColor,
                  backgroundColor:
                    subtitleStyle === 'boxed' || subtitleStyle === 'modern'
                      ? subtitleBgColor
                      : 'transparent',
                  fontSize: `${subtitleFontSize}px`,
                  fontFamily: subtitleFontFamily,
                  WebkitTextStroke:
                    subtitleStyle === 'outlined'
                      ? `2px ${subtitleBgColor}`
                      : 'none',
                  textShadow:
                    subtitleStyle === 'bold'
                      ? `2px 2px 4px ${subtitleBgColor}`
                      : 'none',
                }}
              >
                Este es un ejemplo de subtítulo
              </div>
            )}
          </div>
        </div>

        {/* Before Image - Now on the right (clipped) */}
        <div
          className="image-before"
          style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
        >
          <img src={currentImage} alt="Original" draggable={false} />
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
