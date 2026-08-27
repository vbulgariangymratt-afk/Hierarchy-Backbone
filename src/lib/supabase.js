import { createClient } from '@supabase/supabase-js'
import { logToFile } from './logger';
import { openUrl } from '@tauri-apps/plugin-opener';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yexazwttyoetdfuddwnw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlleGF6d3R0eW9ldGRmdWRkd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTg4OTUsImV4cCI6MjA4ODU5NDg5NX0.Kg9-O0v1ny2FJVE40oOi6gS3LTDr_hX7Lh_QN2Uufmw'

if (!supabaseUrl || !supabaseAnonKey) {
}


export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true
    }
});

// Diagnostic Startup Logs
(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('[DEBUG Auth] Failed to retrieve initial session:', error.message);
    } else {
    }
})();

supabase.auth.onAuthStateChange((event, session) => {
    {};
});



export const loginWithGoogle = async () => {
    await logToFile('Starting Google login flow via loginWithGoogle()');
    
    // In dev mode, use Vite's dev auth poller on localhost:5173/auth/callback
    // In production desktop app, use macOS deep-link scheme (backbone://auth/callback)
    let redirectTo = import.meta.env.DEV
        ? 'http://localhost:5173/auth/callback'
        : 'backbone://auth/callback';
        
    if (!window.__TAURI_INTERNALS__ && import.meta.env.DEV) {
        redirectTo += '?mode=web';
    }
        
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                skipBrowserRedirect: true,
            },
        });
        if (error) {
            console.error('[AUTH] Supabase OAuth error:', error.message);
            return { data, error };
        }
        if (data?.url) {
            try {
                // If running inside Tauri desktop app, open native browser
                if (window.__TAURI_INTERNALS__) {
                    await openUrl(data.url);
                } else {
                    // Otherwise redirect the web tab directly
                    window.location.href = data.url;
                }
            } catch (openErr) {
                console.error('[AUTH] Failed to open system browser, redirecting window:', openErr);
                window.location.href = data.url;
            }
        }
        return { data, error };
    } catch (err) {
        console.error('[AUTH] Unexpected error during OAuth flow:', err);
        return { data: null, error: err };
    }
};

export const saveItem = async (title, content) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        console.error('No authenticated user found:', userError?.message)
        return { data: null, error: userError || new Error('Not authenticated') }
    }

    const { data, error } = await supabase
        .from('items')
        .insert([
            {
                title,
                content,
                user_id: user.id
            }
        ])
        .select()

    if (error) {
        console.error('Error saving item:', error.message)
    }

    return { data, error }

}

export const loadItems = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        console.error('No authenticated user found:', userError?.message)
        return { data: null, error: userError || new Error('Not authenticated') }
    }

    const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error loading items:', error.message)
    }

    return { data, error }
}
