import type { Tab } from './Shell';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◎' },
  { id: 'plan', label: 'Plan', icon: '☰' },
  { id: 'savings', label: 'Savings', icon: '🏦' },
  { id: 'transactions', label: 'Transactions', icon: '📊' },
  { id: 'simulator', label: 'Simulate', icon: '⚡' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="flex h-full w-56 flex-col border-r border-border bg-surface-raised p-3">
      <div className="mb-6 px-3 pt-2 text-lg font-bold text-accent">DFM Budget</div>
      <div className="flex flex-col gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-accent/15 text-accent font-medium'
                : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
