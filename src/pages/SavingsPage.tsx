import { useState } from 'react';
import { useAppState, useAppDispatch } from '../store/hooks';
import { useDfmEngine } from '../hooks/useDfmEngine';
import { GoalForm } from '../components/savings/GoalForm';
import { GoalCard } from '../components/savings/GoalCard';
import { EmptyState } from '../components/shared/EmptyState';
import { formatCurrency } from '../utils/format';
import type { Goal } from '../engine/types';

export function SavingsPage() {
  const { goals } = useAppState();
  const engine = useDfmEngine();
  const dispatch = useAppDispatch();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>();

  const savingsFrozen = engine?.savingsFrozen ?? false;
  const totalVaulted = goals.reduce((sum, g) => sum + g.accumulatedTotal, 0);
  const activeGoals = goals.filter(g => g.status === 'active');
  const pausedGoals = goals.filter(g => g.status === 'paused');

  const handleSave = (goal: Goal) => {
    if (editing) {
      dispatch({ type: 'UPDATE_GOAL', payload: goal });
    } else {
      dispatch({ type: 'ADD_GOAL', payload: goal });
    }
    setEditing(undefined);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Savings</h2>
          {goals.length > 0 && (
            <p className="text-sm text-text-muted">
              Total vaulted: <span className="font-medium text-accent">{formatCurrency(totalVaulted)}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => { setEditing(undefined); setFormOpen(true); }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + New Goal
        </button>
      </div>

      {/* Auto-freeze banner when underwater */}
      {savingsFrozen && activeGoals.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm font-medium text-warning">Contributions auto-frozen</p>
          <p className="mt-1 text-sm text-text-secondary">
            Your spendable balance is below your safety buffer, so there's no room to add to
            savings right now. Your goals are held in place — they'll resume contributing
            automatically once you have surplus again. Add income or reduce expenses to recover.
          </p>
        </div>
      )}

      {goals.length === 0 ? (
        <EmptyState
          icon="🏦"
          title="No savings goals yet"
          description="Create a goal to start saving — set a target or save continuously."
          actionLabel="Create Goal"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              {activeGoals.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  frozen={savingsFrozen}
                  onEdit={() => { setEditing(g); setFormOpen(true); }}
                />
              ))}
            </div>
          )}

          {pausedGoals.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Paused</p>
              <div className="space-y-3">
                {pausedGoals.map(g => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    onEdit={() => { setEditing(g); setFormOpen(true); }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {formOpen && (
        <GoalForm
          key={editing?.id ?? 'new'}
          open
          onClose={() => { setFormOpen(false); setEditing(undefined); }}
          onSave={handleSave}
          initial={editing}
        />
      )}
    </div>
  );
}
