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
        <div className="slider-track">
          <div
            className="slider-fill"
            data-type={type}
            style={{
              width: `${percentage}%`,
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
