import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook to poll for OAuth callbacks from the system browser during development.
 * This replaces the need for deep links (backbone://) while working locally.
 *
 * @param {Function} setSession - Callback to update the session in App.jsx
 */
export const useDevAuthPoller = (setSession) => {
  useEffect(() => {
    // Return early if not in development mode
    if (!import.meta.env.DEV) return;


    const poll = async () => {
      try {
        const res = await fetch('http://localhost:5173/api/auth/poll-callback');
        const json = await res.json();

        if (json.url) {

          const urlObj = new URL('http://localhost:5173' + json.url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (error) {
            console.error('[AUTH] OAuth error from callback:', error);
            return;
          }

          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              console.error('[AUTH] exchangeCodeForSession failed:', exchangeError.message);
              return;
            }
            if (data?.session) {
              setSession(data.session);
            }
          }
        }
      } catch (err) {
        // Server not ready yet or polling endpoint unavailable, safely ignore
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [setSession]);
};
