import { createNode, NodeTypes, TaskStatuses, ObjectiveStatuses } from '../domain/entities';
import { 
    validateRelation, 
    recalculateObjectiveAccumulation, 
    findObjectiveAncestor, 
    findSkillAncestor 
} from './hierarchyHelpers';

export const NodeService = (repository, auraService, deps = {}) => {
    const {
        incrementDailyCompletionCount,
        awardHryvnia,
        updateMomentum,
        protectFromBurnout
    } = deps;

    return {
        addNode: async (nodeData) => {
            console.log('[ADDNODE] addNode called');
            const { type } = nodeData;
            const parentId = nodeData.parentId ? String(nodeData.parentId) : null;
            const id = nodeData.id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            await validateRelation(repository, type, parentId);

            // Add default metadata based on type
            const metadata = { ...nodeData.metadata };
            if (type === NodeTypes.TASK) {
                metadata.status = TaskStatuses.NOT_STARTED;
                metadata.sessions = [];
                metadata.orderIndex = metadata.orderIndex || 0;
            } else if (type === NodeTypes.OBJECTIVE) {
                metadata.theme = metadata.theme || '';
                metadata.accumulationType = metadata.accumulationType || 'tasks or activities';
                metadata.status = ObjectiveStatuses.ACTIVE;
                metadata.isActive = true;
                metadata.isSleeping = false;
                metadata.isArchived = false;
                metadata.activatedAt = Date.now();
                metadata.locked = false;
                metadata.masterAccumulatedMetric = 0;
            } else if (type === NodeTypes.ASPECT) {
                metadata.accumulatedMetric = 0;
                metadata.taskCount = 0;
                metadata.status = 'ACTIVE'; // Aspects are generally active once created
            } else if (type === NodeTypes.SKILL) {
                if (!nodeData.metadata?.identityTier) {
                    throw new Error("Skill creation requires an explicit identityTier.");
                }
                metadata.isActive = false;
                metadata.lastWorkedAt = null;
                metadata.identityTier = nodeData.metadata.identityTier;
                metadata.pinchState = null;
            } else if (type === NodeTypes.REWARD) {
                if (!metadata.rewardCategory) {
                    throw new Error("Reward creation requires an explicit rewardCategory (TASK or MARKETPLACE).");
                }
                metadata.rewardTier = metadata.rewardTier || 1;
            }

            const newNode = createNode({ ...nodeData, id, parentId, metadata });
            const saved = await repository.save(newNode);

            // Sync objective accumulation whenever an aspect is added
            if (type === NodeTypes.ASPECT && parentId) {
                await recalculateObjectiveAccumulation(repository, parentId);
            }

            return saved;
        },

        moveNode: async (nodeId, newParentId) => {
            const node = await repository.getById(nodeId);
            if (!node) throw new Error("Node not found");

            await validateRelation(repository, node.type, newParentId);

            node.parentId = newParentId;
            node.updatedAt = Date.now();
            return await repository.save(node);
        },

        updateNode: async (nodeId, updates) => {
            const existing = await repository.getById(nodeId);
            if (!existing) throw new Error("Node not found");

            // Diagnostic: Store initial session count
            const initialSessionCount = existing.metadata?.sessions?.length || 0;

            // BACKEND PROTECTION: Requirement Escalation
            const ancestorObjective = await findObjectiveAncestor(repository, nodeId);
            if (ancestorObjective?.metadata?.burnoutRisk === true) {
                // Prevent increasing targetUnits, targetDuration, or threshold
                if (updates.metadata?.targetUnits > (existing.metadata?.targetUnits || 0)) {
                    updates.metadata.targetUnits = existing.metadata.targetUnits;
                }
                if (updates.metadata?.targetDuration > (existing.metadata?.targetDuration || 0)) {
                    updates.metadata.targetDuration = existing.metadata.targetDuration;
                }
                if (updates.metadata?.threshold > (existing.metadata?.threshold || 0)) {
                    updates.metadata.threshold = existing.metadata.threshold;
                }
            }

            const newUpdates = { ...updates };
            if (updates.metadata) {
                // IMPORTANT: Use latest metadata from repository state as base to prevent stale overwrite
                const existingMetadata = existing.metadata || {};
                const incomingMetadata = updates.metadata || {};

                // PERMANENT INTEGRITY GUARD: Never let metadata.sessions shrink unless explicitly requested by specific internal services
                const existingSessions = existingMetadata.sessions || [];
                const incomingSessions = incomingMetadata.sessions;

                let mergedSessions = existingSessions;
                if (incomingSessions !== undefined) {
                    if (incomingSessions.length < existingSessions.length) {
                        console.warn(`[CRITICAL] Integrity Trigger: Prevented session loss on node ${nodeId}. Existing: ${existingSessions.length}, Incoming: ${incomingSessions.length}`);
                        mergedSessions = existingSessions; // Restore
                    } else {
                        mergedSessions = incomingSessions; // Use new ones (expansion/update)
                    }
                }

                newUpdates.metadata = { 
                    ...existingMetadata, 
                    ...incomingMetadata,
                    sessions: mergedSessions
                };

                // Guard for subSteps too
                if (existingMetadata.subSteps && !incomingMetadata.subSteps) {
                    newUpdates.metadata.subSteps = existingMetadata.subSteps;
                }
            }

            // AUTO-COMPLETE REPETITION BLOCKS
            // If currentUnits matches or exceeds targetUnits, auto-mark as DONE.
            if (existing.type === NodeTypes.TASK && (updates.metadata?.currentUnits !== undefined || updates.metadata?.targetUnits !== undefined)) {
                const cur = newUpdates.metadata?.currentUnits || 0;
                const tar = newUpdates.metadata?.targetUnits || 0;
                const itemType = newUpdates.metadata?.itemType || existing.metadata?.itemType;

                if (itemType === 'REPETITION' && tar > 0 && cur >= tar && existing.metadata?.status !== TaskStatuses.DONE) {
                    newUpdates.metadata.status = TaskStatuses.DONE;
                }
            }

            // Objective status logic (Part 1: Validation and Achieved timestamp)
            if (existing.type === NodeTypes.OBJECTIVE && updates.metadata?.status) {
                if (updates.metadata.status === ObjectiveStatuses.ACHIEVED &&
                    existing.metadata?.status !== ObjectiveStatuses.ACHIEVED) {
                    newUpdates.metadata = {
                        ...newUpdates.metadata,
                        achievedAt: Date.now()
                    };
                }
            }

            // Task status logic (Part 1: Completed timestamp + Auto-close focus sessions)
            if (existing.type === NodeTypes.TASK && newUpdates.metadata?.status === TaskStatuses.DONE && existing.metadata?.status !== TaskStatuses.DONE) {
                const now = Date.now();
                
                // 1. Ensure completion timestamp
                newUpdates.metadata.completedAt = existing.metadata?.completedAt || now;

                // 2. AUTO-CLOSE Logic: Find most recent active session
                const sessions = [...(newUpdates.metadata.sessions || [])];
                let lastActiveIdx = -1;
                for (let i = sessions.length - 1; i >= 0; i--) {
                    if (sessions[i].status === 'active' || (!sessions[i].endTime && sessions[i].startTime)) {
                        lastActiveIdx = i;
                        break;
                    }
                }

                if (lastActiveIdx !== -1) {
                    const s = sessions[lastActiveIdx];
                    const endTime = now;
                    const startTime = s.startTime || now;
                    const durationSeconds = Math.round((endTime - startTime) / 1000);
                    
                    sessions[lastActiveIdx] = {
                        ...s,
                        status: 'completed',
                        endTime: endTime,
                        endedAt: new Date(endTime).toISOString(),
                        actualDuration: Math.max(0, durationSeconds)
                    };
                    
                    newUpdates.metadata.sessions = sessions;
                    console.log(`[Auto-Close Focus] Recovered ${durationSeconds}s from active session on task "${existing.name}"`);
                }
            }

            // Cooldown Logic: Force deactivation if cooldown is enabled
            if (existing.type === NodeTypes.SKILL && newUpdates.metadata?.cooldownActive) {
                newUpdates.metadata.isActive = false;
                delete newUpdates.metadata.activatedAt;
            }

            // Active Skill Logic: Max 100
            if (existing.type === NodeTypes.SKILL && updates.metadata?.isActive !== undefined) {
                const isActivating = updates.metadata.isActive;
                const wasActive = existing.metadata?.isActive;

                if (isActivating && !wasActive) {
                    // Cooldown Authority: Prevent activation if on cooldown
                    if (existing.metadata?.cooldownActive) {
                        throw new Error("Cooldown Authority: This skill is resting and cannot be activated manually.");
                    }

                    const allNodes = await repository.getAll();
                    const activeSkillsCount = allNodes.filter(n => n.type === NodeTypes.SKILL && n.metadata?.isActive).length;

                    if (activeSkillsCount >= 100) {
                        console.log("ACTIVE LIMIT BLOCKED: 100 skills already active");
                        throw new Error("Active Skill Capacity Reached: You have 100 active skills. Please rest some before activating more.");
                    }

                    newUpdates.metadata.activatedAt = Date.now();
                } else if (!isActivating && wasActive) {
                    delete newUpdates.metadata.activatedAt;
                }
            }

            // Cooldown Logic: Force deactivation if cooldown is enabled
            if (existing.type === NodeTypes.SKILL && newUpdates.metadata?.cooldownActive) {
                newUpdates.metadata.isActive = false;
                delete newUpdates.metadata.activatedAt;
            }

            // --- PRIMARY UPDATE ---
            const result = await repository.update(nodeId, newUpdates);
            
            // Final verification: Ensure sessions were not lost
            const finalSessionCount = result.metadata?.sessions?.length || 0;
            if (initialSessionCount > 0 && finalSessionCount < initialSessionCount) {
                console.error(`[CRITICAL] Session Loss Detected for ${nodeId}! Initial: ${initialSessionCount}, Final: ${finalSessionCount}`);
            } else if (initialSessionCount > 0) {
                console.log(`[PASS] Session integrity verified for ${nodeId}. Sessions: ${finalSessionCount}`);
            }

            // SIDE EFFECTS - OBJECTIVE
            if (existing.type === NodeTypes.OBJECTIVE && newUpdates.metadata?.status === ObjectiveStatuses.ACHIEVED && existing.metadata?.status !== ObjectiveStatuses.ACHIEVED) {
                console.log("Achieved Objective -> Triggering Achieved Rewards");
                if (incrementDailyCompletionCount) await incrementDailyCompletionCount();

                // Tier progression
                const root = await repository.getById('ROOT');
                if (root) {
                    const currentTier = root.metadata?.unlockedRewardTier || 1;
                    await repository.update('ROOT', {
                        metadata: { ...root.metadata, unlockedRewardTier: currentTier + 1 }
                    });
                    console.log(`[Tier Progression] Reward Tier upgraded to ${currentTier + 1}`);
                }
            }

            // SIDE EFFECTS - TASK
            if (existing.type === NodeTypes.TASK && newUpdates.metadata?.status === TaskStatuses.DONE && existing.metadata?.status !== TaskStatuses.DONE) {
                const sideEffects = [];

                // 1. Task Reward
                if (awardHryvnia) sideEffects.push(awardHryvnia(1, "Task Reward"));

                // 2. Momentum Update
                if (updateMomentum) sideEffects.push(updateMomentum(nodeId));

                // 3. Fatigue Evaluation
                sideEffects.push((async () => {
                    const ancestorSkill = await findSkillAncestor(repository, nodeId);
                    if (ancestorSkill && protectFromBurnout) {
                        await protectFromBurnout(ancestorSkill.id);
                    }
                })());

                // 4. Aura reinforcement
                if (auraService) {
                    sideEffects.push(auraService.awardAuraToAncestorSkill(nodeId, 1, "Task Done"));
                }

                // 5. Daily Area Reinforcement Log
                sideEffects.push((async () => {
                    const skill = await findSkillAncestor(repository, nodeId);
                    if (skill && skill.parentId) {
                        const areaId = skill.parentId;
                        const todayStr = new Date().toLocaleDateString('en-CA');
                        const rootNode = await repository.getById('ROOT');
                        if (rootNode) {
                            const metadata = rootNode.metadata || {};
                            const log = { ...(metadata.dailyAreaLog || {}) };
                            if (!log[todayStr]) log[todayStr] = {};

                            const mergedMetadata = { ...(existing.metadata || {}), ...(newUpdates.metadata || {}) };
                            const subSteps = mergedMetadata.subSteps || [];
                            const completedSubStepsCount = subSteps.filter(s => s.isCompleted).length;
                            const sessions = mergedMetadata.sessions || [];
                            const completedSessionsTodayCount = sessions.filter(s => {
                                if (s.status !== 'completed' || !s.endTime) return false;
                                const sessionDate = new Date(s.endTime).toLocaleDateString('en-CA');
                                return sessionDate === todayStr;
                            }).length;

                            const reinforcementUnits = 1 + completedSubStepsCount + completedSessionsTodayCount;
                            log[todayStr][areaId] = (log[todayStr][areaId] || 0) + reinforcementUnits;
                            
                            return repository.update('ROOT', { metadata: { ...metadata, dailyAreaLog: log } });
                        }
                    }
                })());

                // 6. Global Persistent Counter
                if (incrementDailyCompletionCount) sideEffects.push(incrementDailyCompletionCount());

                // Run all side effects in parallel
                await Promise.all(sideEffects);
            }

            // Sync objective accumulation after any aspect metadata change
            if (existing.type === NodeTypes.ASPECT && (updates.metadata?.accumulatedMetric !== undefined || updates.metadata?.status)) {
                await recalculateObjectiveAccumulation(repository, existing.parentId);
            }

            return result;
        },

        deleteNode: async (nodeId) => {
            console.log("HierarchyService: Deleting node", nodeId);
            // We removed the isLocked check here to allow management actions (deleting) 
            // even if a node is currently locked for execution/completion.

            const allNodes = await repository.getAll();

            const findDescendantIds = (parentId, visited = new Set()) => {
                if (visited.has(parentId)) return [];
                visited.add(parentId);

                let ids = [];
                const children = allNodes.filter(n => n.parentId === parentId);
                for (const child of children) {
                    ids.push(child.id);
                    ids = ids.concat(findDescendantIds(child.id, visited));
                }
                return ids;
            };

            const descendantIds = findDescendantIds(nodeId);
            const allIdsToDelete = [...descendantIds, nodeId];

            if (repository.deleteMany) {
                await repository.deleteMany(allIdsToDelete);
            } else {
                for (const id of allIdsToDelete) {
                    await repository.delete(id);
                }
            }

            // Sync objective accumulation if an aspect was deleted
            const deletedNode = allNodes.find(n => n.id === nodeId);
            if (deletedNode?.type === NodeTypes.ASPECT && deletedNode.parentId) {
                await recalculateObjectiveAccumulation(repository, deletedNode.parentId);
            }

            console.log("CASCADE DELETE COMPLETE");
        }
    };
};
