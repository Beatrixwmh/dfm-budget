import type { Tab } from './Shell';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◎' },
  { id: 'plan', label: 'Plan', icon: '☰' },
  { id: 'transactions', label: 'Txns', icon: '📊' },
  { id: 'simulator', label: 'Simulate', icon: '⚡' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function BottomTabBar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-surface-raised px-2 py-2 safe-area-bottom">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs transition-colors ${
            activeTab === tab.id
              ? 'text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
