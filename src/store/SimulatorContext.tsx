import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { Hypothetical } from '../engine/hypotheticals';

export type { Hypothetical };

interface SimulatorState {
  hypotheticals: Hypothetical[];
  add: (h: Hypothetical) => void;
  remove: (id: string) => void;
  clear: () => void;
}

// In-memory only, on purpose: closing the app discards hypotheticals (the spec's
// "no persistent side effects"), but living in context — not page state — means
// tab-switching to the dashboard and back keeps the scenario intact.
const SimulatorCtx = createContext<SimulatorState>({
  hypotheticals: [],
  add: () => {},
  remove: () => {},
  clear: () => {},
});

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [hypotheticals, setHypotheticals] = useState<Hypothetical[]>([]);

  const add = useCallback((h: Hypothetical) => setHypotheticals(prev => [...prev, h]), []);
  const remove = useCallback(
    (id: string) => setHypotheticals(prev => prev.filter(h => h.id !== id)),
    []
  );
  const clear = useCallback(() => setHypotheticals([]), []);

  const value = useMemo(
    () => ({ hypotheticals, add, remove, clear }),
    [hypotheticals, add, remove, clear]
  );

  return <SimulatorCtx value={value}>{children}</SimulatorCtx>;
}

export function useSimulator() {
  return useContext(SimulatorCtx);
}
