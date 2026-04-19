import { supabase } from '../lib/supabase';

export const createHabitRepository = () => {
    let habits = [];
    const subscribers = new Set();
    const notify = () => subscribers.forEach(callback => callback(habits));

    const instanceId = Math.random().toString(36).substr(2, 5);

    // Internal helper to get current authenticated user
    const getUserId = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id;
    };

    const persist = async (habit) => {
        let userId = await getUserId();
        if (!userId) {
            // Wait briefly for token refresh and retry once
            await new Promise(r => setTimeout(r, 1500));
            userId = await getUserId();
        }

        if (!userId) {
            console.error(`HabitRepo [ID:${instanceId}]: persist() FAILED — No authenticated user after retry`);
            return;
        }

        try {
            const { error } = await supabase
                .from('habits')
                .upsert({
                    id: habit.id,
                    user_id: userId,
                    type: habit.type || 'HABIT',
                    if_trigger: habit.ifTrigger,
                    frequency_type: habit.frequencyType || 'daily',
                    target_count: habit.targetCount || 1,
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

    const instance = {
        initialize: async () => {
            if (initPromise) return initPromise;
            initPromise = (async () => {
                try {
                    const userId = await getUserId();
                    if (!userId) {
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
                            frequencyType: row.frequency_type || 'daily',
                            targetCount: row.target_count || 1,
                            isActive: row.is_active,
                            ...h,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at
                        };
                    });
                    notify(); // Ensure subscribers are notified after initial load
                } catch (e) {
                    console.error('Failed to load Habit data from Supabase:', e);
                    habits = [];
                }
            })();
            return initPromise;
        },

        reinitialize: async () => {
            initPromise = null;
            return await instance.initialize();
        },

        subscribe: (callback) => {
            subscribers.add(callback);
            return () => subscribers.delete(callback);
        },

        getAll: () => [...habits],

        add: async (habit) => {
            habits.push(habit);
            const snapshot = JSON.parse(JSON.stringify(habit));
            notify(); // Optimistic UI
            await persist(snapshot);
            return habit;
        },

        update: async (id, updates) => {
            const index = habits.findIndex(h => h.id === id);
            if (index !== -1) {
                habits[index] = { ...habits[index], ...updates };
                const snapshot = JSON.parse(JSON.stringify(habits[index]));
                notify(); // Optimistic UI
                await persist(snapshot);
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
                notify();
            } catch (e) {
                console.error('Failed to delete habit from Supabase:', e);
            }
        },

        reset: () => {
            initPromise = null;
            habits = [];
            notify();
        }
    };
    return instance;
};
