import { useMemo } from 'react';
import { useAppState } from '../store/hooks';
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
  /** True when goals want to contribute but there's no spendable room (underwater). */
  savingsFrozen: boolean;
}

export function useDfmEngine(): DfmEngineOutput | null {
  const state = useAppState();

  return useMemo(() => {
    if (state.incomeSources.length === 0 && state.expenses.length === 0) {
      return null;
    }

    const today = new Date();
    const overdueHoldTotal = state.overdueHolds.reduce((sum, h) => sum + h.amount, 0);
    const effectiveBalance = computeEffectiveBalance(
      state.balance.currentBalance,
      state.overdueHolds
    );

    const allEvents = generateCashEvents(
      state.incomeSources,
      state.expenses,
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
    const events = paidOccurrences.size === 0
      ? allEvents
      : allEvents.filter(e => !paidOccurrences.has(`${e.sourceId}|${e.date}`));

    // Vaulted savings is LOCKED — not available for daily spending. So DFM (spending +
    // new-savings capacity) is computed on the SPENDABLE balance = effective - vault.
    // This guarantees balance - vault = spendable >= buffer (balance never dips below vault).
    const savings0 = state.goals.reduce((sum, g) => sum + g.accumulatedTotal, 0);
    const spendableBalance = effectiveBalance - savings0;

    // rawDfm.projectedBalances is now the SPENDABLE trajectory (starts at spendableBalance).
    const rawDfm = calculateDfm(
      spendableBalance,
      state.buffer,
      events,
      today
    );

    // New savings going forward draws from the same capacity as spending.
    const activeGoals = state.goals.filter(g => g.status === 'active' && g.contributionRatePerDay > 0);
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

    const savingsTotal = savings0;

    const barBreakdown = calculateBarBreakdown(
      effectiveBalance,
      dfm.dailyFreeMoney,
      state.buffer,
      events,
      state.categories,
      todayString(),
      overdueHoldTotal,
      state.transactions,
      savingsTotal
    );

    const incomeEventDates = new Set(
      events.filter(e => e.amount > 0).map(e => e.date)
    );

    // Active goals want to contribute but there's no spendable room → frozen.
    const savingsFrozen = totalSavingsRate > 0 && cappedSavings <= 0;

    return { dfm, events, barBreakdown, incomeEventDates, effectiveBalance, overdueHoldTotal, savingsFrozen };
  }, [state]);
}
