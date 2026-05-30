import { useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../store/hooks';
import { useSubscriptionAutoLog } from './useSubscriptionAutoLog';
import { detectOverdueExpenses } from '../engine/overdueDetector';

/**
 * Orchestrates all side effects on app mount:
 * 1. Subscription auto-logging
 * 2. Overdue expense detection
 */
export function useTransactionSideEffects() {
  useSubscriptionAutoLog();

  const state = useAppState();
  const dispatch = useAppDispatch();
  const hasDetectedOverdue = useRef(false);

  // Detect overdue expenses on mount
  useEffect(() => {
    if (hasDetectedOverdue.current) return;
    hasDetectedOverdue.current = true;

    const today = new Date();
    const newHolds = detectOverdueExpenses(
      state.expenses,
      state.transactions,
      state.overdueHolds,
      state.customHolidays,
      today
    );

    for (const hold of newHolds) {
      dispatch({ type: 'ADD_OVERDUE_HOLD', payload: hold });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
