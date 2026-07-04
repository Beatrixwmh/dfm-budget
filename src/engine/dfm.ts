import type { CashEvent, DfmResult, DfmSegment } from './types';
import { addDays, toDateKey } from './holidays';

export function calculateDfm(
  currentBalance: number,
  buffer: number,
  events: CashEvent[],
  today: Date,
  windowDays: number = 730
): DfmResult {
  // Pre-compute net events per day
  const eventsByDay = new Map<string, number>();
  let totalEvents = 0;
  for (const e of events) {
    eventsByDay.set(e.date, (eventsByDay.get(e.date) ?? 0) + e.amount);
    totalEvents += e.amount;
  }

  const sustainableRate = totalEvents / windowDays;

  // Compute raw_dfm: buffer-constrained min-ratio, no sustainable cap.
  // This is the max rate for savings contributions.
  let rawDfmValue = Infinity;
  {
    let cum = 0;
    for (let t = 1; t <= windowDays; t++) {
      const dayKey = toDateKey(addDays(today, t));
      cum += eventsByDay.get(dayKey) ?? 0;
      const ratio = (currentBalance - buffer + cum) / t;
      if (ratio < rawDfmValue) rawDfmValue = ratio;
    }
  }

  // --- Find binding pinch segments ---
  const segments = findBindingSegments(
    currentBalance,
    buffer,
    eventsByDay,
    today,
    windowDays,
    sustainableRate
  );

  const dailyFreeMoney = segments.length > 0 ? segments[0].rate : sustainableRate;

  // --- Build projected balances piecewise ---
  const projectedBalances: { date: string; balance: number; rawBalance: number }[] = [];
  projectedBalances.push({ date: toDateKey(today), balance: currentBalance, rawBalance: currentBalance });

  let runningBalance = currentBalance;
  let rawBalance = currentBalance;
  let segIdx = 0;
  let dayInSegment = 0;

  for (let t = 1; t <= windowDays; t++) {
    const dayKey = toDateKey(addDays(today, t));
    const dayEvent = eventsByDay.get(dayKey) ?? 0;

    rawBalance += dayEvent;
    runningBalance += dayEvent;

    // Determine current segment rate
    while (segIdx < segments.length - 1 && t > segments[segIdx].endDay) {
      segIdx++;
      dayInSegment = 0;
    }
    dayInSegment++;
    runningBalance -= segments[segIdx].rate;

    projectedBalances.push({ date: dayKey, balance: runningBalance, rawBalance });
  }

  // First pinch point — only meaningful when the first segment is pinched below sustainable
  const hasPinch = segments.length > 1 || (segments.length === 1 && segments[0].endDay < windowDays);
  const pinchPointDate = hasPinch
    ? segments[0].pinchDate
    : '';
  const pinchPointBalance = hasPinch
    ? buffer
    : runningBalance;

  return {
    dailyFreeMoney,
    sustainableRate,
    rawDfm: rawDfmValue,
    pinchPointDate,
    pinchPointBalance,
    projectedBalances,
    segments,
  };
}

/**
 * Max one-time spend TODAY that never breaches the buffer at any future point,
 * assuming $0/day discretionary spending afterward. The aggressive query (no
 * sustainable cap) — this is cushion money, spending it is safe for bills but
 * slows free-money recovery. min over t>=0 of (balance + cumEvents(t)) - buffer.
 */
export function maxSpendToday(
  currentBalance: number,
  buffer: number,
  events: CashEvent[],
  today: Date,
  windowDays: number = 730
): number {
  const eventsByDay = new Map<string, number>();
  for (const e of events) {
    eventsByDay.set(e.date, (eventsByDay.get(e.date) ?? 0) + e.amount);
  }

  let minBalance = currentBalance; // t = 0, before any future event
  let cum = 0;
  for (let t = 1; t <= windowDays; t++) {
    const dayKey = toDateKey(addDays(today, t));
    cum += eventsByDay.get(dayKey) ?? 0;
    const bal = currentBalance + cum;
    if (bal < minBalance) minBalance = bal;
  }

  return Math.max(0, minBalance - buffer);
}

/**
 * Find successive binding pinch segments in a single conceptual forward pass.
 * Each segment has a rate that exactly clears its pinch point.
 * The final segment uses the sustainable rate.
 */
function findBindingSegments(
  effectiveBalance: number,
  buffer: number,
  eventsByDay: Map<string, number>,
  today: Date,
  windowDays: number,
  sustainableRate: number
): DfmSegment[] {
  const segments: DfmSegment[] = [];
  let segStartDay = 0;
  let segBalance = effectiveBalance;

  while (segStartDay < windowDays) {
    let cum = 0;
    let minRatio = Infinity;
    let pinchDayOffset = -1; // offset from segStartDay

    const remaining = windowDays - segStartDay;

    for (let t = 1; t <= remaining; t++) {
      const dayKey = toDateKey(addDays(today, segStartDay + t));
      cum += eventsByDay.get(dayKey) ?? 0;

      const ratio = (segBalance - buffer + cum) / t;
      if (ratio < minRatio) {
        minRatio = ratio;
        pinchDayOffset = t;
      }
    }

    const pinchDay = segStartDay + pinchDayOffset;

    if (minRatio >= sustainableRate) {
      // No further pinch below sustainable — final segment
      segments.push({
        startDay: segStartDay,
        endDay: windowDays,
        rate: sustainableRate,
        pinchDate: toDateKey(addDays(today, windowDays)),
        nextRate: null,
      });
      break;
    } else {
      // Record this pinch boundary
      segments.push({
        startDay: segStartDay,
        endDay: pinchDay,
        rate: minRatio,
        pinchDate: toDateKey(addDays(today, pinchDay)),
        nextRate: null, // filled in below
      });

      // After surviving this pinch, balance = buffer
      segBalance = buffer;
      segStartDay = pinchDay;
    }
  }

  // If we never broke out (extremely rare edge case), add final segment
  if (segments.length === 0) {
    segments.push({
      startDay: 0,
      endDay: windowDays,
      rate: sustainableRate,
      pinchDate: toDateKey(addDays(today, windowDays)),
      nextRate: null,
    });
  }

  // Fill in nextRate for display purposes
  for (let i = 0; i < segments.length - 1; i++) {
    segments[i].nextRate = segments[i + 1].rate;
  }

  return segments;
}
