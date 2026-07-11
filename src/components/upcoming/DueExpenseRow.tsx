import { useState } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { AmountConfirmModal } from './AmountConfirmModal';
import { formatCurrency, todayString } from '../../utils/format';
import type { Transaction } from '../../engine/types';

interface DueExpense {
  expenseId: string;
  name: string;
  amount: number;
  date: string;
  categoryId: string;
  type: 'recurring' | 'subscription' | 'one_time';
}

interface Props {
  item: DueExpense;
  label: string; // "Today" or "Tomorrow"
}

export function DueExpenseRow({ item, label }: Props) {
  const dispatch = useAppDispatch();
  const [showPayModal, setShowPayModal] = useState(false);

  const isSubscription = item.type === 'subscription';

  const handlePay = (actualAmount: number) => {
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      expenseId: item.expenseId,
      dueDate: item.date,
      date: todayString(),
      amount: actualAmount,
      description: item.name,
      categoryId: item.categoryId,
      source: 'manual',
    };
    dispatch({ type: 'PAY_EXPENSE', payload: { actualAmount, transaction: tx } });
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-overlay p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-text-primary">{item.name}</p>
            {isSubscription && (
              <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success">
                Auto-paid
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">{label} · {item.date}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{formatCurrency(item.amount)}</p>
          {!isSubscription && (
            <button
              onClick={() => setShowPayModal(true)}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80"
            >
              Pay
            </button>
          )}
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

export type { DueExpense };
