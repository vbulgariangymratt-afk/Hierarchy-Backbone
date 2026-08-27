import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logToFile } from '../lib/logger';

export const useDeepLinkAuth = (setSession) => {
  useEffect(() => {
    let unsubscribers = [];
    const handleOAuthUrl = async (url) => {
      console.log('[AUTH] Deep link received:', url);
      await logToFile(`Deep link received: ${url}`);
      try {
        const urlObj = new URL(url);
        if (urlObj.hash && urlObj.hash.includes('access_token=')) {
          console.warn('[AUTH] Fragment callback detected! Expected PKCE code flow.');
          return;
        }
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');
        if (error) {
          console.error('[AUTH] OAuth error:', error);
          return;
        }
        if (code) {
          console.log('[AUTH] PKCE code detected — exchanging for session...');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[AUTH] exchangeCodeForSession failed:', exchangeError.message);
            return;
          }
          if (data?.session) {
            console.log('[AUTH] exchangeCodeForSession SUCCESS. User:', data.session.user.email);
            setSession(data.session);
          }
        }
      } catch (err) {
        console.error('[AUTH] Unexpected error during deep link handling:', err);
      }
    };
    const isTauri = typeof window !== 'undefined' && (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);
    if (isTauri) {
      import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
        onOpenUrl((urls) => { urls.forEach(handleOAuthUrl); }).then(unsub => {
          unsubscribers.push(unsub);
        }).catch(err => console.warn('[AUTH] onOpenUrl error:', err));
      }).catch(err => console.warn('[AUTH] Could not load deep link plugin:', err));

      import('@tauri-apps/api/event').then(({ listen }) => {
        ['tauri://url', 'app://open-url'].forEach(eventName => {
          listen(eventName, (event) => {
            const url = typeof event.payload === 'string' 
              ? event.payload 
              : event.payload?.[0];
            if (url) handleOAuthUrl(url);
          }).then(unsub => {
            unsubscribers.push(unsub);
          });
        });
      }).catch(err => console.warn('[AUTH] Event listener error:', err));
    }
    return () => {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [setSession]);
};
