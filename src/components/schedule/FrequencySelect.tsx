import type { ScheduleFrequency } from '../../engine/types';

const options: { value: ScheduleFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: '2 Weeks' },
  { value: 'semimonthly', label: '2x/Month' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

interface Props {
  value: ScheduleFrequency;
  onChange: (freq: ScheduleFrequency) => void;
}

export function FrequencySelect({ value, onChange }: Props) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-text-secondary">Frequency</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              value === opt.value
                ? 'bg-accent text-white'
                : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
