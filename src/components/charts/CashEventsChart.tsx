import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { CashEvent } from '../../engine/types';
import { formatCurrency } from '../../utils/format';
import { aggregateEvents, type Timescale } from './chartHelpers';
import { TimescaleSelector } from './TimescaleSelector';
import { todayString } from '../../utils/format';

interface Props {
  events: CashEvent[];
}

export function CashEventsChart({ events }: Props) {
  const [timescale, setTimescale] = useState<Timescale>('30d');
  const today = todayString();

  const data = useMemo(
    () => aggregateEvents(events, timescale, today),
    [events, timescale, today]
  );

  const hasData = data.some(d => d.income > 0 || d.expenses < 0);

  return (
    <div>
      <div className="mb-3">
        <TimescaleSelector value={timescale} onChange={setTimescale} />
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" strokeOpacity={0.5} />
            <XAxis
              dataKey="label"
              stroke="#5b6178"
              tick={{ fontSize: 10 }}
              tickLine={false}
              interval={getInterval(data.length)}
            />
            <YAxis
              stroke="#5b6178"
              tick={{ fontSize: 11 }}
              width={52}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => {
                if (v === 0) return '$0';
                return `${v < 0 ? '-' : ''}$${(Math.abs(v) / 1000).toFixed(1)}k`;
              }}
            />
            <Tooltip content={<CashFlowTooltip />} />
            <ReferenceLine y={0} stroke="#5b6178" strokeWidth={1} />
            <Bar dataKey="income" fill="#34d399" radius={[2, 2, 0, 0]} />
            <Bar dataKey="expenses" fill="#f87171" radius={[0, 0, 2, 2]} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-sm text-text-muted">
          No events in this period
        </div>
      )}
    </div>
  );
}

function CashFlowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload;
  const income = bucket?.income ?? 0;
  const expenses = bucket?.expenses ?? 0;
  const incomeItems = bucket?.incomeItems ?? [];
  const expenseItems = bucket?.expenseItems ?? [];
  return (
    <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm shadow-lg max-w-xs">
      <p className="mb-1 font-medium text-text-primary">{label}</p>
      {incomeItems.length > 0 && (
        <div className="mb-1">
          {incomeItems.map((item: any, i: number) => (
            <p key={i} className="text-success">
              {item.name}: {formatCurrency(item.amount)}
            </p>
          ))}
        </div>
      )}
      {expenseItems.length > 0 && (
        <div className="mb-1">
          {expenseItems.map((item: any, i: number) => (
            <p key={i} className="text-danger">
              {item.name}: {formatCurrency(item.amount)}
            </p>
          ))}
        </div>
      )}
      <p className="mt-1 border-t border-border pt-1 text-text-secondary">
        Net: {formatCurrency(income + expenses)}
      </p>
    </div>
  );
}

function getInterval(count: number): number | 'preserveStartEnd' {
  if (count <= 12) return 0;
  if (count <= 30) return 2;
  return Math.floor(count / 10);
}
