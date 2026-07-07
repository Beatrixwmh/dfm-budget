import { CategorySpendingChart } from './CategorySpendingChart';
import { SpendingVsBudgetChart } from './SpendingVsBudgetChart';
import { CashEventsChart } from '../charts/CashEventsChart';
import { useDfmEngine } from '../../hooks/useDfmEngine';

export function TrendsView() {
  const result = useDfmEngine();
  // The throttled rate the engine actually applies — not the sum of goal
  // rates, which can exceed real capacity.
  const dailySavingsRate = result?.appliedSavingsRate ?? 0;

  return (
    <div className="space-y-4">
      {result && (
        <div className="rounded-xl bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-medium text-text-secondary">Upcoming Cash Flow</h3>
          <CashEventsChart events={result.events} dailySavingsRate={dailySavingsRate} />
        </div>
      )}
      <CategorySpendingChart />
      <SpendingVsBudgetChart />
    </div>
  );
}
