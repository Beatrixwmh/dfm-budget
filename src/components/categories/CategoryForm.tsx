import { useState } from 'react';
import type { Category } from '../../engine/types';
import { Modal } from '../shared/Modal';
import { ColorPicker } from '../shared/ColorPicker';
import { generateId } from '../../utils/id';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (category: Category) => void;
  initial?: Category;
}

export function CategoryForm({ open, onClose, onSave, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#3b82f6');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? generateId(),
      name: name.trim(),
      color,
      sortOrder: initial?.sortOrder ?? 0,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Category' : 'New Category'}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Housing, Food, Transport"
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <ColorPicker value={color} onChange={setColor} />

        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="mt-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {initial ? 'Save Changes' : 'Add Category'}
        </button>
      </div>
    </Modal>
  );
}
