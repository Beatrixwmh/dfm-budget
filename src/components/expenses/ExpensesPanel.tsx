import { useState } from 'react';
import type { Expense } from '../../engine/types';
import { TIER_LABELS } from '../../engine/types';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { ExpenseForm } from './ExpenseForm';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';
import { formatCurrency, formatRecurrence, formatDayOfMonth, formatDayOfWeek } from '../../utils/format';

export function ExpensesPanel() {
  const { expenses, categories } = useAppState();
  const dispatch = useAppDispatch();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const handleSave = (expense: Expense) => {
    if (editing) {
      dispatch({ type: 'UPDATE_EXPENSE', payload: expense });
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload: expense });
    }
    setEditing(undefined);
  };

  const handleDelete = () => {
    if (deleting) {
      dispatch({ type: 'DELETE_EXPENSE', payload: deleting.id });
      setDeleting(null);
    }
  };

  const scheduleLabel = (exp: Expense) => {
    if (exp.type === 'one_time') return 'One-time';
    if (!exp.schedule) return '';
    const s = exp.schedule;
    const base = formatRecurrence(s.interval, s.unit);
    if (s.unit === 'week' && s.dayOfWeek !== null) return `${base} on ${formatDayOfWeek(s.dayOfWeek)}`;
    if (s.dayOfMonth !== null) return `${base} on the ${formatDayOfMonth(s.dayOfMonth)}`;
    return base;
  };

  // Group by category
  const grouped = new Map<string, Expense[]>();
  const uncategorized: Expense[] = [];

  for (const exp of expenses) {
    if (exp.categoryId && categoryMap.has(exp.categoryId)) {
      const list = grouped.get(exp.categoryId) ?? [];
      list.push(exp);
      grouped.set(exp.categoryId, list);
    } else {
      uncategorized.push(exp);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Expenses</h3>
        <button
          onClick={() => { setEditing(undefined); setFormOpen(true); }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Add
        </button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No expenses yet"
          description="Add your bills, subscriptions, and recurring costs."
          actionLabel="Add Expense"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(grouped.entries()).map(([catId, exps]) => {
            const cat = categoryMap.get(catId)!;
            return (
              <div key={catId}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium text-text-secondary">{cat.name}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {exps.map(exp => (
                    <ExpenseRow
                      key={exp.id}
                      expense={exp}
                      scheduleLabel={scheduleLabel(exp)}
                      onEdit={() => { setEditing(exp); setFormOpen(true); }}
                      onDelete={() => setDeleting(exp)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {uncategorized.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium text-text-muted">Uncategorized</div>
              <div className="flex flex-col gap-1.5">
                {uncategorized.map(exp => (
                  <ExpenseRow
                    key={exp.id}
                    expense={exp}
                    scheduleLabel={scheduleLabel(exp)}
                    onEdit={() => { setEditing(exp); setFormOpen(true); }}
                    onDelete={() => setDeleting(exp)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {formOpen && (
        <ExpenseForm
          key={editing?.id ?? 'new'}
          open
          onClose={() => { setFormOpen(false); setEditing(undefined); }}
          onSave={handleSave}
          initial={editing}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete Expense"
        message={`Delete "${deleting?.name}"? This will affect your DFM calculation.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

const TIER_COLORS = ['text-danger', 'text-warning', 'text-accent', 'text-text-muted'] as const;

function ExpenseRow({
  expense,
  scheduleLabel,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  scheduleLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl bg-surface-raised p-4 ${expense.isAutoCut ? 'opacity-50' : ''}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{expense.name}</span>
          {expense.isVariable && (
            <span className="rounded bg-warning-dim px-1.5 py-0.5 text-xs text-warning">~est</span>
          )}
          {expense.type === 'subscription' && (
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent">sub</span>
          )}
          {expense.isAutoCut && (
            <span className="rounded bg-danger/20 px-1.5 py-0.5 text-xs text-danger">cut</span>
          )}
          <span className={`text-xs ${TIER_COLORS[expense.tier]}`}>
            T{expense.tier}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-text-secondary">
          {formatCurrency(expense.amount)} &middot; {scheduleLabel}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onEdit} className="text-sm text-text-muted hover:text-accent">Edit</button>
        <button onClick={onDelete} className="text-sm text-text-muted hover:text-danger">Delete</button>
      </div>
    </div>
  );
}
