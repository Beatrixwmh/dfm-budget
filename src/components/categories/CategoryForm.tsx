import { useState } from 'react';
import type { Category } from '../../engine/types';
import { useAppState } from '../../store/hooks';
import { Modal } from '../shared/Modal';
import { ColorPicker, PRESET_COLORS } from '../shared/ColorPicker';
import { generateId } from '../../utils/id';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (category: Category) => void;
  initial?: Category;
}

export function CategoryForm({ open, onClose, onSave, initial }: Props) {
  const { categories } = useAppState();

  // Colors used by OTHER categories (the one being edited can keep its own color).
  const takenColors = categories.filter(c => c.id !== initial?.id).map(c => c.color);
  const takenSet = new Set(takenColors.map(c => c.toLowerCase()));
  const firstFree = PRESET_COLORS.find(c => !takenSet.has(c.toLowerCase())) ?? '#7d9fd4';

  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? firstFree);

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
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Category' : 'New Category'}
      footer={
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {initial ? 'Save Changes' : 'Add Category'}
        </button>
      }
    >
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

        <ColorPicker value={color} onChange={setColor} taken={takenColors} />
      </div>
    </Modal>
  );
}
