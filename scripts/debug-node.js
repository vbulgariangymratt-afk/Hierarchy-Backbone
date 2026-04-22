
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const loadEnv = () => {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    return content.split('\n').reduce((acc, line) => {
        const [key, ...val] = line.split('=');
        if (key && val) acc[key.trim()] = val.join('=').trim();
        return acc;
    }, {});
};

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const runQuery = async () => {
    console.log('--- Query 1: Specific Node ---');
    const { data: node, error: nodeError } = await supabase
        .from('nodes')
        .select('*')
        .eq('id', 'SKILL-1773286344315-3b9zw')
        .single();
    
    if (nodeError) {
        console.error('Error fetching node:', nodeError.message);
    } else {
        console.log(JSON.stringify(node, null, 2));
    }

    console.log('\n--- Query 2: Children ---');
    const { data: children, error: childrenError } = await supabase
        .from('nodes')
        .select('*')
        .eq('parent_id', 'SKILL-1773286344315-3b9zw')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (childrenError) {
        console.error('Error fetching children:', childrenError.message);
    } else {
        console.log(JSON.stringify(children, null, 2));
    }
};

runQuery();
