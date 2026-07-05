import { useMemo } from 'react';
import { useAppState } from '../store/hooks';
import { computeSnapshot, type DfmSnapshot } from '../engine/snapshot';

export type DfmEngineOutput = DfmSnapshot;

export function useDfmEngine(): DfmEngineOutput | null {
  const state = useAppState();
  return useMemo(() => computeSnapshot(state, new Date()), [state]);
}
