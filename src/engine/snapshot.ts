import type { AppState, CashEvent, DfmResult, BarBreakdown } from './types';
import { generateCashEvents } from './eventGenerator';
import { calculateDfm, maxSpendToday } from './dfm';
import { calculateBarBreakdown } from './barChart';
import { computeEffectiveBalance } from './effectiveBalance';
import { toDateKey } from './holidays';

export interface SnapshotOptions {
  /** Hypothetical events to merge into the stream (simulator scenarios). */
  extraEvents?: CashEvent[];
  /** Expenses to treat as removed (deficit-mode cut previews). */
  excludeExpenseIds?: Set<string>;
  /** Auto-cut expenses to treat as restored (deficit-mode restore previews). */
  includeCutIds?: Set<string>;
  /** Compute as if all savings contributions were paused (deficit lever preview). */
  pauseAllSavings?: boolean;
}

export interface DfmSnapshot {
  dfm: DfmResult;
  events: CashEvent[];
  barBreakdown: BarBreakdown;
  incomeEventDates: Set<string>;
  effectiveBalance: number;
  overdueHoldTotal: number;
  /** True when goals want to contribute but there's no spendable room (underwater). */
  savingsFrozen: boolean;
  /** Max one-time spend today that never breaches the buffer (aggressive / cushion money). */
  maxSplurge: number;
}

/**
 * The full DFM pipeline as a pure function, so it can run speculatively —
 * the simulator runs it with extra hypothetical events, deficit mode runs it
 * with expenses excluded or savings paused — without duplicating any math.
 * useDfmEngine is a thin memoized wrapper around this.
 */
