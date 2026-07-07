import type { Schedule, ScheduleUnit } from '../../engine/types';
import { DayOfWeekPicker } from './DayOfWeekPicker';
import { DayOfMonthPicker } from './DayOfMonthPicker';
import { WeekendRuleSelect } from './WeekendRuleSelect';
import { HolidayRuleSelect } from './HolidayRuleSelect';

interface Props {
  value: Schedule;
  onChange: (schedule: Schedule) => void;
}

export function ScheduleForm({ value, onChange }: Props) {
  const update = (partial: Partial<Schedule>) => onChange({ ...value, ...partial });

  const handleInterval = (n: number) => {
    // Editing always drops legacy twice-a-month behavior.
    update({ interval: Math.max(1, Math.floor(n) || 1), semimonthlyDays: undefined });
  };

  const handleUnit = (unit: ScheduleUnit) => {
    const base: Partial<Schedule> = { unit, semimonthlyDays: undefined };
    if (unit === 'week') {
      base.dayOfWeek = value.dayOfWeek ?? 5;
      base.dayOfMonth = null;
      // A chosen weekday already fixes weekend-or-not, so reset the (hidden) weekend rule.
      base.weekendRule = 'as_is';
    } else {
      base.dayOfWeek = null;
      base.dayOfMonth = value.dayOfMonth ?? 1;
    }
    onChange({ ...value, ...base });
  };

  const isWeek = value.unit === 'week';
  const plural = value.interval === 1 ? '' : 's';

  return (
    <div className="flex flex-col gap-4">
      {/* Every N <week | month | year> */}
      <div>
        <label className="mb-1.5 block text-sm text-text-secondary">Repeats</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Every</span>
          <input
            type="number"
            min={1}
            value={value.interval}
            onChange={e => handleInterval(Number(e.target.value))}
            onFocus={e => e.currentTarget.select()}
            className="w-16 rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-center text-sm text-text-primary"
          />
          <select
            value={value.unit}
            onChange={e => handleUnit(e.target.value as ScheduleUnit)}
            className="flex-1 rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
          >
            <option value="week">week{plural}</option>
            <option value="month">month{plural}</option>
            <option value="year">year{plural}</option>
          </select>
        </div>
      </div>

      {/* Day-of-week for weeks; day-of-month for months & years */}
      {isWeek ? (
        <DayOfWeekPicker
          value={value.dayOfWeek ?? 5}
          onChange={day => update({ dayOfWeek: day })}
        />
      ) : (
        <DayOfMonthPicker
          value={value.dayOfMonth ?? 1}
          onChange={day => update({ dayOfMonth: day })}
        />
      )}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-sm text-text-secondary">Start Date</label>
          <input
            type="date"
            value={value.startDate}
            onChange={e => update({ startDate: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
          />
        </div>
        <span className="pb-3 text-sm text-text-muted" aria-hidden="true">→</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm text-text-secondary">End Date (optional)</label>
            {value.endDate && (
              <button
                type="button"
                onClick={() => update({ endDate: null })}
                className="text-xs text-text-muted hover:text-accent"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="date"
            value={value.endDate ?? ''}
            min={value.startDate}
            onChange={e => update({ endDate: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary"
          />
        </div>
      </div>

      {/* Weekend rule only matters for date-anchored (month/year) schedules */}
      {!isWeek && (
        <WeekendRuleSelect value={value.weekendRule} onChange={r => update({ weekendRule: r })} />
      )}
      <HolidayRuleSelect value={value.holidayRule} onChange={r => update({ holidayRule: r })} />
    </div>
  );
}
