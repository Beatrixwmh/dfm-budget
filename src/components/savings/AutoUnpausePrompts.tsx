import { Modal } from '../shared/Modal';
import { formatCurrency, formatDate } from '../../utils/format';
import type { UnpausePrompt } from '../../hooks/useAutoUnpause';

interface Props {
  prompts: UnpausePrompt[];
  onExtendPause: (goalId: string) => void;
  onResumeAtLower: (goalId: string) => void;
  onDismiss: (goalId: string) => void;
  onExtendToDate: (goalId: string, date: string) => void;
}

const CADENCE_MULTIPLIERS: Record<string, number> = {
  weekly: 7, biweekly: 14, monthly: 30.44,
};

export function AutoUnpausePrompts({ prompts, onExtendPause, onResumeAtLower, onDismiss, onExtendToDate }: Props) {
  if (prompts.length === 0) return null;

  const prompt = prompts[0]; // show one at a time
  const { goal, kind } = prompt;

  if (kind === 'breach') {
    const maxPerCadence = (prompt.maxRate ?? 0) * CADENCE_MULTIPLIERS[goal.cadence];
    return (
      <Modal open title={`Resume "${goal.name}"?`} onClose={() => onExtendPause(goal.id)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Your goal "{goal.name}" was set to resume {formatDate(goal.autoUnpauseDate!)},
            but resuming at the full rate would put you below your safety buffer.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onExtendPause(goal.id)}
              className="rounded-lg bg-surface-overlay py-2.5 text-sm font-medium text-text-primary hover:bg-surface-raised"
            >
              Extend the pause
            </button>
            <button
              onClick={() => onResumeAtLower(goal.id)}
              className="rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Lower contribution to {formatCurrency(maxPerCadence)}/{goal.cadence} and resume
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (kind === 'no_surplus') {
    if (prompt.newUnpauseDate) {
      return (
        <Modal open title={`"${goal.name}" still paused`} onClose={() => onExtendToDate(goal.id, prompt.newUnpauseDate!)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Your goal "{goal.name}" was set to resume {formatDate(goal.autoUnpauseDate!)},
              but based on your current finances, the earliest you can resume contributing
              without dropping below the buffer is <strong>{formatDate(prompt.newUnpauseDate!)}</strong>.
            </p>
            <p className="text-sm text-text-secondary">
              The auto-resume date has been extended.
            </p>
            <button
              onClick={() => onExtendToDate(goal.id, prompt.newUnpauseDate!)}
              className="rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              OK
            </button>
          </div>
        </Modal>
      );
    } else {
      return (
        <Modal open title={`"${goal.name}" paused`} onClose={() => onDismiss(goal.id)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Goal is paused — based on your current finances, there is no upcoming date where
              you will have room to contribute without dropping below the buffer. You can resume manually anytime.
            </p>
            <button
              onClick={() => {
                onExtendPause(goal.id);
              }}
              className="rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              OK
            </button>
          </div>
        </Modal>
      );
    }
  }

  return null;
}
