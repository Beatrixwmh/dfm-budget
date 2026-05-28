import type { Timescale } from './chartHelpers';

const OPTIONS: { value: Timescale; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '6mo', label: '6mo' },
  { value: '1yr', label: '1yr' },
  { value: '2yr', label: '2yr' },
];

interface TimescaleSelectorProps {
  value: Timescale;
  onChange: (t: Timescale) => void;
}

export function TimescaleSelector({ value, onChange }: TimescaleSelectorProps) {
  return (
    <div className="flex gap-1 overflow-x-auto">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-accent text-white'
              : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
