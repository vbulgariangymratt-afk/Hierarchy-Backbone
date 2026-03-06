export const createHabitRepository = () => {
    let habits = [];
    const instanceId = Math.random().toString(36).substr(2, 5);
    console.log(`HabitRepo: NEW INSTANCE CREATED [ID:${instanceId}]`);

    const persist = async () => {
        try {
            await fetch('/api/habit-data/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(habits)
            });
            console.log(`HabitRepo [ID:${instanceId}]: Synced to habit_data.json. Current size: ${habits.length}`);
        } catch (e) {
            console.error('Failed to persist Habit data:', e);
        }
    };

    let initPromise = null;

    return {
        initialize: async () => {
            if (initPromise) return initPromise;
            initPromise = (async () => {
                try {
                    console.log(`HabitRepo [ID:${instanceId}]: Initializing from habit_data.json...`);
                    const response = await fetch('/api/habit-data/load');
                    const data = await response.json();
                    habits = Array.isArray(data) ? data.map(h => {
                        let updated = { ...h };

                        // 0. Ensure type: 'HABIT'
                        if (!updated.type) {
                            updated.type = 'HABIT';
                        }

                        // 1. Backwards compatibility: convert linkedSkillId to linkedSkillIds
                        if (updated.linkedSkillId && !updated.linkedSkillIds) {
                            updated.linkedSkillIds = [updated.linkedSkillId];
                        }
                        if (!updated.linkedSkillIds) {
                            updated.linkedSkillIds = [];
                        }

                        // 2. Structural Reinforcement: auraPerSkill tracking
                        if (!updated.auraPerSkill) {
                            updated.auraPerSkill = {};
                            updated.linkedSkillIds.forEach(sid => {
                                updated.auraPerSkill[sid] = 0;
                            });
                        } else {
                            // Ensure any newly added skills are also initialized
                            updated.linkedSkillIds.forEach(sid => {
                                if (updated.auraPerSkill[sid] === undefined) {
                                    updated.auraPerSkill[sid] = 0;
                                }
                            });
                        }

                        // 3. Structural Reinforcement: ADHD + MDD Evolution Architecture
                        if (!updated.evolutionConfig) {
                            updated.evolutionConfig = {
                                thresholds: [12, 30, 60, 100, 150],
                                postCapIncrement: 50,
                                rollingWindowDays: 12,
                                requiredDaysInWindow: 8,
                                frictionWindow: 8,
                                heavyBlockWindow: 3,
                                sizeCapPhase: 5
                            };
                        }

                        if (!updated.completions) {
                            updated.completions = [];
                            // Back-fill from sessions if they exist
                            if (updated.sessions && updated.sessions.length > 0) {
                                updated.completions = updated.sessions
                                    .filter(s => s.status === 'completed')
                                    .map(s => ({
                                        timestamp: s.endTime || s.startTime,
                                        friction: "medium", // Default for legacy
                                        duration: s.actualDuration,
                                        performance: {
                                            pleasure: s.actualPleasure,
                                            mastery: s.mastery
                                        }
                                    }));
                            }
                        }

                        if (updated.totalCompletions === undefined) {
                            updated.totalCompletions = updated.completions.length;
                        }

                        return updated;
                    }) : [];
                    console.log(`HabitRepo [ID:${instanceId}]: Loaded ${habits.length} habits`);
                } catch (e) {
                    console.error('Failed to load Habit data:', e);
                    habits = [];
                }
            })();
            return initPromise;
        },

        getAll: () => [...habits],

        add: async (habit) => {
            habits.push(habit);
            await persist();
            return habit;
        },

        update: async (id, updates) => {
            const index = habits.findIndex(h => h.id === id);
            if (index !== -1) {
                habits[index] = { ...habits[index], ...updates };
                await persist();
                return habits[index];
            }
            throw new Error(`Habit with ID ${id} not found`);
        },

        delete: async (id) => {
            habits = habits.filter(h => h.id !== id);
            console.log(`HabitRepo: Habit removed. New size: ${habits.length}`);
            await persist();
        }
    };
};
