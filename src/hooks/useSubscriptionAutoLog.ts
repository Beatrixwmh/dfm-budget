import { useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../store/hooks';
import { generateDates } from '../engine/scheduler';
import { toDateKey, parseDate } from '../engine/holidays';
import type { Expense, Transaction } from '../engine/types';

/**
 * On mount, auto-log transactions for subscription expenses that were due
 * between the last processed date and today. Handles multi-day gaps
 * (user didn't open app for days).
 */
export function useSubscriptionAutoLog() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const today = new Date();
    const todayKey = toDateKey(today);
    const lastProcessed = state.subscriptionLog.lastProcessedDate;

    // If never processed, set to today and skip (don't backfill arbitrarily)
    if (!lastProcessed) {
      dispatch({ type: 'SET_SUBSCRIPTION_LOG', payload: { lastProcessedDate: todayKey } });
      return;
    }

    // If already processed today, skip
    if (lastProcessed >= todayKey) return;

    const subscriptions = state.expenses.filter((e: Expense) => e.type === 'subscription' && e.schedule);
    if (subscriptions.length === 0) {
      dispatch({ type: 'SET_SUBSCRIPTION_LOG', payload: { lastProcessedDate: todayKey } });
      return;
    }

    // Window: day after lastProcessed through today
    const startDate = parseDate(lastProcessed);
    startDate.setDate(startDate.getDate() + 1);

    for (const sub of subscriptions) {
      if (!sub.schedule) continue;
      const dates = generateDates(sub.schedule, startDate, today, state.customHolidays);
      for (const d of dates) {
        const dateKey = toDateKey(d);
        if (dateKey <= lastProcessed || dateKey > todayKey) continue;

        // Check if transaction already exists for this expense on this date
        const exists = state.transactions.some(
          (t: Transaction) => t.expenseId === sub.id && t.date === dateKey
        );
        if (exists) continue;

        const tx: Transaction = {
          id: `auto-${sub.id}-${dateKey}`,
          expenseId: sub.id,
          dueDate: dateKey,
          date: dateKey,
          amount: sub.amount,
          description: sub.name,
          categoryId: sub.categoryId,
          source: 'auto',
        };

        dispatch({ type: 'ADD_TRANSACTION', payload: tx });
        dispatch({
          type: 'SET_BALANCE',
          payload: {
            currentBalance: state.balance.currentBalance - sub.amount,
            lastUpdated: dateKey,
          },
        });
      }
    }

    dispatch({ type: 'SET_SUBSCRIPTION_LOG', payload: { lastProcessedDate: todayKey } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
