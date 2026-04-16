import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logToFile } from '../lib/logger';

/**
 * Hook to manage Tauri deep-link listeners (onOpenUrl and tauri://url).
 * Captures PKCE OAuth codes and exchanges them for a Supabase session.
 *
 * @param {Function} setSession - Callback to update the session in App.jsx
 */
export const useDeepLinkAuth = (setSession) => {
  useEffect(() => {
    let unsubscribers = [];

    const handleOAuthUrl = async (url) => {
      await logToFile(`[AUTH] Deep link received: ${url}`);
      try {
        // Handle implicit flow — tokens are in the hash fragment
        const hashString = url.includes('#') ? url.split('#')[1] : '';
        const params = new URLSearchParams(hashString);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const error = params.get('error');

        if (error) {
          await logToFile(`[AUTH] OAuth error: ${error}`);
          return;
        }

        if (access_token) {
          await logToFile(`[AUTH] Implicit flow tokens found — setting session...`);
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) {
            await logToFile(`[AUTH] setSession FAILED: ${sessionError.message}`);
            return;
          }
          await logToFile(`[AUTH] setSession SUCCESS: ${data.session.user.email}`);
          setSession(data.session);
        } else {
          await logToFile(`[AUTH] No access_token found in URL hash: ${url}`);
        }
      } catch (err) {
        await logToFile(`[AUTH] Unexpected error: ${err.message}`);
      }
    };

    // 1. Handle deep-link plugin (backbone://)
    if (!import.meta.env.DEV) {
      import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
        onOpenUrl((urls) => { urls.forEach(handleOAuthUrl); }).then(unsub => {
          unsubscribers.push(unsub);
        });
      });
    }

    // 2. Handle generic Tauri URL events
    import('@tauri-apps/api/event').then(({ listen }) => {
      ['tauri://url', 'app://open-url'].forEach(eventName => {
        listen(eventName, (event) => {
          const url = typeof event.payload === 'string' ? event.payload : event.payload?.[0];
          if (url) handleOAuthUrl(url);
        }).then(unsub => {
          unsubscribers.push(unsub);
        });
      });
    });

    // 3. Handle Rust-level deep link emission
    import('@tauri-apps/api/event').then(({ listen }) => {
      logToFile('[DEEP LINK] Registering deep-link-received listener...');
      listen('deep-link-received', (event) => {
        logToFile('[DEEP LINK] JS received event from Rust: ' + event.payload);
        const url = event.payload;
        if (url) handleOAuthUrl(url);
      }).then(unsub => {
        logToFile('[DEEP LINK] Listener registered successfully');
        unsubscribers.push(unsub);
      });
    });

    return () => {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [setSession]);
};
