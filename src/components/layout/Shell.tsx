import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { useIsDesktop } from '../../hooks/useMediaQuery';

export type Tab = 'dashboard' | 'plan' | 'savings' | 'transactions' | 'simulator' | 'settings';

interface ShellProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

export function Shell({ activeTab, onTabChange, children }: ShellProps) {
  const isDesktop = useIsDesktop();

  return (
    // h-dvh = the *visible* viewport (excludes iOS toolbars), so content edges
    // aren't hidden behind the address bar / home indicator.
    <div className="flex h-dvh w-full overflow-hidden">
      {isDesktop && <Sidebar activeTab={activeTab} onTabChange={onTabChange} />}
      <main
        className={`flex-1 overflow-y-auto ${
          isDesktop
            ? ''
            // clear the notch up top and the tab bar + home indicator at the bottom
            : 'pt-[env(safe-area-inset-top)] pb-[calc(4rem+env(safe-area-inset-bottom))]'
        }`}
      >
        {children}
      </main>
      {!isDesktop && <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />}
    </div>
  );
}
