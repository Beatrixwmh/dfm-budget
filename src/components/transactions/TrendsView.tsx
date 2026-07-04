import { CategorySpendingChart } from './CategorySpendingChart';
import { SpendingVsBudgetChart } from './SpendingVsBudgetChart';
import { CashEventsChart } from '../charts/CashEventsChart';
import { useDfmEngine } from '../../hooks/useDfmEngine';
import { useAppState } from '../../store/hooks';

export function TrendsView() {
  const result = useDfmEngine();
  const { goals } = useAppState();
  const dailySavingsRate = goals
    .filter(g => g.status === 'active')
    .reduce((s, g) => s + g.contributionRatePerDay, 0);

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
