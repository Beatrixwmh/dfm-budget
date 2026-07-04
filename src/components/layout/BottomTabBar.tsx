import type { Tab } from './Shell';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◎' },
  { id: 'plan', label: 'Plan', icon: '☰' },
  { id: 'savings', label: 'Savings', icon: '🏦' },
  { id: 'transactions', label: 'Txns', icon: '📊' },
  { id: 'simulator', label: 'Simulate', icon: '⚡' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function BottomTabBar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-surface-raised px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs transition-colors ${
              isActive
                ? 'bg-accent/15 font-semibold text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {/* top indicator bar for the active tab */}
            {isActive && (
              <span className="absolute -top-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent" />
            )}
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
