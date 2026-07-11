import type { CashEvent, CustomHoliday, Expense, Schedule } from './types';
import { generateCashEvents } from './eventGenerator';
import { addDays, parseDate, toDateKey } from './holidays';

export interface Hypothetical {
  id: string;
  description: string;
  /** Entered positive; applied to the event stream as an outflow. */
  amount: number;
  kind: 'one_time' | 'recurring';
  /** one_time: the spend date. */
  date: string;
  /** recurring only. */
  schedule?: Schedule;
  categoryId: string;
}

/**
 * A hypothetical is materialized as a temporary Expense so its occurrences run
 * through the exact same scheduler as real expenses — including every-N
 * intervals, weekend/holiday rules, and end dates. Apply reuses this too.
 */
export function hypotheticalToExpense(h: Hypothetical, todayKey?: string): Expense {
  // The engine's convention is that today's events are already reflected in the
  // balance (paid) or pending (overdue flow) — the DFM loop starts tomorrow. A
  // "buy it today" hypothetical is therefore dated tomorrow so it actually
  // registers; one day of shift, same math.
  const oneTimeDate = todayKey && h.date <= todayKey
    ? toDateKey(addDays(parseDate(todayKey), 1))
    : h.date;

  const schedule: Schedule =
    h.kind === 'one_time'
      ? {
          interval: 1,
          unit: 'month',
          dayOfMonth: 1,
          dayOfWeek: null,
          startDate: oneTimeDate,
          endDate: oneTimeDate,
          weekendRule: 'as_is',
          holidayRule: 'as_is',
        }
      : h.schedule!;

  return {
    id: h.id,
    name: h.description,
    amount: h.amount,
    categoryId: h.categoryId,
    type: h.kind === 'one_time' ? 'one_time' : 'recurring',
    schedule,
    tier: 2,
    isAutoCut: false,
  };
}

export function hypotheticalEvents(
  hypos: Hypothetical[],
  today: Date,
  customHolidays: CustomHoliday[] = []
): CashEvent[] {
  if (hypos.length === 0) return [];
  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(addDays(today, 1));
  const events = generateCashEvents(
    [],
    hypos.map(h => hypotheticalToExpense(h, todayKey)),
    today,
    customHolidays
  );
  // Recurring hypos whose first occurrence lands today get the same
  // shift-to-tomorrow treatment (the DFM loop never reads today's key).
  return events.map(e => (e.date <= todayKey ? { ...e, date: tomorrowKey } : e));
}
