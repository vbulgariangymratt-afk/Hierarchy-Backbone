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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Same formula as auraService.js
const calculateLevel = (auraTotal) => Math.floor((auraTotal || 0) / 12) + 1;

const run = async () => {
    console.log('Fetching all SKILL nodes from Supabase...\n');

    const { data: skills, error } = await supabase
        .from('nodes')
        .select('id, metadata')
        .eq('type', 'SKILL');

    if (error) {
        console.error('Failed to fetch skills:', error.message);
        return;
    }

    console.log(`Found ${skills.length} skill(s). Checking auraLevel consistency...\n`);

    const mismatches = [];

    for (const skill of skills) {
        const meta = skill.metadata || {};
        const storedAuraTotal = meta.auraTotal || 0;
        const storedAuraLevel = meta.auraLevel;
        const correctLevel = calculateLevel(storedAuraTotal);

        if (storedAuraLevel === undefined || storedAuraLevel === null) {
            mismatches.push({ id: skill.id, storedAuraTotal, storedAuraLevel: 'MISSING', correctLevel });
        } else if (storedAuraLevel !== correctLevel) {
            mismatches.push({ id: skill.id, storedAuraTotal, storedAuraLevel, correctLevel });
        }
    }

    if (mismatches.length === 0) {
        console.log('✅ All auraLevel fields are consistent. Bug is likely elsewhere.');
        return;
    }

    console.log(`⚠️  Found ${mismatches.length} skill(s) with stale/missing auraLevel:\n`);
    for (const m of mismatches) {
        console.log(`  Skill ID: ${m.id}`);
        console.log(`    auraTotal:      ${m.storedAuraTotal}`);
        console.log(`    stored level:   ${m.storedAuraLevel}  ← WRONG`);
        console.log(`    correct level:  ${m.correctLevel}  ← will use this`);
        console.log();
    }

    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Fix all mismatches now? (yes/no): ', async (answer) => {
        rl.close();
        if (answer.trim().toLowerCase() !== 'yes') {
            console.log('Aborted. No changes made.');
            return;
        }

        console.log('\nFixing...');
        let fixed = 0;
        for (const m of mismatches) {
            const { data: current } = await supabase
                .from('nodes')
                .select('metadata')
                .eq('id', m.id)
                .single();

            const { error: updateError } = await supabase
                .from('nodes')
                .update({ metadata: { ...current.metadata, auraLevel: m.correctLevel } })
                .eq('id', m.id);

            if (updateError) {
                console.error(`  ❌ Failed to fix ${m.id}:`, updateError.message);
            } else {
                console.log(`  ✅ Fixed ${m.id}: auraLevel set to ${m.correctLevel}`);
                fixed++;
            }
        }

        console.log(`\nDone. Fixed ${fixed}/${mismatches.length} skills.`);
        console.log('Next time addAura runs, oldLevel and correctLevel will match — no false fires.');
    });
};

run();
