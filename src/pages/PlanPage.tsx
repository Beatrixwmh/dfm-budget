import { useState } from 'react';
import { CategoriesPanel } from '../components/categories/CategoriesPanel';
import { IncomePanel } from '../components/income/IncomePanel';
import { ExpensesPanel } from '../components/expenses/ExpensesPanel';

type SubTab = 'income' | 'expenses' | 'categories';

const tabs: { id: SubTab; label: string }[] = [
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'categories', label: 'Categories' },
];

export function PlanPage() {
  const [subTab, setSubTab] = useState<SubTab>('income');

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h2 className="mb-4 text-2xl font-bold">Plan</h2>

      <div className="mb-6 flex rounded-xl bg-surface-raised p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              subTab === tab.id
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'income' && <IncomePanel />}
      {subTab === 'expenses' && <ExpensesPanel />}
      {subTab === 'categories' && <CategoriesPanel />}
    </div>
  );
}
