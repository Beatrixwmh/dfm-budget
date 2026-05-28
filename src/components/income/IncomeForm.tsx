import { useState } from 'react';
import type { IncomeSource, Schedule } from '../../engine/types';
import { Modal } from '../shared/Modal';
import { CurrencyInput } from '../shared/CurrencyInput';
import { ScheduleForm } from '../schedule/ScheduleForm';
import { generateId } from '../../utils/id';
import { todayString } from '../../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (income: IncomeSource) => void;
  initial?: IncomeSource;
}

const DEFAULT_SCHEDULE: Schedule = {
  frequency: 'biweekly',
  dayOfMonth: null,
  dayOfWeek: 5,
  startDate: todayString(),
  endDate: null,
  weekendRule: 'as_is',
  holidayRule: 'as_is',
};

export function IncomeForm({ open, onClose, onSave, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [isVariable, setIsVariable] = useState(initial?.isVariable ?? false);
  const [schedule, setSchedule] = useState<Schedule>(initial?.schedule ?? DEFAULT_SCHEDULE);

  const handleSave = () => {
    if (!name.trim() || amount <= 0) return;
    onSave({
      id: initial?.id ?? generateId(),
      name: name.trim(),
      amount,
      isVariable,
      schedule,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Income' : 'New Income Source'}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Day Job, Freelance"
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <CurrencyInput value={amount} onChange={setAmount} label="Amount (per occurrence)" />

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={isVariable}
            onChange={e => setIsVariable(e.target.checked)}
            className="h-4 w-4 rounded accent-accent"
          />
          Amount varies (this is an estimate)
        </label>

        <div className="border-t border-border pt-4">
          <h4 className="mb-3 text-sm font-medium text-text-secondary">Schedule</h4>
          <ScheduleForm value={schedule} onChange={setSchedule} />
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || amount <= 0}
          className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {initial ? 'Save Changes' : 'Add Income'}
        </button>
      </div>
    </Modal>
  );
}
