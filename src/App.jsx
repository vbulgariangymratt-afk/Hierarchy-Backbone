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

// Preload high-intent chunks removed for pure lazy strategy

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { SettingsProvider } from './context/SettingsContext';
import BackgroundLayer from './components/background/BackgroundLayer';
import KeyboardShortcuts from './components/KeyboardShortcuts';

import { supabase } from './lib/supabase';
import { backbone, repository, habitRepo, waitForReady, NodeTypes, reloadAllData, clearAllData } from './backbone-v2';
import PremiumLoadingScreen from './components/loading/PremiumLoadingScreen';
const LaunchpadFlow = lazy(() => import('./components/LaunchpadFlow'));
import EnergyModeTag from './components/EnergyModeTag';

import { useDevAuthPoller } from './hooks/useDevAuthPoller';
import { useDeepLinkAuth } from './hooks/useDeepLinkAuth';
import { useAppInitialization } from './hooks/useAppInitialization';

const LandingLog = () => {
  useEffect(() => { ; }, []);
  return null;
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
      <Router>
        {loading || !repositoriesReady ? (
          <PremiumLoadingScreen 
            secondaryText={!loading ? 'Synchronizing Repository Data...' : ''} 
          />
        ) : (
          <SettingsProvider>
            <SessionProvider>
              <KeyboardShortcuts />
              <BackgroundLayer />
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
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="focus-center" element={<FocusCenterPage />} />
                    <Route path="maintenance-center" element={<MaintenanceCenterPage />} />
                    <Route path="area/:id" element={<AreaPage />} />
                    <Route path="skill/:id" element={<SkillPage />} />
                    <Route path="*" element={<LandingLog />} />
                  </Route>
                  <Route path="/focus" element={<FocusPage />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                </Routes>
              </Suspense>
            </SessionProvider>
          </SettingsProvider>
        )}
      </Router>
    </ThemeProvider>
  );
}

export default App;

