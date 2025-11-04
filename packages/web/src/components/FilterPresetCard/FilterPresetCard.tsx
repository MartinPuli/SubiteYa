import React from 'react';
import './FilterPresetCard.css';

export interface FilterPreset {
  value: string;
  label: string;
  description: string;
  gradient: string;
}

export const FILTER_PRESETS_VISUAL: FilterPreset[] = [
  {
    value: 'none',
    label: 'Sin Filtro',
    description: 'Original sin cambios',
    gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
  },
  {
    value: 'vintage',
    label: 'Vintage',
    description: 'Estilo retro cálido',
    gradient: 'linear-gradient(135deg, #f4a261 0%, #e76f51 100%)',
  },
  {
    value: 'vibrant',
    label: 'Vibrante',
    description: 'Colores intensos',
    gradient: 'linear-gradient(135deg, #ff006e 0%, #8338ec 100%)',
  },
  {
    value: 'cinematic',
    label: 'Cinemático',
    description: 'Look profesional',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
  },
  {
    value: 'warm',
    label: 'Cálido',
    description: 'Tonos naranjas',
    gradient: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
  },
  {
    value: 'cool',
    label: 'Frío',
    description: 'Tonos azules',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
  },
  {
    value: 'bw',
    label: 'Blanco y Negro',
    description: 'Clásico monocromático',
    gradient: 'linear-gradient(135deg, #000000 0%, #737373 100%)',
  },
  {
    value: 'sepia',
    label: 'Sepia',
    description: 'Foto antigua',
    gradient: 'linear-gradient(135deg, #a0826d 0%, #704214 100%)',
  },
  {
    value: 'dramatic',
    label: 'Dramático',
    description: 'Alto contraste',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
  },
];

interface FilterPresetCardProps {
  preset: FilterPreset;
  selected: boolean;
  onClick: () => void;
}

export const FilterPresetCard: React.FC<FilterPresetCardProps> = ({
  preset,
  selected,
  onClick,
}) => {
  return (
    <button
      className={`filter-preset-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className="preset-thumbnail" style={{ background: preset.gradient }}>
        {selected && (
          <div className="selected-badge">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                fill="currentColor"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="preset-info">
        <div className="preset-label">{preset.label}</div>
        <div className="preset-description">{preset.description}</div>
      </div>
    </button>
  );
};
