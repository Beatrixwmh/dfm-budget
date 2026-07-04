import { useState, useMemo } from 'react';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { Modal } from '../shared/Modal';
import { CurrencyInput } from '../shared/CurrencyInput';
import { CategorySelect } from '../shared/CategorySelect';
import { todayString, formatCurrency, formatDate } from '../../utils/format';
import type { Transaction } from '../../engine/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type SpendIntent = 'part_of_goal' | 'withdrawal';

export function QuickAddExpenseModal({ open, onClose }: Props) {
  const { categories, goals, balance } = useAppState();
  const dispatch = useAppDispatch();
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayString());
  const [fromGoalId, setFromGoalId] = useState('');
  const [spendIntent, setSpendIntent] = useState<SpendIntent>('withdrawal');

  const selectedGoal = goals.find(g => g.id === fromGoalId);
  const isTargetGoal = selectedGoal?.type === 'target' && selectedGoal.targetAmount != null;

  // Spendable = total balance minus what's locked in savings vaults.
  const vaultTotal = goals.reduce((sum, g) => sum + g.accumulatedTotal, 0);
  const spendable = balance.currentBalance - vaultTotal;

  // Validation: regular expense can't exceed spendable; from-savings can't exceed that goal's vault.
  const overspendSpendable = !fromGoalId && amount > spendable;
  const overspendGoal = !!fromGoalId && !!selectedGoal && amount > selectedGoal.accumulatedTotal;
  const isInvalid = amount <= 0 || overspendSpendable || overspendGoal;

  // Compute new target date for withdrawal intent
  const newTargetDate = useMemo(() => {
    if (!isTargetGoal || !selectedGoal || amount <= 0) return '';
    const remaining = (selectedGoal.targetAmount ?? 0) - (selectedGoal.accumulatedTotal - amount);
    if (remaining <= 0 || selectedGoal.contributionRatePerDay <= 0) return '';
    const daysNeeded = Math.ceil(remaining / selectedGoal.contributionRatePerDay);
    const d = new Date();
    d.setDate(d.getDate() + daysNeeded);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [selectedGoal, amount, isTargetGoal]);

  const handleGoalChange = (goalId: string) => {
    setFromGoalId(goalId);
    setSpendIntent('withdrawal');
    if (goalId) {
      const goal = goals.find(g => g.id === goalId);
      if (goal && amount === 0) {
        setAmount(goal.accumulatedTotal);
      }
    }
  };

  const handleSave = () => {
    if (isInvalid) return;
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      date,
      amount,
      description: description.trim() || (fromGoalId ? `Spent from ${selectedGoal?.name ?? 'savings'}` : 'Unplanned expense'),
      categoryId,
      source: 'manual',
    };

    if (fromGoalId) {
      dispatch({
        type: 'SPEND_FROM_SAVINGS',
        payload: {
          goalId: fromGoalId,
          amount,
          transaction: tx,
          ...(isTargetGoal && {
            intent: spendIntent,
            newTargetDate: spendIntent === 'withdrawal' ? newTargetDate : undefined,
          }),
        },
      });
    } else {
      dispatch({ type: 'QUICK_ADD_EXPENSE', payload: { amount, transaction: tx } });
    }

    setAmount(0);
    setDescription('');
    setCategoryId('');
    setDate(todayString());
    setFromGoalId('');
    setSpendIntent('withdrawal');
    onClose();
  };

  const goalsWithBalance = goals.filter(g => g.accumulatedTotal > 0);

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

        {goalsWithBalance.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm text-text-secondary">From Savings (optional)</label>
            <select
              value={fromGoalId}
              onChange={e => handleGoalChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
            >
              <option value="">None — from spendable balance ({formatCurrency(spendable)})</option>
              {goalsWithBalance.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({formatCurrency(g.accumulatedTotal)} available)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Overspend validation */}
        {overspendSpendable && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
            <p className="text-sm text-danger">
              That's more than your spendable balance ({formatCurrency(spendable)}).
            </p>
            {vaultTotal > 0 && (
              <p className="mt-0.5 text-xs text-text-muted">
                Your savings ({formatCurrency(vaultTotal)}) is locked — use "From Savings" to spend it.
              </p>
            )}
          </div>
        )}
        {overspendGoal && selectedGoal && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
            <p className="text-sm text-danger">
              {selectedGoal.name} only has {formatCurrency(selectedGoal.accumulatedTotal)} available.
            </p>
          </div>
        )}

        {/* Spend-intent fork for target goals */}
        {isTargetGoal && amount > 0 && (
          <div className="rounded-lg border border-border bg-surface-overlay p-3">
            <p className="mb-2.5 text-sm font-medium text-text-secondary">
              You are spending from savings before the target date:
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 rounded-lg p-2 hover:bg-surface-raised cursor-pointer">
                <input
                  type="radio"
                  name="spendIntent"
                  checked={spendIntent === 'withdrawal'}
                  onChange={() => setSpendIntent('withdrawal')}
                  className="mt-0.5 accent-accent"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">Keep the target amount</span>
                  {newTargetDate && (
                    <p className="text-xs text-text-muted">
                      Target date moves to {formatDate(newTargetDate)}
                    </p>
                  )}
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-lg p-2 hover:bg-surface-raised cursor-pointer">
                <input
                  type="radio"
                  name="spendIntent"
                  checked={spendIntent === 'part_of_goal'}
                  onChange={() => setSpendIntent('part_of_goal')}
                  className="mt-0.5 accent-accent"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    Lower the target to {formatCurrency(Math.max(0, (selectedGoal?.targetAmount ?? 0) - amount))}
                  </span>
                  <p className="text-xs text-text-muted">
                    This spend is part of what the goal was for
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            label="Category (optional)"
            allowAdd
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
          disabled={isInvalid}
          className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {fromGoalId ? 'Spend from Savings' : 'Log Expense'}
        </button>
      </div>
    </Modal>
  );
}
