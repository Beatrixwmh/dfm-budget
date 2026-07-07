import { useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../store/hooks';
import { useSubscriptionAutoLog } from './useSubscriptionAutoLog';
import { useAutoUnpause } from './useAutoUnpause';
import { useSavingsAccrual } from './useSavingsAccrual';
import { detectOverdueExpenses } from '../engine/overdueDetector';
import { toDateKey } from '../engine/holidays';

/**
 * Orchestrates all side effects on app mount:
 * 1. Clear stale overdue holds (due today or later — created by old rounding bug)
 * 2. Subscription auto-logging
 * 3. Overdue expense detection
 * 4. Savings goal auto-unpause checks
 */
export function useTransactionSideEffects() {
  useSubscriptionAutoLog();
  useSavingsAccrual();
  const autoUnpause = useAutoUnpause();

  const state = useAppState();
  const dispatch = useAppDispatch();
  const hasDetectedOverdue = useRef(false);

  useEffect(() => {
    if (hasDetectedOverdue.current) return;
    hasDetectedOverdue.current = true;

    const today = new Date();
    const todayKey = toDateKey(today);

    // Clear any stale holds whose due date is today or later (shouldn't be overdue)
    for (const hold of state.overdueHolds) {
      if (hold.originalDueDate >= todayKey) {
        dispatch({ type: 'DISMISS_OVERDUE', payload: hold.expenseId });
      }
    }

    // Detect genuinely overdue expenses (cut expenses can't be overdue — they're
    // not being paid, on purpose)
    const newHolds = detectOverdueExpenses(
      state.expenses.filter(e => !e.isAutoCut),
      state.transactions,
      state.overdueHolds,
      state.customHolidays,
      today
    );

    for (const hold of newHolds) {
      dispatch({ type: 'ADD_OVERDUE_HOLD', payload: hold });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return autoUnpause;
}
