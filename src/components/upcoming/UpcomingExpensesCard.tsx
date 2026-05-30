import { useState, useMemo } from 'react';
import { useAppState } from '../../store/hooks';
import { generateDates } from '../../engine/scheduler';
import { toDateKey } from '../../engine/holidays';
import { OverdueExpenseRow } from './OverdueExpenseRow';
import { DueExpenseRow } from './DueExpenseRow';
import { FutureExpenseRow } from './FutureExpenseRow';
import type { DueExpense } from './DueExpenseRow';
import type { Expense } from '../../engine/types';

export function UpcomingExpensesCard() {
  const state = useAppState();
  const [showUpcoming, setShowUpcoming] = useState(false);

  const today = new Date();
  const todayKey = toDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toDateKey(tomorrow);

  // Build upcoming expense items from scheduled expenses
  const { todayItems, tomorrowItems, upcomingItems } = useMemo(() => {
    const todayList: DueExpense[] = [];
    const tomorrowList: DueExpense[] = [];
    const upcomingList: DueExpense[] = [];

    // Look ahead 14 days for upcoming section
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 14);

    const checkedTransactions = new Set<string>();

    for (const expense of state.expenses) {
      if (!expense.schedule) continue;
      if (expense.type === 'one_time') continue;

      const dates = generateDates(expense.schedule, today, windowEnd, state.customHolidays);

      for (const d of dates) {
        const dateKey = toDateKey(d);

        // Skip if already paid — check for a transaction made today or later
        // (covers paying early: e.g., paying today for something due tomorrow)
        const txKey = `${expense.id}-${dateKey}`;
        if (checkedTransactions.has(txKey)) continue;
        checkedTransactions.add(txKey);

        const hasTx = state.transactions.some(
          t => t.expenseId === expense.id && t.date >= todayKey
        );
        if (hasTx) continue;

        // Skip if there's already an overdue hold for this expense
        const hasHold = state.overdueHolds.some(h => h.expenseId === expense.id);
        if (hasHold) continue;

        const item: DueExpense = {
          expenseId: expense.id,
          name: expense.name,
          amount: expense.amount,
          date: dateKey,
          categoryId: expense.categoryId,
          type: expense.type,
          isVariable: expense.isVariable,
        };

        if (dateKey === todayKey) {
          todayList.push(item);
        } else if (dateKey === tomorrowKey) {
          tomorrowList.push(item);
        } else if (dateKey > tomorrowKey) {
          upcomingList.push(item);
        }
      }
    }

    // Sort by date
    upcomingList.sort((a, b) => a.date.localeCompare(b.date));

    return { todayItems: todayList, tomorrowItems: tomorrowList, upcomingItems: upcomingList };
  }, [state.expenses, state.transactions, state.overdueHolds, state.customHolidays]);

  const hasOverdue = state.overdueHolds.length > 0;
  const hasTodayTomorrow = todayItems.length > 0 || tomorrowItems.length > 0;
  const hasUpcoming = upcomingItems.length > 0;
  const hasAnything = hasOverdue || hasTodayTomorrow || hasUpcoming;

  if (!hasAnything) return null;

  return (
    <div className="rounded-xl bg-surface-raised p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Upcoming Expenses</h3>

      {/* Overdue Section */}
      {hasOverdue && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">
            Overdue ({state.overdueHolds.length})
          </p>
          <div className="space-y-2">
            {state.overdueHolds.map(hold => (
              <OverdueExpenseRow key={hold.expenseId} hold={hold} />
            ))}
          </div>
        </div>
      )}

      {/* Today & Tomorrow Section */}
      {hasTodayTomorrow && (
        <div className="mb-4">
          {todayItems.length > 0 && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Today
              </p>
              <div className="mb-3 space-y-2">
                {todayItems.map(item => (
                  <DueExpenseRow key={item.expenseId} item={item} label="Today" />
                ))}
              </div>
            </>
          )}
          {tomorrowItems.length > 0 && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Tomorrow
              </p>
              <div className="space-y-2">
                {tomorrowItems.map(item => (
                  <DueExpenseRow key={item.expenseId} item={item} label="Tomorrow" />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Upcoming Section (collapsed by default) */}
      {hasUpcoming && (
        <div>
          <button
            onClick={() => setShowUpcoming(!showUpcoming)}
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary"
          >
            <span>Upcoming ({upcomingItems.length})</span>
            <span className="text-base">{showUpcoming ? '▾' : '▸'}</span>
          </button>
          {showUpcoming && (
            <div className="mt-2 space-y-1.5">
              {upcomingItems.map(item => (
                <FutureExpenseRow key={`${item.expenseId}-${item.date}`} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
