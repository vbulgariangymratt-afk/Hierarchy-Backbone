import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';

import MainLayout from './layout/MainLayout';
import { useWindowState } from './hooks/useWindowState';
import Launchpad from './pages/Launchpad';
import AreaPage from './pages/AreaPage';
import SkillPage from './pages/SkillPage';
import MarketplacePage from './pages/MarketplacePage';


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
const Calendar = () => <ArchivedPage name="Calendar" />;
import SettingsPage from './pages/SettingsPage';
const Settings = () => <SettingsPage />;
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
        <Route index element={<Launchpad />} />
        <Route path="launchpad" element={<Launchpad />} />
        <Route path="home" element={<Home />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="journal" element={<Journal />} />
        <Route path="settings" element={<Settings />} />
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
    </Routes>
    <DailyRituals />
    <WarheadPulse />
    <WarheadPrompt />
    <WarheadChat />
    <SatsLogger />
  </StoreProvider>
);

import { ThemeProvider } from './context/ThemeContext';
import BackgroundLayer from './components/background/BackgroundLayer';

import { supabase } from './lib/supabase';
import { waitForReady } from './backbone-v2';

function App() {
  useWindowState();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [repositoriesReady, setRepositoriesReady] = useState(false);

  const handleDoubleClick = async () => {
    try {
      const appWindow = getCurrentWindow();
      const maximized = await appWindow.isMaximized();
      if (maximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (err) {
      console.error('[App] Error toggling maximization:', err);
    }
  };

  useEffect(() => {
    const handleGlobalDoubleClick = (e) => {
      // If double click is in the top 36px zone
      if (e.clientY <= 36) {
        // Check if the target is NOT an interactive element
        const isInteractive = e.target.closest('button, a, input, textarea, select, .no-drag, [role="button"]');
        if (!isInteractive) {
          handleDoubleClick();
        }
      }
    };

    window.addEventListener('dblclick', handleGlobalDoubleClick);
    return () => window.removeEventListener('dblclick', handleGlobalDoubleClick);
  }, []);

  useEffect(() => {
    // 1. Initialization
    console.log('[App Init] Starting initialization flow');
    console.log('[App Init] Calling supabase.auth.getSession()');

    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        console.log('[App Init] Session check complete. Result:', initialSession ? `Session for ${initialSession.user.email}` : 'No session');

        setSession(initialSession);
        setLoading(false);

        // Once session check is done, ensure repositories are ready
        waitForReady().then((success) => {
          console.log('[App Init] Repositories READY. Success:', success);
          setRepositoriesReady(true);
        });
      })
      .catch(error => {
        console.error('[App Init] CRITICAL: Session check failed with error:', error);
        setLoading(false);
        setRepositoriesReady(true);
      });

    // Handle deep links for OAuth redirects (Tauri Production)
    let unsubscribeDeepLink;

    import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
      onOpenUrl((urls) => {
        for (const url of urls) {
          if (url.includes('auth')) {
            const urlObj = new URL(url.replace('#', '?'));
            const accessToken = urlObj.searchParams.get('access_token');
            const refreshToken = urlObj.searchParams.get('refresh_token');

            if (accessToken && refreshToken) {
              supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              }).then(({ data, error }) => {
                if (error) console.error('[App] Error setting session from deep link:', error.message);
                else setSession(data.session);
              });
            }
          }
        }
      }).then(unsub => { unsubscribeDeepLink = unsub; });
    }).catch(err => {
      console.warn('[App] Deep link plugin not initialized or available:', err);
    });

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (loading) setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (unsubscribeDeepLink) unsubscribeDeepLink();
    };
  }, []);

  if (loading || !repositoriesReady) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#050505',
        color: '#fff',
        fontFamily: 'sans-serif'
      }}>
        <div className="loading-spinner" style={{ marginBottom: '20px' }}>
          Initializing Backbone...
        </div>
        <p style={{ opacity: 0.5, fontSize: '12px' }}>
          {!loading ? 'Synchronizing Repository Data...' : 'Verifying secure session'}
        </p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <BackgroundLayer />
        <Routes>
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/*" element={<LegacyApp />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
