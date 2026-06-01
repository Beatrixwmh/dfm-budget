import { useState } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { AmountConfirmModal } from './AmountConfirmModal';
import { formatCurrency, formatDate, todayString } from '../../utils/format';
import type { Transaction } from '../../engine/types';
import type { DueExpense } from './DueExpenseRow';

interface Props {
  item: DueExpense;
}

export function FutureExpenseRow({ item }: Props) {
  const dispatch = useAppDispatch();
  const [showPayModal, setShowPayModal] = useState(false);

  const handlePay = (actualAmount: number) => {
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      expenseId: item.expenseId,
      dueDate: item.date,
      date: todayString(),
      amount: actualAmount,
      description: `${item.name} (early)`,
      categoryId: item.categoryId,
      source: 'manual',
    };
    dispatch({ type: 'PAY_EXPENSE', payload: { actualAmount, transaction: tx } });
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-overlay/50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary">{item.name}</p>
          <p className="text-xs text-text-muted">{formatDate(item.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-text-secondary">{formatCurrency(item.amount)}</p>
          <button
            onClick={() => setShowPayModal(true)}
            className="rounded-lg border border-accent/40 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10"
          >
            Pay Early
          </button>
        </div>
      </div>

      <AmountConfirmModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        expenseName={item.name}
        expectedAmount={item.amount}
        onConfirm={handlePay}
      />
    </>
  );
}
