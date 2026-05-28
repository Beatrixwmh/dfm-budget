import type { CashEvent, DfmResult } from './types';
import { addDays, toDateKey } from './holidays';

export function calculateDfm(
  currentBalance: number,
  buffer: number,
  events: CashEvent[],
  today: Date,
  windowDays: number = 730
): DfmResult {
  const eventsByDay = new Map<string, number>();
  for (const e of events) {
    eventsByDay.set(e.date, (eventsByDay.get(e.date) ?? 0) + e.amount);
  }

  let cumulativeEvents = 0;
  let minDfm = Infinity;
  let pinchDay = 1;
  let pinchBalance = currentBalance;
  const projectedBalances: { date: string; balance: number }[] = [];

  for (let t = 1; t <= windowDays; t++) {
    const dayDate = addDays(today, t);
    const dayKey = toDateKey(dayDate);

    cumulativeEvents += eventsByDay.get(dayKey) ?? 0;

    const dfmAtT = (currentBalance + cumulativeEvents - buffer) / t;

    if (dfmAtT < minDfm) {
      minDfm = dfmAtT;
      pinchDay = t;
      pinchBalance = currentBalance + cumulativeEvents - minDfm * t;
    }
  }

  // Cap at sustainable rate: spending only what income covers,
  // so DFM stays stable day-over-day when surplus exists
  const sustainableRate = cumulativeEvents / windowDays;
  const dailyFreeMoney = minDfm === Infinity ? 0 : Math.min(minDfm, sustainableRate);

  // Build projected balances assuming DFM spending rate
  let runningBalance = currentBalance;
  let cumEvents = 0;
  projectedBalances.push({ date: toDateKey(today), balance: currentBalance, rawBalance: currentBalance });

  for (let t = 1; t <= windowDays; t++) {
    const dayDate = addDays(today, t);
    const dayKey = toDateKey(dayDate);
    cumEvents += eventsByDay.get(dayKey) ?? 0;
    runningBalance = currentBalance + cumEvents - dailyFreeMoney * t;
    projectedBalances.push({ date: dayKey, balance: runningBalance, rawBalance: currentBalance + cumEvents });
  }

  return {
    dailyFreeMoney,
    sustainableRate,
    pinchPointDate: toDateKey(addDays(today, pinchDay)),
    pinchPointBalance: pinchBalance,
    projectedBalances,
  };
}