export function computeSnapshot(
  state: AppState,
  today: Date,
  opts: SnapshotOptions = {}
): DfmSnapshot | null {
  if (state.incomeSources.length === 0 && state.expenses.length === 0) {
    return null;
  }

  const todayKey = toDateKey(today);
  const overdueHoldTotal = state.overdueHolds.reduce((sum, h) => sum + h.amount, 0);
  const effectiveBalance = computeEffectiveBalance(
    state.balance.currentBalance,
    state.overdueHolds
  );

  // Deficit-cut expenses are excluded from the timeline (that's what "cut"
  // means financially) unless a restore preview explicitly re-includes them.
  const expenses = state.expenses.filter(e => {
    if (opts.excludeExpenseIds?.has(e.id)) return false;
    if (e.isAutoCut && !opts.includeCutIds?.has(e.id)) return false;
    return true;
  });

  const allEvents = generateCashEvents(
    state.incomeSources,
    expenses,
    today,
    state.customHolidays
  );

  // Drop expense occurrences that have already been paid (e.g. paid early) — the
  // money already left the balance, so keeping the future occurrence would
  // double-count it and tank the DFM.
  const paidOccurrences = new Set<string>();
  for (const tx of state.transactions) {
    if (tx.expenseId && tx.dueDate) paidOccurrences.add(`${tx.expenseId}|${tx.dueDate}`);
  }
  let events = paidOccurrences.size === 0
    ? allEvents
    : allEvents.filter(e => !paidOccurrences.has(`${e.sourceId}|${e.date}`));

  // Merge hypothetical events, keeping the stream date-sorted (the bar
  // breakdown's next-income scan relies on chronological order).
  if (opts.extraEvents && opts.extraEvents.length > 0) {
    events = [...events, ...opts.extraEvents].sort((a, b) => a.date.localeCompare(b.date));
  }

  // Vaulted savings is LOCKED — not available for daily spending. So DFM (spending +
  // new-savings capacity) is computed on the SPENDABLE balance = effective - vault.
  // This guarantees balance - vault = spendable >= buffer (balance never dips below vault).
  const savings0 = state.goals.reduce((sum, g) => sum + g.accumulatedTotal, 0);
  const spendableBalance = effectiveBalance - savings0;

  // rawDfm.projectedBalances is the SPENDABLE trajectory (starts at spendableBalance).
  const rawDfm = calculateDfm(
    spendableBalance,
    state.buffer,
    events,
    today
  );

  // New savings going forward draws from the same capacity as spending.
  const activeGoals = opts.pauseAllSavings
    ? []
    : state.goals.filter(g => g.status === 'active' && g.contributionRatePerDay > 0);
  const totalSavingsRate = activeGoals.reduce((sum, g) => sum + g.contributionRatePerDay, 0);

  // New savings capped at rawDfm capacity, so spending DFM >= 0
  const cappedSavings = Math.min(totalSavingsRate, Math.max(0, rawDfm.rawDfm));
  const floor = Math.min(0, rawDfm.dailyFreeMoney);

  // Simulate each goal's vault day-by-day so a target goal lands EXACTLY on its
  // target (no off-by-one shortfall, no overshoot) and then stops contributing.
  const goalSim = activeGoals.map(g => ({
    rate: g.contributionRatePerDay,
    saved: g.accumulatedTotal,
    target: g.type === 'target' && g.targetAmount != null ? g.targetAmount : Infinity,
  }));

  // Build the TOTAL balance line = spendable(t) + vault(t), and the vault line.
  //   balance - vault = spendable (>= buffer) by construction, so they never cross.
  const totalBalances: typeof rawDfm.projectedBalances = [];
  let vault = savings0;
  for (let t = 0; t < rawDfm.projectedBalances.length; t++) {
    const sp = rawDfm.projectedBalances[t];
    if (t > 0) {
      // Desired rate = goals still short of their target.
      const desiredRate = goalSim.reduce((s, gs) => s + (gs.saved < gs.target ? gs.rate : 0), 0);
      // Throttle to what's affordable (capped at rawDfm).
      const capped = totalSavingsRate > 0 ? desiredRate * (cappedSavings / totalSavingsRate) : 0;
      // Distribute across active goals, clipping each at its remaining room to target.
      if (desiredRate > 0) {
        for (const gs of goalSim) {
          if (gs.saved >= gs.target) continue;
          const add = Math.min((gs.rate / desiredRate) * capped, gs.target - gs.saved);
          gs.saved += add;
          vault += add;
        }
      }
    }
    totalBalances.push({
      date: sp.date,
      balance: sp.balance + vault,
      rawBalance: sp.rawBalance + savings0,
      savings: vault,
    });
  }

  const dfm: DfmResult = {
    ...rawDfm,
    dailyFreeMoney: Math.max(floor, rawDfm.dailyFreeMoney - cappedSavings),
    sustainableRate: rawDfm.sustainableRate - cappedSavings,
    projectedBalances: totalBalances,
    segments: rawDfm.segments.map(s => ({
      ...s,
      rate: Math.max(Math.min(0, s.rate), s.rate - cappedSavings),
      nextRate: s.nextRate !== null
        ? Math.max(Math.min(0, s.nextRate), s.nextRate - cappedSavings)
        : null,
    })),
  };

  const barBreakdown = calculateBarBreakdown(
    effectiveBalance,
    dfm.dailyFreeMoney,
    state.buffer,
    events,
    state.categories,
    todayKey,
    overdueHoldTotal,
    state.transactions,
    savings0
  );

  const incomeEventDates = new Set(
    events.filter(e => e.amount > 0).map(e => e.date)
  );

  // Active goals want to contribute but there's no spendable room → frozen.
  const savingsFrozen = totalSavingsRate > 0 && cappedSavings <= 0;

  // Cushion money: max one-time spend today keeping spendable >= buffer at every
  // future t. Ignores savings contributions — a full splurge auto-freezes them.
  const maxSplurge = maxSpendToday(spendableBalance, state.buffer, events, today);

  return { dfm, events, barBreakdown, incomeEventDates, effectiveBalance, overdueHoldTotal, savingsFrozen, maxSplurge };
}
