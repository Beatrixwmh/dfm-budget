import { useAppState } from '../../store/hooks';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Transaction } from '../../engine/types';

interface Props {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: Props) {
  const { categories } = useAppState();
  const category = categories.find(c => c.id === transaction.categoryId);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-overlay p-3">
      {/* Category dot */}
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: category?.color ?? '#6b7280' }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {transaction.description}
        </p>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{formatDate(transaction.date)}</span>
          {category && (
            <>
              <span>·</span>
              <span>{category.name}</span>
            </>
          )}
          {transaction.source === 'auto' && (
            <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[10px] text-success">
              Auto
            </span>
          )}
        </div>
      </div>

      <p className="shrink-0 text-sm font-semibold text-danger">
        -{formatCurrency(transaction.amount)}
      </p>
    </div>
  );
}
