import { useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../store/hooks';
import { computeSavingsAccrual } from '../engine/savingsAccrual';

/**
 * On app open, move the contributions that accrued since the last visit from
 * spendable into each goal's vault (throttled, clipped at targets). This is
 * what makes the savings segment in the balance bar real instead of purely
 * projected. Runs once per mount, like the other day-boundary side effects.
 */
export function useSavingsAccrual() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const result = computeSavingsAccrual(state, new Date());
    if (result) {
      dispatch({ type: 'ACCRUE_SAVINGS', payload: result });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
