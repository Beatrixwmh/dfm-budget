import { useState } from 'react';
import { useDfmEngine } from '../hooks/useDfmEngine';
import { useAppState } from '../store/hooks';
import { ProjectedBalanceChart } from '../components/charts/ProjectedBalanceChart';
import { BarBreakdownChart } from '../components/charts/BarBreakdownChart';
import { FreeMoneyHero } from '../components/dashboard/FreeMoneyHero';
import { UpcomingExpensesCard } from '../components/upcoming/UpcomingExpensesCard';
import { QuickAddExpenseModal } from '../components/transactions/QuickAddExpenseModal';
import { DeficitResolutionModal } from '../components/deficit/DeficitResolutionModal';

export function DashboardPage() {
  const result = useDfmEngine();
  const { buffer, goals } = useAppState();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showDeficitFix, setShowDeficitFix] = useState(false);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <span className="mb-3 text-5xl">◎</span>
        <h2 className="mb-2 text-2xl font-bold">Free Money</h2>
        <p className="text-text-secondary">
          Add your income and expenses in the Plan tab to see what's free to spend.
        </p>
      </div>
    );
  }

  const { dfm, barBreakdown, incomeEventDates, maxSplurge, effectiveBalance } = result;
  const isDeficit = dfm.dailyFreeMoney < 0;
  const vault = goals.reduce((s, g) => s + g.accumulatedTotal, 0);
  const underwaterBy = Math.max(0, buffer - (effectiveBalance - vault));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Hero: free-to-spend now, with the balance bar telling the rest of the story */}
      <div className="rounded-xl bg-surface-raised p-4">
        <FreeMoneyHero
          freeToSpend={barBreakdown.freeToSpend}
          nextIncomeDate={barBreakdown.nextIncomeDate}
          maxSplurge={maxSplurge}
          dfmPerDay={dfm.dailyFreeMoney}
          totalBalance={barBreakdown.totalBalance}
          pinchPointDate={dfm.pinchPointDate}
          isDeficit={isDeficit}
          underwaterBy={underwaterBy}
          onFixDeficit={() => setShowDeficitFix(true)}
        />
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-medium text-text-secondary">Where your money is</h3>
          <BarBreakdownChart
            segments={barBreakdown.segments}
            totalBalance={barBreakdown.totalBalance}
          />
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
          goalCompletions={result.goalCompletions}
        />
      </div>

      <QuickAddExpenseModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
      {showDeficitFix && (
        <DeficitResolutionModal open onClose={() => setShowDeficitFix(false)} />
      )}
    </div>
  );
}
