import { useMemo, useState } from 'react';
import { useAppState, useAppDispatch } from '../store/hooks';
import { useDfmEngine } from '../hooks/useDfmEngine';
import { useSimulator } from '../store/SimulatorContext';
import { computeSnapshot } from '../engine/snapshot';
import { planDeficit, autoSelectCuts } from '../engine/deficit';
import { hypotheticalEvents, hypotheticalToExpense } from '../engine/hypotheticals';
import { HypotheticalForm } from '../components/simulator/HypotheticalForm';
import { ProjectedBalanceChart } from '../components/charts/ProjectedBalanceChart';
import { formatCurrency, formatDate, formatRecurrence, todayString } from '../utils/format';

export function SimulatorPage() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const baseline = useDfmEngine();
  const { hypotheticals, add, remove, clear } = useSimulator();
  const [formOpen, setFormOpen] = useState(false);

  const scenario = useMemo(() => {
    if (!baseline || hypotheticals.length === 0) return null;
    const extraEvents = hypotheticalEvents(hypotheticals, new Date(), state.customHolidays);
    return computeSnapshot(state, new Date(), { extraEvents });
  }, [state, baseline, hypotheticals]);

  // When the scenario goes negative, preview the exact levers the deficit flow
  // would reach for — nothing here mutates anything.
  const deficitPreview = useMemo(() => {
    if (!scenario || scenario.dfm.dailyFreeMoney >= 0) return null;
    const opts = {
      extraEvents: hypotheticalEvents(hypotheticals, new Date(), state.customHolidays),
    };
    const plan = planDeficit(state, new Date(), opts);
    const cutIds = autoSelectCuts(state, new Date(), plan, opts);
    const cuts = [...cutIds]
      .map(id => {
        const e = state.expenses.find(x => x.id === id);
        return e ? { name: e.name, tier: e.tier } : null;
      })
      .filter(Boolean) as { name: string; tier: number }[];
    return { plan, cuts };
  }, [scenario, state, hypotheticals]);

  if (!baseline) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <span className="mb-3 text-5xl">⚡</span>
        <h2 className="mb-2 text-2xl font-bold">What-If Simulator</h2>
        <p className="text-text-secondary">
          Add your income and expenses in the Plan tab first — then test purchases here.
        </p>
      </div>
    );
  }

  const categoryMap = new Map(state.categories.map(c => [c.id, c]));

  const handleApply = (id: string) => {
    const hypo = hypotheticals.find(h => h.id === id);
    if (!hypo) return;
    dispatch({ type: 'ADD_EXPENSE', payload: hypotheticalToExpense(hypo, todayString()) });
    remove(id);
  };

  const handleApplyAll = () => {
    for (const hypo of hypotheticals) {
      dispatch({ type: 'ADD_EXPENSE', payload: hypotheticalToExpense(hypo, todayString()) });
    }
    clear();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">What-If Simulator</h2>
        {hypotheticals.length > 0 && (
          <button
            onClick={clear}
            className="text-sm text-text-muted hover:text-danger"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Baseline readout — useful even before any hypotheticals */}
      <div className="rounded-xl bg-surface-raised p-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <span className="text-sm text-text-secondary">Free to spend now: </span>
            <span className="font-semibold tabular-nums text-success">
              {formatCurrency(baseline.barBreakdown.freeToSpend)}
            </span>
          </div>
          <div>
            <span className="text-sm text-text-secondary">Splurge ceiling: </span>
            <span className="font-semibold tabular-nums text-text-primary">
              {formatCurrency(baseline.maxSplurge)}
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Add a hypothetical purchase below to see how these move before you commit to it.
        </p>
      </div>

      {/* Hypothetical cards */}
      <div className="space-y-2">
        {hypotheticals.map(h => {
          const cat = categoryMap.get(h.categoryId);
          return (
            <div key={h.id} className="flex items-center gap-3 rounded-xl bg-surface-raised p-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cat?.color ?? '#969cb0' }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{h.description}</p>
                <p className="text-xs text-text-muted">
                  {h.kind === 'one_time'
                    ? `One-time · ${formatDate(h.date)}`
                    : `${formatRecurrence(h.schedule!.interval, h.schedule!.unit)}`}
                </p>
              </div>
              <span className="tabular-nums text-sm font-semibold text-danger">
                −{formatCurrency(h.amount)}
              </span>
              <button
                onClick={() => handleApply(h.id)}
                className="rounded-lg bg-accent/15 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/25"
                title="Make this a real expense"
              >
                Apply
              </button>
              <button
                onClick={() => remove(h.id)}
                className="rounded-lg px-2 py-1.5 text-sm text-text-muted hover:text-danger"
                title="Remove from scenario"
              >
                ✕
              </button>
            </div>
          );
        })}

        <button
          onClick={() => setFormOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent py-3 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
        >
          <span className="text-lg leading-none">+</span>
          Add a hypothetical purchase
        </button>
      </div>

      {/* Impact panel */}
      {scenario && (
        <div className="rounded-xl bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-medium text-text-secondary">
            If you go ahead with {hypotheticals.length === 1 ? 'this' : `all ${hypotheticals.length}`}
          </h3>
          <div className="space-y-2">
            <DeltaRow
              label="Free to spend"
              before={baseline.barBreakdown.freeToSpend}
              after={scenario.barBreakdown.freeToSpend}
            />
            <DeltaRow
              label="Splurge ceiling"
              before={baseline.maxSplurge}
              after={scenario.maxSplurge}
            />
            <p className="text-xs text-text-muted">
              Daily allowance {formatCurrency(baseline.dfm.dailyFreeMoney)}/day →{' '}
              {formatCurrency(scenario.dfm.dailyFreeMoney)}/day
            </p>
          </div>

          <PinchShift
            before={baseline.dfm.pinchPointDate}
            after={scenario.dfm.pinchPointDate}
          />

          {scenario.savingsFrozen && !baseline.savingsFrozen && (
            <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              ⚠ This would freeze your savings contributions — there'd be no spare capacity
              to keep contributing.
            </p>
          )}

          {scenario.dfm.dailyFreeMoney < 0 && deficitPreview && (
            <div className="mt-3 rounded-lg bg-danger-dim px-3 py-2 text-xs">
              <p className="text-danger">
                This puts you in deficit — even spending nothing day-to-day, you'd breach your
                buffer{scenario.dfm.pinchPointDate ? ` around ${formatDate(scenario.dfm.pinchPointDate)}` : ''}.
              </p>
              <div className="mt-1.5 text-text-secondary">
                To stay solvent, you'd likely have to:
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {deficitPreview.plan.pausableSavingsPerDay > 0 && (
                    <li>
                      pause savings contributions ({formatCurrency(deficitPreview.plan.pausableSavingsPerDay)}/day)
                    </li>
                  )}
                  {deficitPreview.cuts.length > 0 && (
                    <li>
                      cut {deficitPreview.cuts.map(c => `${c.name} (T${c.tier})`).join(', ')}
                    </li>
                  )}
                  {!deficitPreview.plan.resolvable && (
                    <li>…and even that wouldn't fully cover it.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {hypotheticals.length > 1 && (
            <button
              onClick={handleApplyAll}
              className="mt-4 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Apply All as Real Expenses
            </button>
          )}
        </div>
      )}

      {/* Projection: baseline solid, scenario dashed */}
      <div className="rounded-xl bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-medium text-text-secondary">
          Projected Balance{scenario ? ' — current vs. scenario' : ''}
        </h3>
        <ProjectedBalanceChart
          balances={baseline.dfm.projectedBalances}
          buffer={state.buffer}
          dfmPerDay={baseline.dfm.dailyFreeMoney}
          incomeEventDates={baseline.incomeEventDates}
          segments={baseline.dfm.segments}
          goals={state.goals}
          goalCompletions={baseline.goalCompletions}
          scenarioBalances={scenario?.dfm.projectedBalances}
        />
      </div>

      {formOpen && (
        <HypotheticalForm open onClose={() => setFormOpen(false)} onAdd={add} />
      )}
    </div>
  );
}

function DeltaRow({ label, before, after }: { label: string; before: number; after: number }) {
  const delta = after - before;
  const deltaColor = delta < -0.5 ? 'text-danger' : delta > 0.5 ? 'text-success' : 'text-text-muted';
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="tabular-nums">
        <span className="text-text-muted">{formatCurrency(before)}</span>
        <span className="mx-1.5 text-text-muted">→</span>
        <span className="font-semibold text-text-primary">{formatCurrency(after)}</span>
        <span className={`ml-2 text-xs ${deltaColor}`}>
          ({delta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))})
        </span>
      </span>
    </div>
  );
}

function PinchShift({ before, after }: { before: string; after: string }) {
  if (before === after) return null;
  let text: string;
  if (!before && after) {
    text = `Creates a tight spot around ${formatDate(after)} that doesn't exist today.`;
  } else if (before && !after) {
    text = `Clears your current tight spot (${formatDate(before)}).`;
  } else {
    text = `Your tightest day moves from ${formatDate(before)} to ${formatDate(after)}.`;
  }
  return <p className="mt-3 text-xs text-text-secondary">{text}</p>;
}
