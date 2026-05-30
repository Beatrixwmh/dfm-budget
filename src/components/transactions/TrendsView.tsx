import { CategorySpendingChart } from './CategorySpendingChart';
import { SpendingVsBudgetChart } from './SpendingVsBudgetChart';

export function TrendsView() {
  return (
    <div className="space-y-4">
      <CategorySpendingChart />
      <SpendingVsBudgetChart />
    </div>
  );
}
