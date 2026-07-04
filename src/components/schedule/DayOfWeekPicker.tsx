const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  value: number;
  onChange: (day: number) => void;
}

export function DayOfWeekPicker({ value, onChange }: Props) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-text-secondary">Day of Week</label>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`mx-auto flex h-10 w-10 max-w-full items-center justify-center rounded-full text-sm font-medium transition-colors ${
              value === i
                ? 'bg-accent text-white'
                : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
