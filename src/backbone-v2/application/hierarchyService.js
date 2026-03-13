import { createNode, ValidParentMap, NodeTypes, TaskStatuses, ObjectiveStatuses, IdentityTiers } from '../domain/entities';

const LOCK_THRESHOLD_DAYS = 7;

/**
 * Service for managing the hierarchy structure.
 * This layer contains the business logic for hierarchy operations.
 */
export const HierarchyService = (repository, auraService) => {
    // Hoisted helper functions for internal use
    // ---------------------------------------------------------
    // HOISTED UTILITIES (Always in scope throughout the closure)
    // ---------------------------------------------------------

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
            rootNode = await repository.save({
                id: 'ROOT',
                name: 'System Root',
                type: NodeTypes.LIFE_AREA,
                metadata: { hryvniaBalance: 0, dailyCompletions: {}, dailyAreaLog: {} },
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
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
        console.log("DAILY COMPLETION COUNTER UPDATED", { dateKey: todayStr, newValue: dailyCompletions[todayStr] });
    }

    const validateRelation = async (type, parentId) => {
        const allowedParents = ValidParentMap[type];

        if (!allowedParents) {
            throw new Error(`Unknown node type: ${type}`);
        }

        // Normalize parentId to null if it's essentially empty
        const normalizedParentId = parentId === 'null' || parentId === undefined ? null : parentId;

        if (normalizedParentId === null) {
            if (!allowedParents.includes(null)) {
                throw new Error(`${type} must have a parent.`);
            }
            return;
        }

        const parent = await repository.getById(normalizedParentId);
        if (!parent) {
            const allNodes = await repository.getAll();
            const allIds = allNodes.map(n => n.id);
            console.error(`HierarchyService [Parent Not Found]: Looking for ${normalizedParentId}. Existing IDs in repo:`, allIds);
            throw new Error(`Parent node with ID ${normalizedParentId} not found. (Current Repo Size: ${allIds.length})`);
        }

        if (!allowedParents.includes(parent.type) && !allowedParents.includes(parent.id)) {
            throw new Error(`Node of type ${type} cannot be a child of ${parent.id} [${parent.type}]. Allowed parents: ${allowedParents.join(', ')}`);
        }
    };

    const isLocked = async (nodeId, visited = new Set()) => {
        if (!nodeId || visited.has(nodeId)) return false;
        const node = await repository.getById(nodeId);
        if (!node) return false;

        visited.add(nodeId);

        // 1. Direct lock check (Manual Overrides)
        if (node.metadata?.locked) return true;

        // 2. Sequential Unlocking (Removed)
        // System has shifted from linear completion model to parallel engagement model.
        // Tasks are no longer blocked by their order index relative to incomplete siblings.

        // 3. Recursive parent check (Objective lock, area lock, etc.)
        if (node.parentId) {
            return await isLocked(node.parentId, visited);
        }

        return false;
    };

    const checkAutoLock = (node) => {
        if (node.type === NodeTypes.OBJECTIVE &&
            node.metadata?.status === ObjectiveStatuses.ACHIEVED &&
            node.metadata?.achievedAt &&
            !node.metadata?.locked) {

            const daysSinceAchieved = (Date.now() - node.metadata.achievedAt) / (1000 * 60 * 60 * 24);
            if (daysSinceAchieved >= LOCK_THRESHOLD_DAYS) {
                return {
                    ...node,
                    metadata: { ...node.metadata, locked: true },
                    updatedAt: Date.now()
                };
            }
        }
        return node;
    };

    /**
     * Ancestor Helper: Finds the Skill parent for any given node
     */
    const findSkillAncestor = async (id) => {
        const node = await repository.getById(id);
        if (!node) return null;
        if (node.type === NodeTypes.SKILL) return node;
        if (!node.parentId) return null;
        return await findSkillAncestor(node.parentId);
    };

    /**
     * Ancestor Helper: Finds the Objective parent for any given node
     */
    const findObjectiveAncestor = async (id) => {
        const node = await repository.getById(id);
        if (!node) return null;
        if (node.type === NodeTypes.OBJECTIVE) return node;
        if (!node.parentId) return null;
        return await findObjectiveAncestor(node.parentId);
    };

    /**
     * Ancestor Helper: Finds the Aspect parent for any given node
     */
    const findAspectAncestor = async (id) => {
        const node = await repository.getById(id);
        if (!node) return null;
        if (node.type === NodeTypes.ASPECT) return node;
        if (!node.parentId) return null;
        return await findAspectAncestor(node.parentId);
    };

    /**
     * Sync Helper: Recomputes masterAccumulatedMetric on the parent objective.
     * Called whenever an aspect is modified or a task updates.
     */
    const recalculateObjectiveAccumulation = async (objectiveId) => {
        if (!objectiveId) return;
        const objective = await repository.getById(objectiveId);
        if (!objective || objective.type !== NodeTypes.OBJECTIVE) return;

        const allNodes = await repository.getAll();
        const aspects = allNodes.filter(n => n.parentId === objectiveId && n.type === NodeTypes.ASPECT);

        const totalMetric = aspects.reduce((sum, aspect) => sum + (aspect.metadata?.accumulatedMetric || 0), 0);

        await repository.update(objectiveId, {
            metadata: {
                ...objective.metadata,
                masterAccumulatedMetric: totalMetric
            }
        });
    };

    /**
     * Returns reinforcement counts for all areas for today's date only.
     */
    async function getTodayAreaReinforcement() {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const rootNode = await repository.getById('ROOT');
        return rootNode?.metadata?.dailyAreaLog?.[todayStr] || {};
    }

    /**
     * Momentum Helper: Updates the lastWorkedAt of the ancestor Skill
     */
    const updateMomentum = async (nodeId) => {
        const skill = await findSkillAncestor(nodeId);
        if (skill) {
            await repository.update(skill.id, {
                metadata: { ...skill.metadata, lastWorkedAt: new Date().toISOString() },
                updatedAt: Date.now()
            });
        }
    };

    /*
    BURNOUT PROTECTION LAYER
    Purpose: 
    Detect physiological overload, abandonment patterns, and reward collapse.
    This system overrides motivational optimization.
    */
    const protectFromBurnout = async (skillId) => {
        console.log("🔥 BURNOUT PROTECTION CHECK ENTERED");
        const skill = await repository.getById(skillId);
        if (!skill || skill.type !== NodeTypes.SKILL) return;

        console.log(`DEBUG: Evaluating fatigue for skill: ${skill.name}`);

        const allNodes = await repository.getAll();

        const getDescendantTasks = (parentId) => {
            let tasks = [];
            const children = allNodes.filter(n => n.parentId === parentId);
            for (const child of children) {
                if (child.type === NodeTypes.TASK) {
                    tasks.push(child);
                }
                tasks = tasks.concat(getDescendantTasks(child.id));
            }
            return tasks;
        };

        const tasks = getDescendantTasks(skillId);
        const now = Date.now();
        console.log(`DEBUG: Fatigue test mode active (1d/2d windows)`);
        const sevenDaysMs = 1 * 24 * 60 * 60 * 1000; // Was 7 days
        const fourteenDaysMs = 2 * 24 * 60 * 60 * 1000; // Was 14 days

        // 1️⃣ Signal: Completion Drop (40% drop vs previous 7 days)
        const last7DaysStart = now - sevenDaysMs;
        const prev7DaysStart = now - fourteenDaysMs;

        const completionsLast7 = tasks.filter(t => {
            if (!t.metadata?.completedAt) return false;
            const completeTime = new Date(t.metadata.completedAt).getTime();
            return completeTime >= last7DaysStart && completeTime <= now;
        }).length;

        const completionsPrev7 = tasks.filter(t => {
            if (!t.metadata?.completedAt) return false;
            const completeTime = new Date(t.metadata.completedAt).getTime();
            return completeTime >= prev7DaysStart && completeTime < last7DaysStart;
        }).length;

        let completionDropPct = 0;
        if (completionsPrev7 > 0) {
            completionDropPct = (completionsPrev7 - completionsLast7) / completionsPrev7;
            if (completionDropPct < 0) completionDropPct = 0;
        }

        const signalCompletionDrop = completionDropPct >= 0.40;
        console.log(`DEBUG: Completion drop: ${Math.round(completionDropPct * 100)}%`);

        // 2️⃣ Signal: Pleasure Drop (30% drop vs 14-session baseline)
        let allSessions = [];
        tasks.forEach(t => {
            if (t.metadata?.sessions) {
                allSessions = allSessions.concat(t.metadata.sessions.filter(s => s.status === 'completed'));
            }
        });

        allSessions.sort((a, b) => b.endTime - a.endTime);

        const baselineSessions = allSessions.slice(0, 14);
        const last5Sessions = allSessions.slice(0, 5);

        let pleasureDropPct = 0;
        if (baselineSessions.length > 0) {
            const baselineAvg = baselineSessions.reduce((sum, s) => sum + (s.actualPleasure || 0), 0) / baselineSessions.length;
            const last5Avg = last5Sessions.length > 0
                ? last5Sessions.reduce((sum, s) => sum + (s.actualPleasure || 0), 0) / last5Sessions.length
                : 0;

            if (baselineAvg > 0) {
                pleasureDropPct = (baselineAvg - last5Avg) / baselineAvg;
                if (pleasureDropPct < 0) pleasureDropPct = 0;
            }
        }
        const signalPleasureDrop = pleasureDropPct >= 0.30;
        console.log(`DEBUG: Pleasure drop: ${Math.round(pleasureDropPct * 100)}%`);

        // 3️⃣ Signal: Abandonment (>=3 sessions <3 mins in 7 days)
        const abandonmentSessions = allSessions.filter(s => {
            const isRecent = s.endTime >= last7DaysStart;
            const isShort = s.actualDuration < 180;
            return isRecent && isShort;
        });

        const abandonmentCount = abandonmentSessions.length;
        const signalAbandonment = abandonmentCount >= 3;
        console.log(`DEBUG: Abandonment count: ${abandonmentCount}`);

        // Fatigue Rule Check
        let triggeredCount = 0;
        const activeSignals = [];
        if (signalCompletionDrop) { triggeredCount++; activeSignals.push('CompletionDrop'); }
        if (signalPleasureDrop) { triggeredCount++; activeSignals.push('PleasureDrop'); }
        if (signalAbandonment) { triggeredCount++; activeSignals.push('Abandonment'); }

        console.log(`DEBUG: Fatigue signals triggered: ${triggeredCount}`);

        const fatigueSuggested = triggeredCount >= 2;

        if (fatigueSuggested) {
            console.log(`Skill Fatigue Detected → ${skill.name}`);
            console.log(`Signals: ${activeSignals.join(' | ')}`);
        }

        // Re-fetch skill to ensure we have latest metadata before saving fatigueSuggested
        const latestSkill = await repository.getById(skillId);

        // Update skill metadata
        const result = await repository.update(skillId, {
            metadata: {
                ...(latestSkill?.metadata || {}),
                fatigueSuggested
            },
            updatedAt: Date.now()
        });

        console.log(`DEBUG: Persistence check: [${skill.name}] fatigueSuggested is now ${result.metadata.fatigueSuggested}`);
        return fatigueSuggested;
    };

    /*
    MOTIVATIONAL OPTIMIZATION LAYER (PINCH)
    Purpose:
    Detect motivational misalignment (Passion, Interest, Novelty, Challenge, Hurry).
    Only executes if Burnout Protection is not triggered.
    */
    const evaluatePinch = async (skillId, currentPredictedPleasure = null, currentInitiationDelay = 0, logger = console.log) => {
        console.log("PINCH FUNCTION ENTERED");
        const skill = await repository.getById(skillId);
        if (!skill || skill.type !== NodeTypes.SKILL) return null;

        const allNodes = await repository.getAll();
        const getDescendantTasks = (parentId) => {
            let tasks = [];
            const children = allNodes.filter(n => n.parentId === parentId);
            for (const child of children) {
                if (child.type === NodeTypes.TASK) {
                    tasks.push(child);
                }
                tasks = tasks.concat(getDescendantTasks(child.id));
            }
            return tasks;
        };

        const tasks = getDescendantTasks(skillId);
        let allSessions = [];
        tasks.forEach(t => {
            if (t.metadata?.sessions) {
                allSessions = allSessions.concat(t.metadata.sessions.filter(s => s.status === 'completed'));
            }
        });

        // Temporal Filter: 14 days
        const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const filteredSessions = allSessions
            .filter(s => s.endTime > fourteenDaysAgo)
            .sort((a, b) => a.startTime - b.startTime); // Ascending for block grouping

        // Aggregate into blocks (30-minute rule)
        const blocks = [];
        if (filteredSessions.length > 0) {
            let currentBlock = [filteredSessions[0]];
            for (let i = 1; i < filteredSessions.length; i++) {
                const prev = currentBlock[currentBlock.length - 1];
                const curr = filteredSessions[i];
                if (curr.startTime - prev.endTime < 30 * 60 * 1000) {
                    currentBlock.push(curr);
                } else {
                    blocks.push(currentBlock);
                    currentBlock = [curr];
                }
            }
            blocks.push(currentBlock);
        }

        const aggregatedBlocks = blocks.map(block => {
            const totalDuration = block.reduce((acc, s) => acc + (s.actualDuration || 0), 0);
            const initiationDelay = block[0].initiationDelay || 0;
            const startTime = block[0].startTime;
            const endTime = block[block.length - 1].endTime;

            let weightedPred = 0;
            let weightedAct = 0;
            let weightedMast = 0;

            if (totalDuration > 0) {
                weightedPred = block.reduce((acc, s) => acc + (s.predictedPleasure || 0) * (s.actualDuration || 0), 0) / totalDuration;
                weightedAct = block.reduce((acc, s) => acc + (s.actualPleasure || 0) * (s.actualDuration || 0), 0) / totalDuration;
                weightedMast = block.reduce((acc, s) => acc + (s.mastery || 0) * (s.actualDuration || 0), 0) / totalDuration;
            } else {
                weightedPred = block.reduce((acc, s) => acc + (s.predictedPleasure || 0), 0) / block.length;
                weightedAct = block.reduce((acc, s) => acc + (s.actualPleasure || 0), 0) / block.length;
                weightedMast = block.reduce((acc, s) => acc + (s.mastery || 0), 0) / block.length;
            }

            return {
                predictedPleasure: weightedPred,
                actualPleasure: weightedAct,
                mastery: weightedMast,
                initiationDelay,
                actualDuration: totalDuration,
                startTime,
                endTime,
                endedAt: block[block.length - 1].endedAt || new Date(endTime).toISOString()
            };
        }).sort((a, b) => b.endTime - a.endTime); // Newest block first

        console.log(`PINCH DEBUG - [${skill.name}] Raw sessions: ${filteredSessions.length}, Blocks created: ${aggregatedBlocks.length}`);
        console.log(`PINCH DEBUG - [${skill.name}] Block Timestamps:`, aggregatedBlocks.map(b => b.endedAt));

        logger(`PINCH [${skill.name}]: Found ${filteredSessions.length} sessions (${aggregatedBlocks.length} blocks) within 14-day window.`);

        // Rolling Window: Need exactly 6 blocks to evaluate (Rule 1 & 6)
        if (aggregatedBlocks.length < 6) {
            logger(`PINCH [${skill.name}]: Fewer than 6 blocks (count: ${aggregatedBlocks.length}). Clearing state.`);
            await repository.update(skillId, {
                metadata: { ...skill.metadata, pinchState: null }
            });
            return null;
        }

        console.log("PINCH DEBUG - Array used for rolling window:", aggregatedBlocks);
        const window = aggregatedBlocks.slice(0, 3); // Current = blocks 0-2 (Rule 2)
        const baselineWindow = aggregatedBlocks.slice(3, 6); // Baseline = blocks 3-5 (Rule 2)

        const ma = {
            predicted: window.reduce((acc, b) => acc + (b.predictedPleasure || 0), 0) / 3,
            actual: window.reduce((acc, b) => acc + (b.actualPleasure || 0), 0) / 3,
            mastery: window.reduce((acc, b) => acc + (b.mastery || 0), 0) / 3,
            duration: window.reduce((acc, b) => acc + (b.actualDuration || 0), 0) / 3,
            delay: window.reduce((acc, b) => acc + (b.initiationDelay || 0), 0) / 3
        };

        const baselinePleasureMA = baselineWindow.reduce((acc, b) => acc + (b.actualPleasure || 0), 0) / 3;
        const previousDurationMA = baselineWindow.reduce((acc, b) => acc + (b.actualDuration || 0), 0) / 3;
        const previousMasteryMA = baselineWindow.reduce((acc, b) => acc + (b.mastery || 0), 0) / 3;

        const pleasureDrop = baselinePleasureMA > 0 ? (baselinePleasureMA - ma.actual) / baselinePleasureMA : 0;
        const durationPercentChange = previousDurationMA > 0 ? (ma.duration - previousDurationMA) / previousDurationMA : 0;
        const pleasurePercentChange = baselinePleasureMA > 0 ? (ma.actual - baselinePleasureMA) / baselinePleasureMA : 0;

        // Debug Logs (Rule 7)
        logger(`PINCH [${skill.name}] NOVELTY Analysis:`);
        logger(`- Baseline pleasure MA: ${baselinePleasureMA.toFixed(2)}`);
        logger(`- Current pleasure MA: ${ma.actual.toFixed(2)}`);
        logger(`- Percent drop: ${pleasureDrop.toFixed(2)}`);
        logger(`- Current mastery MA: ${ma.mastery.toFixed(2)}`);

        logger(`PINCH [${skill.name}]: MA(3 blocks) -> Pred:${ma.predicted.toFixed(1)}, Act:${ma.actual.toFixed(1)}, Mast:${ma.mastery.toFixed(1)}, Delay:${ma.delay.toFixed(1)}`);

        const identityTier = skill.metadata?.identityTier || "OPTIONAL";

        let activeState = null;
        let passionTriggered = false;
        let noveltyTriggered = false;
        let challengeTriggered = false;
        let interestTriggered = false;
        let hurryTriggered = false;

        // 1️⃣ PASSION: CORE skill + High expectations + Significant delay
        if (identityTier === IdentityTiers.CORE && currentPredictedPleasure >= 6 && currentInitiationDelay >= 10) {
            passionTriggered = true;
        }

        // 2️⃣ NOVELTY: Pleasure drop with incomplete mastery (Rule 5)
        if (pleasureDrop >= 0.25 && ma.mastery < 8) {
            noveltyTriggered = true;
        }
        logger(`- Trigger result: ${noveltyTriggered}`);

        // 3️⃣ CHALLENGE: Mastered but duration dropping (Detection Only)
        console.log("PINCH DEBUG - CHALLENGE CHECK");
        console.log("Previous Duration MA:", previousDurationMA);
        console.log("Current Duration MA:", ma.duration);
        console.log("Duration % Change:", durationPercentChange);
        console.log("Current Mastery MA:", ma.mastery);
        console.log("Pleasure % Change:", pleasurePercentChange);

        if (ma.mastery >= 8 && durationPercentChange <= -0.2 && pleasurePercentChange >= -0.3) {
            challengeTriggered = true;
        }
        console.log("Triggered:", challengeTriggered);

        // 4️⃣ INTEREST: Non-core skill + Low intrinsic engagement (MA)
        if (identityTier !== IdentityTiers.CORE && ma.actual <= 4) {
            interestTriggered = true;
        }

        // 5️⃣ HURRY: High delay compared to personal baseline or absolute threshold
        if (currentInitiationDelay >= 15 || currentInitiationDelay >= ma.delay * 1.5) {
            hurryTriggered = true;
        }

        // Priority Selection
        if (passionTriggered) activeState = "PASSION";
        else if (noveltyTriggered) activeState = "NOVELTY";
        else if (challengeTriggered) activeState = "CHALLENGE";
        else if (interestTriggered) activeState = "INTEREST";
        else if (hurryTriggered) activeState = "HURRY";

        logger(`PINCH [${skill.name}]: Final State -> ${activeState || 'NONE'}`);

        // Persist
        await repository.update(skillId, {
            metadata: {
                ...skill.metadata,
                pinchState: activeState
            }
        });

        return activeState;
    };



    const awardHryvnia = async (amount, label = "Hryvnia") => {
        const val = Number(amount);
        if (isNaN(val) || val <= 0) return { awarded: 0, before: 0, after: 0 };

        let rootNode = await repository.getById('ROOT');
        const currentBalance = rootNode?.metadata?.hryvniaBalance || 0;
        const newBalance = currentBalance + val;

        if (rootNode) {
            await repository.update('ROOT', {
                metadata: { ...rootNode.metadata, hryvniaBalance: newBalance }
            });
        } else {
            await repository.save({
                id: 'ROOT',
                name: 'System Root',
                type: NodeTypes.LIFE_AREA,
                metadata: {
                    hryvniaBalance: newBalance,
                    dailyCompletions: {},
                    dailyAreaLog: {},
                    activeMarketplace: [],
                    marketplaceLastRefilledAt: 0,
                    lastHryvniaSpendDate: null
                },
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }

        console.log(`[${label}] +${val} Hryvnia`);
        console.log(`[${label}] Balance before: ${currentBalance}`);
        console.log(`[${label}] Balance after: ${newBalance}`);

        return { awarded: val, before: currentBalance, after: newBalance };
    };



    const ensureRewardVaultSetup = async () => {
        const allNodes = await repository.getAll();

        // 1. Create REWARD_BANK if it doesn't exist
        let bank = await repository.getById('REWARD_BANK');
        if (!bank) {
            await repository.save({
                id: 'REWARD_BANK',
                name: 'Reward Bank',
                type: NodeTypes.REWARD_VAULT,
                parentId: 'ROOT', // Created under ROOT
                metadata: {},
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            console.log("HierarchyService [Setup]: Created REWARD_BANK under ROOT");
        } else {
            console.log("HierarchyService [Status]: REWARD_BANK exists");
        }

        // 2. Migrate existing REWARD nodes to REWARD_BANK
        const rewards = allNodes.filter(n => n.type === NodeTypes.REWARD);
        let migratedCount = 0;
        for (const r of rewards) {
            if (r.parentId !== 'REWARD_BANK') {
                await repository.update(r.id, { parentId: 'REWARD_BANK' });
                migratedCount++;
            }
        }

        if (migratedCount > 0) {
            console.log(`HierarchyService [Migration]: Migrated ${migratedCount} rewards to REWARD_BANK`);
        }

        // 3. Remove legacy container nodes
        const legacyIds = ['REWARD_VAULT', 'SMALL_REWARDS', 'MEDIUM_REWARDS', 'LARGE_REWARDS'];
        for (const id of legacyIds) {
            const node = allNodes.find(n => n.id === id);
            if (node) {
                await repository.delete(id);
                console.log(`HierarchyService [Cleanup]: Removed legacy container ${id}`);
            }
        }

        console.log("HierarchyService [Migration]: Migration completed successfully");

        // 4. Reward Categorization Migration
        const rootNode = await repository.getById('ROOT');
        const activeMarketplace = rootNode?.metadata?.activeMarketplace || [];
        const taskRewardIds = new Set(allNodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.rewardId).map(n => n.metadata.rewardId));

        for (const r of rewards) {
            const inMarketplace = activeMarketplace.some(item => (item.rewardId || item) === r.id);
            const inTasks = taskRewardIds.has(r.id);

            if (inMarketplace && inTasks) {
                console.error(`AMBIGUITY DETECTED: Reward ${r.id} (${r.name}) is both in Marketplace and Task-linked. Safety override applied.`);
                // We'll prioritize TASK category as it's more specific, or just skip categorization for now
            }

            let category = r.metadata?.rewardCategory;
            if (!category) {
                if (inMarketplace) {
                    category = 'MARKETPLACE';
                } else if (inTasks) {
                    category = 'TASK';
                }
            }

            if (category && r.metadata?.rewardCategory !== category) {
                await repository.update(r.id, {
                    metadata: { ...r.metadata, rewardCategory: category }
                });
                console.log(`Assigned rewardCategory: ${category} to reward ${r.id} (${r.name})`);
            } else if (!category) {
                console.log(`LOG: Ambiguity - Reward ${r.id} (${r.name}) has no usage and no explicit category. Skipping assignment.`);
            }
        }
    };

    const refillMarketplace = async () => {
        const allNodes = await repository.getAll();
        const rootNode = await repository.getById('ROOT');
        const unlockedTier = rootNode?.metadata?.unlockedRewardTier || 1;

        const bankRewards = allNodes.filter(n =>
            n.type === NodeTypes.REWARD &&
            n.parentId === 'REWARD_BANK' &&
            n.metadata?.rewardCategory === 'MARKETPLACE' &&
            (n.metadata?.rewardTier || 1) <= unlockedTier
        );

        // Shuffle and pick up to 8 unique items
        const shuffled = [...bankRewards].sort(() => 0.5 - Math.random());
        const selectedItems = shuffled.slice(0, 8).map(r => ({
            rewardId: r.id,
            addedAt: Date.now()
        }));

        if (rootNode) {
            await repository.update('ROOT', {
                metadata: {
                    ...rootNode.metadata,
                    activeMarketplace: selectedItems,
                    marketplaceLastRefilledAt: Date.now()
                }
            });
            console.log(`Marketplace refilled with ${selectedItems.length} items`);
        }
    };

    const initializeMarketplace = async () => {
        let rootNode = await repository.getById('ROOT');
        if (!rootNode) return;

        let metadata = rootNode.metadata || {};
        let marketplace = metadata.activeMarketplace || [];

        // Migration: string[] -> {rewardId, addedAt}[]
        if (marketplace.length > 0 && typeof marketplace[0] === 'string') {
            console.log("HierarchyService [Migration]: Migrating activeMarketplace to new structure");
            marketplace = marketplace.map(id => ({ rewardId: id, addedAt: Date.now() }));
            metadata.activeMarketplace = marketplace;
            await repository.update('ROOT', { metadata });
            rootNode = await repository.getById('ROOT');
        }

        // Ensure all new metadata fields exist
        if (metadata.activeMarketplace === undefined ||
            metadata.marketplaceLastRefilledAt === undefined ||
            metadata.lastHryvniaSpendDate === undefined ||
            metadata.unlockedRewardTier === undefined) {

            rootNode = await repository.update('ROOT', {
                metadata: {
                    ...metadata,
                    activeMarketplace: metadata.activeMarketplace || [],
                    marketplaceLastRefilledAt: metadata.marketplaceLastRefilledAt || 0,
                    lastHryvniaSpendDate: metadata.lastHryvniaSpendDate !== undefined ? metadata.lastHryvniaSpendDate : null,
                    unlockedRewardTier: metadata.unlockedRewardTier || 1
                }
            });
        }

        if (rootNode.metadata.activeMarketplace.length < 8) {
            await refillMarketplace();
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

    /**
     * V1 Burnout Detection (Silent)
     * Aggregates objective-specific session data over a rolling 72-hour window.
     * Sets metadata.burnoutRisk = true if multiple decay signals are detected.
     */
    const evaluateObjectiveBurnout = async (objectiveId) => {
        const objective = await repository.getById(objectiveId);
        if (!objective || objective.type !== NodeTypes.OBJECTIVE) return;

        const allNodes = await repository.getAll();

        const getTasks = (pid) => {
            let res = [];
            allNodes.filter(n => n.parentId === pid).forEach(child => {
                if (child.type === NodeTypes.TASK) res.push(child);
                res = res.concat(getTasks(child.id));
            });
            return res;
        };

        const tasks = getTasks(objectiveId);

        const formatDate = (date) => {
            return date.getFullYear() + '-' +
                String(date.getMonth() + 1).padStart(2, '0') + '-' +
                String(date.getDate()).padStart(2, '0');
        };

        // Window: Last 3 days (rolling 72h)
        const now = new Date();
        const dateStrings = [0, 1, 2].map(daysAgo => {
            const d = new Date(now);
            d.setDate(d.getDate() - daysAgo);
            return formatDate(d);
        }).reverse(); // [D-2, D-1, Today]

        const dailyStats = dateStrings.map(dateStr => {
            let sessions = [];
            tasks.forEach(t => {
                if (t.metadata?.sessions) {
                    const sessOnDate = t.metadata.sessions.filter(s => {
                        if (s.status !== 'completed' || !s.endTime) return false;
                        const sDate = formatDate(new Date(s.endTime));
                        return sDate === dateStr;
                    });
                    sessions = sessions.concat(sessOnDate);
                }
            });

            if (sessions.length === 0) return null;

            const avgStartCost = sessions.reduce((sum, s) => sum + (s.startCost || 0), 0) / sessions.length;
            const avgPleasure = sessions.reduce((sum, s) => sum + (s.actualPleasure || 0), 0) / sessions.length;
            const totalDeepMinutes = sessions.reduce((sum, s) => {
                // Deep work: Session > 90 mins (5400s)
                return sum + (s.actualDuration > 5400 ? (s.actualDuration / 60) : 0);
            }, 0);

            const drivers = sessions.map(s => s.dominantDriver).filter(Boolean);
            const hurryCount = drivers.filter(d => d === 'HURRY').length;
            const isPrimarilyHurry = drivers.length > 0 && (hurryCount / drivers.length) >= 0.5;

            return { avgStartCost, avgPleasure, totalDeepMinutes, isPrimarilyHurry };
        });

        // Detect Signals
        let signals = 0;

        // 1. startCost trend increasing across 2+ days
        const startCosts = dailyStats.map(s => s?.avgStartCost).filter(v => v !== undefined && v !== null);
        if (startCosts.length >= 2) {
            let increasing = true;
            for (let i = 1; i < startCosts.length; i++) {
                if (startCosts[i] <= startCosts[i - 1]) increasing = false;
            }
            if (increasing) signals++;
        }

        // 2. actualPleasure trend decreasing across 2+ days
        const pleasures = dailyStats.map(s => s?.avgPleasure).filter(v => v !== undefined && v !== null);
        if (pleasures.length >= 2) {
            let decreasing = true;
            for (let i = 1; i < pleasures.length; i++) {
                if (pleasures[i] >= pleasures[i - 1]) decreasing = false;
            }
            if (decreasing) signals++;
        }

        // 3. deepWorkMinutes decreasing over 48–72h
        const deepMins = dailyStats.map(s => s?.totalDeepMinutes).filter(v => v !== undefined && v !== null);
        if (deepMins.length >= 2) {
            let decreasing = true;
            for (let i = 1; i < deepMins.length; i++) {
                if (deepMins[i] >= deepMins[i - 1]) decreasing = false;
            }
            if (decreasing) signals++;
        }

        // 4. dominantDriver shifts to primarily HURRY
        const latest = dailyStats[dailyStats.length - 1];
        if (latest?.isPrimarilyHurry) signals++;

        const burnoutRisk = signals >= 2;

        if (objective.metadata?.burnoutRisk !== burnoutRisk) {
            console.log(`[Burnout Detection] Objective ${objective.name} burnoutRisk: ${burnoutRisk} (${signals} signals)`);
            await repository.update(objectiveId, {
                metadata: {
                    ...objective.metadata,
                    burnoutRisk
                }
            });
        }
    };

    const checkExpirations = async () => {
        const allNodes = await repository.getAll();
        const objectives = allNodes.filter(n => n.type === NodeTypes.OBJECTIVE && n.metadata?.status === ObjectiveStatuses.ACTIVE);

        for (const obj of objectives) {
            if (obj.metadata?.activatedAt && obj.metadata?.durationInDays) {
                const expiryTime = obj.metadata.activatedAt + (obj.metadata.durationInDays * 24 * 60 * 60 * 1000);
                if (Date.now() >= expiryTime) {
                    await repository.update(obj.id, {
                        metadata: {
                            ...obj.metadata,
                            status: ObjectiveStatuses.ARCHIVED,
                            archivedAt: Date.now(),
                            isActive: false,
                            isSleeping: false,
                            isArchived: true
                        }
                    });
                    console.log(`[Lifecycle] Objective "${obj.name}" (Experiment) expired and moved to Archive.`);
                }
            }
        }
    };

    const service = {
        checkExpirations: async () => await checkExpirations(),
        evaluateObjectiveBurnout: async (objectiveId) => await evaluateObjectiveBurnout(objectiveId),
        /**
         * Checks if a node is locked due to manual lock, stage sequence, or ancestor lock.
         */
        isLocked: async (nodeId) => await isLocked(nodeId),

        /**
         * Adds a node to the hierarchy with relational validation
         */
        addNode: async (nodeData) => {
            const { type } = nodeData;
            const parentId = nodeData.parentId ? String(nodeData.parentId) : null;
            const id = nodeData.id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            await validateRelation(type, parentId);

            // Add default metadata based on type
            const metadata = { ...nodeData.metadata };
            if (type === NodeTypes.TASK) {
                metadata.status = TaskStatuses.NOT_STARTED;
                metadata.sessions = [];
                metadata.orderIndex = metadata.orderIndex || 0;
            } else if (type === NodeTypes.OBJECTIVE) {
                if (!metadata.theme || !metadata.durationInDays || !metadata.accumulationType || !metadata.mve) {
                    throw new Error("Objective creation requires Theme, DurationInDays, AccumulationType, and MVE.");
                }
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
                await recalculateObjectiveAccumulation(parentId);
            }

            return saved;
        },

        /**
         * Retrieves the full tree structure
         */
        getTree: async () => {
            const allNodes = await repository.getAll();
            const tree = buildTree(allNodes);
            console.log(`HierarchyService: getTree resulting in ${tree.length} root nodes`);
            return tree;
        },

        /**
         * Moves a node to a new parent
         */
        moveNode: async (nodeId, newParentId) => {
            const node = await repository.getById(nodeId);
            if (!node) throw new Error("Node not found");

            await validateRelation(node.type, newParentId);

            node.parentId = newParentId;
            node.updatedAt = Date.now();
            return await repository.save(node);
        },

        /**
         * Updates a node's metadata or name
         */
        async updateNode(nodeId, updates) {
            const existing = await repository.getById(nodeId);
            if (!existing) throw new Error("Node not found");

            // BACKEND PROTECTION: Requirement Escalation
            const ancestorObjective = await findObjectiveAncestor(nodeId);
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
                newUpdates.metadata = { ...existing.metadata, ...updates.metadata };
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

            // Task status logic (Part 1: Completed timestamp)
            if (existing.type === NodeTypes.TASK && newUpdates.metadata?.status === TaskStatuses.DONE && existing.metadata?.status !== TaskStatuses.DONE) {
                const completedAt = existing.metadata?.completedAt || Date.now();
                newUpdates.metadata = {
                    ...newUpdates.metadata,
                    completedAt
                };
                console.log(`DEBUG: Task completedAt set to ${completedAt}`);
            }

            // Active Skill Logic: Max 4
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

                    if (activeSkillsCount >= 4) {
                        console.log("ACTIVE LIMIT BLOCKED: 4 skills already active");
                        throw new Error("ACTIVE_LIMIT_REACHED");
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
            // We save the node itself BEFORE side-effects so reactive refreshes (subscriptions)
            // see the correct status immediately when rewards/counters update.
            const result = await repository.update(nodeId, newUpdates);

            // SIDE EFFECTS - OBJECTIVE
            if (existing.type === NodeTypes.OBJECTIVE && newUpdates.metadata?.status === ObjectiveStatuses.ACHIEVED && existing.metadata?.status !== ObjectiveStatuses.ACHIEVED) {
                console.log("Achieved Objective -> Triggering Achieved Rewards");
                await incrementDailyCompletionCount();

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
                // 1. Task Reward
                await awardHryvnia(1, "Task Reward");

                // 2. Momentum Update
                await updateMomentum(nodeId);

                // Fatigue Evaluation
                const ancestorSkill = await findSkillAncestor(nodeId);
                if (ancestorSkill) {
                    await protectFromBurnout(ancestorSkill.id);
                }

                // Aura reinforcement: +1 for Task Completion
                if (auraService) {
                    await auraService.awardAuraToAncestorSkill(nodeId, 1, "Task Done");
                }

                // Daily Area Reinforcement Log
                const skill = await findSkillAncestor(nodeId);
                if (skill && skill.parentId) {
                    const areaId = skill.parentId;
                    const todayStr = new Date().toLocaleDateString('en-CA');
                    const rootNode = await repository.getById('ROOT');
                    if (rootNode) {
                        const metadata = rootNode.metadata || {};
                        const log = { ...(metadata.dailyAreaLog || {}) };
                        if (!log[todayStr]) log[todayStr] = {};
                        log[todayStr][areaId] = (log[todayStr][areaId] || 0) + 1;
                        await repository.update('ROOT', { metadata: { ...metadata, dailyAreaLog: log } });
                    }
                }

                // Global Persistent Counter
                console.log("CALLING DAILY COMPLETION INCREMENT");
                await incrementDailyCompletionCount();
            }

            // Sync objective accumulation after any aspect metadata change
            if (existing.type === NodeTypes.ASPECT && (updates.metadata?.accumulatedMetric !== undefined || updates.metadata?.status)) {
                await recalculateObjectiveAccumulation(existing.parentId);
            }

            return result;
        },

        resumeCooldownEarly: async (skillId) => {
            const skill = await repository.getById(skillId);
            if (!skill || skill.type !== NodeTypes.SKILL) throw new Error("Invalid Skill");

            const allNodes = await repository.getAll();
            const activeSkillsCount = allNodes.filter(n => n.type === NodeTypes.SKILL && n.metadata?.isActive).length;

            if (activeSkillsCount >= 4) {
                console.log("ACTIVE LIMIT BLOCKED: 4 skills already active");
                throw new Error("ACTIVE_LIMIT_REACHED");
            }

            console.log(`Cooldown Broken Early → ${skill.name}`);

            return await repository.update(skillId, {
                metadata: {
                    ...skill.metadata,
                    cooldownActive: false,
                    cooldownStart: null,
                    cooldownEnd: null,
                    isActive: true,
                    activatedAt: Date.now()
                },
                updatedAt: Date.now()
            });
        },

        startManualCooldown: async (skillId) => {
            const skill = await repository.getById(skillId);
            if (!skill || skill.type !== NodeTypes.SKILL) throw new Error("Invalid Skill");

            console.log("Manual Cooldown Activated →", skill.name);

            return await repository.update(skillId, {
                metadata: {
                    ...skill.metadata,
                    cooldownActive: true,
                    cooldownStart: Date.now(),
                    cooldownEnd: Date.now() + (5 * 24 * 60 * 60 * 1000),
                    isActive: false,
                    fatigueSuggested: false
                },
                updatedAt: Date.now()
            });
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

            // Delete descendants first (bottom-up is cleaner for some repos, though this one is flat)
            for (const id of descendantIds) {
                await repository.delete(id);
            }

            // Delete target node
            await repository.delete(nodeId);

            // Sync objective accumulation if an aspect was deleted
            const deletedNode = allNodes.find(n => n.id === nodeId);
            if (deletedNode?.type === NodeTypes.ASPECT && deletedNode.parentId) {
                await recalculateObjectiveAccumulation(deletedNode.parentId);
            }

            console.log("CASCADE DELETE COMPLETE");
        },

        /**
         * Sessions Logic
         */
        startSession: async (taskId, durationMinutes = 10, predictedPleasure = 0, initiationDelay = 0, logger = console.log) => {
            const task = await repository.getById(taskId);
            if (!task || task.type !== NodeTypes.TASK) throw new Error("Invalid Task");

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

            await repository.update(taskId, {
                metadata: {
                    ...task.metadata,
                    status: TaskStatuses.IN_PROGRESS,
                    sessions: [...sessions, newSession]
                }
            });

            // Aura reinforcement: +1 for Session Start
            if (auraService) {
                await auraService.awardAuraToAncestorSkill(taskId, 1, "Session Start");
            }

            return newSession;
        },

        async completeSession(taskId, sessionId, actualPleasure = 0, mastery = 0, startCost = 0, logger = console.log) {
            // HURRY Cleanup: Clear stuckness timer on completion
            const root = await repository.getById('ROOT');
            if (root?.metadata?.nextTaskIdentifiedAt) {
                await repository.update('ROOT', { metadata: { ...root.metadata, nextTaskIdentifiedAt: null } });
            }

            const task = await repository.getById(taskId);
            if (!task) throw new Error("Task not found");

            const sessions = task.metadata.sessions.map(s => {
                if (s.id === sessionId) {
                    const now = Date.now();
                    const actualSeconds = Math.round((now - s.startTime) / 1000);
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

            const result = await repository.update(taskId, {
                metadata: {
                    ...task.metadata,
                    sessions
                }
            });

            // Execution Order: Motivational Optimization (PINCH) -> Burnout Protection (Fatigue)
            const completedSession = sessions.find(s => s.id === sessionId);
            const ancestorSkill = await findSkillAncestor(taskId);

            if (ancestorSkill && completedSession) {
                console.log("PINCH EXECUTION CHECKPOINT");
                const driver = await evaluatePinch(
                    ancestorSkill.id,
                    completedSession.predictedPleasure,
                    completedSession.initiationDelay,
                    logger
                );

                // Persist the driver into the session metadata for burnout detection aggregation
                const sessionsWithDriver = sessions.map(s =>
                    s.id === sessionId ? { ...s, dominantDriver: driver } : s
                );
                await repository.update(taskId, {
                    metadata: {
                        ...task.metadata,
                        sessions: sessionsWithDriver
                    }
                });
            }

            // Burnout Protection (Fatigue - Skill Level)
            if (ancestorSkill) {
                await protectFromBurnout(ancestorSkill.id);
            }

            // V1 Burnout Detection (Objective Level)
            const ancestorObjective = await findObjectiveAncestor(taskId);
            if (ancestorObjective) {
                await evaluateObjectiveBurnout(ancestorObjective.id);
            }

            // Momentum Update
            await updateMomentum(taskId);
            // Global Persistent Counter
            console.log("CALLING DAILY COMPLETION INCREMENT");
            await this.incrementDailyCompletionCount();

            // Accumulation Logic: Add to Aspect
            const parentAspect = await findAspectAncestor(taskId);
            const objectiveToUpdate = await findObjectiveAncestor(taskId);
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
                    await recalculateObjectiveAccumulation(objectiveToUpdate.id);
                }
            }

            return result;
        },

        /**
         * Resolves the next prioritized task for a given skill.
         * Follows: Active Objective -> Next/InProgress Stage -> First non-done Task.
         */
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

        /**
         * Focus Mode Resolver: Returns the next actionable task marked as "Today".
         */
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
                const locked = await isLocked(task.id);
                if (!locked) {
                    // This is our next Focus Action
                    return task;
                }
            }

            return null;
        },

        async getDailyCompletionCount(date) {
            return await getDailyCompletionCount(date);
        },

        async incrementDailyCompletionCount() {
            return await incrementDailyCompletionCount();
        },

        getHryvniaBalance: async () => {
            const rootNode = await repository.getById('ROOT');
            return rootNode?.metadata?.hryvniaBalance || 0;
        },

        redeemReward: async (rewardId) => {
            console.log("REDEEM ATTEMPT:", rewardId);
            const reward = await repository.getById(rewardId);
            if (!reward || reward.type !== NodeTypes.REWARD) throw new Error("Reward not found");

            if (reward.metadata?.rewardCategory !== 'MARKETPLACE') {
                throw new Error(`Safeguard: Reward "${reward.name}" is not a MARKETPLACE reward and cannot be redeemed for Hryvnia.`);
            }

            const cost = reward.metadata?.hryvniaCost || 0;
            let rootNode = await repository.getById('ROOT');
            const currentBalance = rootNode?.metadata?.hryvniaBalance || 0;
            console.log("Current balance:", rootNode?.metadata?.hryvniaBalance);
            console.log("Reward cost:", reward.metadata?.hryvniaCost);

            if (currentBalance >= cost) {
                const newBalance = currentBalance - cost;
                await repository.update('ROOT', {
                    metadata: {
                        ...rootNode.metadata,
                        hryvniaBalance: newBalance,
                        lastHryvniaSpendDate: Date.now()
                    }
                });

                console.log(`[Reward Redeemed] -${cost} Hryvnia: ${reward.name}`);
                console.log(`Remaining balance: ${newBalance}`);

                await repository.update(rewardId, {
                    metadata: { ...reward.metadata, lastRedeemedAt: Date.now() }
                });
                return true;
            } else {
                console.log("Not enough Hryvnia");
                return false;
            }
        },

        claimMicroReward: async (taskId) => {
            const task = await repository.getById(taskId);
            if (!task) throw new Error("Task not found");

            if (task.metadata?.rewardId) {
                const reward = await repository.getById(task.metadata.rewardId);
                if (reward && reward.metadata?.rewardCategory !== 'TASK') {
                    throw new Error(`Safeguard: Reward "${reward.name}" linked to task "${task.name}" is not a TASK reward.`);
                }
            }

            await repository.update(taskId, {
                metadata: { ...task.metadata, lastMicroRewardClaimedAt: Date.now() }
            });
            return true;
        },

        getAllNodes: async () => {
            return await repository.getAll();
        },

        recalculateObjectiveAccumulation: async (objectiveId) => {
            return await recalculateObjectiveAccumulation(objectiveId);
        },

        async getTodayAreaReinforcement() {
            return await getTodayAreaReinforcement();
        },

        createDailyRestSuggestion,
        approveRest,
        completeRest,
        getTodayRest,

        protectFromBurnout,
        evaluateSkillFatigue: protectFromBurnout,
        evaluatePinch,
        refillMarketplace,
        initializeMarketplace,

        rotateMarketplace: async (count = 2) => {
            const rootNode = await repository.getById('ROOT');
            if (!rootNode) return;

            let marketplace = [...(rootNode.metadata?.activeMarketplace || [])];
            // Sort by addedAt ascending (oldest first)
            marketplace.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

            // Remove oldest
            const removed = marketplace.splice(0, count);
            const currentIds = marketplace.map(m => m.rewardId);

            // Select new ones
            const allNodes = await repository.getAll();
            const unlockedTier = rootNode?.metadata?.unlockedRewardTier || 1;
            const availableRewards = allNodes.filter(n =>
                n.type === NodeTypes.REWARD &&
                n.parentId === 'REWARD_BANK' &&
                n.metadata?.rewardCategory === 'MARKETPLACE' &&
                (n.metadata?.rewardTier || 1) <= unlockedTier &&
                !currentIds.includes(n.id)
            );

            const shuffled = availableRewards.sort(() => 0.5 - Math.random());
            const newSelections = shuffled.slice(0, count).map(r => ({
                rewardId: r.id,
                addedAt: Date.now()
            }));

            // Combine and update
            const updatedMarketplace = [...marketplace, ...newSelections];

            await repository.update('ROOT', {
                metadata: {
                    ...rootNode.metadata,
                    activeMarketplace: updatedMarketplace
                }
            });

            console.log(`Marketplace rotated: removed ${removed.length}, added ${newSelections.length}`);
        },

        checkNoveltyDecay: async () => {
            const rootNode = await repository.getById('ROOT');
            const lastSpend = rootNode?.metadata?.lastHryvniaSpendDate;
            if (!lastSpend) return false;

            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            return (Date.now() - lastSpend) > sevenDaysMs;
        },

        // PINCH ELEMENT #5: HURRY (Sprints)
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

        trackFocusMode: async (isActive, logger = console.log) => {
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
                metadata: { ...root.metadata, sprintSuggested: false }
            });
        },

        getDailyCompletionCount: async (date) => {
            return await getDailyCompletionCount(date);
        },

        getTotalAuraPoints: async () => {
            return await auraService.getTotalAuraPoints();
        },

        getHryvniaBalance: async () => {
            const root = await repository.getById('ROOT');
            return root?.metadata?.hryvniaBalance || 0;
        },

        getTopPriorityAreas: async () => {
            const allNodes = await repository.getAll();
            const areas = allNodes.filter(n => n.type === NodeTypes.LIFE_AREA && n.id !== 'ROOT');

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            const windowDays = [today, today - oneDayMs, today - (2 * oneDayMs)];

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
                    hasActiveSkills
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
            if (await isLocked(taskId)) {
                throw new Error("Cannot increment: This item is locked by sequential progression.");
            }

            const cur = (task.metadata?.currentUnits || 0) + 1;
            const res = await service.updateNode(taskId, {
                metadata: { currentUnits: cur }
            });

            // Accumulation Logic: Reps
            const parentAspect = await findAspectAncestor(taskId);
            const ancestorObjective = await findObjectiveAncestor(taskId);
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
                await recalculateObjectiveAccumulation(ancestorObjective.id);
            }
            return res;
        },

        updateTaskRepetitionTarget: async (taskId, newTarget) => {
            const task = await repository.getById(taskId);
            if (!task || task.type !== NodeTypes.TASK) throw new Error("Item not found");

            // Rule: Increasing targetUnits must NOT reduce currentUnits. (Naturally handled by updateNode)
            // Decreasing targetUnits may immediately mark repetition block complete (Handled by updateNode threshold)
            return await service.updateNode(taskId, {
                metadata: { targetUnits: Number(newTarget) }
            });
        },

        initialize: async () => {
            if (repository.initialize) {
                await repository.initialize();

                // 1. Structural Safeguard: Ensure ROOT exists
                let rootNode = await repository.getById('ROOT');
                if (!rootNode) {
                    await repository.save({
                        id: 'ROOT',
                        name: 'System Root',
                        type: NodeTypes.LIFE_AREA,
                        metadata: {
                            hryvniaBalance: 0,
                            dailyCompletions: {},
                            dailyAreaLog: {},
                            activeMarketplace: [],
                            marketplaceLastRefilledAt: 0,
                            lastHryvniaSpendDate: null,
                            unlockedRewardTier: 1
                        },
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                    console.log("HierarchyService [Setup]: ROOT node confirmed");
                }

                // 2. Structural Safeguard: Ensure REWARD_BANK exists
                let bankNode = await repository.getById('REWARD_BANK');
                if (!bankNode) {
                    await repository.save({
                        id: 'REWARD_BANK',
                        name: 'Reward Bank',
                        type: NodeTypes.REWARD_VAULT,
                        parentId: 'ROOT',
                        metadata: {},
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                    console.log("HierarchyService [Setup]: REWARD_BANK node confirmed");
                }

                await ensureRewardVaultSetup();
                await initializeMarketplace();
                await createDailyRestSuggestion();
                await checkExpirations();

                // Run maintenance tasks once during boot
                const allNodes = await repository.getAll();
                for (const node of allNodes) {
                    const updated = checkAutoLock(node);
                    if (updated !== node) {
                        await repository.update(node.id, updated);
                    }
                }
            }
        },

    };

    return service;
};

/**
 * Helper to build a tree from a flat list
 */
function buildTree(nodes, parentId = null, visited = new Set()) {
    // If parentId is undefined, treat it as null to match root nodes, 
    // BUT only if this is the top-level call. 
    // Actually, it's safer to always use null for roots and ensure IDs exist.
    const targetParentId = parentId === undefined ? null : parentId;

    return nodes
        .filter(node => (node.parentId ?? null) === targetParentId)
        .map(node => {
            // Safety: If node has no ID, it cannot have children
            if (!node.id) {
                console.warn(`[Backbone] Found node without ID during tree build: ${node.name}. Skipping children.`);
                return { ...node, children: [] };
            }

            // Self-reference or circular reference protection
            if (node.id === (node.parentId ?? null) || visited.has(node.id)) {
                console.warn(`[Backbone] Circular or self-referential path detected at node: ${node.id}. breaking recursion.`);
                return { ...node, children: [] };
            }

            const nextVisited = new Set(visited);
            nextVisited.add(node.id);

            return {
                ...node,
                children: buildTree(nodes, node.id, nextVisited)
            };
        });
}
