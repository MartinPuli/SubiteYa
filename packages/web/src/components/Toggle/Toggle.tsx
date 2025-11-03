import React from 'react';
import './Toggle.css';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  checked,
  onChange,
  description,
  disabled = false,
}) => {
  return (
    <div className="toggle-container">
      <div className="toggle-content">
        <div className="toggle-text">
          <label className="toggle-label">{label}</label>
          {description && <p className="toggle-description">{description}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          className={`toggle-switch ${checked ? 'toggle-switch--checked' : ''} ${disabled ? 'toggle-switch--disabled' : ''}`}
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
        >
          <span className="toggle-switch-thumb" />
        </button>
      </div>
    </div>
  );
};
