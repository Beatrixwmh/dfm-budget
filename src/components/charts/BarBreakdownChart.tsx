import { useState } from 'react';
import type { BarSegment } from '../../engine/types';
import { formatCurrency, formatDate } from '../../utils/format';

interface Props {
  segments: BarSegment[];
  totalBalance: number;
}

export function BarBreakdownChart({ segments, totalBalance }: Props) {
  const [selected, setSelected] = useState<BarSegment | null>(null);

  const positive = segments.filter(s => s.amount > 0);
  const total = positive.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm text-text-secondary">Total Balance</span>
        <span className="text-lg font-semibold">{formatCurrency(totalBalance)}</span>
      </div>

      <div className="flex h-10 overflow-hidden rounded-lg">
        {positive.map((seg, i) => {
          const pct = total > 0 ? (seg.amount / total) * 100 : 0;
          if (pct < 0.5) return null;
          return (
            <button
              key={i}
              className="relative transition-opacity hover:opacity-80"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                minWidth: pct > 2 ? undefined : 4,
              }}
              onClick={() => setSelected(selected === seg ? null : seg)}
              title={`${seg.label}: ${formatCurrency(seg.amount)}`}
            />
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {positive.filter(s => (s.amount / total) * 100 >= 2).map((seg, i) => (
          <button
            key={i}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
            onClick={() => setSelected(selected === seg ? null : seg)}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4 rounded-xl bg-surface-overlay p-4">
          {selected.funding ? (
            <FundingDetail segment={selected} />
          ) : (
            <div>
              <p className="font-medium">{selected.label}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(selected.amount)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FundingDetail({ segment }: { segment: BarSegment }) {
  const { funding } = segment;
  if (!funding) return null;

  const pct = funding.due > 0 ? Math.min(100, (funding.allocated / funding.due) * 100) : 100;
  const funded = pct >= 100;
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference - (circumference * Math.min(pct, 100)) / 100;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="#2e3345" strokeWidth="7" />
          <circle
            cx="44" cy="44" r="36"
            fill="none"
            stroke={funded ? '#34d399' : '#f87171'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{segment.label}</p>
        <p className="mt-0.5 text-sm text-text-secondary">
          Due {formatDate(funding.dueDate)}
        </p>
        <div className="mt-2 flex gap-4 text-sm">
          <div>
            <span className="text-text-muted">Allocated</span>
            <p className="font-semibold">{formatCurrency(funding.allocated)}</p>
          </div>
          <div>
            <span className="text-text-muted">Due</span>
            <p className="font-semibold">{formatCurrency(funding.due)}</p>
          </div>
        </div>
        {funded ? (
          <span className="mt-2 inline-block rounded-full bg-success-dim px-2 py-0.5 text-xs font-medium text-success">
            Funded
          </span>
        ) : (
          <span className="mt-2 inline-block rounded-full bg-danger-dim px-2 py-0.5 text-xs font-medium text-danger">
            Shortfall: {formatCurrency(funding.due - funding.allocated)}
          </span>
        )}
      </div>
    </div>
  );
}
