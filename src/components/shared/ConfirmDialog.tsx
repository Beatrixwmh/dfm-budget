interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative z-10 w-80 rounded-2xl bg-surface-raised p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="mb-6 text-sm text-text-secondary">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white hover:bg-danger/80"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
