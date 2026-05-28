import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useAppState } from '../../store/hooks';
import { TimescaleSelector } from '../charts/TimescaleSelector';
import { formatCurrency } from '../../utils/format';
import type { Timescale } from '../charts/chartHelpers';
import type { DfmHistoryEntry } from '../../engine/types';

const TIMESCALE_DAYS: Record<Timescale, number> = {
  '7d': 7, '30d': 30, '90d': 90, '6mo': 182, '1yr': 365, '2yr': 730,
};

export function DfmHistoryChart() {
  const { dfmHistory } = useAppState();
  const [timescale, setTimescale] = useState<Timescale>('30d');

  const data = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TIMESCALE_DAYS[timescale]);
    const cutoffKey = cutoffDate.toISOString().slice(0, 10);

    return dfmHistory
      .filter((h: DfmHistoryEntry) => h.date >= cutoffKey)
      .sort((a: DfmHistoryEntry, b: DfmHistoryEntry) => a.date.localeCompare(b.date))
      .map((h: DfmHistoryEntry) => ({
        date: h.date.slice(5), // MM-DD
        dfm: Math.round(h.dfm * 100) / 100,
      }));
  }, [dfmHistory, timescale]);

  const hasData = data.length >= 2;

  return (
    <div className="rounded-xl bg-surface-raised p-4">
      <h4 className="mb-3 text-sm font-medium text-text-secondary">DFM History</h4>
      <div className="mb-3">
        <TimescaleSelector value={timescale} onChange={setTimescale} />
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dfmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" strokeOpacity={0.5} />
            <XAxis dataKey="date" stroke="#5b6178" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis
              stroke="#5b6178"
              tick={{ fontSize: 11 }}
              width={52}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `$${v}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e2233', border: '1px solid #2e3345', borderRadius: 8 }}
              labelStyle={{ color: '#8b90a5' }}
              formatter={(value: number) => [formatCurrency(value), 'DFM']}
            />
            <ReferenceLine y={0} stroke="#5b6178" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="dfm"
              stroke="#22c55e"
              fill="url(#dfmGradient)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-12 text-center text-sm text-text-muted">
          {dfmHistory.length < 2
            ? 'DFM history builds over time. Check back after a few days.'
            : 'No data for this time range.'}
        </p>
      )}
    </div>
  );
}
