interface Props {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CurrencyInput({ value, onChange, label, placeholder = '0.00', autoFocus }: Props) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-sm text-text-secondary">{label}</label>}
      <div className="flex items-center rounded-lg border border-border bg-surface-overlay px-3 py-2.5 focus-within:border-accent">
        <span className="mr-1 text-text-muted">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value || ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}
