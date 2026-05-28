import { useState } from 'react';
import { useDfmEngine } from '../hooks/useDfmEngine';
import { useAppState } from '../store/hooks';
import { formatCurrency, formatDate } from '../utils/format';
import { ProjectedBalanceChart } from '../components/charts/ProjectedBalanceChart';
import { BarBreakdownChart } from '../components/charts/BarBreakdownChart';
import { CashEventsChart } from '../components/charts/CashEventsChart';
import { UpcomingExpensesCard } from '../components/upcoming/UpcomingExpensesCard';
import { QuickAddExpenseModal } from '../components/transactions/QuickAddExpenseModal';

export function DashboardPage() {
  const result = useDfmEngine();
  const { buffer } = useAppState();
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
      <div className="text-center">
        <p className="mb-1 text-sm text-text-secondary">Daily Free Money</p>
        <p className={`text-5xl font-bold ${isNegative ? 'text-danger' : 'text-success'}`}>
          {formatCurrency(dfm.dailyFreeMoney)}
        </p>
        <p className="mt-1 text-sm text-text-muted">/day</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-raised p-4 text-center">
          <p className="text-xs text-text-muted">Weekly</p>
          <p className={`text-lg font-semibold ${isNegative ? 'text-danger' : 'text-text-primary'}`}>
            {formatCurrency(dfm.dailyFreeMoney * 7)}
          </p>
        </div>
        <div className="rounded-xl bg-surface-raised p-4 text-center">
          <p className="text-xs text-text-muted">Monthly</p>
          <p className={`text-lg font-semibold ${isNegative ? 'text-danger' : 'text-text-primary'}`}>
            {formatCurrency(dfm.dailyFreeMoney * 30)}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-medium text-text-secondary">Pinch Point</h3>
        <p className="text-lg font-semibold">{formatDate(dfm.pinchPointDate)}</p>
        <p className="text-sm text-text-secondary">
          Projected balance: {formatCurrency(dfm.pinchPointBalance)}
        </p>
        {isNegative && (
          <div className="mt-3 rounded-lg bg-danger-dim p-3">
            <p className="text-sm text-danger">
              Even spending $0/day, you'll hit your buffer by {formatDate(dfm.pinchPointDate)}.
            </p>
          </div>
        )}
      </div>

      <UpcomingExpensesCard />

      <div className="rounded-xl bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-medium text-text-secondary">Projected Balance</h3>
        <ProjectedBalanceChart
          balances={dfm.projectedBalances}
          buffer={buffer}
          pinchPointDate={dfm.pinchPointDate}
          pinchPointBalance={dfm.pinchPointBalance}
          dfmPerDay={dfm.dailyFreeMoney}
          incomeEventDates={incomeEventDates}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-medium text-text-secondary">Balance Breakdown</h3>
          <BarBreakdownChart
            segments={barBreakdown.segments}
            totalBalance={barBreakdown.totalBalance}
          />
        </div>

        <div className="rounded-xl bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-medium text-text-secondary">Cash Flow</h3>
          <CashEventsChart events={events} />
        </div>
      </div>

      {/* Quick-add FAB */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white shadow-lg hover:bg-accent-hover md:bottom-6 md:right-6"
        aria-label="Log expense"
      >
        +
      </button>

      <QuickAddExpenseModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
    </div>
  );
}
