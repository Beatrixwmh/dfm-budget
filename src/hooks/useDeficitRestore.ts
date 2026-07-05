import { useEffect } from 'react';
import { useAppState, useAppDispatch } from '../store/hooks';
import { findRestorable } from '../engine/deficit';

/**
 * Auto-restore: whenever the budget improves (income added, expense removed,
 * balance topped up), cut expenses come back automatically — essentials first
 * (tier 1 → 2 → 3) — as long as restoring keeps the daily allowance ≥ 0.
 * Mirrors useAutoUnpause: derived behavior, no stored schedule.
 */
export function useDeficitRestore() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!state.expenses.some(e => e.isAutoCut)) return;
    const ids = findRestorable(state, new Date());
    if (ids.length > 0) {
      dispatch({ type: 'SET_AUTO_CUT', payload: { expenseIds: ids, isAutoCut: false } });
    }
  }, [state, dispatch]);
}
