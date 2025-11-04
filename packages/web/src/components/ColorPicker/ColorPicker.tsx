import './ColorPicker.css';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  disabled?: boolean;
}

export function ColorPicker({
  label,
  value,
  onChange,
  description,
  disabled = false,
}: ColorPickerProps) {
  return (
    <div className="color-picker-container">
      <label className="color-picker-label">{label}</label>
      {description && <p className="color-picker-description">{description}</p>}
      <div className="color-picker-input-wrapper">
        <input
          type="color"
          className="color-picker-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
        />
        <input
          type="text"
          className="color-picker-text"
          value={value.toUpperCase()}
          onChange={e => {
            const val = e.target.value;
            if (/^#[0-9A-F]{0,6}$/i.test(val)) {
              onChange(val);
            }
          }}
          placeholder="#000000"
          disabled={disabled}
          maxLength={7}
        />
      </div>
    </div>
  );
}
