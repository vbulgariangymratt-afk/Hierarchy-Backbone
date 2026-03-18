import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import BackgroundLayer from './components/background/BackgroundLayer';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

/**
 * Global Keyboard Shortcuts Manager
 * Centralized way to define and manage in-app keyboard shortcuts.
 */
const KeyboardShortcuts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    completeSession, 
    isSessionActive, 
    activeSessionId, 
    previousRoute, 
    setPreviousRoute 
  } = useSession();

  const { 
    theme, 
    setTheme, 
    backgroundMode, 
    setBackgroundMode,
    isMultipleWallpapersMode,
    setIsMultipleWallpapersMode
  } = useTheme();


  // Track the last non-focus, non-settings route to return to it later
  useEffect(() => {
    if (location.pathname !== '/focus' && location.pathname !== '/settings') {
      setPreviousRoute(location.pathname);
    }
  }, [location.pathname, setPreviousRoute]);


  // Defined as a memoized object to ensure hook efficiency
  const shortcuts = useMemo(() => ({
    // Requirement: Shortcut: Cmd + , 
    "cmd+,": () => navigate('/settings'),
    
    // Requirement: Cmd + Enter → complete current session
    // Context awareness: Only work when a session is active
    "cmd+enter": () => {
      if (isSessionActive && activeSessionId) {
        completeSession();
      }
    },

    // Requirement: Cmd + Shift + F → Toggle Focus Mode
    "cmd+shift+f": () => {
      // Condition: Use routing state to determine toggle target
      if (location.pathname === '/focus') {
        // Return to previous route (Launchpad as fallback)
        navigate(previousRoute || '/launchpad');
      } else {
        // Navigate to Focus mode
        navigate('/focus');
      }
    },

    // Appearance Shortcut 1: Toggle binary Light/Dark (Cmd + Shift + L)
    "cmd+shift+l": () => {
      setTheme(theme === 'light' ? 'dark' : 'light');
    },

    // Appearance Shortcut 2: Cycle background modes (Cmd + Shift + M)
    "cmd+shift+m": () => {
      const modes = ['liquid', 'solid', 'wallpaper'];
      const currentIndex = modes.indexOf(backgroundMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setBackgroundMode(modes[nextIndex]);
    },

    // Navigation Shortcut 1: Go Back (Cmd + {)
    "cmd+{": () => navigate(-1),

    // Navigation Shortcut 2: Go Forward (Cmd + })
    "cmd+}": () => navigate(1)
  }), [
    navigate, location.pathname, 
    completeSession, isSessionActive, activeSessionId, 
    previousRoute, theme, setTheme, backgroundMode, setBackgroundMode,
    isMultipleWallpapersMode, setIsMultipleWallpapersMode
  ]);



  useKeyboardShortcuts(shortcuts);

  return null;
};




import { supabase } from './lib/supabase';
import { waitForReady } from './backbone-v2';
import PremiumLoadingScreen from './components/loading/PremiumLoadingScreen';

const LandingLog = () => {
  useEffect(() => { console.log("App: Root /* route matched (LandingLog mounted)"); }, []);
  return null;
};

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
    let unsubscribers = [];

    const handleOAuthUrl = async (url) => {
      console.log('[App Auth] Deep link received:', url);
      
      // Look for our callback path (e.g. backbone://auth/callback) or general auth segments
      if (typeof url === 'string' && (url.includes('auth/callback') || url.includes('access_token='))) {
        console.log('[App Auth] Detected OAuth callback segment. Processing session...');
        
        try {
          // Supabase helper to extract session from the hash fragment
          const { data, error } = await supabase.auth.getSessionFromUrl({ 
            url, 
            storeSession: true 
          });

          if (error) {
            console.error('[App Auth] Error getting session from URL:', error.message);
          } else if (data?.session) {
            console.log('[App Auth] Session retrieved successfully for:', data.session.user.email);
            setSession(data.session);
          } else {
            console.warn('[App Auth] No session data returned from getSessionFromUrl');
          }
        } catch (err) {
          console.error('[App Auth] Unexpected exception during deep link processing:', err);
        }
      }
    };

    // 1. Specialized Deep Link Plugin Listener (Preferred)
    import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
      console.log('[App Auth] Initializing Deep Link plugin listener');
      onOpenUrl((urls) => {
        urls.forEach(handleOAuthUrl);
      }).then(unsub => { unsubscribers.push(unsub); });
    }).catch(err => {
      console.warn('[App Auth] Deep link plugin not available:', err.message);
    });

    // 2. Event System Fallback (tauri://url or app://open-url)
    import('@tauri-apps/api/event').then(({ listen }) => {
      // Listen for both event names as requested for redundancy
      ['tauri://url', 'app://open-url'].forEach(eventName => {
        listen(eventName, (event) => {
          console.log(`[App Auth] Event received via ${eventName}:`, event.payload);
          const url = typeof event.payload === 'string' ? event.payload : event.payload?.[0];
          if (url) handleOAuthUrl(url);
        }).then(unsub => { unsubscribers.push(unsub); });
      });
    });

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[App] Auth Event:', event);
      setSession(newSession);

      // Requirement: When user signs in, ensure data is refetched and UI state is refreshed
      if (event === 'SIGNED_IN') {
        console.log('[App] User signed in, synchronizing repository data...');
        setRepositoriesReady(false); // Show loading state while fetching user data
        
        try {
          // Re-trigger the repository initialization flow
          const success = await waitForReady(); 
          console.log('[App] Synchronization complete. Success:', success);
        } catch (err) {
          console.error('[App] Failed to sync data after sign-in:', err);
        } finally {
          setRepositoriesReady(true);
        }
      }

      if (loading) setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  return (
    <ThemeProvider>
      <Router>
        {loading || !repositoriesReady ? (
          <PremiumLoadingScreen 
            secondaryText={!loading ? 'Synchronizing Repository Data...' : ''} 
          />
        ) : (
          <SessionProvider>
            <KeyboardShortcuts />
            <BackgroundLayer />
            <Routes>
              <Route path="/focus" element={<FocusPage />} />
              <Route path="/*" element={<><LandingLog /><LegacyApp /></>} />
            </Routes>
          </SessionProvider>
        )}
      </Router>
    </ThemeProvider>
  );
}

export default App;
