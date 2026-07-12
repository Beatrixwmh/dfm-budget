import { useState, useEffect } from 'react';
import type { Expense, ExpenseType, ExpenseTier, Schedule } from '../../engine/types';
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
];

const TIER_OPTIONS: { value: ExpenseTier; label: string }[] = [
  { value: 0, label: "T0 · Can't Cut" },
  { value: 1, label: 'T1 · Must Pay' },
  { value: 2, label: 'T2 · Important' },
  { value: 3, label: 'T3 · Nice to Have' },
];

const CATEGORY_TIER_SUGGESTIONS: Record<string, ExpenseTier> = {
  housing: 0, rent: 0, mortgage: 0, loans: 0, loan: 0,
  utilities: 1, insurance: 1, phone: 1, groceries: 1,
  transport: 2, savings: 2, investment: 2,
  subscriptions: 3, entertainment: 3, hobby: 3,
};

function suggestTier(categoryName: string): ExpenseTier {
  const lower = categoryName.toLowerCase();
  for (const [key, tier] of Object.entries(CATEGORY_TIER_SUGGESTIONS)) {
    if (lower.includes(key)) return tier;
  }
  return 2;
}

const DEFAULT_SCHEDULE: Schedule = {
  interval: 1,
  unit: 'month',
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
  const [schedule, setSchedule] = useState<Schedule>(initial?.schedule ?? DEFAULT_SCHEDULE);
  const [tier, setTier] = useState<ExpenseTier>(initial?.tier ?? 2);

  useEffect(() => {
    if (initial) return;
    const cat = categories.find(c => c.id === categoryId);
    if (cat) setTier(suggestTier(cat.name));
  }, [categoryId, categories, initial]);

  const handleSave = () => {
    if (!name.trim() || amount <= 0) return;
    const expense: Expense = {
      id: initial?.id ?? generateId(),
      name: name.trim(),
      amount,
      categoryId,
      type,
      schedule: type === 'one_time' ? { ...schedule, endDate: schedule.startDate } : schedule,
      tier,
      isAutoCut: initial?.isAutoCut ?? false,
    };
    onSave(expense);
    onClose();
  };

  const canSave = name.trim() !== '' && amount > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Expense' : 'New Expense'}
      footer={
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {initial ? 'Save Changes' : 'Add Expense'}
        </button>
      }
    >
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

        <CurrencyInput value={amount} onChange={setAmount} label="Amount (per occurrence)" />

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Type</label>
          <div className="grid grid-cols-3 gap-1.5">
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

        <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} allowAdd />

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

      </div>
    </Modal>
  );
}
