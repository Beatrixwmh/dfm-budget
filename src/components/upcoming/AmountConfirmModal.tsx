import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { CurrencyInput } from '../shared/CurrencyInput';
import { formatCurrency } from '../../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  expenseName: string;
  expectedAmount: number;
  isVariable: boolean;
  onConfirm: (actualAmount: number) => void;
}

export function AmountConfirmModal({ open, onClose, expenseName, expectedAmount, isVariable, onConfirm }: Props) {
  const [amount, setAmount] = useState(expectedAmount);

  const handleConfirm = () => {
    if (amount <= 0) return;
    onConfirm(amount);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Pay: ${expenseName}`}>
      <div className="space-y-4">
        {isVariable ? (
          <>
            <p className="text-sm text-text-secondary">
              Expected: {formatCurrency(expectedAmount)}. Enter the actual amount paid:
            </p>
            <CurrencyInput value={amount} onChange={setAmount} label="Amount Paid" autoFocus />
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Confirm payment of {formatCurrency(expectedAmount)} for {expenseName}.
            </p>
            <div className="rounded-lg bg-surface-overlay p-3 text-center">
              <span className="text-2xl font-bold">{formatCurrency(expectedAmount)}</span>
            </div>
            <button
              onClick={() => setAmount(amount === expectedAmount ? 0 : expectedAmount)}
              className="text-xs text-accent hover:underline"
            >
              Adjust amount?
            </button>
            {amount !== expectedAmount && (
              <CurrencyInput value={amount} onChange={setAmount} label="Adjusted Amount" autoFocus />
            )}
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={amount <= 0}
            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-40"
          >
            Mark as Paid
          </button>
        </div>
      </div>
    </Modal>
  );
}
