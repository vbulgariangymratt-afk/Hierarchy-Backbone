/**
 * evaluateFrictionTrend — Pure, O(n=5) helper.
 * Computes suggestion-only flags from the last 5 completions.
 * Flags are recalculated from scratch on every call — they reset automatically
 * when the trend condition is no longer true.
 *
 * @param {Array} completions - Full completions array (uses only last 5).
 * @param {number} currentPhaseLevel
 * @returns {{ evolutionSuggested: boolean, fatigueRisk: boolean, phaseReductionSuggested: boolean }}
 */
const evaluateFrictionTrend = (completions = [], currentPhaseLevel = 0) => {
    const last5 = completions.slice(-5);
    const lightCount = last5.filter(c => c.friction === 'light').length;
    const mediumCount = last5.filter(c => c.friction === 'medium').length;
    const heavyCount = last5.filter(c => c.friction === 'heavy').length;

    // 1. Evolution suggested: ≥4 light AND 0 heavy (minimum 4 completions in window)
    const evolutionSuggested = last5.length >= 4 && lightCount >= 4 && heavyCount === 0;

    // 2. Fatigue risk: ≥3 medium OR ≥2 heavy
    const fatigueRisk = mediumCount >= 3 || heavyCount >= 2;

    // 3. Phase reduction suggested: ≥3 heavy AND currentPhaseLevel > 0
    const phaseReductionSuggested = heavyCount >= 3 && currentPhaseLevel > 0;

    return { evolutionSuggested, fatigueRisk, phaseReductionSuggested };
};

