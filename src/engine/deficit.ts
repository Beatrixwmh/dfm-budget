import type { AppState, Expense } from './types';
import { computeSnapshot, type SnapshotOptions } from './snapshot';

/** Merge a base scenario (e.g. simulator hypotheticals) with additional cut ids. */
function withCuts(base: SnapshotOptions, cutIds: Set<string>): SnapshotOptions {
  const merged = new Set(base.excludeExpenseIds ?? []);
  for (const id of cutIds) merged.add(id);
  return { ...base, excludeExpenseIds: merged };
}

export interface DeficitCandidate {
  expenseId: string;
  name: string;
  tier: 1 | 2 | 3;
  amount: number;
  /** How much daily allowance cutting this single expense frees (exact, via snapshot). */
  freedPerDay: number;
}

export interface DeficitPlan {
  inDeficit: boolean;
  /** |DFM| — how far under water the daily rate is. */
  deficitPerDay: number;
  neededPerMonth: number;
  /** Cushion above buffer (maxSplurge) — ~0 in a genuine deficit; shown as lever-1 context. */
  headroom: number;
  /** Lever 2: what pausing all active goals frees per day (0 if none active). */
  pausableSavingsPerDay: number;
  /** True when the engine already auto-froze contributions (no spendable room). */
  savingsAlreadyFrozen: boolean;
  /** Cut candidates grouped by tier, 3 → 2 → 1. Tier 0 is NEVER included. */
  tiers: { tier: 1 | 2 | 3; candidates: DeficitCandidate[] }[];
  /** False when cutting every tier 1–3 expense still leaves DFM negative. */
  resolvable: boolean;
}

/**
 * Assess a deficit and lay out the resolution levers in addendum-A2 order:
 * headroom fact → pause savings → tier cuts (3 → 2 → 1, never 0).
 * Savings goals are transfers, not expenses — they never appear as cut
 * candidates; pausing is their lever.
 */
export function planDeficit(
  state: AppState,
  today: Date,
  baseOpts: SnapshotOptions = {}
): DeficitPlan {
  const base = computeSnapshot(state, today, baseOpts);
  if (!base) {
    return {
      inDeficit: false, deficitPerDay: 0, neededPerMonth: 0, headroom: 0,
      pausableSavingsPerDay: 0, savingsAlreadyFrozen: false, tiers: [], resolvable: true,
    };
  }

  const inDeficit = base.dfm.dailyFreeMoney < 0;
  const deficitPerDay = Math.max(0, -base.dfm.dailyFreeMoney);

  const activeGoals = state.goals.filter(g => g.status === 'active' && g.contributionRatePerDay > 0);
  const pausableSavingsPerDay = activeGoals.reduce((s, g) => s + g.contributionRatePerDay, 0);

  // Candidates: uncut, schedulable expenses in tiers 1–3 (tier 0 untouchable).
  const cuttable = state.expenses.filter(
    (e): e is Expense => !e.isAutoCut && e.tier > 0
  );

  const tiers: DeficitPlan['tiers'] = [];
  for (const tier of [3, 2, 1] as const) {
    const inTier = cuttable.filter(e => e.tier === tier);
    if (inTier.length === 0) continue;
    const candidates = inTier
      .map(e => {
        const without = computeSnapshot(state, today, withCuts(baseOpts, new Set([e.id])));
        const freedPerDay = without
          ? without.dfm.dailyFreeMoney - base.dfm.dailyFreeMoney
          : 0;
        return {
          expenseId: e.id,
          name: e.name,
          tier,
          amount: e.amount,
          freedPerDay: Math.max(0, freedPerDay),
        };
      })
      .sort((a, b) => b.freedPerDay - a.freedPerDay);
    tiers.push({ tier, candidates });
  }

  // Resolvable? Cut everything cuttable and check.
  const allCutIds = new Set(cuttable.map(e => e.id));
  const everythingCut = computeSnapshot(state, today, withCuts(baseOpts, allCutIds));
  const resolvable = !inDeficit || (everythingCut ? everythingCut.dfm.dailyFreeMoney >= 0 : false);

  return {
    inDeficit,
    deficitPerDay,
    neededPerMonth: deficitPerDay * 30.44,
    headroom: base.maxSplurge,
    pausableSavingsPerDay,
    savingsAlreadyFrozen: base.savingsFrozen,
    tiers,
    resolvable,
  };
}

/** Projected daily allowance if the given expenses were cut. */
export function simulateCuts(
  state: AppState,
  today: Date,
  cutIds: Set<string>,
  baseOpts: SnapshotOptions = {}
): number {
  const snap = computeSnapshot(state, today, withCuts(baseOpts, cutIds));
  return snap ? snap.dfm.dailyFreeMoney : 0;
}

/**
 * Greedy auto-select: walk tiers 3 → 2 → 1, largest-freed first, until the
 * projected daily allowance clears zero. Returns the chosen expense ids
 * (possibly all of them if the deficit is unresolvable).
 */
export function autoSelectCuts(
  state: AppState,
  today: Date,
  plan: DeficitPlan,
  baseOpts: SnapshotOptions = {}
): Set<string> {
  const chosen = new Set<string>();
  for (const { candidates } of plan.tiers) {
    for (const c of candidates) {
      chosen.add(c.expenseId);
      if (simulateCuts(state, today, chosen, baseOpts) >= 0) return chosen;
    }
  }
  return chosen;
}

/**
 * Which auto-cut expenses can come back without re-triggering the deficit?
 * Restores essentials first (tier 1 → 2 → 3), largest first within a tier,
 * greedily — each expense is restored only if the allowance stays ≥ 0 with it
 * and everything already chosen back in.
 */
export function findRestorable(state: AppState, today: Date): string[] {
  const cut = state.expenses.filter(e => e.isAutoCut);
  if (cut.length === 0) return [];

  // Nothing comes back while still under water.
  const current = computeSnapshot(state, today);
  if (!current || current.dfm.dailyFreeMoney < 0) return [];

  const ordered = [...cut].sort((a, b) => (a.tier - b.tier) || (b.amount - a.amount));
  const restored: string[] = [];
  const included = new Set<string>();

  for (const e of ordered) {
    included.add(e.id);
    const snap = computeSnapshot(state, today, { includeCutIds: included });
    if (snap && snap.dfm.dailyFreeMoney >= 0) {
      restored.push(e.id);
    } else {
      included.delete(e.id);
    }
  }
  return restored;
}
