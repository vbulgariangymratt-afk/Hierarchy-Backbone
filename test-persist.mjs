import { createClient } from '@supabase/supabase-js'
const supabase = createClient('https://yexazwttyoetdfuddwnw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlleGF6d3R0eW9ldGRmdWRkd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTg4OTUsImV4cCI6MjA4ODU5NDg5NX0.Kg9-O0v1ny2FJVE40oOi6gS3LTDr_hX7Lh_QN2Uufmw')

async function run() {
    const email = `test_fresh_${Date.now()}@gmail.com`;
    console.log('Signing up:', email);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: 'Password123!',
    });
    
    if (authError) {
        console.error('Auth error:', authError.message);
        return;
    }
    
    // Check if session is present right away (email confirmation might be required)
    if (!authData.session) {
        console.log('No session returned! Email confirmation might be required.');
    }
    
    const userId = authData.user.id;
    console.log('New user ID:', userId);
    
    // Simulate what persistentRepository does during persist
    const nodes = [
        { id: 'ROOT', parentId: null, name: 'Root', type: 'ROOT' },
        { id: 'REWARD_BANK', parentId: 'ROOT', name: 'Rewards', type: 'REWARD_BANK' }
    ];

    const nodesToUpsert = nodes.map(node => ({
        id: node.id,
        user_id: userId,
        name: node.name,
        type: node.type,
        parent_id: node.parentId,
        metadata: {},
        updated_at: new Date().toISOString()
    }));

    const retries = 3;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (attempt > 1) {
                console.log(`Attempt ${attempt}: forcing session refresh...`);
                await new Promise(r => setTimeout(r, 800 * attempt));
                await supabase.auth.getSession();
            }

            const { error } = await supabase.from('nodes').upsert(nodesToUpsert);
            if (error) throw error;
            
            console.log('Upsert successful on attempt', attempt);
            break;
        } catch (e) {
            const isRls = e.message?.includes('row-level security policy') || e.code === '42501';
            if (isRls && attempt < retries) {
                console.log(`RLS error on attempt ${attempt}. Retrying...`);
            } else {
                console.error('Final error:', e);
                break;
            }
        }
    }
    
    // Now verify the rows exist
    const { data: rows, error: selectError } = await supabase
        .from('nodes')
        .select('*')
        .eq('user_id', userId);
        
    if (selectError) {
        console.error('Select error:', selectError.message);
    } else {
        console.log(`Found ${rows?.length || 0} rows for user ${userId}:`);
        console.log((rows || []).map(r => r.id).join(', '));
    }
}
run();
