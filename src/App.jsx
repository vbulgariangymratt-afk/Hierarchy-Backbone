import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { logToFile, logErrorToFile } from './lib/logger';


const MainLayout = lazy(() => import('./layout/MainLayout'));
import { useWindowState } from './hooks/useWindowState';
import { useAppLifecycle } from './hooks/useAppLifecycle';
const Launchpad = lazy(() => import('./pages/Launchpad'));
const AreaPage = lazy(() => import('./pages/AreaPage'));
const SkillPage = lazy(() => import('./pages/SkillPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const JournalPage = lazy(() => import('./pages/JournalPage'));
const FocusPage = lazy(() => import('./pages/FocusPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const FocusCenterPage = lazy(() => import('./pages/FocusCenterPage'));
const MaintenanceCenterPage = lazy(() => import('./pages/MaintenanceCenterPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const CreateLifeAreaPage = lazy(() => import('./pages/CreateLifeAreaPage'));

// Preload high-intent chunks
export const preloadFocus = () => import('./pages/FocusPage');
export const preloadSkill = () => import('./pages/SkillPage');
export const preloadLaunchpad = () => import('./pages/Launchpad');

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { useBackboneStore } from './store/backboneStore';
import KeyboardShortcuts from './components/KeyboardShortcuts';

import { supabase } from './lib/supabase';
import { backbone, repository, habitRepo, waitForReady, NodeTypes, reloadAllData, clearAllData } from './backbone-v2';
import PremiumLoadingScreen from './components/loading/PremiumLoadingScreen';
const LaunchpadFlow = lazy(() => import('./components/LaunchpadFlow'));
import EnergyModeTag from './components/EnergyModeTag';
import HabitUpgradeFlow from './components/habits/HabitUpgradeFlow';

import { useDevAuthPoller } from './hooks/useDevAuthPoller';
import { useDeepLinkAuth } from './hooks/useDeepLinkAuth';
import { useAppInitialization } from './hooks/useAppInitialization';
import BackgroundLayer from './components/background/BackgroundLayer';
import ReadOnlyInterceptor from './components/TrialPaywallOverlay';
import AuthGate from './components/TrialExpiredSidebar';
import FlyingOrbsOverlay from './components/ui/FlyingOrbsOverlay';
import UndoSnackbar from './components/UndoSnackbar';

const LandingLog = () => {
  useEffect(() => { ; }, []);
  return null;
};

const AuthenticatedWorkspace = ({ user }) => {
  const { hasAccess, loading: settingsLoading } = useSettings();

  if (settingsLoading) {
    return <PremiumLoadingScreen secondaryText="Verifying License..." />;
  }

  if (!hasAccess) {
    return <AuthGate user={user} />;
  }

  return (
    <SessionProvider>
      <ReadOnlyInterceptor />
      <KeyboardShortcuts />
      <EnergyModeTag />
      <Suspense fallback={<PremiumLoadingScreen secondaryText="Loading Perspective..." />}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<LaunchpadFlow />} />
            <Route path="launchpad" element={<LaunchpadFlow />} />
            <Route path="planning" element={<Navigate to="/launchpad" replace />} />
            <Route path="calendar" element={<TimelinePage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="journal" element={<JournalPage />} />
            <Route path="settings" element={null} />
            <Route path="focus-center" element={<FocusCenterPage />} />
            <Route path="maintenance-center" element={<MaintenanceCenterPage />} />
            <Route path="area/:id" element={<AreaPage />} />
            <Route path="skill/:id" element={<SkillPage />} />
            <Route path="*" element={<LandingLog />} />
          </Route>
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/create-life-area" element={<CreateLifeAreaPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Suspense>
      <HabitUpgradeFlow />
      <FlyingOrbsOverlay />
      <UndoSnackbar />
    </SessionProvider>
  );
};

function App() {
  // 1. Desktop Window & Lifecycle Management
  useWindowState();
  useAppLifecycle();
  
  const [session, setSession] = useState(null);
  
  // 2. The "Brain" hook handles initialization, auth, and real-time syncing
  // This hook returns repositoriesReady=false during login reloads.
  const { loading, repositoriesReady } = useAppInitialization(setSession);

  // 4. Background services
  useDevAuthPoller(setSession);
  useDeepLinkAuth(setSession);

  return (
    <ThemeProvider>
      <BackgroundLayer />
      <Router>
        {loading || !repositoriesReady ? (
          <PremiumLoadingScreen 
            secondaryText={!loading ? 'Synchronizing Repository Data...' : ''} 
          />
        ) : !session?.user ? (
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<AuthGate />} />
          </Routes>
        ) : (
          <SettingsProvider>
            <AuthenticatedWorkspace user={session.user} />
          </SettingsProvider>
        )}
      </Router>
    </ThemeProvider>
  );
}

export default App;

