/**
 * Savings engine — uses rawDfm (buffer-constrained, no sustainable cap)
 * as the ceiling for savings contributions.
 *
 * rawDfm = min over t=1..730 of (effective_balance + cumEvents(t) - buffer) / t
 * This is the max daily rate that keeps balance >= buffer at every point.
 * Savings is allowed to consume this entire rate (intentional drawdown to buffer).
 */
import type { CashEvent } from './types';
import { addDays, toDateKey } from './holidays';

export interface SavableDateResult {
  date: string;
  daysOut: number;
  maxRate: number;
}

/**
 * Find the first future date where the user will have surplus to start saving
 * (rawDfm computed from that date forward is positive). Returns null if there's
 * no savable window in the next `windowDays`.
 */
export function findFirstSavableDate(
  spendableBalance: number,
  buffer: number,
  events: CashEvent[],
  today: Date,
  windowDays: number = 730,
  step: number = 7
): SavableDateResult | null {
  const eventsByDay = new Map<string, number>();
  for (const e of events) {
    eventsByDay.set(e.date, (eventsByDay.get(e.date) ?? 0) + e.amount);
  }
  // cum[t] = cumulative net events through day t
  const cum: number[] = [0];
  let c = 0;
  for (let t = 1; t <= windowDays; t++) {
    c += eventsByDay.get(toDateKey(addDays(today, t))) ?? 0;
    cum[t] = c;
  }

  for (let d = 0; d <= windowDays; d += step) {
    const balAtD = spendableBalance + cum[d];
    let minRate = Infinity;
    for (let k = 1; k <= windowDays - d; k++) {
      const rate = (balAtD + (cum[d + k] - cum[d]) - buffer) / k;
      if (rate < minRate) minRate = rate;
    }
    if (minRate > 0) {
      return { date: fastestDateFromDays(today, d), daysOut: d, maxRate: minRate };
    }
  }
  return null;
}

export interface FastestDateResult {
  fastestDate: string;
  maxRatePerDay: number;
  daysToReach: number;
}

export interface ValidationResult {
  feasible: boolean;
  maxRate: number;
}

/**
 * Find the earliest date by which saving at rawDfm rate reaches targetAmount.
 * Since rawDfm is a constant max rate, fastest date = ceil(targetAmount / rawDfm).
 */
export function calculateFastestDate(
  rawDfm: number,
  targetAmount: number
): FastestDateResult | null {
  if (rawDfm <= 0 || targetAmount <= 0) return null;

  const daysToReach = Math.ceil(targetAmount / rawDfm);
  if (daysToReach > 730) return null; // not achievable in window

  const neededRate = targetAmount / daysToReach;

  return {
    fastestDate: '', // caller computes from daysToReach
    maxRatePerDay: neededRate,
    daysToReach,
  };
}

/**
 * Compute the date string from today + days offset.
 */
export function fastestDateFromDays(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Check if a given daily contribution rate is feasible.
 * Rate must not exceed rawDfm (buffer-constrained max).
 */
export function validateContribution(
  rawDfm: number,
  ratePerDay: number
): ValidationResult {
  const maxRate = Math.max(0, rawDfm);
  return {
    feasible: ratePerDay <= maxRate && maxRate > 0,
    maxRate,
  };
}
