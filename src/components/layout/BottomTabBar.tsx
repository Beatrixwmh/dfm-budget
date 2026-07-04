import type { Tab } from './Shell';
import { NAV_TABS } from './navIcons';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-surface-raised px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {NAV_TABS.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-xs transition-colors ${
              isActive
                ? 'bg-accent/15 font-semibold text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {/* top indicator bar for the active tab */}
            {isActive && (
              <span className="absolute -top-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent" />
            )}
            <tab.Icon className="h-5 w-5" />
            <span>{tab.shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
