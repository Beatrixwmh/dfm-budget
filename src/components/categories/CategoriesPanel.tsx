import { useState } from 'react';
import type { Category } from '../../engine/types';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { CategoryForm } from './CategoryForm';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';

export function CategoriesPanel() {
  const { categories } = useAppState();
  const dispatch = useAppDispatch();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();
  const [deleting, setDeleting] = useState<Category | null>(null);

  const handleSave = (category: Category) => {
    if (editing) {
      dispatch({ type: 'UPDATE_CATEGORY', payload: category });
    } else {
      dispatch({ type: 'ADD_CATEGORY', payload: { ...category, sortOrder: categories.length } });
    }
    setEditing(undefined);
  };

  const handleDelete = () => {
    if (deleting) {
      dispatch({ type: 'DELETE_CATEGORY', payload: deleting.id });
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Categories</h3>
        <button
          onClick={() => { setEditing(undefined); setFormOpen(true); }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Add
        </button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="No categories yet"
          description="Categories help organize your expenses. Add some to get started."
          actionLabel="Add Category"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map(cat => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-xl bg-surface-raised p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="font-medium">{cat.name}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(cat); setFormOpen(true); }}
                  className="text-sm text-text-muted hover:text-accent"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleting(cat)}
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
        <CategoryForm
          key={editing?.id ?? 'new'}
          open
          onClose={() => { setFormOpen(false); setEditing(undefined); }}
          onSave={handleSave}
          initial={editing}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete Category"
        message={`Delete "${deleting?.name}"? Expenses in this category will become uncategorized.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
