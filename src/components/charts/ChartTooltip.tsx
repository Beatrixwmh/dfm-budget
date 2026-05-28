import type { ReactNode } from 'react';

interface ChartTooltipProps {
  active?: boolean;
  children?: ReactNode;
}

export function ChartTooltipShell({ active, children }: ChartTooltipProps) {
  if (!active) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm shadow-lg">
      {children}
    </div>
  );
}
