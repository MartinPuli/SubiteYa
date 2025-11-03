import React from 'react';
import './Slider.css';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  disabled = false,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="slider-container">
      <div className="slider-header">
        <label className="slider-label">{label}</label>
        <span className="slider-value">
          {value}
          {unit}
        </span>
      </div>
      <div className="slider-track-container">
        <input
          type="range"
          className="slider-input"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          style={{
            background: `linear-gradient(to right, 
              var(--color-tiktok-pink) 0%, 
              var(--color-tiktok-cyan) ${percentage}%, 
              #e2e8f0 ${percentage}%, 
              #e2e8f0 100%)`,
          }}
        />
      </div>
    </div>
  );
};
