import { useState, useEffect } from 'react';
import type { Expense, ExpenseType, ExpenseTier, Schedule } from '../../engine/types';
import { TIER_LABELS } from '../../engine/types';
import { useAppState } from '../../store/hooks';
import { Modal } from '../shared/Modal';
import { CurrencyInput } from '../shared/CurrencyInput';
import { CategorySelect } from '../shared/CategorySelect';
import { ScheduleForm } from '../schedule/ScheduleForm';
import { generateId } from '../../utils/id';
import { todayString } from '../../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  initial?: Expense;
}

const EXPENSE_TYPES: { value: ExpenseType; label: string; desc: string }[] = [
  { value: 'recurring', label: 'Recurring', desc: 'Manual confirmation on due date' },
  { value: 'subscription', label: 'Subscription', desc: 'Auto-charged, logged automatically' },
  { value: 'one_time', label: 'One-time', desc: 'Single payment on a specific date' },
  { value: 'savings_goal', label: 'Savings Goal', desc: 'Save toward a target amount' },
];

const TIER_OPTIONS: { value: ExpenseTier; label: string }[] = [
  { value: 0, label: "T0 · Can't Cut" },
  { value: 1, label: 'T1 · Must Pay' },
  { value: 2, label: 'T2 · Important' },
  { value: 3, label: 'T3 · Nice to Have' },
];

const CATEGORY_TIER_SUGGESTIONS: Record<string, ExpenseTier> = {
  housing: 0,
  rent: 0,
  mortgage: 0,
  loans: 0,
  loan: 0,
  utilities: 1,
  insurance: 1,
  phone: 1,
  groceries: 1,
  transport: 2,
  savings: 2,
  investment: 2,
  subscriptions: 3,
  entertainment: 3,
  hobby: 3,
};

function suggestTier(categoryName: string): ExpenseTier {
  const lower = categoryName.toLowerCase();
  for (const [key, tier] of Object.entries(CATEGORY_TIER_SUGGESTIONS)) {
    if (lower.includes(key)) return tier;
  }
  return 2; // Default: Important
}

const DEFAULT_SCHEDULE: Schedule = {
  frequency: 'monthly',
  dayOfMonth: 1,
  dayOfWeek: null,
  startDate: todayString(),
  endDate: null,
  weekendRule: 'as_is',
  holidayRule: 'as_is',
};

export function ExpenseForm({ open, onClose, onSave, initial }: Props) {
  const { categories } = useAppState();
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [type, setType] = useState<ExpenseType>(initial?.type ?? 'recurring');
  const [isVariable, setIsVariable] = useState(initial?.isVariable ?? false);
  const [schedule, setSchedule] = useState<Schedule>(initial?.schedule ?? DEFAULT_SCHEDULE);
  const [tier, setTier] = useState<ExpenseTier>(initial?.tier ?? 2);
  const [targetAmount, setTargetAmount] = useState(initial?.targetAmount ?? 0);
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [savingsMode, setSavingsMode] = useState<'target_date' | 'fixed_contribution'>(
    initial?.savingsMode ?? 'fixed_contribution'
  );

  const isSavingsGoal = type === 'savings_goal';

  // Auto-suggest tier when category changes (only for new expenses)
  useEffect(() => {
    if (initial) return; // Don't override on edit
    const cat = categories.find(c => c.id === categoryId);
    if (cat) setTier(suggestTier(cat.name));
  }, [categoryId, categories, initial]);

  const isTargetDateMode = isSavingsGoal && savingsMode === 'target_date';

  const handleSave = () => {
    if (!name.trim()) return;
    if (!isTargetDateMode && amount <= 0) return;
    const expense: Expense = {
      id: initial?.id ?? generateId(),
      name: name.trim(),
      amount,
      categoryId,
      type,
      isVariable,
      schedule: type === 'one_time' ? { ...schedule, endDate: schedule.startDate } : schedule,
      tier,
      isAutoCut: initial?.isAutoCut ?? false,
    };
    if (type === 'savings_goal') {
      expense.targetAmount = targetAmount;
      expense.currentSaved = initial?.currentSaved ?? 0;
      expense.savingsMode = savingsMode;
      if (savingsMode === 'target_date' && targetDate) {
        expense.targetDate = targetDate;
      }
    }
    onSave(expense);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Expense' : 'New Expense'}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Rent, Spotify, Car Insurance"
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        {!isSavingsGoal && (
          <CurrencyInput value={amount} onChange={setAmount} label="Amount (per occurrence)" />
        )}

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Type</label>
          <div className="grid grid-cols-2 gap-1.5">
            {EXPENSE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  type === t.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
                }`}
              >
                <span className="font-medium">{t.label}</span>
                <span className={`block text-xs ${type === t.value ? 'text-white/70' : 'text-text-muted'}`}>
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {isSavingsGoal && (
          <div className="rounded-lg border border-border bg-surface-overlay p-3">
            <label className="mb-2 block text-sm font-medium text-text-secondary">Savings Goal</label>
            <div className="flex flex-col gap-3">
              <CurrencyInput value={targetAmount} onChange={setTargetAmount} label="Target amount" />
              <div>
                <label className="mb-1.5 block text-sm text-text-secondary">Mode</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSavingsMode('fixed_contribution')}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${
                      savingsMode === 'fixed_contribution'
                        ? 'bg-accent text-white'
                        : 'bg-surface-raised text-text-secondary'
                    }`}
                  >
                    Fixed contribution
                  </button>
                  <button
                    type="button"
                    onClick={() => setSavingsMode('target_date')}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${
                      savingsMode === 'target_date'
                        ? 'bg-accent text-white'
                        : 'bg-surface-raised text-text-secondary'
                    }`}
                  >
                    By target date
                  </button>
                </div>
              </div>
              {savingsMode === 'fixed_contribution' && (
                <CurrencyInput value={amount} onChange={setAmount} label="Contribution (per occurrence)" />
              )}
              {savingsMode === 'target_date' && (
                <div>
                  <label className="mb-1.5 block text-sm text-text-secondary">Target date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Priority Tier</label>
          <select
            value={tier}
            onChange={e => setTier(Number(e.target.value) as ExpenseTier)}
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
          >
            {TIER_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-text-muted">
            {tier === 0 && 'Never cut, even in deficit mode'}
            {tier === 1 && 'Essential — only cut as last resort'}
            {tier === 2 && 'Important but cuttable if needed'}
            {tier === 3 && 'First to be cut in deficit mode'}
          </p>
        </div>

        {!isSavingsGoal && (
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={isVariable}
              onChange={e => setIsVariable(e.target.checked)}
              className="h-4 w-4 rounded accent-accent"
            />
            Amount varies (this is an estimate)
          </label>
        )}

        <div className="border-t border-border pt-4">
          <h4 className="mb-3 text-sm font-medium text-text-secondary">
            {type === 'one_time' ? 'Date' : 'Schedule'}
          </h4>
          {type === 'one_time' ? (
            <div>
              <input
                type="date"
                value={schedule.startDate}
                onChange={e => setSchedule({ ...schedule, startDate: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
              />
            </div>
          ) : (
            <ScheduleForm value={schedule} onChange={setSchedule} />
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || (!isTargetDateMode && amount <= 0)}
          className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {initial ? 'Save Changes' : 'Add Expense'}
        </button>
      </div>
    </Modal>
  );
}

