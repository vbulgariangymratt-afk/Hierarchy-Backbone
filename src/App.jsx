import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { logToFile, logErrorToFile } from './lib/logger';

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
        <Route index element={<LaunchpadFlow />} />
        <Route path="launchpad" element={<LaunchpadFlow />} />
        <Route path="planning" element={<Navigate to="/launchpad" replace />} />
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
import { backbone, waitForReady, NodeTypes, reloadAllData, clearAllData } from './backbone-v2';
import PremiumLoadingScreen from './components/loading/PremiumLoadingScreen';
import LaunchpadFlow from './components/LaunchpadFlow';
import EnergyModeTag from './components/EnergyModeTag';

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
    console.log('[AUTH] App started');
    console.log('[AUTH] Calling supabase.auth.getSession() on startup');

    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        console.log('[AUTH] Initial session check complete. Result:', initialSession ? `Session exists for ${initialSession.user.email}` : 'No initial session found');

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
      console.log('[AUTH] Deep link received:', url);
      await logToFile(`Deep link received: ${url}`);
      
      try {
        const urlObj = new URL(url);
        
        // 1. Explicitly reject fragment callbacks (#access_token)
        if (urlObj.hash && urlObj.hash.includes('access_token=')) {
          console.warn('[AUTH] Unexpected fragment callback detected! Expected PKCE code flow.');
          await logToFile(`UNEXPECTED: Fragment callback detected (Implicit flow) instead of PKCE: ${url}`);
          return;
        }

        // 2. Parse search params for code or error
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');
        const errorDescription = urlObj.searchParams.get('error_description');

        if (error) {
          console.error('[AUTH] OAuth error received in callback:', error, errorDescription);
          await logToFile(`OAuth Callback Error: ${error} - ${errorDescription}`);
          return;
        }

        if (code) {
          console.log('[AUTH] PKCE code detected:', code);
          await logToFile(`Parsed code value: ${code.substring(0, 10)}... (length: ${code.length})`);
          
          console.log('[AUTH] Exchanging code for session via exchangeCodeForSession...');
          await logToFile('Starting exchangeCodeForSession...');
          
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('[AUTH] exchangeCodeForSession failed:', exchangeError.message);
            await logErrorToFile('exchangeCodeForSession', exchangeError);
            return;
          }
          
          if (data?.session) {
            console.log('[AUTH] exchangeCodeForSession SUCCESSFUL. User:', data.session.user.email);
            await logToFile(`exchangeCodeForSession SUCCESSFUL. User: ${data.session.user.email}`);
            setSession(data.session);
          } else {
            console.warn('[AUTH] Session exchange returned null session state.');
            await logToFile('exchangeCodeForSession returned no session state.');
          }
        } else if (url.includes('auth/callback')) {
          console.warn('[AUTH] Callback URL received but no code parameter present.');
          await logToFile('WARNING: Auth callback received but no "code" found in search params.');
        }
      } catch (err) {
        console.error('[AUTH] Unexpected process error during deep link handling:', err);
        await logErrorToFile('handleOAuthUrl', err);
      }
    };

    // 1. Specialized Deep Link Plugin Listener (Preferred)
    import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
      console.log('[AUTH] Deep link listener (plugin) registered');
      onOpenUrl((urls) => {
        urls.forEach(handleOAuthUrl);
      }).then(unsub => { unsubscribers.push(unsub); });
    }).catch(err => {
      console.warn('[AUTH] Deep link plugin not available:', err.message);
    });

    // 2. Event System Fallback (tauri://url or app://open-url)
    import('@tauri-apps/api/event').then(({ listen }) => {
      console.log('[AUTH] Deep link listener (event) registered');
      // Listen for both event names as requested for redundancy
      ['tauri://url', 'app://open-url'].forEach(eventName => {
        listen(eventName, (event) => {
          console.log(`[AUTH] Protocol event received via ${eventName}:`, event.payload);
          const url = typeof event.payload === 'string' ? event.payload : event.payload?.[0];
          if (url) handleOAuthUrl(url);
        }).then(unsub => { unsubscribers.push(unsub); });
      });
    });

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[AUTH] State Change Event:', event, newSession ? `User: ${newSession.user.email}` : 'None');
      await logToFile(`Auth State Change Event: ${event} | User: ${newSession?.user?.email || 'None'}`);
      
      setSession(newSession);

      if (event === 'SIGNED_IN' && newSession) {
        console.log('[App] User signed in, re-initializing systems...');
        setRepositoriesReady(false);
        try {
          await reloadAllData();
        } catch (err) {
          console.error('[App] Failed to reload data after sign-in:', err);
          await logErrorToFile('reloadAllData (SIGNED_IN)', err);
        } finally {
          setRepositoriesReady(true);
        }
      }

      if (event === 'SIGNED_OUT') {
        console.log('[App] User signed out, clearing data...');
        clearAllData();
        setRepositoriesReady(false);
        // Refresh session state (will show empty till login)
        setRepositoriesReady(true);
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

  // Daily Rollover Logic
  useEffect(() => {
    if (repositoriesReady) {
      const runRollover = async () => {
        const today = new Date().toDateString();
        const lastRun = localStorage.getItem("lastRolloverDate");

        if (lastRun !== today) {
          console.log("[Rollover] New day detected. Starting daily rollover...");
          try {
            const allNodes = await backbone.getAllNodes();
            const tomorrowTasks = allNodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.tomorrow === true);

            if (tomorrowTasks.length > 0) {
              console.log(`[Rollover] Found ${tomorrowTasks.length} tasks to roll over from tomorrow to today.`);
              
              // Process in parallel for speed
              await Promise.all(tomorrowTasks.map(task => 
                backbone.updateNode(task.id, {
                  metadata: {
                    ...task.metadata,
                    isToday: true,
                    tomorrow: false
                  }
                })
              ));
              
              console.log("[Rollover] Successfully rolled over tasks.");
            } else {
              console.log("[Rollover] No tomorrow tasks found to roll over.");
            }
            
            localStorage.setItem("lastRolloverDate", today);
            console.log("[Rollover] Last run date updated to:", today);
          } catch (err) {
            console.error("[Rollover] Failed to complete daily rollover:", err);
          }
        } else {
          console.log("[Rollover] Rollover already ran today:", today);
        }
      };
      
      runRollover();
    }
  }, [repositoriesReady]);

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
            <EnergyModeTag />
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
