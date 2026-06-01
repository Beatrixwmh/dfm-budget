import type { IncomeSource, Expense, CashEvent, CustomHoliday } from './types';
import { generateDates } from './scheduler';
import { toDateKey, addDays, parseDate } from './holidays';

export function generateCashEvents(
  incomeSources: IncomeSource[],
  expenses: Expense[],
  today: Date,
  customHolidays: CustomHoliday[] = [],
  windowDays: number = 730
): CashEvent[] {
  const events: CashEvent[] = [];
  const windowEnd = addDays(today, windowDays);

  for (const income of incomeSources) {
    const dates = generateDates(income.schedule, today, windowEnd, customHolidays);
    for (const date of dates) {
      events.push({
        date: toDateKey(date),
        amount: income.amount,
        sourceId: income.id,
        sourceName: income.name,
        categoryId: null,
      });
    }
  }

  for (const expense of expenses) {
    if (expense.type === 'one_time') {
      if (expense.schedule) {
        const expDate = parseDate(expense.schedule.startDate);
        if (expDate >= today && expDate <= windowEnd) {
          events.push({
            date: toDateKey(expDate),
            amount: -expense.amount,
            sourceId: expense.id,
            sourceName: expense.name,
            categoryId: expense.categoryId,
          });
        }
      }
      continue;
    }

    if (!expense.schedule) continue;

    const dates = generateDates(expense.schedule, today, windowEnd, customHolidays);
    for (const date of dates) {
      events.push({
        date: toDateKey(date),
        amount: -expense.amount,
        sourceId: expense.id,
        sourceName: expense.name,
        categoryId: expense.categoryId,
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
