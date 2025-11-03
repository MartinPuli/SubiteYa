import React from 'react';
import './EnhancedSlider.css';

export type SliderType =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'temperature'
  | 'tint'
  | 'hue'
  | 'exposure'
  | 'volume'
  | 'speed'
  | 'default';

interface EnhancedSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  type?: SliderType;
  description?: string;
}

const getSliderGradient = (type: SliderType): string => {
  switch (type) {
    case 'brightness':
      return 'linear-gradient(to right, #1e293b 0%, #fbbf24 100%)';
    case 'contrast':
      return 'linear-gradient(to right, #6b7280 0%, #000000 100%)';
    case 'saturation':
      return 'linear-gradient(to right, #9ca3af 0%, #ef4444 25%, #f59e0b 50%, #10b981 75%, #3b82f6 100%)';
    case 'temperature':
      return 'linear-gradient(to right, #3b82f6 0%, #ffffff 50%, #f97316 100%)';
    case 'tint':
      return 'linear-gradient(to right, #10b981 0%, #ffffff 50%, #ec4899 100%)';
    case 'hue':
      return 'linear-gradient(to right, #ef4444 0%, #f59e0b 16.67%, #eab308 33.33%, #22c55e 50%, #3b82f6 66.67%, #a855f7 83.33%, #ef4444 100%)';
    case 'exposure':
      return 'linear-gradient(to right, #000000 0%, #6b7280 50%, #ffffff 100%)';
    case 'volume':
      return 'linear-gradient(to right, #64748b 0%, #10b981 50%, #ef4444 100%)';
    case 'speed':
      return 'linear-gradient(to right, #3b82f6 0%, #ffffff 50%, #ef4444 100%)';
    default:
      return 'linear-gradient(to right, #e0e7ff 0%, #667eea 100%)';
  }
};

const getValueColor = (
  type: SliderType,
  value: number,
  min: number,
  max: number
): string => {
  const normalized = (value - min) / (max - min);

  switch (type) {
    case 'brightness':
      return normalized > 0.5 ? '#fbbf24' : '#64748b';
    case 'temperature':
      return normalized > 0.5 ? '#f97316' : '#3b82f6';
    case 'saturation':
      return normalized > 0.7 ? '#ef4444' : '#64748b';
    default:
      return '#667eea';
  }
};

export const EnhancedSlider: React.FC<EnhancedSliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  type = 'default',
  description,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const gradient = getSliderGradient(type);
  const valueColor = getValueColor(type, value, min, max);

  return (
    <div className="enhanced-slider">
      <div className="slider-header">
        <label className="slider-label">{label}</label>
        <span className="slider-value" style={{ color: valueColor }}>
          {value}
          {unit}
        </span>
      </div>
      {description && <p className="slider-description">{description}</p>}
      <div className="slider-track-container">
        <div className="slider-track" style={{ background: gradient }}>
          <div
            className="slider-fill"
            style={{
              width: `${percentage}%`,
              background: gradient,
              opacity: 0.7,
            }}
          />
        </div>
        <input
          type="range"
          className="slider-input"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
        />
      </div>
      <div className="slider-markers">
        <span className="marker-label">
          {min}
          {unit}
        </span>
        <span className="marker-label">
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
};
