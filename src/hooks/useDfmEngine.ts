import { useMemo } from 'react';
import { useAppState } from '../store/hooks';
import { useDebounce } from './useDebounce';
import { generateCashEvents } from '../engine/eventGenerator';
import { calculateDfm } from '../engine/dfm';
import { calculateBarBreakdown } from '../engine/barChart';
import { computeEffectiveBalance } from '../engine/effectiveBalance';
import { todayString } from '../utils/format';
import type { DfmResult, CashEvent, BarBreakdown } from '../engine/types';

export interface DfmEngineOutput {
  dfm: DfmResult;
  events: CashEvent[];
  barBreakdown: BarBreakdown;
  incomeEventDates: Set<string>;
  effectiveBalance: number;
  overdueHoldTotal: number;
}

export function useDfmEngine(): DfmEngineOutput | null {
  const state = useAppState();
  const debouncedState = useDebounce(state, 200);

  return useMemo(() => {
    if (debouncedState.incomeSources.length === 0 && debouncedState.expenses.length === 0) {
      return null;
    }

    const today = new Date();
    const overdueHoldTotal = debouncedState.overdueHolds.reduce((sum, h) => sum + h.amount, 0);
    const effectiveBalance = computeEffectiveBalance(
      debouncedState.balance.currentBalance,
      debouncedState.overdueHolds
    );

    const events = generateCashEvents(
      debouncedState.incomeSources,
      debouncedState.expenses,
      today,
      debouncedState.customHolidays
    );

    const dfm = calculateDfm(
      effectiveBalance,
      debouncedState.buffer,
      events,
      today
    );

    const barBreakdown = calculateBarBreakdown(
      effectiveBalance,
      dfm.dailyFreeMoney,
      debouncedState.buffer,
      events,
      debouncedState.categories,
      todayString(),
      overdueHoldTotal
    );

    const incomeEventDates = new Set(
      events.filter(e => e.amount > 0).map(e => e.date)
    );

    return { dfm, events, barBreakdown, incomeEventDates, effectiveBalance, overdueHoldTotal };
  }, [debouncedState]);
}
