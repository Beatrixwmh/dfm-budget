import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { useIsDesktop } from '../../hooks/useMediaQuery';

export type Tab = 'dashboard' | 'plan' | 'simulator' | 'settings';

interface ShellProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

export function Shell({ activeTab, onTabChange, children }: ShellProps) {
  const isDesktop = useIsDesktop();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {isDesktop && <Sidebar activeTab={activeTab} onTabChange={onTabChange} />}
      <main className={`flex-1 overflow-y-auto ${isDesktop ? '' : 'pb-18'}`}>
        {children}
      </main>
      {!isDesktop && <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />}
    </div>
  );
}
