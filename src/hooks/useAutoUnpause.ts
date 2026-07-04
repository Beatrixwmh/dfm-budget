import { useState, useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../store/hooks';
import { useDfmEngine } from './useDfmEngine';
import { validateContribution } from '../engine/savings';
import { todayString } from '../utils/format';
import type { Goal } from '../engine/types';

export interface UnpausePrompt {
  goal: Goal;
  kind: 'feasible_resumed' | 'breach' | 'no_surplus';
  maxRate?: number;
  newUnpauseDate?: string;
}

export function useAutoUnpause() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const engine = useDfmEngine();
  const hasRun = useRef(false);
  const [prompts, setPrompts] = useState<UnpausePrompt[]>([]);

  useEffect(() => {
    if (hasRun.current || !engine) return;
    hasRun.current = true;

    const today = todayString();
    const pending: UnpausePrompt[] = [];
    const rawDfm = engine.dfm.rawDfm;

    for (const goal of state.goals) {
      if (goal.status !== 'paused' || !goal.autoUnpauseDate) continue;
      if (goal.autoUnpauseDate > today) continue;

      const validation = validateContribution(rawDfm, goal.contributionRatePerDay);

      if (validation.feasible) {
        dispatch({
          type: 'UPDATE_GOAL',
          payload: { ...goal, status: 'active', autoUnpauseDate: undefined },
        });
      } else if (validation.maxRate > 0) {
        pending.push({
          goal,
          kind: 'breach',
          maxRate: validation.maxRate,
        });
      } else {
        pending.push({
          goal,
          kind: 'no_surplus',
        });
      }
    }

    if (pending.length > 0) setPrompts(pending);
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissPrompt = (goalId: string) => {
    setPrompts(p => p.filter(pr => pr.goal.id !== goalId));
  };

  const extendPause = (goalId: string) => {
    const prompt = prompts.find(p => p.goal.id === goalId);
    if (!prompt) return;
    dispatch({
      type: 'UPDATE_GOAL',
      payload: { ...prompt.goal, autoUnpauseDate: undefined },
    });
    dismissPrompt(goalId);
  };

  const resumeAtLowerRate = (goalId: string) => {
    const prompt = prompts.find(p => p.goal.id === goalId);
    if (!prompt || !prompt.maxRate) return;
    dispatch({
      type: 'UPDATE_GOAL',
      payload: {
        ...prompt.goal,
        status: 'active',
        autoUnpauseDate: undefined,
        contributionRatePerDay: prompt.maxRate,
      },
    });
    dismissPrompt(goalId);
  };

  const extendToDate = (goalId: string, newDate: string) => {
    const prompt = prompts.find(p => p.goal.id === goalId);
    if (!prompt) return;
    dispatch({
      type: 'UPDATE_GOAL',
      payload: { ...prompt.goal, autoUnpauseDate: newDate },
    });
    dismissPrompt(goalId);
  };

  return { prompts, dismissPrompt, extendPause, resumeAtLowerRate, extendToDate };
}
