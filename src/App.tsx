import { useState } from 'react';
import { Shell, type Tab } from './components/layout/Shell';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { DashboardPage } from './pages/DashboardPage';
import { PlanPage } from './pages/PlanPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { SettingsPage } from './pages/SettingsPage';
import { useIsNewUser } from './store/hooks';
import { useTransactionSideEffects } from './hooks/useTransactionSideEffects';

export default function App() {
  const isNewUser = useIsNewUser();
  const [showOnboarding, setShowOnboarding] = useState(isNewUser);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  useTransactionSideEffects();

  if (showOnboarding) {
    return <OnboardingModal onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <Shell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && <DashboardPage />}
      {activeTab === 'plan' && <PlanPage />}
      {activeTab === 'simulator' && <SimulatorPage />}
      {activeTab === 'settings' && <SettingsPage />}
    </Shell>
  );
}
