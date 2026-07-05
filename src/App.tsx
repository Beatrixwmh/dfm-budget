import { useState } from 'react';
import { Shell, type Tab } from './components/layout/Shell';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { DashboardPage } from './pages/DashboardPage';
import { PlanPage } from './pages/PlanPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SavingsPage } from './pages/SavingsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { SettingsPage } from './pages/SettingsPage';
import { AutoUnpausePrompts } from './components/savings/AutoUnpausePrompts';
import { NavContext } from './store/NavContext';
import { SimulatorProvider } from './store/SimulatorContext';
import { useIsNewUser } from './store/hooks';
import { useTransactionSideEffects } from './hooks/useTransactionSideEffects';
import { useDeficitRestore } from './hooks/useDeficitRestore';

export default function App() {
  const isNewUser = useIsNewUser();
  const [showOnboarding, setShowOnboarding] = useState(isNewUser);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { prompts, extendPause, resumeAtLowerRate, dismissPrompt, extendToDate } = useTransactionSideEffects();
  useDeficitRestore();

  if (showOnboarding) {
    return <OnboardingModal onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <NavContext value={setActiveTab}>
      <SimulatorProvider>
      <Shell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'plan' && <PlanPage />}
        {activeTab === 'savings' && <SavingsPage />}
        {activeTab === 'transactions' && <TransactionsPage />}
        {activeTab === 'simulator' && <SimulatorPage />}
        {activeTab === 'settings' && <SettingsPage />}
        <AutoUnpausePrompts
          prompts={prompts}
          onExtendPause={extendPause}
          onResumeAtLower={resumeAtLowerRate}
          onDismiss={dismissPrompt}
          onExtendToDate={extendToDate}
        />
      </Shell>
      </SimulatorProvider>
    </NavContext>
  );
}
