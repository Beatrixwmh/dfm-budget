import type { Tab } from './Shell';
import { NAV_TABS } from './navIcons';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function Sidebar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="flex h-full w-56 flex-col border-r border-border bg-surface-raised p-3">
      <div className="mb-6 px-3 pt-2 text-lg font-bold text-accent">DFM Budget</div>
      <div className="flex flex-col gap-1">
        {NAV_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-accent/15 text-accent font-medium'
                : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
            }`}
          >
            <tab.Icon className="h-[18px] w-[18px] shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
