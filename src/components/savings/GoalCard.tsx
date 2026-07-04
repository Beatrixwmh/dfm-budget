import { useState, useMemo } from 'react';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { CurrencyInput } from '../shared/CurrencyInput';
import { Modal } from '../shared/Modal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Goal } from '../../engine/types';

interface Props {
  goal: Goal;
  onEdit: () => void;
  frozen?: boolean;
}

const CADENCE_MULTIPLIERS: Record<string, number> = {
  weekly: 7, biweekly: 14, monthly: 30.44,
};

export function GoalCard({ goal, onEdit, frozen = false }: Props) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [autoUnpauseDate, setAutoUnpauseDate] = useState('');

  const isTarget = goal.type === 'target';
  const isPaused = goal.status === 'paused';
  const pct = isTarget && goal.targetAmount
    ? Math.min(100, (goal.accumulatedTotal / goal.targetAmount) * 100)
    : 0;
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference - (circumference * Math.min(pct, 100)) / 100;
  const perCadence = goal.contributionRatePerDay * CADENCE_MULTIPLIERS[goal.cadence];

  // Calculate projected target date if user picks an auto-unpause date
  const projectedDateAfterPause = useMemo(() => {
    if (!isTarget || !autoUnpauseDate || !goal.targetAmount || goal.contributionRatePerDay <= 0) return '';
    const remaining = goal.targetAmount - goal.accumulatedTotal;
    if (remaining <= 0) return '';
    const daysNeeded = Math.ceil(remaining / goal.contributionRatePerDay);
    const [y, m, d] = autoUnpauseDate.split('-').map(Number);
    const resumeDate = new Date(y, m - 1, d);
    resumeDate.setDate(resumeDate.getDate() + daysNeeded);
    return `${resumeDate.getFullYear()}-${String(resumeDate.getMonth() + 1).padStart(2, '0')}-${String(resumeDate.getDate()).padStart(2, '0')}`;
  }, [isTarget, autoUnpauseDate, goal]);

  const handlePause = () => {
    dispatch({
      type: 'UPDATE_GOAL',
      payload: {
        ...goal,
        status: 'paused',
        autoUnpauseDate: autoUnpauseDate || undefined,
      },
    });
    setAutoUnpauseDate('');
    setShowPause(false);
  };

  const handleResume = () => {
    dispatch({
      type: 'UPDATE_GOAL',
      payload: { ...goal, status: 'active', autoUnpauseDate: undefined },
    });
  };

  // Spendable = total balance minus everything already vaulted. A deposit just
  // moves spendable -> vault, so it can't exceed spendable.
  const vaultTotal = state.goals.reduce((sum, g) => sum + g.accumulatedTotal, 0);
  const spendable = state.balance.currentBalance - vaultTotal;
  const depositOverspends = depositAmount > spendable;

  const handleDeposit = () => {
    if (depositAmount <= 0 || depositOverspends) return;
    dispatch({ type: 'DEPOSIT_TO_GOAL', payload: { goalId: goal.id, amount: depositAmount } });
    setDepositAmount(0);
    setShowDeposit(false);
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_GOAL', payload: goal.id });
    setShowDelete(false);
  };

  return (
    <div className={`rounded-xl bg-surface-raised p-4 ${isPaused ? 'opacity-50' : frozen ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-4">
        {isTarget && goal.targetAmount ? (
          <div className="relative shrink-0">
            <svg width="80" height="80" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="36" fill="none" stroke="#2e3345" strokeWidth="6" />
              <circle
                cx="44" cy="44" r="36"
                fill="none"
                stroke={pct >= 100 ? '#6dbf9c' : '#7d9fd4'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 44 44)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {Math.round(pct)}%
            </span>
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-overlay">
            <span className="text-lg font-bold text-accent">{formatCurrency(goal.accumulatedTotal)}</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{goal.name}</h4>
            {isPaused && (
              <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-xs text-text-muted">Paused</span>
            )}
            {!isPaused && frozen && (
              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">❄ Frozen</span>
            )}
          </div>

          {isTarget && goal.targetAmount ? (
            <p className="mt-0.5 text-sm text-text-secondary">
              {formatCurrency(goal.accumulatedTotal)} / {formatCurrency(goal.targetAmount)}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-text-secondary">Saved so far</p>
          )}

          {!isPaused && frozen && (
            <p className="mt-0.5 text-xs text-warning">
              No room to contribute — paused until you have surplus
            </p>
          )}

          {!isPaused && !frozen && (
            <p className="mt-0.5 text-xs text-text-muted">
              {formatCurrency(perCadence)}/{goal.cadence}
              {isTarget && goal.targetDate && (
                <> &middot; Target: {formatDate(goal.targetDate)}</>
              )}
            </p>
          )}

          {isPaused && goal.autoUnpauseDate && (
            <p className="mt-0.5 text-xs text-text-muted">
              Auto-resumes {formatDate(goal.autoUnpauseDate)}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setShowDeposit(true)}
              className="rounded-md bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/25"
            >
              + Add Deposit
            </button>
            {isPaused ? (
              <button
                onClick={handleResume}
                className="rounded-md bg-success/15 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/25"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={() => setShowPause(true)}
                className="rounded-md bg-surface-overlay px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                Pause
              </button>
            )}
            <button
              onClick={onEdit}
              className="rounded-md bg-surface-overlay px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="rounded-md bg-surface-overlay px-2.5 py-1 text-xs font-medium text-text-muted hover:text-danger"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Pause modal with optional auto-unpause date */}
      <Modal open={showPause} onClose={() => setShowPause(false)} title={`Pause "${goal.name}"`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Contributions will stop. The saved amount ({formatCurrency(goal.accumulatedTotal)}) stays.
          </p>
          <div>
            <label className="mb-1.5 block text-sm text-text-secondary">Auto-resume date (optional)</label>
            <input
              type="date"
              value={autoUnpauseDate}
              onChange={e => setAutoUnpauseDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
            />
            <p className="mt-1 text-xs text-text-muted">
              Leave empty for an open-ended pause. You can always resume manually.
            </p>
          </div>
          {autoUnpauseDate && projectedDateAfterPause && isTarget && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
              <p className="text-sm text-text-secondary">
                If you resume on {formatDate(autoUnpauseDate)}, your new target date would be approximately{' '}
                <strong>{formatDate(projectedDateAfterPause)}</strong>
              </p>
            </div>
          )}
          <button
            onClick={handlePause}
            className="rounded-lg bg-surface-overlay py-2.5 text-sm font-medium text-text-primary hover:bg-surface-raised"
          >
            Pause Goal
          </button>
        </div>
      </Modal>

      {/* Deposit modal */}
      <Modal open={showDeposit} onClose={() => setShowDeposit(false)} title="Add to Savings">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">Add a one-off deposit to "{goal.name}"</p>
          <CurrencyInput value={depositAmount} onChange={setDepositAmount} label="Amount" autoFocus />
          <p className="text-xs text-text-muted">Spendable available: {formatCurrency(spendable)}</p>
          {depositOverspends && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
              <p className="text-sm text-danger">
                That's more than your spendable balance ({formatCurrency(spendable)}).
              </p>
            </div>
          )}
          <button
            onClick={handleDeposit}
            disabled={depositAmount <= 0 || depositOverspends}
            className="rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Add Deposit
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        title="Delete Goal"
        message={`Delete "${goal.name}"? The accumulated savings (${formatCurrency(goal.accumulatedTotal)}) will return to your spendable balance.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
