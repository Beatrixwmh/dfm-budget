import { useState, useEffect, useRef } from 'react';

interface Props {
  categories: { id: string; name: string; color: string }[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

export function CategorySelect({ categories, value, onChange, label = 'Category' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = categories.find(c => c.id === value);

  return (
    <div ref={ref} className="relative">
      {label && <label className="mb-1.5 block text-sm text-text-secondary">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-left text-sm text-text-primary"
      >
        {selected ? (
          <>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />
            {selected.name}
          </>
        ) : (
          <span className="text-text-muted">No category</span>
        )}
        <svg className="ml-auto h-4 w-4 shrink-0 text-text-muted" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface-overlay py-1 shadow-lg">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-raised ${!value ? 'text-accent' : 'text-text-secondary'}`}
          >
            No category
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-raised ${value === c.id ? 'text-accent' : 'text-text-primary'}`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
