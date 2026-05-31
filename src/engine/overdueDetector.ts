import type { Expense, Transaction, OverdueHold, CustomHoliday, ScheduleFrequency } from './types';
import { generateDates } from './scheduler';
import { toDateKey } from './holidays';

/** Half the billing period — used to detect early payments for a due date. */
function halfPeriodDays(freq: ScheduleFrequency): number {
  switch (freq) {
    case 'weekly': return 3;
    case 'biweekly': return 7;
    case 'semimonthly': return 7;
    case 'monthly': return 15;
    case 'quarterly': return 45;
    case 'annual': return 180;
  }
}

/**
 * Detect recurring expenses that are overdue (past due with no transaction or hold).
 * Returns new OverdueHold entries that should be added to state.
 */
export function detectOverdueExpenses(
  expenses: Expense[],
  transactions: Transaction[],
  overdueHolds: OverdueHold[],
  customHolidays: CustomHoliday[],
  today: Date
): OverdueHold[] {
  const todayKey = toDateKey(today);
  const holdExpenseIds = new Set(overdueHolds.map(h => h.expenseId));
  const newHolds: OverdueHold[] = [];

  for (const expense of expenses) {
    // Only recurring expenses need manual confirmation
    if (expense.type !== 'recurring') continue;
    if (!expense.schedule) continue;
    if (holdExpenseIds.has(expense.id)) continue;

    // Find the most recent scheduled due date on or before today
    // Generate dates from schedule start up to today
    const dates = generateDates(expense.schedule, new Date(expense.schedule.startDate), today, customHolidays);
    if (dates.length === 0) continue;

    // Get the last date that is on or before today
    const pastDueDates = dates.filter(d => toDateKey(d) <= todayKey);
    if (pastDueDates.length === 0) continue;

    const lastDueDate = pastDueDates[pastDueDates.length - 1];
    const lastDueDateKey = toDateKey(lastDueDate);

    // Check if there's already a transaction covering this period.
    // Use half-period lookback to catch early payments (e.g. paid day before due date).
    const hp = halfPeriodDays(expense.schedule.frequency);
    const lookback = new Date(lastDueDate);
    lookback.setDate(lookback.getDate() - hp);
    const lookbackKey = toDateKey(lookback);
    const hasTransaction = transactions.some(
      t => t.expenseId === expense.id && t.date >= lookbackKey
    );
    if (hasTransaction) continue;

    // This expense is overdue — create a hold
    const daysOverdue = Math.round(
      (today.getTime() - lastDueDate.getTime()) / (86400 * 1000)
    );

    // Only flag if actually past due (due date is before today, not today itself)
    if (daysOverdue <= 0) continue;

    newHolds.push({
      expenseId: expense.id,
      expenseName: expense.name,
      amount: expense.amount,
      originalDueDate: lastDueDateKey,
      deferCount: daysOverdue - 1, // start at days already passed minus 1
      categoryId: expense.categoryId,
    });
  }

  return newHolds;
}
