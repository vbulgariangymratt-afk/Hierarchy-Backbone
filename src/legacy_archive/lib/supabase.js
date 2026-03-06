
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eoaliivxbgcshnspfjic.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYWxpaXZ4Ymdjc2huc3BmamljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQxOTIsImV4cCI6MjA4MzU1MDE5Mn0.vRIYFq1iFyqUo98fKEwvajTjtNhoApEYlj6BG37ydww'

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
})
