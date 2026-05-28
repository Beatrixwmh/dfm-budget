import { useState } from 'react';
import { CurrencyInput } from '../shared/CurrencyInput';
import { useAppDispatch } from '../../store/hooks';
import { todayString } from '../../utils/format';

interface Props {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: Props) {
  const dispatch = useAppDispatch();
  const [balance, setBalance] = useState(0);

  const handleSubmit = () => {
    dispatch({
      type: 'SET_BALANCE',
      payload: { currentBalance: balance, lastUpdated: todayString() },
    });
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-accent">DFM Budget</h1>
          <p className="text-text-secondary">How much money do you have right now?</p>
        </div>

        <div className="mb-8">
          <CurrencyInput
            value={balance}
            onChange={setBalance}
            label="Current Balance"
            autoFocus
          />
          <p className="mt-2 text-xs text-text-muted">
            Total across all accounts. You can update this anytime.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
