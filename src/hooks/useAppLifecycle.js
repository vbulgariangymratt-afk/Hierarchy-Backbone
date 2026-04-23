import { useEffect } from 'react';

const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

/**
 * Hook to manage Tauri window maximization (on double-click in title bar zone)
 * and global app lifecycle logging (focus, visibility, mount status).
 */
export const useAppLifecycle = () => {
  // Window Maximization Logic
  useEffect(() => {
    const handleDoubleClick = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
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

    const handleGlobalDoubleClick = (e) => {
      // If double click is in the top 36px zone (title bar drag zone)
      if (e.clientY <= 36) {
        // Ignore if clicking an interactive element (buttons, inputs, etc.)
        const isInteractive = e.target.closest('button, a, input, textarea, select, .no-drag, [role="button"]');
        if (!isInteractive) {
        if (isTauri) {
          handleDoubleClick();
        }
        }
      }
    };

    window.addEventListener('dblclick', handleGlobalDoubleClick);
    return () => window.removeEventListener('dblclick', handleGlobalDoubleClick);
  }, []);

  // Diagnostic Lifecycle Logging
  useEffect(() => {
    
    const handleVisibilityChange = () => {
    };
    
    const handleWindowFocus = () => {};
    const handleWindowBlur = () => {};

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);
};
