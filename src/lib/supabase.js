import { createClient } from '@supabase/supabase-js'
import { logToFile } from './logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
}


export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
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

    const isTauri = window.__TAURI__ !== undefined;

    const redirectTo = isTauri
        ? 'backbone://auth/callback'
        : 'https://backbone-hierarchy.vercel.app/auth/callback';

    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                skipBrowserRedirect: isTauri,
            },
        });
        if (error) {
            console.error('[AUTH] Supabase OAuth error:', error.message);
            return { data, error };
        }
        if (isTauri && data?.url) {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(data.url);
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
