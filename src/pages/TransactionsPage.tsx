import { useState } from 'react';
import { TransactionList } from '../components/transactions/TransactionList';

type SubTab = 'list' | 'trends';

const tabs: { id: SubTab; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'trends', label: 'Trends' },
];

export function TransactionsPage() {
  const [subTab, setSubTab] = useState<SubTab>('list');

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h2 className="mb-4 text-2xl font-bold">Transactions</h2>

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

      {subTab === 'list' && <TransactionList />}
      {subTab === 'trends' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-3 text-4xl">📈</span>
          <h3 className="mb-1 text-lg font-medium text-text-secondary">Coming Soon</h3>
          <p className="text-sm text-text-muted">Trends charts will appear here once you have transaction history.</p>
        </div>
      )}
    </div>
  );
}
