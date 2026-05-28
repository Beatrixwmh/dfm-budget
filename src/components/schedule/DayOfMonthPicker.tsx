interface Props {
  value: number;
  onChange: (day: number) => void;
  label?: string;
}

export function DayOfMonthPicker({ value, onChange, label = 'Day of Month' }: Props) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div>
      <label className="mb-1.5 block text-sm text-text-secondary">{label}</label>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`flex h-9 items-center justify-center rounded-lg text-sm transition-colors ${
              value === d
                ? 'bg-accent text-white'
                : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
            }`}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(-1)}
          className={`col-span-3 flex h-9 items-center justify-center rounded-lg text-sm transition-colors ${
            value === -1
              ? 'bg-accent text-white'
              : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
          }`}
        >
          Last Day
        </button>
      </div>
    </div>
  );
}
