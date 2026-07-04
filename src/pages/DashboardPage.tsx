import { useState } from 'react';
import { useDfmEngine } from '../hooks/useDfmEngine';
import { useAppState } from '../store/hooks';
import { formatCurrency } from '../utils/format';
import { ProjectedBalanceChart } from '../components/charts/ProjectedBalanceChart';
import { BarBreakdownChart } from '../components/charts/BarBreakdownChart';
import { CashEventsChart } from '../components/charts/CashEventsChart';
import { UpcomingExpensesCard } from '../components/upcoming/UpcomingExpensesCard';
import { QuickAddExpenseModal } from '../components/transactions/QuickAddExpenseModal';

export function DashboardPage() {
  const result = useDfmEngine();
  const { buffer, goals } = useAppState();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <span className="mb-3 text-5xl">◎</span>
        <h2 className="mb-2 text-2xl font-bold">Daily Free Money</h2>
        <p className="text-text-secondary">
          Add your income and expenses in the Plan tab to see your daily budget.
        </p>
      </div>
    );
  }

  const { dfm, events, barBreakdown, incomeEventDates } = result;
  const isNegative = dfm.dailyFreeMoney < 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Balance bar + DFM at top */}
      <div className="rounded-xl bg-surface-raised p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-secondary">Balance Breakdown</h3>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-text-muted">DFM</span>
            <span className={`text-lg font-bold ${isNegative ? 'text-danger' : 'text-success'}`}>
              {formatCurrency(dfm.dailyFreeMoney)}
            </span>
            <span className="text-xs text-text-muted">/day</span>
          </div>
        </div>
        <BarBreakdownChart
          segments={barBreakdown.segments}
          totalBalance={barBreakdown.totalBalance}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-overlay p-2.5 text-center">
            <p className="text-xs text-text-muted">Weekly</p>
            <p className={`text-sm font-semibold ${isNegative ? 'text-danger' : 'text-text-primary'}`}>
              {formatCurrency(dfm.dailyFreeMoney * 7)}
            </p>
          </div>
          <div className="rounded-lg bg-surface-overlay p-2.5 text-center">
            <p className="text-xs text-text-muted">Monthly</p>
            <p className={`text-sm font-semibold ${isNegative ? 'text-danger' : 'text-text-primary'}`}>
              {formatCurrency(dfm.dailyFreeMoney * 30)}
            </p>
          </div>
        </div>
      </div>

      {/* Upcoming Expenses + Quick-Add */}
      <div className="space-y-3">
        <UpcomingExpensesCard />
        <button
          onClick={() => setShowQuickAdd(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-success py-3 text-sm font-medium text-success transition-colors hover:bg-success/10"
        >
          <span className="text-lg leading-none">+</span>
          Log Unplanned Expense
        </button>
      </div>

      {/* Projected Balance (pinch point shown as dot on chart) */}
      <div className="rounded-xl bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-medium text-text-secondary">Projected Balance</h3>
        <ProjectedBalanceChart
          balances={dfm.projectedBalances}
          buffer={buffer}
          dfmPerDay={dfm.dailyFreeMoney}
          incomeEventDates={incomeEventDates}
          segments={dfm.segments}
          goals={goals}
        />
      </div>

      {/* Cash Flow */}
      <div className="rounded-xl bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-medium text-text-secondary">Cash Flow</h3>
        <CashEventsChart
          events={events}
          dailySavingsRate={goals.filter(g => g.status === 'active').reduce((s, g) => s + g.contributionRatePerDay, 0)}
        />
      </div>

      <QuickAddExpenseModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
    </div>
  );
}
