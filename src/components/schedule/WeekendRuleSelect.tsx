import type { WeekendRule } from '../../engine/types';

const options: { value: WeekendRule; label: string }[] = [
  { value: 'as_is', label: 'As-is' },
  { value: 'friday_before', label: 'Fri before' },
  { value: 'monday_after', label: 'Mon after' },
  { value: 'nearest_weekday', label: 'Nearest' },
];

interface Props {
  value: WeekendRule;
  onChange: (rule: WeekendRule) => void;
}

export function WeekendRuleSelect({ value, onChange }: Props) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-text-secondary">If on Weekend</label>
      <div className="flex gap-1">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
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
