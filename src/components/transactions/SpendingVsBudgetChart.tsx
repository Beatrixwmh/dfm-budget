import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { useAppState } from '../../store/hooks';
import { TimescaleSelector } from '../charts/TimescaleSelector';
import { CategorySelect } from '../shared/CategorySelect';
import { formatCurrency } from '../../utils/format';
import type { Timescale } from '../charts/chartHelpers';
import type { Transaction, Expense, Category } from '../../engine/types';

const TIMESCALE_DAYS: Record<Timescale, number> = {
  '7d': 7, '30d': 30, '90d': 90, '6mo': 182, '1yr': 365, '2yr': 730,
};

// Convert any schedule frequency to a monthly equivalent multiplier
function monthlyMultiplier(freq: string): number {
  switch (freq) {
    case 'weekly': return 52 / 12;
    case 'biweekly': return 26 / 12;
    case 'semimonthly': return 2;
    case 'monthly': return 1;
    case 'quarterly': return 1 / 3;
    case 'annual': return 1 / 12;
    default: return 1;
  }
}

interface BudgetVsActual {
  name: string;
  color: string;
  budgeted: number;
  actual: number;
  over: boolean;
}

export function SpendingVsBudgetChart() {
  const { transactions, expenses, categories } = useAppState();
  const [timescale, setTimescale] = useState<Timescale>('30d');
  const [categoryFilter, setCategoryFilter] = useState('');

  const data = useMemo(() => {
    const days = TIMESCALE_DAYS[timescale];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffKey = cutoffDate.toISOString().slice(0, 10);
    const months = days / 30;

    // Compute budgeted amount per category (scaled to the selected time range)
    const budgetByCat = new Map<string, number>();
    for (const exp of expenses) {
      if (!exp.schedule) continue;
      if (categoryFilter && exp.categoryId !== categoryFilter) continue;
      const catId = exp.categoryId || '__uncategorized__';
      const monthlyAmount = exp.amount * monthlyMultiplier(exp.schedule.frequency);
      const scaled = monthlyAmount * months;
      budgetByCat.set(catId, (budgetByCat.get(catId) ?? 0) + scaled);
    }

    // Compute actual spending per category
    const actualByCat = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.date < cutoffKey) continue;
      if (categoryFilter && tx.categoryId !== categoryFilter) continue;
      const catId = tx.categoryId || '__uncategorized__';
      actualByCat.set(catId, (actualByCat.get(catId) ?? 0) + tx.amount);
    }

    // Merge all categories
    const allCatIds = new Set([...budgetByCat.keys(), ...actualByCat.keys()]);
    const catMap = new Map(categories.map((c: Category) => [c.id, c]));

    const result: BudgetVsActual[] = [];
    for (const catId of allCatIds) {
      const cat = catMap.get(catId);
      const budgeted = Math.round((budgetByCat.get(catId) ?? 0) * 100) / 100;
      const actual = Math.round((actualByCat.get(catId) ?? 0) * 100) / 100;
      result.push({
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? '#6b7280',
        budgeted,
        actual,
        over: actual > budgeted && budgeted > 0,
      });
    }

    return result.sort((a, b) => b.actual - a.actual);
  }, [transactions, expenses, categories, timescale, categoryFilter]);

  const hasData = data.length > 0;

  return (
    <div className="rounded-xl bg-surface-raised p-4">
      <h4 className="mb-3 text-sm font-medium text-text-secondary">Budget vs Actual</h4>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TimescaleSelector value={timescale} onChange={setTimescale} />
        {categories.length > 0 && (
          <div className="w-40">
            <CategorySelect categories={categories} value={categoryFilter} onChange={setCategoryFilter} label="" />
          </div>
        )}
      </div>

      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={Math.max(180, data.length * 48)}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, bottom: 0, left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" strokeOpacity={0.5} horizontal={false} />
              <XAxis
                type="number"
                stroke="#5b6178"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#5b6178"
                tick={{ fontSize: 11 }}
                width={80}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e2233', border: '1px solid #2e3345', borderRadius: 8 }}
                labelStyle={{ color: '#8b90a5' }}
                formatter={(value: number, name: string) => [formatCurrency(value), name === 'budgeted' ? 'Budgeted' : 'Actual']}
              />
              <Bar dataKey="budgeted" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} name="budgeted" />
              <Bar dataKey="actual" radius={[0, 4, 4, 0]} barSize={14} name="actual">
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.over ? '#ef4444' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3b82f6]" /> Budgeted
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#22c55e]" /> Actual
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#ef4444]" /> Over budget
            </span>
          </div>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-text-muted">No budget or spending data for this period</p>
      )}
    </div>
  );
}
