import { useState } from 'react';
import type { Schedule } from '../../engine/types';
import type { Hypothetical } from '../../engine/hypotheticals';
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
  onAdd: (h: Hypothetical) => void;
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

export function HypotheticalForm({ open, onClose, onAdd }: Props) {
  const { categories } = useAppState();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [kind, setKind] = useState<'one_time' | 'recurring'>('one_time');
  const [date, setDate] = useState(todayString());
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [categoryId, setCategoryId] = useState('');

  const canAdd = description.trim() !== '' && amount > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({
      id: generateId(),
      description: description.trim(),
      amount,
      kind,
      date,
      schedule: kind === 'recurring' ? schedule : undefined,
      categoryId,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="What if…"
      footer={
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          Add to Scenario
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">What are you considering?</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g., New couch, Gym upgrade, Weekend trip"
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <CurrencyInput value={amount} onChange={setAmount} label="Amount" />

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Type</label>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { value: 'one_time', label: 'One-time', desc: 'A single purchase' },
              { value: 'recurring', label: 'Recurring', desc: 'A new ongoing cost' },
            ] as const).map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setKind(t.value)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  kind === t.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
                }`}
              >
                <span className="font-medium">{t.label}</span>
                <span className={`block text-xs ${kind === t.value ? 'text-white/70' : 'text-text-muted'}`}>
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} allowAdd />

        <div className="border-t border-border pt-4">
          <h4 className="mb-3 text-sm font-medium text-text-secondary">
            {kind === 'one_time' ? 'When would you buy it?' : 'Schedule'}
          </h4>
          {kind === 'one_time' ? (
            <input
              type="date"
              value={date}
              min={todayString()}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
            />
          ) : (
            <ScheduleForm value={schedule} onChange={setSchedule} />
          )}
        </div>
      </div>
    </Modal>
  );
}
