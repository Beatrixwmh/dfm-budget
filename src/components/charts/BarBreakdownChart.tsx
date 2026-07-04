import { useState } from 'react';
import type { BarSegment } from '../../engine/types';
import { formatCurrency, formatDate } from '../../utils/format';

interface Props {
  segments: BarSegment[];
  totalBalance: number;
}

const MIN_SEGMENT_PX = 18;

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

      {/* Bar — all segments shown, small ones get a minimum width */}
      <div className="flex h-10 overflow-hidden rounded-lg">
        {positive.map((seg, i) => {
          const pct = total > 0 ? (seg.amount / total) * 100 : 0;
          return (
            <button
              key={i}
              className={`relative transition-opacity hover:opacity-80 ${selected === seg ? 'ring-2 ring-white/40 ring-inset' : ''}`}
              style={{
                flex: `${pct} 0 ${MIN_SEGMENT_PX}px`,
                backgroundColor: seg.color,
              }}
              onClick={() => setSelected(selected === seg ? null : seg)}
              title={`${seg.label}: ${formatCurrency(seg.amount)}`}
            />
          );
        })}
      </div>

      {/* Legend — show all segments */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {positive.map((seg, i) => (
          <button
            key={i}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              selected === seg ? 'text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setSelected(selected === seg ? null : seg)}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </button>
        ))}
      </div>

      {/* Detail popup */}
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

  const nextPct = funding.nextDue > 0
    ? Math.min(100, (funding.nextAllocated / funding.nextDue) * 100)
    : 100;
  const nextFunded = nextPct >= 100;
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference - (circumference * Math.min(nextPct, 100)) / 100;

  return (
    <div className="flex items-start gap-5">
      {/* Funding ring for next occurrence */}
      <div className="relative shrink-0">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="#2e3345" strokeWidth="7" />
          <circle
            cx="44" cy="44" r="36"
            fill="none"
            stroke={nextFunded ? '#34d399' : '#f87171'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
          {Math.round(nextPct)}%
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium">{segment.label}</p>

        {/* Next occurrence */}
        <p className="mt-1 text-sm text-text-secondary">
          Next: {formatCurrency(funding.nextDue)} due {formatDate(funding.nextDueDate)}
        </p>
        <div className="mt-1.5 flex gap-4 text-sm">
          <div>
            <span className="text-text-muted">Allocated</span>
            <p className="font-semibold">{formatCurrency(funding.nextAllocated)}</p>
          </div>
          <div>
            <span className="text-text-muted">Due</span>
            <p className="font-semibold">{formatCurrency(funding.nextDue)}</p>
          </div>
        </div>
        {nextFunded ? (
          <span className="mt-1.5 inline-block rounded-full bg-success-dim px-2 py-0.5 text-xs font-medium text-success">
            Funded
          </span>
        ) : (
          <span className="mt-1.5 inline-block rounded-full bg-danger-dim px-2 py-0.5 text-xs font-medium text-danger">
            Shortfall: {formatCurrency(funding.nextDue - funding.nextAllocated)}
          </span>
        )}

        {/* Future occurrences */}
        {funding.futureTotal > 0 && (
          <div className="mt-3 border-t border-border pt-2.5">
            <p className="text-xs text-text-muted">Future occurrences</p>
            <div className="mt-1 flex gap-4 text-sm">
              <div>
                <span className="text-text-muted">Reserved</span>
                <p className="font-semibold">{formatCurrency(funding.futureAllocated)}</p>
              </div>
              <div>
                <span className="text-text-muted">Total upcoming</span>
                <p className="font-semibold">{formatCurrency(funding.futureTotal)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
