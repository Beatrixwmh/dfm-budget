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
  ReferenceDot,
} from 'recharts';
import { formatCurrency, formatMonthShort } from '../../utils/format';

interface Props {
  balances: { date: string; balance: number; rawBalance: number }[];
  buffer: number;
  pinchPointDate: string;
  pinchPointBalance: number;
  dfmPerDay: number;
  incomeEventDates: Set<string>;
}

export function ProjectedBalanceChart({
  balances,
  buffer,
  pinchPointDate,
  pinchPointBalance,
  dfmPerDay,
  incomeEventDates,
}: Props) {
  const [showDaily, setShowDaily] = useState(false);

  const paydayData = useMemo(() => {
    if (balances.length === 0) return [];
    // Always include today (first point) and last point
    const result = [balances[0]];
    for (let i = 1; i < balances.length - 1; i++) {
      if (incomeEventDates.has(balances[i].date)) {
        result.push(balances[i]);
      }
    }
    result.push(balances[balances.length - 1]);
    return result;
  }, [balances, incomeEventDates]);

  const dailyData = useMemo(() => {
    // Sample every-other-day when >400 points to avoid aliasing
    return balances.length > 400
      ? balances.filter((_, i) => i % 2 === 0 || i === balances.length - 1)
      : balances;
  }, [balances]);

  const data = showDaily ? dailyData : paydayData;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Assumes spending {formatCurrency(dfmPerDay)}/day
        </p>
        <button
          onClick={() => setShowDaily(d => !d)}
          className="rounded-md px-2 py-0.5 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
        >
          {showDaily ? 'Show paydays' : 'Show daily'}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonthShort}
            stroke="#5b6178"
            tick={{ fontSize: 11 }}
            interval={Math.floor(data.length / 12)}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => `$${(v / 1000).toFixed(1)}k`}
            stroke="#5b6178"
            tick={{ fontSize: 11 }}
            width={52}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<BalanceTooltip />} />
          <Area
            type="linear"
            dataKey="balance"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#balanceGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#34d399' }}
          />
          {buffer > 0 && (
            <ReferenceLine
              y={buffer}
              stroke="#fbbf24"
              strokeDasharray="6 4"
              label={{ value: 'Buffer', fill: '#fbbf24', fontSize: 11, position: 'insideTopRight' }}
            />
          )}
          <ReferenceDot
            x={pinchPointDate}
            y={pinchPointBalance}
            r={5}
            fill="#f87171"
            stroke="#f87171"
            strokeWidth={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BalanceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { date, balance, rawBalance } = payload[0].payload;
  const [y, m, d] = date.split('-').map(Number);
  const formatted = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const spent = rawBalance - balance;
  return (
    <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-text-secondary">{formatted}</p>
      <p className="text-success">Balance: {formatCurrency(balance)}</p>
      {spent > 0 && (
        <p className="text-text-muted">Cumulative spending: {formatCurrency(spent)}</p>
      )}
    </div>
  );
}
