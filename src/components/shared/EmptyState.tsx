interface Props {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = '📋', title, description, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="mb-3 text-4xl">{icon}</span>
      <h3 className="mb-1 text-lg font-medium text-text-secondary">{title}</h3>
      {description && <p className="mb-4 text-sm text-text-muted">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
