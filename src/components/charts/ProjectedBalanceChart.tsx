import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { formatCurrency, formatMonthShort } from '../../utils/format';
import type { DfmSegment, Goal } from '../../engine/types';
import type { GoalCompletion } from '../../engine/snapshot';

interface Props {
  balances: { date: string; balance: number; rawBalance: number }[];
  buffer: number;
  dfmPerDay: number;
  incomeEventDates: Set<string>;
  segments: DfmSegment[];
  goals?: Goal[];
  /** True (throttle-aware) completion dates from the engine's vault simulation. */
  goalCompletions?: GoalCompletion[];
  /** Simulator scenario trajectory, rendered as a dashed overlay. */
  scenarioBalances?: { date: string; balance: number }[];
}

export function ProjectedBalanceChart({
  balances,
  buffer,
  dfmPerDay,
  incomeEventDates,
  segments,
  goals = [],
  goalCompletions = [],
  scenarioBalances,
}: Props) {
  const activeGoals = goals.filter(g => g.status === 'active' && g.contributionRatePerDay > 0);
  const totalSavingsRate = activeGoals.reduce((s, g) => s + g.contributionRatePerDay, 0);
  const [showDaily, setShowDaily] = useState(false);
  const [showSavings, setShowSavings] = useState(totalSavingsRate > 0);

  // DFM-increase markers: only genuine rises to a meaningfully higher positive rate.
  // (Filters out the noisy $0→$0 "rises" that happen when underwater.)
  const dfmMarkers = useMemo(() => {
    return segments
      .filter(s =>
        s.nextRate !== null &&
        s.endDay < 730 &&
        s.nextRate > s.rate + 0.5 &&
        s.nextRate > 0
      )
      .map(s => ({ date: s.pinchDate, rate: s.nextRate as number }));
  }, [segments]);

  // All marker dates must be present in the data so vertical ReferenceLines render in BOTH views.
  const markerDates = useMemo(
    () => new Set<string>([...dfmMarkers.map(m => m.date), ...goalCompletions.map(c => c.date)]),
    [dfmMarkers, goalCompletions]
  );

  const paydayData = useMemo(() => {
    if (balances.length === 0) return [];
    const result = [balances[0]];
    for (let i = 1; i < balances.length; i++) {
      if (incomeEventDates.has(balances[i].date) || markerDates.has(balances[i].date)) {
        result.push(balances[i]);
      }
    }
    return result;
  }, [balances, incomeEventDates, markerDates]);

  const dailyData = useMemo(() => {
    if (balances.length <= 400) return balances;
    // Sample every other day, but always keep marker dates so lines render.
    return balances.filter((b, i) => i % 2 === 0 || i === balances.length - 1 || markerDates.has(b.date));
  }, [balances, markerDates]);

  const rawData = showDaily ? dailyData : paydayData;

  // Merge the scenario trajectory into the sampled points by date — both come
  // from the same 731-day window, so dates align exactly.
  const scenarioMap = useMemo(() => {
    if (!scenarioBalances) return null;
    return new Map(scenarioBalances.map(b => [b.date, b.balance]));
  }, [scenarioBalances]);

  const data = useMemo(() => {
    if (!scenarioMap) return rawData;
    return rawData.map(p => ({ ...p, scenario: scenarioMap.get(p.date) }));
  }, [rawData, scenarioMap]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs text-text-muted">
            Next 2 years · assumes spending {formatCurrency(dfmPerDay)}/day
          </p>
          {totalSavingsRate > 0 && (
            <button
              onClick={() => setShowSavings(s => !s)}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                showSavings ? 'bg-[#d4be7e]/20 text-[#d4be7e]' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {showSavings ? 'Hide savings' : 'Show savings'}
            </button>
          )}
        </div>
        <button
          onClick={() => setShowDaily(d => !d)}
          className="rounded-md px-2 py-0.5 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
        >
          {showDaily ? 'Show paydays' : 'Show daily'}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6dbf9c" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6dbf9c" stopOpacity={0} />
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
          <Tooltip content={<BalanceTooltip showSavings={showSavings} />} />
          <Area
            type="linear"
            dataKey="balance"
            stroke="#6dbf9c"
            strokeWidth={2}
            fill="url(#balanceGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#6dbf9c' }}
          />
          {showSavings && totalSavingsRate > 0 && (
            <Line
              type="linear"
              dataKey="savings"
              stroke="#d4be7e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#d4be7e' }}
            />
          )}
          {scenarioMap && (
            <Line
              type="linear"
              dataKey="scenario"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4, fill: '#a78bfa' }}
            />
          )}
          {buffer > 0 && (
            <ReferenceLine
              y={buffer}
              stroke="#e0b074"
              strokeDasharray="6 4"
              label={{ value: 'Buffer', fill: '#e0b074', fontSize: 11, position: 'insideTopRight' }}
            />
          )}
          {/* DFM-increase markers: subtle vertical anchors; labels live in the key below */}
          {dfmMarkers.map(m => (
            <ReferenceLine
              key={`dfm-${m.date}`}
              x={m.date}
              stroke="#a78bfa"
              strokeDasharray="3 4"
              strokeWidth={1}
              strokeOpacity={0.7}
            />
          ))}
          {/* Goal completion markers (tied to the savings line) */}
          {showSavings && goalCompletions.map(c => (
            <ReferenceLine
              key={`goal-${c.goalId}`}
              x={c.date}
              stroke="#d4be7e"
              strokeDasharray="3 4"
              strokeWidth={1}
              strokeOpacity={0.7}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {scenarioMap && (
        <div className="mt-2 flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-[#6dbf9c]" /> Current plan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-[#a78bfa]" /> With hypotheticals
          </span>
        </div>
      )}

      {/* Compact legend linking each marker line to its meaning */}
      {(dfmMarkers.length > 0 || (showSavings && goalCompletions.length > 0)) && (
        <div className="mt-3 space-y-1.5">
          {dfmMarkers.map((m, i) => (
            <div key={`dfm-cap-${i}`} className="flex items-center gap-2 text-xs">
              <span className="inline-block h-3 w-0 border-l-2 border-dashed border-[#a78bfa]" />
              <span className="text-text-secondary">
                Daily allowance rises to{' '}
                <span className="font-medium text-[#a78bfa]">{formatCurrency(m.rate)}</span>
                {' '}around {formatPinchDate(m.date)}
              </span>
            </div>
          ))}
          {showSavings && goalCompletions.map(c => (
            <div key={`goal-cap-${c.goalId}`} className="flex items-center gap-2 text-xs">
              <span className="inline-block h-3 w-0 border-l-2 border-dashed border-[#d4be7e]" />
              <span className="text-text-secondary">
                <span className="font-medium text-[#d4be7e]">{c.name}</span> funded — frees{' '}
                <span className="font-medium text-success">{formatCurrency(c.ratePerDay)}</span>/day
                {' '}around {formatPinchDate(c.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPinchDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function BalanceTooltip({ active, payload, showSavings }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const { date, balance, rawBalance, savings } = point;
  const [y, m, d] = date.split('-').map(Number);
  const formatted = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const spent = rawBalance - balance;

  return (
    <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-text-secondary">{formatted}</p>
      <p className="text-success">Balance: {formatCurrency(balance)}</p>
      {point.scenario != null && (
        <p className="text-[#a78bfa]">Scenario: {formatCurrency(point.scenario)}</p>
      )}
      {showSavings && savings != null && (
        <p className="text-[#d4be7e]">Savings vault: {formatCurrency(savings)}</p>
      )}
      {spent > 0 && (
        <p className="text-text-muted">Cumulative spending: {formatCurrency(spent)}</p>
      )}
    </div>
  );
}
