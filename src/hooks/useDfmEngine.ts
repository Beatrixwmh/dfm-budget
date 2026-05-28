import { useMemo } from 'react';
import { useAppState } from '../store/hooks';
import { useDebounce } from './useDebounce';
import { generateCashEvents } from '../engine/eventGenerator';
import { calculateDfm } from '../engine/dfm';
import { calculateBarBreakdown } from '../engine/barChart';
import { todayString } from '../utils/format';
import type { DfmResult, CashEvent, BarBreakdown } from '../engine/types';

export interface DfmEngineOutput {
  dfm: DfmResult;
  events: CashEvent[];
  barBreakdown: BarBreakdown;
  incomeEventDates: Set<string>;
}

export function useDfmEngine(): DfmEngineOutput | null {
  const state = useAppState();
  const debouncedState = useDebounce(state, 200);

  return useMemo(() => {
    if (debouncedState.incomeSources.length === 0 && debouncedState.expenses.length === 0) {
      return null;
    }

    const today = new Date();
    const events = generateCashEvents(
      debouncedState.incomeSources,
      debouncedState.expenses,
      today,
      debouncedState.customHolidays
    );

    const dfm = calculateDfm(
      debouncedState.balance.currentBalance,
      debouncedState.buffer,
      events,
      today
    );

    const barBreakdown = calculateBarBreakdown(
      debouncedState.balance.currentBalance,
      dfm.dailyFreeMoney,
      debouncedState.buffer,
      events,
      debouncedState.categories,
      todayString()
    );

    const incomeEventDates = new Set(
      events.filter(e => e.amount > 0).map(e => e.date)
    );

    return { dfm, events, barBreakdown, incomeEventDates };
  }, [debouncedState]);
}
