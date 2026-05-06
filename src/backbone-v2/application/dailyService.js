import { createNode, NodeTypes } from '../domain/entities';
import { supabase } from '../../lib/supabase';
import { findSkillAncestor } from './hierarchyHelpers';

export const DailyService = (repository) => {

    async function getDailyCompletionCount(date = new Date()) {
        const todayStr = date.toLocaleDateString('en-CA');
        const rootNode = await repository.getById('ROOT');

        if (rootNode?.metadata?.dailyCompletions && rootNode.metadata.dailyCompletions[todayStr] !== undefined) {
            return rootNode.metadata.dailyCompletions[todayStr];
        }

        const allNodes = await repository.getAll();
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        const startTime = startOfDay.getTime();
        const endTime = endOfDay.getTime();

        let count = 0;
        allNodes.forEach(node => {
            if (node.type === NodeTypes.TASK && node.metadata?.completedAt) {
                const ct = new Date(node.metadata.completedAt).getTime();
                if (ct >= startTime && ct <= endTime) count++;
            }
            if (node.type === NodeTypes.OBJECTIVE && node.metadata?.achievedAt) {
                const at = new Date(node.metadata.achievedAt).getTime();
                if (at >= startTime && at <= endTime) count++;
            }
            if (node.type === NodeTypes.TASK && node.metadata?.sessions) {
                node.metadata.sessions.forEach(s => {
                    if (s.status === 'completed' && s.endTime && s.endTime >= startTime && s.endTime <= endTime) count++;
                });
            }
        });
        console.log(`DEBUG: Daily completions today (on-the-fly): ${count}`);
        return count;
    }

    async function incrementDailyCompletionCount() {
        const todayStr = new Date().toLocaleDateString('en-CA');
        let rootNode = await repository.getById('ROOT');

        if (!rootNode) {
            // [CRITICAL SAFETY GUARD]: Before creating a new ROOT, verify it doesn't exist in Supabase
            const { data: existingRoot } = await supabase
                .from('nodes')
                .select('*')
                .eq('id', 'ROOT')
                .single();

            if (existingRoot) {
                console.log("[Counter] ROOT found in cloud, restoring to local repository.");
                rootNode = await repository.save({
                    id: existingRoot.id,
                    name: existingRoot.name,
                    type: existingRoot.type,
                    parentId: existingRoot.parent_id,
                    metadata: existingRoot.metadata,
                    createdAt: existingRoot.created_at,
                    updatedAt: existingRoot.updated_at
                });
            } else {
                console.log("[Counter] ROOT genuinely missing, creating fresh root.");
                rootNode = await repository.save({
                    id: 'ROOT',
                    name: 'System Root',
                    type: NodeTypes.LIFE_AREA,
                    metadata: { hryvniaBalance: 0, dailyCompletions: {}, dailyAreaLog: {} },
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
            }
        }

        const metadata = rootNode.metadata || {};
        const dailyCompletions = { ...(metadata.dailyCompletions || {}) };

        if (dailyCompletions[todayStr] === undefined) {
            const currentTotal = await getDailyCompletionCount();
            dailyCompletions[todayStr] = currentTotal;
            console.log(`[Counter] Initializing daily persistent counter for ${todayStr} with ${currentTotal}`);
        } else {
            dailyCompletions[todayStr] += 1;
        }

        await repository.update('ROOT', {
            metadata: { ...metadata, dailyCompletions }
        });
    }

    async function checkDailyReset() {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const rootNode = await repository.getById('ROOT');
        if (!rootNode) return;

        const lastReset = rootNode.metadata?.lastTodayResetDate;
        if (lastReset !== todayStr) {
            console.log(`[Daily Reset] New day detected (${todayStr}). Processing rollover...`);
            
            const allNodes = await repository.getAll();
            
            // 1. Reset existing Today tasks
            const todayTasks = allNodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.isToday);
            for (const task of todayTasks) {
                await repository.update(task.id, {
                    metadata: { ...task.metadata, isToday: false },
                    updatedAt: Date.now()
                });
            }

            // 2. Promote Tomorrow tasks to Today
            const tomorrowTasks = allNodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.tomorrow);
            for (const task of tomorrowTasks) {
                await repository.update(task.id, {
                    metadata: { ...task.metadata, isToday: true, tomorrow: false },
                    updatedAt: Date.now()
                });
            }

            await repository.update('ROOT', {
                metadata: { ...rootNode.metadata, lastTodayResetDate: todayStr },
                updatedAt: Date.now()
            });
            console.log(`[Daily Reset] Successfully reset ${todayTasks.length} and promoted ${tomorrowTasks.length} tasks.`);
        }
    }

    async function getAreaReinforcement(dateStr) {
        const rootNode = await repository.getById('ROOT');
        return rootNode?.metadata?.dailyAreaLog?.[dateStr] || {};
    }

    async function getTodayAreaReinforcement() {
        const todayStr = new Date().toLocaleDateString('en-CA');
        return await getAreaReinforcement(todayStr);
    }

    async function getRepetitionLog(dateStr) {
        const rootNode = await repository.getById('ROOT');
        const rawLog = rootNode?.metadata?.dailyRepLog?.[dateStr] || {};
        // Enrich with task names
        const result = {};
        for (const [taskId, count] of Object.entries(rawLog)) {
            const task = await repository.getById(taskId);
            result[taskId] = { name: task?.name || taskId, count };
        }
        return result;
    }

    async function getTodayRepetitionLog() {
        const todayStr = new Date().toLocaleDateString('en-CA');
        return await getRepetitionLog(todayStr);
    }

    const updateMomentum = async (nodeId) => {
        const skill = await findSkillAncestor(repository, nodeId);
        if (skill) {
            await repository.update(skill.id, {
                metadata: { ...skill.metadata, lastWorkedAt: new Date().toISOString() },
                updatedAt: Date.now()
            });
        }
    };

    const createDailyRestSuggestion = async () => {
        const today = new Date().toLocaleDateString('en-CA');
        const allNodes = await repository.getAll();
        const existing = allNodes.find(n => n.type === NodeTypes.SCHEDULED_REST && n.metadata?.scheduledFor === today);
        if (existing) return existing;

        const categories = ["movement", "sensory", "creative", "social"];
        const root = await repository.getById('ROOT');
        const library = root?.metadata?.restActivityLibrary || [];

        let category, activityText;

        if (library.length > 0 && Math.random() < 0.5) {
            const item = library[Math.floor(Math.random() * library.length)];
            category = item.category;
            activityText = item.text;
        } else {
            category = categories[Math.floor(Math.random() * categories.length)];
            const activities = {
                movement: "Take a short walk",
                sensory: "Listen to one song fully",
                creative: "Doodle or sketch freely",
                social: "Send a light message to someone"
            };
            activityText = activities[category];
        }

        const duration = Math.floor(Math.random() * 11) + 5;
        const names = { movement: "Movement Break", sensory: "Sensory Reset", creative: "Creative Expression", social: "Social Connection" };

        const suggestionNode = {
            id: `REST-${Date.now()}`,
            name: names[category] || "Scheduled Rest",
            type: NodeTypes.SCHEDULED_REST,
            parentId: "ROOT",
            metadata: {
                durationMinutes: duration,
                category,
                activityText,
                scheduledFor: today,
                completedAt: null,
                approved: false
            }
        };
        return await repository.save(createNode(suggestionNode));
    };

    const approveRest = async (restId, activityText, saveToLibrary = true) => {
        const rest = await repository.getById(restId);
        if (!rest) return null;

        if (saveToLibrary && activityText) {
            const root = await repository.getById('ROOT');
            if (root) {
                const library = root.metadata.restActivityLibrary || [];
                const isDuplicate = library.some(item => item.text.toLowerCase() === activityText.toLowerCase());

                if (!isDuplicate) {
                    const newEntry = {
                        id: `LIB-${Date.now()}`,
                        text: activityText,
                        category: rest.metadata.category,
                        createdAt: Date.now()
                    };
                    await repository.update('ROOT', {
                        metadata: {
                            ...root.metadata,
                            restActivityLibrary: [...library, newEntry]
                        }
                    });
                }
            }
        }

        const updates = {
            metadata: {
                ...rest.metadata,
                approved: true
            }
        };
        if (activityText !== undefined) {
            updates.metadata.activityText = activityText;
        }
        return await repository.update(restId, updates);
    };

    const completeRest = async (restId) => {
        const rest = await repository.getById(restId);
        if (!rest) return null;
        return await repository.update(restId, { metadata: { ...rest.metadata, completedAt: new Date().toISOString() } });
    };

    const getTodayRest = async () => {
        const today = new Date().toLocaleDateString('en-CA');
        const allNodes = await repository.getAll();
        return allNodes.find(n => n.type === NodeTypes.SCHEDULED_REST && n.metadata?.scheduledFor === today);
    };

    return {
        getDailyCompletionCount,
        incrementDailyCompletionCount,
        checkDailyReset,
        createDailyRestSuggestion,
        approveRest,
        completeRest,
        getTodayRest,
        getAreaReinforcement,
        getTodayAreaReinforcement,
        getRepetitionLog,
        getTodayRepetitionLog,
        updateMomentum
    };
};
