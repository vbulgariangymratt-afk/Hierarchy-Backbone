import { NodeTypes, IdentityTiers } from '../domain/entities';

export const MotivationService = (repository) => {

    const protectFromBurnout = async (skillId) => {
        const skill = await repository.getById(skillId);
        if (!skill || skill.type !== NodeTypes.SKILL) return;


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

        // 3️⃣ Signal: Abandonment (>=3 sessions <3 mins in 7 days)
        const abandonmentSessions = allSessions.filter(s => {
            const isRecent = s.endTime >= last7DaysStart;
            const isShort = s.actualDuration < 180;
            return isRecent && isShort;
        });

        const abandonmentCount = abandonmentSessions.length;
        const signalAbandonment = abandonmentCount >= 3;

        // Fatigue Rule Check
        let triggeredCount = 0;
        const activeSignals = [];
        if (signalCompletionDrop) { triggeredCount++; activeSignals.push('CompletionDrop'); }
        if (signalPleasureDrop) { triggeredCount++; activeSignals.push('PleasureDrop'); }
        if (signalAbandonment) { triggeredCount++; activeSignals.push('Abandonment'); }


        const fatigueSuggested = triggeredCount >= 2;

        if (fatigueSuggested) {
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

        return fatigueSuggested;
    };

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

    return {
        protectFromBurnout,
        evaluateSkillFatigue: protectFromBurnout,
        evaluatePinch,
        evaluateObjectiveBurnout
    };
};
