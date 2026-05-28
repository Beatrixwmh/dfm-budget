import { useState, useMemo } from 'react';
import { useAppState } from '../../store/hooks';
import { TransactionRow } from './TransactionRow';
import { CategorySelect } from '../shared/CategorySelect';
import { EmptyState } from '../shared/EmptyState';
import type { Transaction } from '../../engine/types';

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6mo', days: 182 },
  { label: '1yr', days: 365 },
  { label: '2yr', days: 730 },
] as const;

const TYPE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Planned', value: 'planned' },
  { label: 'Unplanned', value: 'unplanned' },
] as const;

export function TransactionList() {
  const { transactions, categories } = useAppState();
  const [dateRange, setDateRange] = useState(30);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'planned' | 'unplanned'>('all');

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dateRange);
    const cutoffKey = cutoff.toISOString().slice(0, 10);

    return transactions
      .filter((t: Transaction) => {
        if (t.date < cutoffKey) return false;
        if (categoryFilter && t.categoryId !== categoryFilter) return false;
        if (typeFilter === 'planned' && !t.expenseId) return false;
        if (typeFilter === 'unplanned' && t.expenseId) return false;
        return true;
      })
      .sort((a: Transaction, b: Transaction) => b.date.localeCompare(a.date));
  }, [transactions, dateRange, categoryFilter, typeFilter]);

  return (
    <div className="space-y-4">
      {/* Date range selector */}
      <div className="flex rounded-lg bg-surface-overlay p-0.5">
        {DATE_RANGES.map(r => (
          <button
            key={r.days}
            onClick={() => setDateRange(r.days)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              dateRange === r.days
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex gap-3">
        <div className="flex-1">
          {categories.length > 0 && (
            <CategorySelect
              categories={categories}
              value={categoryFilter}
              onChange={setCategoryFilter}
              label=""
            />
          )}
        </div>
        <div className="flex items-end rounded-lg bg-surface-overlay p-0.5">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value as typeof typeFilter)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <EmptyState icon="📊" title="No transactions" description="Transactions will appear here as you log expenses." />
      ) : (
        <div className="space-y-2">
          {filtered.map((tx: Transaction) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </div>
      )}
    </div>
  );
}
