import { supabase } from '../lib/supabase';

export const createHabitRepository = () => {
    let habits = [];
    const instanceId = Math.random().toString(36).substr(2, 5);
    console.log(`HabitRepo: NEW INSTANCE CREATED [ID:${instanceId}]`);

    // Internal helper to get current authenticated user
    const getUserId = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id;
    };

    const persist = async (habit) => {
        const userId = await getUserId();
        if (!userId) return;

        try {
            const { error } = await supabase
                .from('habits')
                .upsert({
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
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
        } catch (e) {
            console.error('Failed to persist Habit to Supabase:', e);
        }
    };

    let initPromise = null;

    return {
        initialize: async () => {
            if (initPromise) return initPromise;
            initPromise = (async () => {
                console.log(`HabitRepo [ID:${instanceId}]: Initializing from Supabase...`);
                try {
                    const userId = await getUserId();
                    if (!userId) {
                        console.warn('HabitRepo: No user authenticated.');
                        return;
                    }

                    const { data, error } = await supabase
                        .from('habits')
                        .select('*')
                        .eq('user_id', userId);

                    if (error) throw error;

                    habits = (data || []).map(row => {
                        const h = row.metadata || {};
                        return {
                            id: row.id,
                            type: row.type,
                            ifTrigger: row.if_trigger,
                            isActive: row.is_active,
                            ...h,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at
                        };
                    });
                    console.log(`HabitRepo [ID:${instanceId}]: Loaded ${habits.length} habits from Supabase`);
                } catch (e) {
                    console.error('Failed to load Habit data from Supabase:', e);
                    habits = [];
                }
            })();
            return initPromise;
        },

        getAll: () => [...habits],

        add: async (habit) => {
            habits.push(habit);
            await persist(habit);
            return habit;
        },

        update: async (id, updates) => {
            const index = habits.findIndex(h => h.id === id);
            if (index !== -1) {
                habits[index] = { ...habits[index], ...updates };
                await persist(habits[index]);
                return habits[index];
            }
            throw new Error(`Habit with ID ${id} not found`);
        },

        delete: async (id) => {
            try {
                const { error } = await supabase
                    .from('habits')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                habits = habits.filter(h => h.id !== id);
                console.log(`HabitRepo: Habit removed from Supabase. New size: ${habits.length}`);
            } catch (e) {
                console.error('Failed to delete habit from Supabase:', e);
            }
        }
    };
};
