import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAppState } from '../../store/hooks';
import { TimescaleSelector } from '../charts/TimescaleSelector';
import { CategorySelect } from '../shared/CategorySelect';
import { formatCurrency } from '../../utils/format';
import type { Timescale } from '../charts/chartHelpers';
import type { Transaction, Category } from '../../engine/types';

const TIMESCALE_DAYS: Record<Timescale, number> = {
  '7d': 7, '30d': 30, '90d': 90, '6mo': 182, '1yr': 365, '2yr': 730,
};

interface Bucket {
  label: string;
  [categoryId: string]: number | string;
}

function getBucketKey(date: string, timescale: Timescale): string {
  const [y, m, day] = date.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  if (timescale === '7d' || timescale === '30d') {
    return date.slice(5); // MM-DD
  } else if (timescale === '90d' || timescale === '6mo') {
    // Week bucket: ISO week start (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${m}-${dd}`;
  } else {
    // Monthly
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  }
}

export function CategorySpendingChart() {
  const { transactions, categories } = useAppState();
  const [timescale, setTimescale] = useState<Timescale>('30d');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data, usedCategories } = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TIMESCALE_DAYS[timescale]);
    const cutoffKey = cutoffDate.toISOString().slice(0, 10);

    const filtered = transactions.filter((t: Transaction) => {
      if (t.date < cutoffKey) return false;
      if (categoryFilter && t.categoryId !== categoryFilter) return false;
      return true;
    });

    const bucketMap = new Map<string, Record<string, number>>();
    const catSet = new Set<string>();

    for (const tx of filtered) {
      const key = getBucketKey(tx.date, timescale);
      const bucket = bucketMap.get(key) ?? {};
      const catId = tx.categoryId || '__uncategorized__';
      bucket[catId] = (bucket[catId] ?? 0) + tx.amount;
      bucketMap.set(key, bucket);
      catSet.add(catId);
    }

    const sortedKeys = [...bucketMap.keys()].sort();
    const buckets: Bucket[] = sortedKeys.map(key => ({
      label: key,
      ...bucketMap.get(key)!,
    }));

    const usedCats = categories.filter((c: Category) => catSet.has(c.id));
    if (catSet.has('__uncategorized__')) {
      usedCats.push({ id: '__uncategorized__', name: 'Uncategorized', color: '#6b7280', sortOrder: 999 });
    }

    return { data: buckets, usedCategories: usedCats };
  }, [transactions, categories, timescale, categoryFilter]);

  const hasData = data.length > 0;

  return (
    <div className="rounded-xl bg-surface-raised p-4">
      <h4 className="mb-3 text-sm font-medium text-text-secondary">Spending by Category</h4>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TimescaleSelector value={timescale} onChange={setTimescale} />
        {categories.length > 0 && (
          <div className="w-40">
            <CategorySelect categories={categories} value={categoryFilter} onChange={setCategoryFilter} label="" />
          </div>
        )}
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e3345" strokeOpacity={0.5} />
            <XAxis dataKey="label" stroke="#5b6178" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis
              stroke="#5b6178"
              tick={{ fontSize: 11 }}
              width={52}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e2233', border: '1px solid #2e3345', borderRadius: 8 }}
              labelStyle={{ color: '#8b90a5' }}
              formatter={(value: number, name: string) => {
                const cat = usedCategories.find(c => c.id === name);
                return [formatCurrency(value), cat?.name ?? 'Uncategorized'];
              }}
            />
            {usedCategories.map(cat => (
              <Bar key={cat.id} dataKey={cat.id} stackId="spending" fill={cat.color} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-12 text-center text-sm text-text-muted">No spending data for this period</p>
      )}
    </div>
  );
}
