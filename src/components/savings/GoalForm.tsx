import { useState, useMemo } from 'react';
import { useDfmEngine } from '../../hooks/useDfmEngine';
import { useAppState } from '../../store/hooks';
import { useNavigate } from '../../store/NavContext';
import { generateCashEvents } from '../../engine/eventGenerator';
import { computeEffectiveBalance } from '../../engine/effectiveBalance';
import { Modal } from '../shared/Modal';
import { CurrencyInput } from '../shared/CurrencyInput';
import { calculateFastestDate, validateContribution, fastestDateFromDays, findFirstSavableDate } from '../../engine/savings';
import { formatCurrency, formatDate } from '../../utils/format';
import { generateId } from '../../utils/id';
import type { Goal } from '../../engine/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  initial?: Goal;
}

type GoalType = 'target' | 'continuous';
type Cadence = 'weekly' | 'biweekly' | 'monthly';

const CADENCE_MULTIPLIERS: Record<Cadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30.44,
};

export function GoalForm({ open, onClose, onSave, initial }: Props) {
  const engine = useDfmEngine();
  const state = useAppState();
  const navigate = useNavigate();

  const [name, setName] = useState(initial?.name ?? '');
  const [goalType, setGoalType] = useState<GoalType>(initial?.type ?? 'target');
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? 'monthly');
  const [targetAmount, setTargetAmount] = useState(initial?.targetAmount ?? 0);
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [contributionPerCadence, setContributionPerCadence] = useState(0);
  const [useFastest, setUseFastest] = useState(true);

  // Use rawDfm (buffer-constrained, no sustainable cap) as savings ceiling
  const rawDfm = engine?.dfm.rawDfm ?? 0;

  // Fastest date calculation
  const fastest = useMemo(() => {
    if (rawDfm <= 0 || goalType !== 'target' || targetAmount <= 0) return null;
    return calculateFastestDate(rawDfm, targetAmount);
  }, [rawDfm, goalType, targetAmount]);

  const fastestDateStr = useMemo(() => {
    if (!fastest) return '';
    return fastestDateFromDays(new Date(), fastest.daysToReach);
  }, [fastest]);

  // Compute contribution when user picks a later date
  const computedRate = useMemo(() => {
    if (goalType !== 'target' || !targetDate || targetAmount <= 0) return null;
    const today = new Date();
    const [y, m, d] = targetDate.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const days = Math.max(1, Math.round((target.getTime() - today.getTime()) / 86400000));
    return targetAmount / days;
  }, [goalType, targetDate, targetAmount]);

  // Validation for continuous type — rate must fit within rawDfm
  const validation = useMemo(() => {
    if (rawDfm <= 0 || goalType !== 'continuous' || contributionPerCadence <= 0) return null;
    const ratePerDay = contributionPerCadence / CADENCE_MULTIPLIERS[cadence];
    return validateContribution(rawDfm, ratePerDay);
  }, [rawDfm, goalType, contributionPerCadence, cadence]);

  const canSave = rawDfm > 0;

  // If can't save now, find the first future date with surplus (auto-start candidate).
  const savableDate = useMemo(() => {
    if (canSave) return null;
    const vaultTotal = state.goals.reduce((sum, g) => sum + g.accumulatedTotal, 0);
    const effective = computeEffectiveBalance(state.balance.currentBalance, state.overdueHolds);
    const spendable = effective - vaultTotal;
    const events = generateCashEvents(state.incomeSources, state.expenses, new Date(), state.customHolidays);
    return findFirstSavableDate(spendable, state.buffer, events, new Date());
  }, [canSave, state]);

  // Auto-start: create the goal paused, set to wake on the first savable date.
  const handleAutoStart = () => {
    if (!name.trim() || !savableDate) return;
    let ratePerDay = 0;
    if (goalType === 'target') {
      if (targetAmount <= 0) return;
      // Save at the surplus available on that future date
      const days = Math.max(1, Math.ceil(targetAmount / savableDate.maxRate));
      ratePerDay = targetAmount / days;
    } else {
      if (contributionPerCadence <= 0) return;
      ratePerDay = Math.min(
        contributionPerCadence / CADENCE_MULTIPLIERS[cadence],
        savableDate.maxRate
      );
    }
    const goal: Goal = {
      id: generateId(),
      name: name.trim(),
      type: goalType,
      status: 'paused',
      contributionRatePerDay: ratePerDay,
      cadence,
      autoUnpauseDate: savableDate.date,
      ...(goalType === 'target' && { targetAmount }),
      accumulatedTotal: 0,
    };
    onSave(goal);
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) return;
    let ratePerDay = 0;

    if (goalType === 'target') {
      if (targetAmount <= 0) return;
      ratePerDay = useFastest
        ? (fastest?.maxRatePerDay ?? 0)
        : (computedRate ?? 0);
    } else {
      if (contributionPerCadence <= 0) return;
      ratePerDay = contributionPerCadence / CADENCE_MULTIPLIERS[cadence];
    }

    const goal: Goal = {
      id: initial?.id ?? generateId(),
      name: name.trim(),
      type: goalType,
      status: 'active',
      contributionRatePerDay: ratePerDay,
      cadence,
      ...(goalType === 'target' && {
        targetAmount,
        targetDate: useFastest ? fastestDateStr : targetDate,
      }),
      accumulatedTotal: initial?.accumulatedTotal ?? 0,
    };
    onSave(goal);
    onClose();
  };

  const displayRate = goalType === 'target'
    ? (useFastest ? fastest?.maxRatePerDay : computedRate) ?? 0
    : contributionPerCadence / CADENCE_MULTIPLIERS[cadence];
  const displayPerCadence = displayRate * CADENCE_MULTIPLIERS[cadence];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Goal' : 'New Savings Goal'}
      footer={
        !canSave && savableDate ? (
          <button
            onClick={handleAutoStart}
            disabled={
              !name.trim() ||
              (goalType === 'target' && targetAmount <= 0) ||
              (goalType === 'continuous' && contributionPerCadence <= 0)
            }
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Auto-start on {formatDate(savableDate.date)}
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={
              !name.trim() || !canSave ||
              (goalType === 'target' && (targetAmount <= 0 || !fastest)) ||
              (goalType === 'continuous' && (contributionPerCadence <= 0 || (validation && !validation.feasible)))
            }
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {initial ? 'Save Changes' : 'Create Goal'}
          </button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Goal Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Emergency Fund, Trip, New Laptop"
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        {!canSave && savableDate && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-sm text-warning">
              You don't have room to save right now.
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              Based on your plan, you'll have surplus starting {formatDate(savableDate.date)}.
              Set up the goal now and it'll auto-start then.
            </p>
          </div>
        )}

        {!canSave && !savableDate && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
            <p className="text-sm text-danger">
              Your budget has no room for savings in the next 2 years.
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              Try adjusting income or expenses in the Simulator to find room.
            </p>
            <button
              type="button"
              onClick={() => { onClose(); navigate('simulator'); }}
              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
            >
              Open Simulator →
            </button>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Type</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setGoalType('target')}
              className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                goalType === 'target' ? 'bg-accent text-white' : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="font-medium">Target Amount</span>
              <span className={`block text-xs ${goalType === 'target' ? 'text-white/70' : 'text-text-muted'}`}>
                Save toward a specific goal
              </span>
            </button>
            <button
              type="button"
              onClick={() => setGoalType('continuous')}
              className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                goalType === 'continuous' ? 'bg-accent text-white' : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="font-medium">Continuous</span>
              <span className={`block text-xs ${goalType === 'continuous' ? 'text-white/70' : 'text-text-muted'}`}>
                Open-ended saving
              </span>
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Contribution Cadence</label>
          <div className="flex rounded-lg bg-surface-overlay p-0.5">
            {(['weekly', 'biweekly', 'monthly'] as Cadence[]).map(c => (
              <button
                key={c}
                onClick={() => setCadence(c)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
                  cadence === c ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {goalType === 'target' && (
          <>
            <CurrencyInput value={targetAmount} onChange={setTargetAmount} label="Target Amount" />

            {fastest && targetAmount > 0 && canSave && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <p className="text-sm text-success">
                  Fastest reachable: <strong>{formatDate(fastestDateStr)}</strong>
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  At max contribution: {formatCurrency(fastest.maxRatePerDay * CADENCE_MULTIPLIERS[cadence])}/{cadence}
                </p>
              </div>
            )}

            {!fastest && targetAmount > 0 && canSave && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                <p className="text-sm text-danger">Not achievable within 2 years at current finances.</p>
              </div>
            )}

            {fastest && targetAmount > 0 && canSave && (
              <div>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={useFastest}
                    onChange={e => setUseFastest(e.target.checked)}
                    className="h-4 w-4 rounded accent-accent"
                  />
                  Use fastest date
                </label>
                {!useFastest && (
                  <div className="mt-2">
                    <label className="mb-1.5 block text-sm text-text-secondary">Target Date</label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={e => setTargetDate(e.target.value)}
                      min={fastestDateStr}
                      className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
                    />
                    {computedRate !== null && targetDate && (
                      <p className="mt-1 text-xs text-text-muted">
                        Contribution: {formatCurrency(computedRate * CADENCE_MULTIPLIERS[cadence])}/{cadence}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {goalType === 'continuous' && (
          <>
            <CurrencyInput
              value={contributionPerCadence}
              onChange={setContributionPerCadence}
              label={`Contribution per ${cadence} period`}
            />
            {validation && !validation.feasible && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                <p className="text-sm text-danger">
                  This exceeds your daily free money.
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Max sustainable: {formatCurrency(validation.maxRate * CADENCE_MULTIPLIERS[cadence])}/{cadence}
                </p>
              </div>
            )}
          </>
        )}

      </div>
    </Modal>
  );
}
