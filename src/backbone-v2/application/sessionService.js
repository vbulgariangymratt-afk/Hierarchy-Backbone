import { NodeTypes, TaskStatuses, ObjectiveStatuses } from '../domain/entities';
import {
    findSkillAncestor,
    findAspectAncestor,
    findObjectiveAncestor,
    recalculateObjectiveAccumulation,
    isLocked
} from './hierarchyHelpers';

export const SessionService = (repository, auraService, deps = {}) => {
    const {
        evaluatePinch,
        protectFromBurnout,
        evaluateObjectiveBurnout,
        updateMomentum,
        incrementDailyCompletionCount
    } = deps;

    return {
        startSession: async (taskId, durationMinutes = 10, predictedPleasure = 0, initiationDelay = 0, logger = console.log) => {
            const task = await repository.getById(taskId);
            if (!task || task.type !== NodeTypes.TASK) throw new Error("Invalid Task");

            console.log(`[DEBUG SessionService] startSession START for task: ${taskId}. Current sessions: ${task.metadata.sessions?.length || 0}`);

            const sessions = task.metadata.sessions || [];
            const newSession = {
                id: Math.random().toString(36).substr(2, 9),
                targetDuration: durationMinutes,
                actualDuration: 0,
                predictedPleasure: parseInt(predictedPleasure),
                initiationDelay: parseInt(initiationDelay),
                startTime: Date.now(),
                status: 'active'
            };

            const updatePayload = {
                metadata: {
                    status: TaskStatuses.IN_PROGRESS,
                    sessions: [...sessions, newSession]
                }
            };
            console.log(`[DEBUG SessionService] startSession updatePayload:`, JSON.stringify(updatePayload));
            
            const result = await repository.update(taskId, updatePayload);
            console.log(`[DEBUG SessionService] startSession PERSISTED. Final sessions: ${result.metadata.sessions.length}`);

            // Aura reinforcement: +1 for Session Start
            if (auraService) {
                await auraService.awardAuraToAncestorSkill(taskId, 1, "Session Start");
            }

            return newSession;
        },

        completeSession: async (taskId, sessionId, actualPleasure = 0, mastery = 0, startCost = 0, logger = console.log) => {
            // HURRY Cleanup: Clear stuckness timer on completion
            const root = await repository.getById('ROOT');
            if (root?.metadata?.nextTaskIdentifiedAt) {
                await repository.update('ROOT', { metadata: { ...root.metadata, nextTaskIdentifiedAt: null } });
            }

            const task = await repository.getById(taskId);
            if (!task) throw new Error("Task not found");

            console.log(`[DEBUG SessionService] completeSession START for task: ${taskId}, sessionId: ${sessionId}. Current sessions: ${task.metadata.sessions?.length || 0}`);

            const sessions = (task.metadata.sessions || []).map(s => {
                if (s.id === sessionId) {
                    const now = Date.now();
                    const actualSeconds = Math.round((now - s.startTime) / 1000);
                    console.log(`[DEBUG SessionService] Found session to complete. Duration: ${actualSeconds}s`);
                    return {
                        ...s,
                        status: 'completed',
                        endTime: now,
                        endedAt: new Date().toISOString(), // ISO standard for audit
                        actualDuration: actualSeconds,
                        actualPleasure: parseInt(actualPleasure),
                        mastery: parseInt(mastery),
                        startCost: parseInt(startCost)
                    };
                }
                return s;
            });

            const updatePayload = {
                metadata: {
                    sessions
                }
            };
            console.log(`[DEBUG SessionService] completeSession updatePayload:`, JSON.stringify(updatePayload));

            const result = await repository.update(taskId, updatePayload);
            console.log(`[DEBUG SessionService] completeSession PERSISTED. Final sessions: ${result.metadata.sessions.length}`);

            // Execution Order: Parallelize side effects to reduce network latency
            const completedSession = sessions.find(s => s.id === sessionId);
            const ancestorSkill = await findSkillAncestor(repository, taskId);
            const ancestorObjective = await findObjectiveAncestor(repository, taskId);

            const sideEffects = [];

            // PINCH Evaluation
            if (ancestorSkill && completedSession && evaluatePinch) {
                sideEffects.push((async () => {
                    const driver = await evaluatePinch(
                        ancestorSkill.id,
                        completedSession.predictedPleasure,
                        completedSession.initiationDelay,
                        logger
                    );
                    // Persist driver into session metadata
                    const sessionsWithDriver = sessions.map(s =>
                        s.id === sessionId ? { ...s, dominantDriver: driver } : s
                    );
                    return repository.update(taskId, {
                        metadata: { sessions: sessionsWithDriver }
                    });
                })());
            }

            // Burnout Protection (Skill Level)
            if (ancestorSkill && protectFromBurnout) {
                sideEffects.push(protectFromBurnout(ancestorSkill.id));
            }

            // Burnout Detection (Objective Level)
            if (ancestorObjective && evaluateObjectiveBurnout) {
                sideEffects.push(evaluateObjectiveBurnout(ancestorObjective.id));
            }

            // Momentum Update
            if (updateMomentum) sideEffects.push(updateMomentum(taskId));
            
            // Global Persistent Counter
            if (incrementDailyCompletionCount) sideEffects.push(incrementDailyCompletionCount());

            // Await all background updates in parallel
            await Promise.all(sideEffects);

            // Accumulation Logic: Add to Aspect
            const parentAspect = await findAspectAncestor(repository, taskId);
            const objectiveToUpdate = await findObjectiveAncestor(repository, taskId);
            if (parentAspect && completedSession && objectiveToUpdate) {
                const accType = objectiveToUpdate.metadata?.accumulationType || 'minutes';
                let amount = 0;
                if (accType === 'minutes') {
                    amount = Math.round(completedSession.actualDuration / 60);
                } else if (accType === 'sessions') {
                    amount = 1;
                }

                if (amount > 0) {
                    const currentAcc = parentAspect.metadata?.accumulatedMetric || 0;
                    const currentCount = parentAspect.metadata?.taskCount || 0;
                    const currentLogs = parentAspect.metadata?.logs || [];
                    const taskNode = await repository.getById(taskId);

                    const newLog = {
                        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name: taskNode?.name || 'Manual Log',
                        amount: amount,
                        timestamp: Date.now()
                    };

                    await repository.update(parentAspect.id, {
                        metadata: {
                            ...parentAspect.metadata,
                            accumulatedMetric: currentAcc + amount,
                            taskCount: currentCount + 1,
                            logs: [...currentLogs, newLog]
                        }
                    });
                    // Sync objective
                    await recalculateObjectiveAccumulation(repository, objectiveToUpdate.id);
                }
            }

            return result;
        },

        getNextExecutableItem: async (skillId, logger = console.log) => {
            logger(`[Resolver] Beginning resolution for Skill ID: ${skillId}`);

            const root = await repository.getById('ROOT');
            const now = Date.now();
            let sprintSuggested = root.metadata?.sprintSuggested || false;

            const allNodes = await repository.getAll();

            const skill = allNodes.find(n => n.id === skillId);
            logger(`[Resolver] Skill Name: ${skill?.name || 'NOT FOUND'}`);

            const objectives = allNodes.filter(n => n.parentId === skillId && n.type === NodeTypes.OBJECTIVE);
            logger(`[Resolver] Found ${objectives.length} objectives under skill.`);

            objectives.forEach(o => {
                logger(`[Resolver]   Objective: ${o.name} [${o.id}], status: ${o.metadata?.status}, isActionable: ${o.metadata?.status === ObjectiveStatuses.ACTIVE}`);
            });

            const activeObjective = objectives.find(n => n.metadata?.status === ObjectiveStatuses.ACTIVE);

            // Log ALL aspects under this skill's objectives for full context
            const allSkillAspects = allNodes.filter(n => n.type === NodeTypes.ASPECT && objectives.some(o => o.id === n.parentId));
            logger(`[Resolver] All aspects under this skill's objectives: ${allSkillAspects.length}`);
            for (const a of allSkillAspects) {
                const parentObj = objectives.find(o => o.id === a.parentId);
                logger(`[Resolver]   Aspect: ${a.name} [${a.id}], parentId: ${a.parentId} (Objective: ${parentObj?.name})`);
            }

            if (!activeObjective) {
                logger(`[Resolver] NONE: No active objective found.`);
                return null;
            }

            const aspects = allNodes.filter(n => n.parentId === activeObjective.id && n.type === NodeTypes.ASPECT);
            logger(`[Resolver] Found ${aspects.length} aspects under objective.`);

            // Aspects are non-linear. We just find the first aspect with incomplete tasks.
            let selectedTask = null;
            for (const aspect of aspects) {
                const tasks = allNodes.filter(n => n.parentId === aspect.id && n.type === NodeTypes.TASK);
                const sortedTasks = tasks.sort((a, b) => (a.metadata?.orderIndex || 0) - (b.metadata?.orderIndex || 0));
                selectedTask = sortedTasks.find(t => t.metadata?.status !== TaskStatuses.DONE);
                if (selectedTask) break;
            }

            if (!selectedTask) {
                logger(`[Resolver] NONE: No incomplete tasks found in any aspect of objective ${activeObjective.id}.`);
                return null;
            }

            logger(`[Resolver] Evaluating task "${selectedTask.name}" [${selectedTask.id}]`);

            const selected = selectedTask;
            if (selected) {
                logger(`[Resolver] SUCCESS: Selected "${selected.name}"`);

                // HURRY Detection: Next task exists and 3 minutes pass without completion
                // BACKEND PROTECTION: Suppress HURRY behavioral escalation (sprintSuggested) during burnout
                const isBurntOut = activeObjective.metadata?.burnoutRisk === true;
                const identifiedAt = root.metadata?.nextTaskIdentifiedAt;

                if (!identifiedAt) {
                    await repository.update('ROOT', { metadata: { ...root.metadata, nextTaskIdentifiedAt: now } });
                } else if (!isBurntOut && !sprintSuggested && (now - identifiedAt) > 3 * 60 * 1000) {
                    await repository.update('ROOT', { metadata: { ...root.metadata, sprintSuggested: true } });
                }
            } else {
                logger(`[Resolver] NONE: No qualifying task found.`);
                if (root.metadata?.nextTaskIdentifiedAt) {
                    await repository.update('ROOT', { metadata: { ...root.metadata, nextTaskIdentifiedAt: null } });
                }
            }

            return selected;
        },

        getTodayFocusTask: async () => {
            const allNodes = await repository.getAll();

            // 1. Filter for incomplete tasks marked as "Today"
            const todayTasks = allNodes.filter(n =>
                n.type === NodeTypes.TASK &&
                n.metadata?.isToday === true &&
                n.metadata?.status !== TaskStatuses.DONE
            );

            // 2. Identify which ones are currently actionable (not locked)
            // We evaluate them in the order they appear in the repository (usually sequential)
            for (const task of todayTasks) {
                const locked = await isLocked(repository, task.id);
                if (!locked) {
                    // This is our next Focus Action
                    return task;
                }
            }

            return null;
        }
    };
};
