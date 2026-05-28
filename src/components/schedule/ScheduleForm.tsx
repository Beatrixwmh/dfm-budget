import type { Schedule, ScheduleFrequency } from '../../engine/types';
import { FrequencySelect } from './FrequencySelect';
import { DayOfWeekPicker } from './DayOfWeekPicker';
import { DayOfMonthPicker } from './DayOfMonthPicker';
import { WeekendRuleSelect } from './WeekendRuleSelect';
import { HolidayRuleSelect } from './HolidayRuleSelect';

interface Props {
  value: Schedule;
  onChange: (schedule: Schedule) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function ScheduleForm({ value, onChange }: Props) {
  const update = (partial: Partial<Schedule>) => onChange({ ...value, ...partial });

  const handleFrequencyChange = (frequency: ScheduleFrequency) => {
    const base: Partial<Schedule> = { frequency };

    if (frequency === 'weekly' || frequency === 'biweekly') {
      base.dayOfWeek = value.dayOfWeek ?? 5;
      base.dayOfMonth = null;
      base.semimonthlyDays = undefined;
    } else if (frequency === 'semimonthly') {
      base.dayOfWeek = null;
      base.dayOfMonth = null;
      base.semimonthlyDays = value.semimonthlyDays ?? [1, 15];
    } else {
      base.dayOfWeek = null;
      base.dayOfMonth = value.dayOfMonth ?? 1;
      base.semimonthlyDays = undefined;
    }

    onChange({ ...value, ...base });
  };

  const showDayOfWeek = value.frequency === 'weekly' || value.frequency === 'biweekly';
  const showDayOfMonth = value.frequency === 'monthly' || value.frequency === 'quarterly' || value.frequency === 'annual';
  const showSemimonthly = value.frequency === 'semimonthly';
  const showMonthPicker = value.frequency === 'annual';

  return (
    <div className="flex flex-col gap-4">
      <FrequencySelect value={value.frequency} onChange={handleFrequencyChange} />

      {showDayOfWeek && (
        <DayOfWeekPicker
          value={value.dayOfWeek ?? 5}
          onChange={day => update({ dayOfWeek: day })}
        />
      )}

      {showDayOfMonth && (
        <DayOfMonthPicker
          value={value.dayOfMonth ?? 1}
          onChange={day => update({ dayOfMonth: day })}
        />
      )}

      {showSemimonthly && (
        <div className="flex flex-col gap-3">
          <DayOfMonthPicker
            label="First Day"
            value={value.semimonthlyDays?.[0] ?? 1}
            onChange={day => update({ semimonthlyDays: [day, value.semimonthlyDays?.[1] ?? 15] })}
          />
          <DayOfMonthPicker
            label="Second Day"
            value={value.semimonthlyDays?.[1] ?? 15}
            onChange={day => update({ semimonthlyDays: [value.semimonthlyDays?.[0] ?? 1, day] })}
          />
        </div>
      )}

      {showMonthPicker && (
        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Month</label>
          <select
            value={new Date(value.startDate).getMonth()}
            onChange={e => {
              const month = parseInt(e.target.value);
              const d = new Date(value.startDate);
              d.setMonth(month);
              update({ startDate: d.toISOString().slice(0, 10) });
            }}
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Start Date</label>
          <input
            type="date"
            value={value.startDate}
            onChange={e => update({ startDate: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">End Date (optional)</label>
          <input
            type="date"
            value={value.endDate ?? ''}
            onChange={e => update({ endDate: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
          />
        </div>
      </div>

      <WeekendRuleSelect value={value.weekendRule} onChange={r => update({ weekendRule: r })} />
      <HolidayRuleSelect value={value.holidayRule} onChange={r => update({ holidayRule: r })} />
    </div>
  );
}
