import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Check your environment variables.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

export const loginWithGoogle = async () => {
    console.log('[AUTH] Starting Google login flow');

    // In production (Tauri), we use the manual opener and skip auto-redirect
    // In development (base URL localhost), we can use the localhost URL and default redirect
    const isProd = !window.location.href.includes('localhost:5173')
    const redirectTo = isProd
        ? 'backbone://auth'
        : 'http://localhost:5173/auth/callback'

    console.log('[AUTH] Environment:', isProd ? 'Production (Tauri)' : 'Development (Vite)');
    console.log('[AUTH] Redirect URL configured:', redirectTo);

    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                skipBrowserRedirect: isProd,
            },
        })

        if (error) {
            console.error('[AUTH] Supabase OAuth error:', error.message);
            return { data, error };
        }

        console.log('[AUTH] OAuth URL generated:', data?.url);

        if (isProd && data?.url) {
            console.log('[AUTH] Manually opening system browser via Tauri Opener...');
            try {
                const { open } = await import('@tauri-apps/plugin-opener');
                await open(data.url);
                console.log('[AUTH] Browser open command sent successfully');
            } catch (openErr) {
                console.error('[AUTH] Failed to open system browser:', openErr);
            }
        }

        return { data, error }
    } catch (err) {
        console.error('[AUTH] Unexpected error during OAuth flow:', err);
        return { data: null, error: err };
    }
}

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
