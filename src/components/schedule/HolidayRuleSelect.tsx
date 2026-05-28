import type { HolidayRule } from '../../engine/types';

const options: { value: HolidayRule; label: string }[] = [
  { value: 'as_is', label: 'As-is' },
  { value: 'day_before', label: 'Day before' },
  { value: 'day_after', label: 'Day after' },
  { value: 'nearest_business_day', label: 'Nearest biz day' },
];

interface Props {
  value: HolidayRule;
  onChange: (rule: HolidayRule) => void;
}

export function HolidayRuleSelect({ value, onChange }: Props) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-text-secondary">If on Holiday</label>
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