export const createHabitService = (repository, auraService, backbone) => {
    const _reportCompletion = async (habit) => {
        if (!backbone) return;

        console.log(`HabitService: reporting completion for habit ${habit.id} to Backbone`);

        // 1. Increment global daily completions (exactly once)
        await backbone.incrementDailyCompletionCount();

        // 2. Resolve areas and award Aura for each skill
        const skillIds = habit.linkedSkillIds || (habit.linkedSkillId ? [habit.linkedSkillId] : []);
        if (skillIds.length === 0) return;

        const allNodes = await backbone.getAllNodes();
        const todayStr = new Date().toLocaleDateString('en-CA');
        const root = allNodes.find(n => n.id === 'ROOT');
        if (!root) return;

        const metadata = root.metadata || {};
        const dailyAreaLog = { ...(metadata.dailyAreaLog || {}) };
        if (!dailyAreaLog[todayStr]) dailyAreaLog[todayStr] = {};

        for (const skillId of skillIds) {
            // a) Award +1 Aura
            if (auraService) {
                await auraService.addAura(skillId, 1, "Habit Completion");
            }

            // b) & c) Resolve area and increment log
            const skillNode = allNodes.find(n => n.id === skillId);
            if (skillNode && skillNode.parentId) {
                const areaId = skillNode.parentId;
                dailyAreaLog[todayStr][areaId] = (dailyAreaLog[todayStr][areaId] || 0) + 1;
            }
        }

        // Write the log back to ROOT via backbone's updateNode
        await backbone.updateNode('ROOT', { metadata: { ...metadata, dailyAreaLog } });
    };

    return {
        initialize: async () => {
            await repository.initialize();
        },

        getAllHabits: () => repository.getAll().filter(h => h.type === 'HABIT'),

        getHabitsBySkill: (skillId) => {
            return repository.getAll().filter(h =>
                h.type === 'HABIT' &&
                ((h.linkedSkillIds && h.linkedSkillIds.includes(skillId)) ||
                    h.linkedSkillId === skillId)
            );
        },

        getActiveHabitsBySkill: (skillId) => {
            return repository.getAll().filter(h =>
                h.type === 'HABIT' &&
                ((h.linkedSkillIds && h.linkedSkillIds.includes(skillId)) || h.linkedSkillId === skillId) &&
                h.isActive
            );
        },

        createHabit: async (linkedSkillId, ifTrigger, mveAction) => {
            console.log(`HabitService: createHabit called with skillId: ${linkedSkillId}`);

            const defaultEvolutionConfig = {
                thresholds: [12, 30, 60, 100, 150],
                postCapIncrement: 50,
                rollingWindowDays: 12,
                requiredDaysInWindow: 8,
                frictionWindow: 8,
                heavyBlockWindow: 3,
                sizeCapPhase: 5
            };

            const newHabit = {
                id: Math.random().toString(36).substr(2, 9),
                type: 'HABIT',
                linkedSkillIds: [linkedSkillId],
                ifTrigger,
                phases: [
                    {
                        level: 0,
                        description: mveAction,
                        threshold: defaultEvolutionConfig.thresholds[0]
                    }
                ],
                currentPhaseLevel: 0,
                totalCompletions: 0,
                completions: [],
                evolutionConfig: {
                    thresholds: [12, 30, 60, 100, 150],
                    postCapIncrement: 50,
                    rollingWindowDays: 12,
                    requiredDaysInWindow: 8,
                    frictionWindow: 8,
                    heavyBlockWindow: 3,
                    sizeCapPhase: 5
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                auraPerSkill: { [linkedSkillId]: 0 },
                sessions: []
            };
            const added = await repository.add(newHabit);
            console.log(`HabitService: Habit persisted with ADHD+MDD Evolution Config.`);
            return added;
        },

        evaluateEvolutionEligibility: async (id) => {
            const habits = repository.getAll();
            const habit = habits.find(h => h.id === id);
            if (!habit) throw new Error("Habit not found");

            const config = habit.evolutionConfig;
            const completions = habit.completions || [];
            const currentPhaseLevel = habit.currentPhaseLevel || 0;

            // --- Gate 1: Lifetime ---
            let requiredLifetime = 0;
            if (currentPhaseLevel < config.thresholds.length) {
                requiredLifetime = config.thresholds[currentPhaseLevel];
            } else {
                const lastThreshold = config.thresholds[config.thresholds.length - 1];
                const extraPhases = currentPhaseLevel - (config.thresholds.length - 1);
                requiredLifetime = lastThreshold + (config.postCapIncrement * extraPhases);
            }

            const lifetimeStatus = {
                current: completions.length,
                required: requiredLifetime
            };
            const lifetimePassed = completions.length >= requiredLifetime;

            // --- Gate 2: Stability (8/12 Rule) ---
            const now = Date.now();
            const windowStart = now - (config.rollingWindowDays * 24 * 60 * 60 * 1000);

            const windowCompletions = completions.filter(c => c.timestamp >= windowStart);
            const distinctDays = new Set(windowCompletions.map(c =>
                new Date(c.timestamp).toLocaleDateString('en-CA')
            ));

            const stabilityStatus = {
                completedDays: distinctDays.size,
                required: config.requiredDaysInWindow
            };
            const stabilityPassed = distinctDays.size >= config.requiredDaysInWindow;

            // --- Gate 3: Friction Rule B ---
            const frictionScores = { light: 1, medium: 2, heavy: 3 };
            const lastFrictionWindow = completions.slice(-config.frictionWindow);

            const averageFriction = lastFrictionWindow.length > 0
                ? lastFrictionWindow.reduce((sum, c) => sum + frictionScores[c.friction], 0) / lastFrictionWindow.length
                : 3; // Default to heavy if no data

            const lastHeavyWindow = completions.slice(-config.heavyBlockWindow);
            const blockedByRecentHeavy = lastHeavyWindow.some(c => c.friction === 'heavy');

            const frictionStatus = {
                average: averageFriction,
                blockedByRecentHeavy
            };
            const frictionPassed = averageFriction <= 2 && !blockedByRecentHeavy;

            const isCapped = currentPhaseLevel >= config.sizeCapPhase;

            return {
                evolutionReady: lifetimePassed && stabilityPassed && frictionPassed,
                gateStatus: {
                    lifetime: lifetimeStatus,
                    stability: stabilityStatus,
                    friction: frictionStatus
                },
                nextPhaseLevel: currentPhaseLevel + 1,
                isCapped
            };
        },

        startSprint: async (id, durationMinutes = 10, predictedPleasure = 0) => {
            const habits = repository.getAll();
            const habit = habits.find(h => h.id === id);
            if (!habit) throw new Error("Habit not found");

            const sessions = habit.sessions || [];
            const newSession = {
                id: Math.random().toString(36).substr(2, 9),
                targetDuration: durationMinutes,
                actualDuration: 0,
                predictedPleasure: parseInt(predictedPleasure),
                startTime: Date.now(),
                status: 'active'
            };

            return await repository.update(id, {
                sessions: [...sessions, newSession]
            });
        },

        completeSprint: async (id, sessionId, friction = "medium", actualPleasure = 0, mastery = 0) => {
            const habits = repository.getAll();
            const habit = habits.find(h => h.id === id);
            if (!habit) throw new Error("Habit not found");

            let duration = 0;
            const sessions = (habit.sessions || []).map(s => {
                if (s.id === sessionId) {
                    const now = Date.now();
                    duration = Math.round((now - s.startTime) / 1000);
                    return {
                        ...s,
                        status: 'completed',
                        endTime: now,
                        endedAt: new Date().toISOString(),
                        actualDuration: duration,
                        actualPleasure: parseInt(actualPleasure),
                        mastery: parseInt(mastery)
                    };
                }
                return s;
            });

            const newCompletion = {
                timestamp: Date.now(),
                friction,
                duration,
                performance: {
                    pleasure: parseInt(actualPleasure),
                    mastery: parseInt(mastery)
                }
            };

            const completions = [...(habit.completions || []), newCompletion];

            const auraPerSkill = { ...(habit.auraPerSkill || {}) };
            const skillIds = habit.linkedSkillIds || (habit.linkedSkillId ? [habit.linkedSkillId] : []);
            skillIds.forEach(sid => {
                auraPerSkill[sid] = (auraPerSkill[sid] || 0) + 1;
            });

            const frictionFlags = evaluateFrictionTrend(completions, habit.currentPhaseLevel || 0);

            const updates = {
                sessions,
                completions,
                totalCompletions: completions.length,
                lastCompletedAt: new Date().toISOString(),
                auraPerSkill,
                ...frictionFlags
            };

            const updated = await repository.update(id, updates);
            await _reportCompletion(updated);

            return updated;
        },

        completeHabit: async (id, friction = "medium") => {
            const habits = repository.getAll();
            const habit = habits.find(h => h.id === id);
            if (!habit) throw new Error("Habit not found");

            const newCompletion = {
                timestamp: Date.now(),
                friction
            };

            const completions = [...(habit.completions || []), newCompletion];

            const auraPerSkill = { ...(habit.auraPerSkill || {}) };
            const skillIds = habit.linkedSkillIds || (habit.linkedSkillId ? [habit.linkedSkillId] : []);
            skillIds.forEach(sid => {
                auraPerSkill[sid] = (auraPerSkill[sid] || 0) + 1;
            });

            const frictionFlags = evaluateFrictionTrend(completions, habit.currentPhaseLevel || 0);

            const updates = {
                completions,
                totalCompletions: completions.length,
                lastCompletedAt: new Date().toISOString(),
                auraPerSkill,
                ...frictionFlags
            };

            const updated = await repository.update(id, updates);
            await _reportCompletion(updated);

            return updated;
        },

        upgradePhase: async (id, newDescription) => {
            const habits = repository.getAll();
            const habit = habits.find(h => h.id === id);
            if (!habit) throw new Error("Habit not found");

            // BACKEND PROTECTION: If any linked skill belongs to an objective with burnoutRisk, block evolution
            const allNodes = await backbone.getAllNodes();
            let skillIds = habit.linkedSkillIds || (habit.linkedSkillId ? [habit.linkedSkillId] : []);

            for (const skillId of skillIds) {
                let current = allNodes.find(n => n.id === skillId);
                while (current) {
                    if (current.type === NodeTypes.OBJECTIVE && current.metadata?.burnoutRisk === true) {
                        throw new Error("Evolution is temporarily paused while recovery mode is active.");
                    }
                    current = allNodes.find(n => n.id === current.parentId);
                }
            }

            // Check eligibility first (Server-side constraint)
            const service = createHabitService(repository, auraService, backbone);
            const eligibility = await service.evaluateEvolutionEligibility(id);

            if (!eligibility.evolutionReady) {
                throw new Error("Habit is not yet eligible for evolution.");
            }

            const currentLevel = habit.currentPhaseLevel || 0;
            const nextLevel = currentLevel + 1;

            const config = habit.evolutionConfig || { thresholds: [12, 30, 60, 100, 150], postCapIncrement: 50 };

            let threshold;
            if (nextLevel < config.thresholds.length) {
                threshold = config.thresholds[nextLevel];
            } else {
                // Post-cap phases: increment by postCapIncrement
                const lastThreshold = habit.phases[currentLevel].threshold;
                threshold = lastThreshold + (config.postCapIncrement || 50);
            }

            const newPhase = {
                level: nextLevel,
                description: newDescription,
                threshold
            };

            const updates = {
                phases: [...(habit.phases || []), newPhase],
                currentPhaseLevel: nextLevel
            };

            const result = await repository.update(id, updates);

            // Award Aura reinforcement: +2 for Phase Upgrade
            skillIds = habit.linkedSkillIds || (habit.linkedSkillId ? [habit.linkedSkillId] : []);
            if (auraService && skillIds.length > 0) {
                for (const skillId of skillIds) {
                    await auraService.addAura(skillId, 2, "Phase Upgrade");
                }
            }

            return result;
        },

        updateHabit: async (id, updates) => {
            return await repository.update(id, updates);
        },

        getAllNodes: async () => backbone ? backbone.getAllNodes() : [],

        restoreHabit: async (habit) => repository.add(habit),

        deleteHabit: async (id) => repository.delete(id)
    };
};
