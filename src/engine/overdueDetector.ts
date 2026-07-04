import type { Expense, Transaction, OverdueHold, CustomHoliday } from './types';
import { generateDates } from './scheduler';
import { toDateKey, parseDate } from './holidays';

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
    const dates = generateDates(expense.schedule, parseDate(expense.schedule.startDate), today, customHolidays);
    if (dates.length === 0) continue;

    // Get the last date that is on or before today
    const pastDueDates = dates.filter(d => toDateKey(d) <= todayKey);
    if (pastDueDates.length === 0) continue;

    const lastDueDate = pastDueDates[pastDueDates.length - 1];
    const lastDueDateKey = toDateKey(lastDueDate);

    // Check if there's already a transaction covering this due date.
    // Match by dueDate when available; fall back to date match for old transactions.
    const hasTransaction = transactions.some(
      t => t.expenseId === expense.id &&
        (t.dueDate ? t.dueDate === lastDueDateKey : t.date === lastDueDateKey)
    );
    if (hasTransaction) continue;

    // Only flag if actually past due (due date is strictly before today, not today itself)
    if (lastDueDateKey >= todayKey) continue;

    // Compute days overdue using date keys (no timezone issues)
    const [ty, tm, td] = todayKey.split('-').map(Number);
    const [dy, dm, dd] = lastDueDateKey.split('-').map(Number);
    const todayMs = new Date(ty, tm - 1, td).getTime();
    const dueMs = new Date(dy, dm - 1, dd).getTime();
    const daysLate = Math.floor((todayMs - dueMs) / (86400 * 1000));

    newHolds.push({
      expenseId: expense.id,
      expenseName: expense.name,
      amount: expense.amount,
      originalDueDate: lastDueDateKey,
      deferCount: Math.max(0, daysLate - 1),
      categoryId: expense.categoryId,
    });
  }

  return newHolds;
}
