import { useState } from 'react';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { AmountConfirmModal } from './AmountConfirmModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { formatCurrency, formatDate, todayString } from '../../utils/format';
import type { OverdueHold, Transaction, Expense } from '../../engine/types';

interface Props {
  hold: OverdueHold;
}

export function OverdueExpenseRow({ hold }: Props) {
  const dispatch = useAppDispatch();
  const { expenses } = useAppState();
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDismissDialog, setShowDismissDialog] = useState(false);

  const expense = expenses.find((e: Expense) => e.id === hold.expenseId);
  const isVariable = expense?.isVariable ?? false;
  const canDefer = hold.deferCount < 6; // days 0-6 can defer; 7+ forces resolution

  const urgencyClass =
    hold.deferCount >= 7 ? 'border-danger bg-danger-dim' :
    hold.deferCount >= 4 ? 'border-warning bg-warning/10' :
    'border-danger/40 bg-danger-dim/50';

  const handlePay = (actualAmount: number) => {
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      expenseId: hold.expenseId,
      date: todayString(),
      amount: actualAmount,
      description: hold.expenseName,
      categoryId: hold.categoryId,
      source: 'manual',
    };
    dispatch({ type: 'PAY_OVERDUE', payload: { expenseId: hold.expenseId, actualAmount, transaction: tx } });
  };

  const handleDefer = () => {
    dispatch({ type: 'DEFER_OVERDUE_HOLD', payload: hold.expenseId });
  };

  const handleDismiss = () => {
    dispatch({ type: 'DISMISS_OVERDUE', payload: hold.expenseId });
    setShowDismissDialog(false);
  };

  return (
    <>
      <div className={`rounded-xl border p-3 ${urgencyClass}`}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-text-primary">{hold.expenseName}</p>
            <p className="text-xs text-text-muted">
              Due {formatDate(hold.originalDueDate)}
              {hold.deferCount > 0 && (
                <span className="ml-1.5 text-warning">
                  · Deferred {hold.deferCount}×
                </span>
              )}
            </p>
          </div>
          <p className="shrink-0 text-lg font-semibold text-danger">
            {formatCurrency(hold.amount)}
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowPayModal(true)}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent/80"
          >
            Paid
          </button>
          {canDefer ? (
            <button
              onClick={handleDefer}
              className="rounded-lg bg-surface-overlay px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              Defer
            </button>
          ) : (
            <span className="flex items-center rounded-lg bg-danger-dim px-3 py-2 text-xs text-danger">
              Must resolve
            </span>
          )}
          <button
            onClick={() => setShowDismissDialog(true)}
            className="rounded-lg bg-surface-overlay px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary"
          >
            Didn't happen
          </button>
        </div>
      </div>

      <AmountConfirmModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        expenseName={hold.expenseName}
        expectedAmount={hold.amount}
        isVariable={isVariable}
        onConfirm={handlePay}
      />

      <ConfirmDialog
        open={showDismissDialog}
        title="Dismiss Overdue"
        message={`Confirm that "${hold.expenseName}" didn't happen this period. The hold will be released back to your balance.`}
        confirmLabel="Dismiss"
        onConfirm={handleDismiss}
        onCancel={() => setShowDismissDialog(false)}
      />
    </>
  );
}
