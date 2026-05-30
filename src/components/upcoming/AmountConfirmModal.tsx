import { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { CurrencyInput } from '../shared/CurrencyInput';

interface Props {
  open: boolean;
  onClose: () => void;
  expenseName: string;
  expectedAmount: number;
  onConfirm: (actualAmount: number) => void;
}

export function AmountConfirmModal({ open, onClose, expenseName, expectedAmount, onConfirm }: Props) {
  const [amount, setAmount] = useState(expectedAmount);

  // Reset amount when modal opens
  useEffect(() => {
    if (open) setAmount(expectedAmount);
  }, [open, expectedAmount]);

  const handleConfirm = () => {
    if (amount <= 0) return;
    onConfirm(amount);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Pay: ${expenseName}`}>
      <div className="space-y-4">
        <CurrencyInput value={amount} onChange={setAmount} label="Amount" autoFocus />

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
