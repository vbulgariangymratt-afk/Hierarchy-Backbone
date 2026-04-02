import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { logToFile, logErrorToFile } from './lib/logger';

import MainLayout from './layout/MainLayout';
import { useWindowState } from './hooks/useWindowState';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import Launchpad from './pages/Launchpad';
import AreaPage from './pages/AreaPage';
import SkillPage from './pages/SkillPage';
import MarketplacePage from './pages/MarketplacePage';
import TimelinePage from './pages/TimelinePage';



/**
 * ARCHIVED LEGACY SYSTEM STUBS
 * These components are part of the legacy system and have been moved to src/legacy_archive.
 * They are stubbed here to allow the router to function without reintroducing legacy dependency chains.
 */
const ArchivedPage = ({ name }) => (
  <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontFamily: 'sans-serif' }}>
    <h2 style={{ marginBottom: '10px' }}>{name} (Archived)</h2>
    <p>This component was moved to <code>src/legacy_archive</code> during the V2 refactor.</p>

  </div>
);

import JournalPage from './pages/JournalPage';
import FocusPage from './pages/FocusPage';

const Home = () => <ArchivedPage name="Home" />;
const AreaDetail = () => <AreaPage />;
const SkillDetail = () => <SkillPage />;
const Marketplace = () => <MarketplacePage />;
const Journal = () => <JournalPage />;
const Calendar = () => <TimelinePage />;

import SettingsPage from './pages/SettingsPage';
const Settings = () => <SettingsPage />;
import FocusCenterPage from './pages/FocusCenterPage';
const FocusCenter = () => <FocusCenterPage />;
const WarheadChatPage = () => <ArchivedPage name="Warhead Chat" />;
const StoreProvider = ({ children }) => <>{children}</>;
const WarheadChat = () => null;
const WarheadPulse = () => null;
const WarheadPrompt = () => null;
const Manifesting = () => <ArchivedPage name="Manifesting" />;
const Wealth = () => <ArchivedPage name="Wealth" />;
const WealthItemDetail = () => <ArchivedPage name="Wealth Item Detail" />;
const GenericTracker = () => <ArchivedPage name="Generic Tracker" />;
const BeliefDetail = () => <ArchivedPage name="Belief Detail" />;
const SatsLogger = () => null;
const DailyRituals = () => null;

const LegacyApp = () => (
  <StoreProvider>
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<LaunchpadFlow />} />
        <Route path="launchpad" element={<LaunchpadFlow />} />
        <Route path="planning" element={<Navigate to="/launchpad" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="journal" element={<Journal />} />
        <Route path="settings" element={<Settings />} />
        <Route path="focus-center" element={<FocusCenter />} />
        <Route path="warhead" element={<WarheadChatPage />} />
        <Route path="area/:id" element={<AreaDetail />} />
        <Route path="skill/:id" element={<SkillDetail />} />
        {/* System Trackers */}
        <Route path="beliefs/:id" element={<BeliefDetail />} />
        <Route path="trackers/manifesting" element={<Manifesting />} />
        <Route path="trackers/wealth" element={<Wealth />} />
        <Route path="wealth/:id" element={<WealthItemDetail />} />
        <Route path="trackers/:trackerId" element={<GenericTracker />} />
      </Route>
      <Route path="*" element={<div style={{color:'white'}}>No route matched in LegacyApp. Path: {window.location.pathname}</div>} />
    </Routes>
    <DailyRituals />
    <WarheadPulse />
    <WarheadPrompt />
    <WarheadChat />
    <SatsLogger />
  </StoreProvider>
);

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { SettingsProvider } from './context/SettingsContext';
import BackgroundLayer from './components/background/BackgroundLayer';
import KeyboardShortcuts from './components/KeyboardShortcuts';


/**
 * Backbone initialized stubs...
 * (skipping for replace clarity)
 */




import { supabase } from './lib/supabase';
import { backbone, repository, habitRepo, waitForReady, NodeTypes, reloadAllData, clearAllData } from './backbone-v2';
import PremiumLoadingScreen from './components/loading/PremiumLoadingScreen';
import LaunchpadFlow from './components/LaunchpadFlow';
import EnergyModeTag from './components/EnergyModeTag';

import { useDevAuthPoller } from './hooks/useDevAuthPoller';
import { useDeepLinkAuth } from './hooks/useDeepLinkAuth';
import { useDailyRollover } from './hooks/useDailyRollover';
import { useAppInitialization } from './hooks/useAppInitialization';

const LandingLog = () => {
  useEffect(() => { console.log("App: Root /* route matched (LandingLog mounted)"); }, []);
  return null;
};

function App() {
  useWindowState();
  useAppLifecycle();
  const [session, setSession] = useState(null);
  
  // The "Brain" hook handles initialization, auth, and real-time syncing
  const { loading, repositoriesReady } = useAppInitialization(setSession);

  // Background helpers
  useDevAuthPoller(setSession);
  useDeepLinkAuth(setSession);
  useDailyRollover(repositoriesReady);

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
              <Routes>
                <Route path="/focus" element={<FocusPage />} />
                <Route path="/auth/callback" element={<div />} />
                <Route path="/*" element={<><LandingLog /><LegacyApp /></>} />
              </Routes>
            </SessionProvider>
          </SettingsProvider>
        )}
      </Router>
    </ThemeProvider>
  );
}

export default App;
