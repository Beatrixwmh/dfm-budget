import type { AppState } from './types';
import { computeSnapshot } from './snapshot';
import { parseDate, toDateKey } from './holidays';

export interface AccrualResult {
  /** New lastAccrualDate to store (today). */
  date: string;
  deposits: { goalId: string; amount: number }[];
}

/**
 * Scheduled contributions are a daily flow from spendable → vault, but until
 * now they only existed in the projection — nothing ever moved. This computes
 * the catch-up deposit for each active goal since the last accrual, at the
 * THROTTLED rate the engine actually applies (min(total desired, rawDfm)
 * shared proportionally), clipped at each goal's remaining target.
 *
 * Returns null when there's nothing to do. A missing/empty lastAccrualDate
 * initializes to today with no back-accrual (we can't know the past).
 * While frozen (no capacity), days pass without accruing — by design.
 */
export function computeSavingsAccrual(state: AppState, today: Date): AccrualResult | null {
  const todayKey = toDateKey(today);
  const last = state.savingsLog?.lastAccrualDate;

  if (!last) return { date: todayKey, deposits: [] };
  if (last >= todayKey) return null;

  const days = Math.round(
    (parseDate(todayKey).getTime() - parseDate(last).getTime()) / 86400000
  );
  if (days <= 0) return null;

  const active = state.goals.filter(g => g.status === 'active' && g.contributionRatePerDay > 0);
  if (active.length === 0) return { date: todayKey, deposits: [] };

  const snap = computeSnapshot(state, today);
  const totalRate = active.reduce((s, g) => s + g.contributionRatePerDay, 0);
  const factor = snap && totalRate > 0 ? snap.appliedSavingsRate / totalRate : 0;

  const deposits: AccrualResult['deposits'] = [];
  for (const g of active) {
    const remaining =
      g.type === 'target' && g.targetAmount != null
        ? Math.max(0, g.targetAmount - g.accumulatedTotal)
        : Infinity;
    const amount = Math.min(g.contributionRatePerDay * factor * days, remaining);
    if (amount > 0.005) {
      deposits.push({ goalId: g.id, amount: Math.round(amount * 100) / 100 });
    }
  }

  return { date: todayKey, deposits };
}
