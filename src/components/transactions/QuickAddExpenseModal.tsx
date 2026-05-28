import { useState } from 'react';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { Modal } from '../shared/Modal';
import { CurrencyInput } from '../shared/CurrencyInput';
import { CategorySelect } from '../shared/CategorySelect';
import { todayString } from '../../utils/format';
import type { Transaction } from '../../engine/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QuickAddExpenseModal({ open, onClose }: Props) {
  const { categories } = useAppState();
  const dispatch = useAppDispatch();
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayString());

  const handleSave = () => {
    if (amount <= 0) return;
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      date,
      amount,
      description: description.trim() || 'Unplanned expense',
      categoryId,
      source: 'manual',
    };
    dispatch({ type: 'QUICK_ADD_EXPENSE', payload: { amount, transaction: tx } });
    // Reset form
    setAmount(0);
    setDescription('');
    setCategoryId('');
    setDate(todayString());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Expense">
      <div className="flex flex-col gap-4">
        <CurrencyInput value={amount} onChange={setAmount} label="Amount" autoFocus />

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g., Lunch, Coffee, Uber"
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        {categories.length > 0 && (
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            label="Category (optional)"
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={todayString()}
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={amount <= 0}
          className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          Log Expense
        </button>
      </div>
    </Modal>
  );
}
