import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

// Helper to load .env manually since we don't have dotenv
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

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const migrate = async (userId) => {
    if (!userId) {
        console.error('❌ Error: No USER_ID provided. Please provide the authenticated user ID.');
        console.log('Usage: node scripts/migrate.js <user_id>');
        process.exit(1);
    }

    console.log(`🚀 Starting migration for User: ${userId}`);

    // 1. Migrate Nodes (v2_data.json)
    try {
        const v2Path = path.resolve(process.cwd(), 'v2_data.json');
        if (fs.existsSync(v2Path)) {
            const v2Data = JSON.parse(fs.readFileSync(v2Path, 'utf8'));
            console.log(`📦 Found ${v2Data.length} nodes in v2_data.json`);

            let skippedV2Count = 0;
            const nodesToInsert = v2Data.filter(node => {
                if (!node.id || node.id === null || node.id === undefined) {
                    console.warn("Skipping V2 node without ID:", node);
                    skippedV2Count++;
                    return false;
                }
                return true;
            }).map(node => ({
                id: node.id,
                user_id: userId,
                name: node.name || 'Untitled',
                type: node.type || 'NODE',
                parent_id: node.parentId,
                metadata: node.metadata || {},
                created_at: node.createdAt ? new Date(node.createdAt).toISOString() : new Date().toISOString(),
                updated_at: node.updatedAt ? new Date(node.updatedAt).toISOString() : new Date().toISOString()
            }));

            if (skippedV2Count > 0) {
                console.log(`⚠️  Skipped ${skippedV2Count} V2 nodes missing IDs.`);
            }

            if (nodesToInsert.length > 0) {
                const { error } = await supabase.from('nodes').upsert(nodesToInsert);
                if (error) throw error;
                console.log('✅ Nodes migrated successfully.');
            }
        }
    } catch (e) {
        console.error('❌ Failed to migrate nodes:', e.message);
    }

    // 2. Migrate Journal Entries (journal_data.json)
    try {
        const journalPath = path.resolve(process.cwd(), 'journal_data.json');
        if (fs.existsSync(journalPath)) {
            const journalData = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
            const entries = journalData.entries || [];
            console.log(`📦 Found ${entries.length} journal entries`);

            const journalToInsert = entries.map(entry => ({
                id: entry.id,
                user_id: userId,
                date: entry.date,
                biological: entry.biological || {},
                activation: entry.activation || {},
                regulation: entry.regulation || {},
                notes: entry.notes || '',
                metadata: journalData.metadata || {}, // Global metadata stored per entry or could be separate
                created_at: entry.createdAt ? new Date(entry.createdAt).toISOString() : new Date().toISOString(),
                updated_at: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : new Date().toISOString()
            }));

            const { error } = await supabase.from('journal_entries').upsert(journalToInsert);
            if (error) throw error;
            console.log('✅ Journal entries migrated successfully.');
        }
    } catch (e) {
        console.error('❌ Failed to migrate journal entries:', e.message);
    }

    // 3. Migrate Habits (habit_data.json)
    try {
        const habitPath = path.resolve(process.cwd(), 'habit_data.json');
        if (fs.existsSync(habitPath)) {
            const habits = JSON.parse(fs.readFileSync(habitPath, 'utf8'));
            console.log(`📦 Found ${habits.length} habits`);

            const habitsToInsert = habits.map(habit => ({
                id: habit.id,
                user_id: userId,
                type: habit.type || 'HABIT',
                if_trigger: habit.ifTrigger,
                is_active: habit.isActive !== false,
                metadata: {
                    linkedSkillIds: habit.linkedSkillIds,
                    phases: habit.phases,
                    currentPhaseLevel: habit.currentPhaseLevel,
                    totalCompletions: habit.totalCompletions,
                    completions: habit.completions,
                    evolutionConfig: habit.evolutionConfig,
                    auraPerSkill: habit.auraPerSkill,
                    lastCompletedAt: habit.lastCompletedAt
                },
                created_at: habit.createdAt ? new Date(habit.createdAt).toISOString() : new Date().toISOString()
            }));

            const { error } = await supabase.from('habits').upsert(habitsToInsert);
            if (error) throw error;
            console.log('✅ Habits migrated successfully.');
        }
    } catch (e) {
        console.error('❌ Failed to migrate habits:', e.message);
    }

    // 4. Migrate Vault Data (local_data_vault.json)
    try {
        const vaultPath = path.resolve(process.cwd(), 'local_data_vault.json');
        if (fs.existsSync(vaultPath)) {
            const vaultData = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
            console.log('📦 Found local_data_vault.json. Extracting legacy areas and skills...');

            let nodesFromVault = [];
            let skippedCount = 0;

            // Extract Areas
            if (vaultData.areas) {
                Object.values(vaultData.areas).forEach(area => {
                    if (!area.id || area.id === null || area.id === undefined) {
                        console.warn("Skipping Area without ID:", area);
                        skippedCount++;
                        return;
                    }
                    nodesFromVault.push({
                        id: area.id,
                        user_id: userId,
                        name: area.name,
                        type: 'LIFE_AREA',
                        parent_id: 'ROOT',
                        metadata: { ...area, skillIds: undefined }, // Clean up metadata if needed
                        created_at: new Date().toISOString()
                    });
                });
            }

            // Extract Skills
            if (vaultData.skills) {
                Object.values(vaultData.skills).forEach(skill => {
                    if (!skill.id || skill.id === null || skill.id === undefined) {
                        console.warn("Skipping Skill without ID:", skill);
                        skippedCount++;
                        return;
                    }
                    nodesFromVault.push({
                        id: skill.id,
                        user_id: userId,
                        name: skill.name,
                        type: 'SKILL',
                        parent_id: skill.areaId || 'ROOT',
                        metadata: skill,
                        created_at: new Date().toISOString()
                    });
                });
            }

            if (skippedCount > 0) {
                console.log(`⚠️  Skipped ${skippedCount} items missing IDs.`);
            }

            if (nodesFromVault.length > 0) {
                console.log(`🚀 Upserting ${nodesFromVault.length} nodes from vault...`);
                const { error } = await supabase.from('nodes').upsert(nodesFromVault);
                if (error) throw error;
                console.log('✅ Vault nodes migrated successfully.');
            }
        }
    } catch (e) {
        console.error('❌ Failed to migrate vault data:', e.message);
    }

    console.log('🏁 Migration finished.');
};

// Execute
const userId = process.argv[2];
migrate(userId);
