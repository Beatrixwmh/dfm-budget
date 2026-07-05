import { useEffect, useMemo, useState } from 'react';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { useDfmEngine } from '../../hooks/useDfmEngine';
import { planDeficit, simulateCuts, autoSelectCuts } from '../../engine/deficit';
import { Modal } from '../shared/Modal';
import { formatCurrency, formatDateWithWeekday } from '../../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DeficitResolutionModal({ open, onClose }: Props) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const baseline = useDfmEngine();

  const plan = useMemo(() => planDeficit(state, new Date()), [state]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revealedCount, setRevealedCount] = useState(1);

  // First-deficit tier warning: latched at mount so marking it seen (below)
  // doesn't reactively hide it mid-view. Shown once, ever.
  const [showTierWarning] = useState(() => !state.hasSeenDeficitWarning);
  useEffect(() => {
    if (open && showTierWarning) dispatch({ type: 'MARK_DEFICIT_WARNING_SEEN' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const projected = useMemo(
    () => (selected.size > 0 ? simulateCuts(state, new Date(), selected) : -plan.deficitPerDay),
    [state, selected, plan.deficitPerDay]
  );
  const resolved = projected >= 0;

  const visibleTiers = plan.tiers.slice(0, revealedCount);
  const nextTier = plan.tiers[revealedCount];
  const currentTierExhausted =
    visibleTiers.length > 0 &&
    visibleTiers[visibleTiers.length - 1].candidates.every(c => selected.has(c.expenseId));

  const nextPayday = baseline?.barBreakdown.nextIncomeDate ?? undefined;
  const hasActiveSavings = plan.pausableSavingsPerDay > 0;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAutoSelect = () => {
    const chosen = autoSelectCuts(state, new Date(), plan);
    setSelected(chosen);
    // Reveal every tier the auto-selection reached into.
    let tiersUsed = 0;
    for (let i = 0; i < plan.tiers.length; i++) {
      if (plan.tiers[i].candidates.some(c => chosen.has(c.expenseId))) tiersUsed = i + 1;
    }
    setRevealedCount(Math.max(1, tiersUsed));
  };

  const handlePauseSavings = () => {
    dispatch({ type: 'PAUSE_ACTIVE_GOALS', payload: { autoUnpauseDate: nextPayday } });
  };

  const handleApply = () => {
    if (selected.size === 0) { onClose(); return; }
    dispatch({ type: 'SET_AUTO_CUT', payload: { expenseIds: [...selected], isAutoCut: true } });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Get Back Above Water"
      footer={
        <button
          onClick={handleApply}
          disabled={selected.size === 0 || (!resolved && plan.resolvable)}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {selected.size === 0
            ? 'Select expenses to cut'
            : resolved
              ? `Cut ${selected.size} expense${selected.size > 1 ? 's' : ''}`
              : plan.resolvable
                ? 'Not enough freed yet'
                : `Cut ${selected.size} anyway (slows the bleed)`}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Shortfall summary */}
        <p className="text-sm text-text-secondary">
          Your plan runs about{' '}
          <span className="font-semibold text-danger">{formatCurrency(plan.neededPerMonth)}/month</span>{' '}
          short. Free up at least that much below.
        </p>

        {showTierWarning && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Heads up: new expenses default to Tier 2 (cuttable). Review your expense tiers in
            the Plan tab to protect anything important before cutting.
          </p>
        )}

        {/* Lever 1: headroom fact */}
        <div className="rounded-lg bg-surface-overlay px-3 py-2 text-xs text-text-secondary">
          Cushion above your buffer right now:{' '}
          <span className="font-semibold tabular-nums text-text-primary">
            {formatCurrency(plan.headroom)}
          </span>
          {plan.headroom < 1 && ' — nothing left to dip into.'}
        </div>

        {/* Lever 2: pause savings — always above tier cuts */}
        {hasActiveSavings && (
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Pause savings contributions</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {plan.savingsAlreadyFrozen
                    ? 'Already auto-frozen while you\'re under water — pausing makes it official and your goals stop counting on the money.'
                    : `The gentlest lever — frees ${formatCurrency(plan.pausableSavingsPerDay)}/day, and your saved money stays put.`}
                </p>
              </div>
              <button
                onClick={handlePauseSavings}
                className="shrink-0 rounded-lg bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-border"
              >
                {nextPayday ? `Pause until ${formatDateWithWeekday(nextPayday)}` : 'Pause'}
              </button>
            </div>
          </div>
        )}

        {/* Lever 3: tier cuts */}
        {plan.tiers.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-text-secondary">Cut expenses</h4>
              <button
                onClick={handleAutoSelect}
                className="text-xs text-accent hover:underline"
              >
                Auto-select for me
              </button>
            </div>

            <div className="space-y-3">
              {visibleTiers.map(({ tier, candidates }) => (
                <div key={tier}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                    Tier {tier} · {tier === 3 ? 'Nice to Have' : tier === 2 ? 'Important' : 'Must Pay'}
                  </p>
                  <div className="space-y-1">
                    {candidates.map(c => (
                      <label
                        key={c.expenseId}
                        className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-overlay px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(c.expenseId)}
                          onChange={() => toggle(c.expenseId)}
                          className="h-4 w-4 rounded accent-accent"
                        />
                        <span className="flex-1 truncate text-sm text-text-primary">{c.name}</span>
                        <span className="text-xs tabular-nums text-success">
                          +{formatCurrency(c.freedPerDay)}/day
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {currentTierExhausted && !resolved && nextTier && (
              <button
                onClick={() => setRevealedCount(c => c + 1)}
                className="mt-3 w-full rounded-lg border border-dashed border-border py-2 text-xs text-text-secondary hover:text-text-primary"
              >
                Cutting all of Tier {visibleTiers[visibleTiers.length - 1].tier} isn't enough —
                show Tier {nextTier.tier}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-muted">No cuttable expenses (everything is Tier 0).</p>
        )}

        {/* Running projection */}
        <div className="rounded-lg bg-surface-overlay px-3 py-2 text-sm">
          <span className="text-text-secondary">Daily allowance after cuts: </span>
          <span className={`font-semibold tabular-nums ${resolved ? 'text-success' : 'text-danger'}`}>
            {formatCurrency(projected)}/day
          </span>
        </div>

        {!plan.resolvable && (
          <p className="rounded-lg bg-danger-dim px-3 py-2 text-xs text-danger">
            Even cutting everything cuttable, you'd still be short — your Tier 0 obligations
            exceed your income. This needs more income, a balance top-up, or restructuring a
            Tier 0 expense.
          </p>
        )}
      </div>
    </Modal>
  );
}
