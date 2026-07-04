import { useState } from 'react';
import type { IncomeSource } from '../../engine/types';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { IncomeForm } from './IncomeForm';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';
import { formatCurrency, formatRecurrence, formatDayOfWeek, formatDayOfMonth } from '../../utils/format';

export function IncomePanel() {
  const { incomeSources } = useAppState();
  const dispatch = useAppDispatch();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeSource | undefined>();
  const [deleting, setDeleting] = useState<IncomeSource | null>(null);

  const handleSave = (income: IncomeSource) => {
    if (editing) {
      dispatch({ type: 'UPDATE_INCOME', payload: income });
    } else {
      dispatch({ type: 'ADD_INCOME', payload: income });
    }
    setEditing(undefined);
  };

  const handleDelete = () => {
    if (deleting) {
      dispatch({ type: 'DELETE_INCOME', payload: deleting.id });
      setDeleting(null);
    }
  };

  const scheduleLabel = (inc: IncomeSource) => {
    const s = inc.schedule;
    const base = formatRecurrence(s.interval, s.unit);
    if (s.unit === 'week' && s.dayOfWeek !== null) return `${base} on ${formatDayOfWeek(s.dayOfWeek)}`;
    if (s.dayOfMonth !== null) return `${base} on the ${formatDayOfMonth(s.dayOfMonth)}`;
    return base;
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Income Sources</h3>
        <button
          onClick={() => { setEditing(undefined); setFormOpen(true); }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Add
        </button>
      </div>

      {incomeSources.length === 0 ? (
        <EmptyState
          icon="💰"
          title="No income sources"
          description="Add your income to calculate your daily spending budget."
          actionLabel="Add Income"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {incomeSources.map(inc => (
            <div
              key={inc.id}
              className="flex items-center justify-between rounded-xl bg-surface-raised p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{inc.name}</span>
                  {inc.isVariable && (
                    <span className="rounded bg-warning-dim px-1.5 py-0.5 text-xs text-warning">~est</span>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-text-secondary">
                  {formatCurrency(inc.amount)} &middot; {scheduleLabel(inc)}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(inc); setFormOpen(true); }}
                  className="text-sm text-text-muted hover:text-accent"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleting(inc)}
                  className="text-sm text-text-muted hover:text-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <IncomeForm
          key={editing?.id ?? 'new'}
          open
          onClose={() => { setFormOpen(false); setEditing(undefined); }}
          onSave={handleSave}
          initial={editing}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete Income Source"
        message={`Delete "${deleting?.name}"? This will affect your DFM calculation.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
