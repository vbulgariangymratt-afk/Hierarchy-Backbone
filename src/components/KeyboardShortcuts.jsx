import { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

/**
 * Component that manages global application keyboard shortcuts.
 * Registers hotkeys for navigation, appearance, and session control.
 * Rendered once in App.jsx to provide app-wide hotkeys.
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
    setBackgroundMode
  } = useTheme();

  // Track the last "safe" route (non-focus, non-settings) 
  // to return to it when toggling focus mode.
  useEffect(() => {
    if (location.pathname !== '/focus' && location.pathname !== '/settings') {
      setPreviousRoute(location.pathname);
    }
  }, [location.pathname, setPreviousRoute]);

  const shortcuts = useMemo(() => ({
    // Open Global Settings (Cmd + ,)
    "cmd+,": () => navigate('/settings'),
    
    // Complete Active Session (Cmd + Enter)
    "cmd+enter": () => {
      if (isSessionActive && activeSessionId) {
        completeSession();
      }
    },

    // Toggle Focus Mode (Cmd + Shift + F)
    "cmd+shift+f": () => {
      if (location.pathname === '/focus') {
        // Return to previous route (Launchpad as fallback)
        navigate(previousRoute || '/launchpad');
      } else {
        navigate('/focus');
      }
    },

    // Appearance: Light/Dark toggle (Cmd + Shift + L)
    "cmd+shift+l": () => {
      setTheme(theme === 'light' ? 'dark' : 'light');
    },

    // Appearance: Cycle Background Modes (Cmd + Shift + M)
    "cmd+shift+m": () => {
      const modes = ['liquid', 'solid', 'wallpaper'];
      const currentIndex = modes.indexOf(backgroundMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setBackgroundMode(modes[nextIndex]);
    },

    // Browser-style Navigation
    "cmd+{": () => navigate(-1),
    "cmd+}": () => navigate(1)
  }), [
    navigate, location.pathname, 
    completeSession, isSessionActive, activeSessionId, 
    previousRoute, theme, setTheme, backgroundMode, setBackgroundMode
  ]);

  // Hook into global keydown listeners
  useKeyboardShortcuts(shortcuts);

  return null;
};

export default KeyboardShortcuts;
