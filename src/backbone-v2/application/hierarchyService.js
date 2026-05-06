import { createNode, ValidParentMap, NodeTypes, TaskStatuses, ObjectiveStatuses, IdentityTiers } from '../domain/entities';

import {
    validateRelation,
    isLocked,
    checkAutoLock,
    findSkillAncestor,
    findObjectiveAncestor,
    findAspectAncestor,
    buildTree,
    recalculateObjectiveAccumulation
} from './hierarchyHelpers';

import { NodeService } from './nodeService';
import { SessionService } from './sessionService';
import { RewardService } from './rewardService';
import { MotivationService } from './motivationService';
import { DailyService } from './dailyService';
import { LifecycleService } from './lifecycleService';

export const HierarchyService = (repository, auraService) => {
    
    // Instantiate all services with dependency injection
    const rewardService = RewardService(repository);
    const motivationService = MotivationService(repository);
    const dailyService = DailyService(repository);

    const lifecycleService = LifecycleService(repository, {
        ensureRewardVaultSetup: rewardService.ensureRewardVaultSetup,
        initializeMarketplace: rewardService.initializeMarketplace,
        createDailyRestSuggestion: dailyService.createDailyRestSuggestion,
        checkDailyReset: dailyService.checkDailyReset
    });

    const sessionServiceDeps = {
        evaluatePinch: motivationService.evaluatePinch,
        protectFromBurnout: motivationService.protectFromBurnout,
        evaluateObjectiveBurnout: motivationService.evaluateObjectiveBurnout,
        updateMomentum: dailyService.updateMomentum,
        incrementDailyCompletionCount: dailyService.incrementDailyCompletionCount
    };

    const nodeServiceDeps = {
        incrementDailyCompletionCount: dailyService.incrementDailyCompletionCount,
        awardHryvnia: rewardService.awardHryvnia,
        updateMomentum: dailyService.updateMomentum,
        protectFromBurnout: motivationService.protectFromBurnout
    };

    const nodeService = NodeService(repository, auraService, nodeServiceDeps);
    const sessionService = SessionService(repository, auraService, sessionServiceDeps);

    const localService = {
        getTree: async () => {
            const allNodes = await repository.getAll();
            const tree = buildTree(allNodes);
            return tree;
        },

        getAllNodes: async () => {
            return await repository.getAll();
        },

        getNodesByParent: async (parentId) => {
            return await repository.getNodesByParent(parentId);
        },

        getNodesByType: async (type) => {
            return await repository.getNodesByType(type);
        },

        getChildrenOf: async (nodeId) => {
            return await repository.getChildrenOf(nodeId);
        },

        recordNudge: async () => {
            const root = await repository.getById('ROOT');
            const now = Date.now();
            const history = (root.metadata?.nudgeHistory || []).filter(t => now - t < 5 * 60 * 1000);
            const newHistory = [...history, now];
            await repository.update('ROOT', {
                metadata: {
                    ...root.metadata,
                    nudgeHistory: newHistory,
                    sprintSuggested: root.metadata?.sprintSuggested || newHistory.length >= 2
                }
            });
        },

        trackFocusMode: async (isActive, logger = () => {}) => {
            const root = await repository.getById('ROOT');
            if (!root) return;
            const now = Date.now();
            const updates = { metadata: { ...root.metadata } };
            if (isActive) {
                logger("[HURRY CHECK] Evaluating stuck state...");
                updates.metadata.focusModeEntryAt = now;

                // Selection Logic: If starting focus mode, ensure we have a starting point
                const selected = root.metadata.todaySelectedAreaIds || [];
                if (selected.length > 0) {
                    updates.metadata.currentFocusAreaId = selected[0]; // Start with the highest priority selected Area
                }

                // Stuck Check #2: Next task exists and 3 minutes pass
                const identifiedAt = root.metadata?.nextTaskIdentifiedAt;
                if (identifiedAt && !root.metadata?.sprintSuggested && (now - identifiedAt) > 3 * 60 * 1000) {
                    updates.metadata.sprintSuggested = true;
                } else if (!identifiedAt) {
                    // Initialize identification if a task exists
                    const allNodes = await repository.getAll();
                    const hasTask = allNodes.some(n => n.type === NodeTypes.TASK && n.metadata?.status !== TaskStatuses.DONE);
                    if (hasTask) {
                        updates.metadata.nextTaskIdentifiedAt = now;
                    }
                }
            } else {
                const entryAt = root.metadata?.focusModeEntryAt;
                if (entryAt && (now - entryAt) < 60 * 1000) {
                    updates.metadata.sprintSuggested = true;
                }
                updates.metadata.focusModeEntryAt = null;
                updates.metadata.currentFocusAreaId = null; // Clear focus area on exit
            }
            await repository.update('ROOT', updates);
        },

        saveSelectedAreas: async (areaIds) => {
            const root = await repository.getById('ROOT');
            if (!root) return;
            await repository.update('ROOT', {
                metadata: {
                    ...root.metadata,
                    todaySelectedAreaIds: areaIds
                }
            });
        },

        startSprint: async (durationMinutes = 5) => {
            const root = await repository.getById('ROOT');
            await repository.update('ROOT', {
                metadata: {
                    ...root.metadata,
                    activeSprint: { startedAt: Date.now(), durationMinutes },
                    sprintSuggested: false,
                    nextTaskIdentifiedAt: Date.now()
                }
            });
        },

        endSprint: async () => {
            const root = await repository.getById('ROOT');
            await repository.update('ROOT', {
                metadata: { ...root.metadata, activeSprint: null }
            });
        },

        dismissSprintSuggestion: async () => {
            const root = await repository.getById('ROOT');
            await repository.update('ROOT', {
                metadata: { ...root.metadata, sprintSuggested: false, nextTaskIdentifiedAt: Date.now() }
            });
        },

        getTotalAuraPoints: async () => {
            return await auraService.getTotalAuraPoints();
        },

        getGlobalLevel: async () => {
            const totalPoints = await auraService.getTotalAuraPoints();
            return auraService.calculateLevel(totalPoints);
        },

        getSkillLevel: async (skillId) => {
            const skill = await repository.getById(skillId);
            if (!skill || skill.type !== NodeTypes.SKILL) return 1;
            return auraService.calculateLevel(skill.metadata?.auraTotal || 0);
        },

        getTopPriorityAreas: async () => {
            const allNodes = await repository.getAll();
            const areas = allNodes.filter(n => n.type === NodeTypes.LIFE_AREA && n.id !== 'ROOT');

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            const windowDays = [today, today - oneDayMs, today - (2 * oneDayMs)];

            const root = await repository.getById('ROOT');
            const selectedIds = root?.metadata?.todaySelectedAreaIds || [];

            const scoredAreas = areas.map(area => {
                const descendantNodes = allNodes.filter(n => {
                    // Simple parent-child recursion check (since it's a shallow tree usually)
                    if (n.parentId === area.id) return true;
                    const parent = allNodes.find(p => p.id === n.parentId);
                    if (parent && parent.parentId === area.id) return true; // objective -> skill -> area
                    const grandParent = parent ? allNodes.find(gp => gp.id === parent.parentId) : null;
                    if (grandParent && grandParent.parentId === area.id) return true; // aspect -> objective -> skill -> area
                    const ggrandParent = grandParent ? allNodes.find(ggp => ggp.id === grandParent.parentId) : null;
                    if (ggrandParent && ggrandParent.parentId === area.id) return true; // task -> aspect -> objective -> skill
                    return false;
                });

                const descendantSkills = descendantNodes.filter(n => n.type === NodeTypes.SKILL);
                const descendantTasks = descendantNodes.filter(n => n.type === NodeTypes.TASK);

                // areaAura rolling sum
                const areaAura = descendantSkills.reduce((sum, s) => sum + (s.metadata?.auraTotal || 0), 0);

                // 1. PINCH & BASE SCORE
                let score = 0;
                const pinchStates = [];
                descendantSkills.forEach(skill => {
                    if (skill.metadata?.pinchState) {
                        score += 10;
                        pinchStates.push(skill.metadata.pinchState);
                    }
                    if (skill.metadata?.isActive) score += 5;
                    if (skill.metadata?.lastWorkedAt) {
                        const lw = new Date(skill.metadata.lastWorkedAt).getTime();
                        if (Date.now() - lw < oneDayMs) score += 3;
                    }
                });

                // 2. ROLLING MOMENTUM
                const completedDates = new Set();
                descendantTasks.forEach(task => {
                    const sessions = task.metadata?.sessions || [];
                    sessions.forEach(s => {
                        if (s.status === 'completed' && s.endTime) {
                            const d = new Date(s.endTime);
                            const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                            if (windowDays.includes(midnight)) {
                                completedDates.add(midnight);
                            }
                        }
                    });
                });
                const reinforcedDaysLast3 = completedDates.size;
                const inMotion = reinforcedDaysLast3 >= 2;

                const aspects = descendantNodes.filter(n => n.type === NodeTypes.ASPECT);

                // Sort aspects by most recent session completion if needed, or just collect them
                const aspectWithRecency = aspects.map(aspect => {
                    const tasks = descendantTasks.filter(t => t.parentId === aspect.id);
                    let latestSessionTime = 0;
                    tasks.forEach(t => {
                        (t.metadata?.sessions || []).forEach(s => {
                            if (s.endTime > latestSessionTime) latestSessionTime = s.endTime;
                        });
                    });
                    return { aspect, latestSessionTime };
                }).sort((a, b) => b.latestSessionTime - a.latestSessionTime);

                const currentAspect = aspectWithRecency[0]?.aspect;
                let stageInfo = null; // Reusing naming but semantics are different
                let nextMinimalStep = null;

                if (currentAspect) {
                    const siblingAspects = allNodes.filter(n => n.parentId === currentAspect.parentId && n.type === NodeTypes.ASPECT);

                    const currentIndex = siblingAspects.findIndex(s => s.id === currentAspect.id);

                    stageInfo = {
                        currentStageIndex: currentIndex + 1,
                        totalStages: siblingAspects.length
                    };

                    const tasks = descendantTasks
                        .filter(t => t.parentId === currentAspect.id)
                        .sort((a, b) => (a.metadata?.orderIndex || 0) - (b.metadata?.orderIndex || 0));

                    const nextTask = tasks.find(t => t.metadata?.status !== TaskStatuses.DONE);
                    if (nextTask) {
                        nextMinimalStep = {
                            label: nextTask.name,
                            auraReward: 2
                        };
                    }
                }

                const hasActiveSkills = descendantSkills.some(s =>
                    s.metadata?.status === 'ACTIVE' || (s.metadata?.isActive && s.metadata?.status !== 'SLEEPING')
                );

                return {
                    ...area,
                    score,
                    areaAura,
                    activePinch: pinchStates[0] || null,
                    stageInfo,
                    rollingMomentum: { reinforcedDaysLast3 },
                    inMotion,
                    nextMinimalStep,
                    hasActiveSkills,
                    isActive: selectedIds.includes(area.id)
                };
            });

            return scoredAreas
                .sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return a.name.localeCompare(b.name);
                });
        },

        incrementTaskRepetition: async (taskId) => {
            const task = await repository.getById(taskId);
            if (!task || task.type !== NodeTypes.TASK) throw new Error("Item not found");

            // Item must be in an actionable state (not locked by sequence)
            if (await isLocked(repository, taskId)) {
                throw new Error("Cannot increment: This item is locked by sequential progression.");
            }

            const cur = (task.metadata?.currentUnits || 0) + 1;
            const res = await nodeService.updateNode(taskId, {
                metadata: { currentUnits: cur }
            });

            // Update momentum (lastWorkedAt on skill ancestor)
            await dailyService.updateMomentum(taskId);

            // Daily Rep Log: stamp today's increment on ROOT
            const todayStr = new Date().toLocaleDateString('en-CA');
            const rootNode = await repository.getById('ROOT');
            const dailyRepLog = rootNode?.metadata?.dailyRepLog || {};
            const todayLog = dailyRepLog[todayStr] || {};
            await repository.update('ROOT', {
                metadata: {
                    ...rootNode.metadata,
                    dailyRepLog: {
                        ...dailyRepLog,
                        [todayStr]: {
                            ...todayLog,
                            [taskId]: (todayLog[taskId] || 0) + 1
                        }
                    }
                }
            });

            // Accumulation Logic: Reps
            const parentAspect = await findAspectAncestor(repository, taskId);
            const ancestorObjective = await findObjectiveAncestor(repository, taskId);
            if (parentAspect && ancestorObjective?.metadata?.accumulationType === 'reps') {
                const currentAcc = parentAspect.metadata?.accumulatedMetric || 0;
                const currentCount = parentAspect.metadata?.taskCount || 0;
                await repository.update(parentAspect.id, {
                    metadata: {
                        ...parentAspect.metadata,
                        accumulatedMetric: currentAcc + 1,
                        taskCount: currentCount + 1
                    }
                });
                await recalculateObjectiveAccumulation(repository, ancestorObjective.id);
            }
            return res;
        },

        updateTaskRepetitionTarget: async (taskId, newTarget) => {
            const task = await repository.getById(taskId);
            if (!task || task.type !== NodeTypes.TASK) throw new Error("Item not found");

            // Rule: Increasing targetUnits must NOT reduce currentUnits. (Naturally handled by updateNode)
            // Decreasing targetUnits may immediately mark repetition block complete (Handled by updateNode threshold)
            return await nodeService.updateNode(taskId, {
                metadata: { targetUnits: Number(newTarget) }
            });
        },

        isLocked: async (nodeId) => await isLocked(repository, nodeId),
        evaluateSkillFatigue: motivationService.protectFromBurnout,
        recalculateObjectiveAccumulation: async (id) => await recalculateObjectiveAccumulation(repository, id)
    };

    return Object.assign(
        {},
        nodeService,
        sessionService,
        rewardService,
        motivationService,
        dailyService,
        lifecycleService,
        localService
    );
};
