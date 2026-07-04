import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional sticky footer (e.g. the primary action). Stays visible outside the scroll area. */
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative z-10 flex max-h-[100dvh] w-full flex-col bg-surface-raised md:max-h-[90vh] md:max-w-lg md:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-2xl text-text-muted hover:text-text-primary">&times;</button>
        </div>
        <div className={`overflow-y-auto overflow-x-hidden px-5 py-4 ${footer ? '' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]'}`}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-border bg-surface-raised px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
