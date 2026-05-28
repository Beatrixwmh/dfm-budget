import type { OverdueHold } from './types';

export function computeEffectiveBalance(
  currentBalance: number,
  overdueHolds: OverdueHold[]
): number {
  const holdTotal = overdueHolds.reduce((sum, h) => sum + h.amount, 0);
  return currentBalance - holdTotal;
}
