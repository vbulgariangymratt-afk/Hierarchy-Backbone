// Activation Engine V1
// Isolated to Backbone V2
// Does not access Legacy StoreContext
import React, { useState, useEffect, useRef } from 'react';
import backbone, {
    NodeTypes,
    repository,
    habitService,
    ObjectiveStatuses,
    TaskStatuses,
    IdentityTiers
} from './index';
import ScheduledRestWidget from '../components/ScheduledRestWidget';

const ACTIVATION_DURATION = 5; // Minutes

const getIdentityTierLabel = (tier) => {
    switch (tier) {
        case "CORE":
            return "CORE IDENTITY";
        case "EXPLORATION":
            return "EXPLORATION";
        case "OPTIONAL":
            return "OPTIONAL";
        default:
            return tier;
    }
};

const StructuralTester = () => {
    console.log("DEBUG: StructuralTester rendering. repository:", repository);
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionStatus, setActionStatus] = useState('');
    const [traces, setTraces] = useState([]);
    const [newName, setNewName] = useState('');
    const [pendingCreate, setPendingCreate] = useState(null); // { type, parentId }
    const [lastRepoId, setLastRepoId] = useState(repository.instanceId);
    const [viewMode, setViewMode] = useState('full'); // 'full' or 'achievements'
    const [focusMode, setFocusMode] = useState(false);
    const [pendingHabit, setPendingHabit] = useState(null); // { skillId, ifTrigger, mveAction }
    const [lastDeletedHabit, setLastDeletedHabit] = useState(null); // { habit, timestamp }
    const [activeSessionSetup, setActiveSessionSetup] = useState(null); // { type: 'task'|'habit', id, duration, predictedPleasure: 5, initiationDelay: 0 }
    const [activeSessionWrapup, setActiveSessionWrapup] = useState(null); // { type: 'task'|'habit', id, sessionId, actualPleasure: 5, mastery: 5, startCost: 5 }
    const [showActivation, setShowActivation] = useState(null); // { taskId, name, message }
    const [nudgeHistory, setNudgeHistory] = useState([]); // { timestamp, action: 'dismiss'|'accept' }
    const [activeFatigueSkill, setActiveFatigueSkill] = useState(null); // Skill node
    const [activeLimitModal, setActiveLimitModal] = useState(null); // The skill we tried to activate
    const [dailyCompletions, setDailyCompletions] = useState(0);
    const [todayAreaLog, setTodayAreaLog] = useState({});
    const [expandedWoop, setExpandedWoop] = useState({}); // { [objectiveId]: boolean }
    const [hryvniaBalance, setHryvniaBalance] = useState(0);
    const [hryvniaBonusModal, setHryvniaBonusModal] = useState(null); // { amount, aspectName, aspectId }
    const [unlockedMicroReward, setUnlockedMicroReward] = useState(null); // { taskId, rewardId, rewardName, sensoryDescription }
    const [rewardDescription, setRewardDescription] = useState('');
    const [rewardSensory, setRewardSensory] = useState('');
    const [rewardCost, setRewardCost] = useState(10);
    const auraLevelsRef = useRef({});
    const [skillIdentityTier, setSkillIdentityTier] = useState(''); // Only for SKILL creation/editing
    const [activeMarketplace, setActiveMarketplace] = useState([]);
    const [marketplaceLastRefilledAt, setMarketplaceLastRefilledAt] = useState(0);
    const [rewardCategory, setRewardCategory] = useState('MARKETPLACE'); // "MARKETPLACE" or "TASK"
    const [habitEligibilities, setHabitEligibilities] = useState({});
    const [now, setNow] = useState(Date.now());

    // New Aspect Progression testing states
    const [aspectType, setAspectType] = useState('finite');
    const [itemType, setItemType] = useState('task');
    const [unitName, setUnitName] = useState('units');
    const [targetUnits, setTargetUnits] = useState(1);
    const [lockedNodes, setLockedNodes] = useState(new Set());

    // Force re-render every second for active timers
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        console.log("%cBackbone V2 running in isolated mode", "background: #222; color: #bada55; font-size: 14px; padding: 4px;");
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const calculateTotalTaskTime = (sessions = []) => {
        const totalSeconds = sessions.reduce((acc, s) => {
            if (s.status === 'completed') return acc + (s.actualDuration || 0);
            return acc + Math.round((now - s.startTime) / 1000);
        }, 0);
        return formatTime(totalSeconds);
    };

    const checkRepoReset = () => {
        if (repository.instanceId !== lastRepoId) {
            logTrace(`CRITICAL: Repository Reset! Old: ${lastRepoId}, New: ${repository.instanceId}`);
            setLastRepoId(repository.instanceId);
            return true;
        }
        return false;
    };


    const logTrace = (msg) => {
        setTraces(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 5));
    };


    const triggerStatus = (msg) => {
        logTrace(msg);
        setActionStatus(msg);
        setTimeout(() => setActionStatus(''), 2000);
    };


    const [rawNodes, setRawNodes] = useState([]);
    const [habits, setHabits] = useState([]);

    const refreshTree = async () => {
        checkRepoReset();
        logTrace('Refresh: Starting...');

        try {
            // REMOVED: backbone.initialize() and habitService.initialize() 
            // to prevent infinite update loop from migrations

            const allNodes = await repository.getAll();
            console.log("DEBUG: StructuralTester.refreshTree - allNodes:", allNodes);
            logTrace(`Refresh: Repository contains ${allNodes.length} nodes`);
            setRawNodes([...allNodes]);

            const newTree = await backbone.getTree();
            console.log("DEBUG: StructuralTester.refreshTree - newTree:", newTree);
            logTrace(`Refresh: Tree built with ${newTree.length} roots`);
            setTree([...newTree]);

            const allHabits = habitService.getAllHabits();
            setHabits([...allHabits]);
            logTrace(`HABIT REPO SIZE: ${allHabits.length}`);

            // Fetch ADHD+MDD Evolution Eligibilities
            const eligs = {};
            await Promise.all(allHabits.map(async (h) => {
                try {
                    const eligibility = await habitService.evaluateEvolutionEligibility(h.id);
                    eligs[h.id] = eligibility;
                } catch (e) {
                    console.error("Failed to fetch eligibility for habit", h.id, e);
                }
            }));
            setHabitEligibilities(eligs);

            // Detect Aura Level Up
            allNodes.filter(n => n.type === NodeTypes.SKILL).forEach(skill => {
                const currentLevel = skill.metadata?.auraLevel || 1;
                const previousLevel = auraLevelsRef.current[skill.id];

                if (previousLevel && currentLevel > previousLevel) {
                    triggerStatus(`Level Up → ${skill.name} (Level ${currentLevel})`);
                }
                auraLevelsRef.current[skill.id] = currentLevel;
            });

            const count = await backbone.getDailyCompletionCount();
            setDailyCompletions(count);

            const areaLog = await backbone.getTodayAreaReinforcement();
            console.log("TODAY AREA LOG:", areaLog);
            setTodayAreaLog(areaLog);

            const balance = await backbone.getHryvniaBalance();
            setHryvniaBalance(balance);

            // Detect Aspect Completion Rewards
            allNodes.forEach(n => {
                if (n.type === NodeTypes.ASPECT && n.metadata?.hryvniaBonusAwarded && !n.metadata?.hryvniaBonusClaimed) {
                    setHryvniaBonusModal({ amount: n.metadata.hryvniaBonusAwarded, aspectName: n.name, aspectId: n.id });
                }
            });

            const rootNode = allNodes.find(n => n.id === 'ROOT');
            if (rootNode) {
                setActiveMarketplace(rootNode.metadata?.activeMarketplace || []);
                setMarketplaceLastRefilledAt(rootNode.metadata?.marketplaceLastRefilledAt || 0);
            }

            // Populate locked status for sequential logic
            const newLockedSet = new Set();
            for (const n of allNodes) {
                if (await backbone.isLocked(n.id)) {
                    newLockedSet.add(n.id);
                }
            }
            setLockedNodes(newLockedSet);

        } catch (e) {
            logTrace(`Refresh Error: ${e.message}`);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (repository.subscribe) {
            console.log("DEBUG: StructuralTester - Subscribing to repository changes");
            return repository.subscribe(() => {
                console.log("DEBUG: StructuralTester - Repository changed, refreshing...");
                refreshTree();
            });
        }
    }, []);

    useEffect(() => {
        refreshTree();
    }, []);

    // Micro-reward monitor
    useEffect(() => {
        if (!focusMode) return;
        const currentTask = rawNodes.find(n => n.type === NodeTypes.TASK && n.metadata?.sessions?.some(s => s.status === 'active'));
        if (currentTask && currentTask.metadata?.rewardId && !currentTask.metadata?.lastMicroRewardClaimedAt) {
            const activeSession = currentTask.metadata.sessions.find(s => s.status === 'active');
            const elapsed = (now - activeSession.startTime) / 1000;
            if (elapsed >= 600) { // 10 minutes
                const reward = rawNodes.find(n => n.id === currentTask.metadata.rewardId);
                if (reward && (!unlockedMicroReward || unlockedMicroReward.taskId !== currentTask.id)) {
                    console.log(`Micro reward available: ${reward.name}`);
                    setUnlockedMicroReward({
                        taskId: currentTask.id,
                        rewardId: reward.id,
                        rewardName: reward.name,
                        sensoryDescription: reward.metadata?.sensoryDescription
                    });
                }
            }
        }
    }, [focusMode, rawNodes, unlockedMicroReward]);

    const prepareAddNode = (type, parentId = null) => {
        checkRepoReset();
        const pid = parentId ? String(parentId) : null;
        logTrace(`PrepareAdd: ${type} for parent ${pid}`);
        setPendingCreate({ type, parentId: pid });
        setNewName('');
        setRewardDescription('');
        setRewardSensory('');
        setRewardCost(10);
        setSkillIdentityTier('');
        setRewardCategory('MARKETPLACE');
        setAspectType('finite');
        setItemType('task');
        setUnitName('units');
        setTargetUnits(1);
    };

    const confirmAddNode = async () => {
        checkRepoReset();
        if (!pendingCreate || !newName.trim()) return;

        const { type, parentId } = pendingCreate;
        const name = newName.trim();

        try {
            logTrace(`AddNode: Creating ${name} (${type})...`);

            const nodeToSave = {
                id: String(Math.random().toString(36).substr(2, 9)),
                name: String(name),
                type,
                parentId: parentId ? String(parentId) : null,
                metadata: type === NodeTypes.REWARD ? {
                    description: rewardDescription,
                    sensoryDescription: rewardSensory,
                    rewardCategory,
                    hryvniaCost: (rewardCategory === 'MARKETPLACE') ? rewardCost : null
                } : (type === NodeTypes.SKILL ? {
                    identityTier: skillIdentityTier
                } : (type === NodeTypes.ASPECT ? {
                    aspectType: aspectType
                } : (type === NodeTypes.TASK ? {
                    itemType: itemType,
                    unitName: itemType === 'REPETITION' ? unitName : undefined,
                    targetUnits: itemType === 'REPETITION' ? parseInt(targetUnits) : undefined,
                    currentUnits: itemType === 'REPETITION' ? 0 : undefined
                } : {})))
            };

            if (type === NodeTypes.REWARD) {
                console.log("Creating reward:", nodeToSave);
            }

            await backbone.addNode(nodeToSave);
            triggerStatus(`${type} Created`);
            logTrace(`AddNode: Success!`);

            setPendingCreate(null);
            setNewName('');
            setSkillIdentityTier('');
            await refreshTree();
        } catch (error) {
            logTrace(`AddNode Error: ${error.message}`);
            alert(error.message);
        }
    };

    const cancelAddNode = () => {
        setPendingCreate(null);
        setNewName('');
        setRewardDescription('');
        setRewardSensory('');
        setSkillIdentityTier('');
        logTrace('AddNode: Cancelled');
    };

    const handleDeleteNode = async (id) => {
        console.log("TRASH BUTTON CLICKED");
        console.log("AFTER CLICK LOG REACHED");
        try {
            console.log("CALLING DELETE WITH ID:", id);
            await backbone.deleteNode(id);
            console.log("DELETE CALL FINISHED");
            triggerStatus("Node Deleted");
            refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleStartSession = (id, duration, type = 'task') => {
        setActiveSessionSetup({ type, id, duration, predictedPleasure: 5, initiationDelay: 0 });
    };

    const confirmStartSession = async () => {
        if (!activeSessionSetup) return;
        const { type, id, duration, predictedPleasure, initiationDelay } = activeSessionSetup;

        try {
            if (type === 'task') {
                logTrace(`Session: Starting ${duration}m for task ${id} (Pred: ${predictedPleasure}) Delay: ${initiationDelay}`);
                await backbone.startSession(id, duration, predictedPleasure, initiationDelay, logTrace);
                refreshTree();
            } else {
                logTrace(`Sprint: Starting ${duration}m for habit ${id} (Pred: ${predictedPleasure})`);
                await habitService.startSprint(id, duration, predictedPleasure);
                setHabits([...habitService.getAllHabits()]);
            }
            setActiveSessionSetup(null);
            resetActivity();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleCompleteSessionUI = (id, sessionId, type = 'task') => {
        setActiveSessionWrapup({ type, id, sessionId, actualPleasure: 5, mastery: 5, startCost: 5 });
    };

    const confirmCompleteSession = async () => {
        console.log("LOG RESULTS BUTTON HANDLER ENTERED");
        try {
            if (!activeSessionWrapup) return;
            const { type, id, sessionId, actualPleasure, mastery, startCost } = activeSessionWrapup;

            if (type === 'task') {
                logTrace(`Session: Completing ${sessionId} (Act: ${actualPleasure}, Mast: ${mastery}, Cost: ${startCost})`);
                console.log("CALLING completeSession");
                await backbone.completeSession(id, sessionId, actualPleasure, mastery, startCost, logTrace);
                console.log("completeSession FINISHED");
                refreshTree();
            } else {
                logTrace(`Sprint: Completing ${sessionId} (Act: ${actualPleasure}, Mast: ${mastery})`);
                console.log("CALLING completeSprint");
                await habitService.completeSprint(id, sessionId, actualPleasure, mastery);
                console.log("completeSprint FINISHED");
                setHabits([...habitService.getAllHabits()]);
                refreshTree();
            }

            console.log("CLOSING SESSION MODAL");
            setActiveSessionWrapup(null);
            triggerStatus("Session Logged!");
        } catch (e) {
            console.error("ERROR IN LOG RESULTS HANDLER:", e);
            alert(e.message);
        }
    };

    // HABIT HANDLERS
    const handleCreateHabit = (skillId) => {
        logTrace(`HabitUI: Showing creation form for skill ${skillId}`);
        setPendingHabit({ skillId, ifTrigger: '', mveAction: '' });
    };

    const confirmHabitCreate = async () => {
        if (!pendingHabit) return;
        const { skillId, ifTrigger, mveAction } = pendingHabit;

        logTrace(`HabitUI: Confirm clicked for skill ${skillId}`);

        if (!ifTrigger.trim()) {
            alert("Please enter an IF trigger.");
            return;
        }
        if (!mveAction.trim()) {
            alert("Please enter a THEN action.");
            return;
        }

        try {
            logTrace(`HabitService: createHabit called`);
            await habitService.createHabit(skillId, ifTrigger, mveAction);
            logTrace(`HabitUI: SUCCESS - Habit created`);

            setHabits([...habitService.getAllHabits()]);
            setPendingHabit(null);
        } catch (e) {
            logTrace(`HabitService ERROR: ${e.message}`);
            alert(`Habit Error: ${e.message}`);
        }
    };

    const handleUpgradeHabit = async (habitId) => {
        const h = habitService.getAllHabits().find(x => x.id === habitId);
        if (!h) return;

        logTrace(`HabitUI: Upgrade requested for ${habitId}`);
        const newDesc = prompt("New Phase Description (e.g. 10-min version):");
        if (!newDesc) return;

        try {
            await habitService.upgradePhase(habitId, newDesc);
            logTrace(`HabitUI: SUCCESS - Upgraded to Level ${h.currentPhaseLevel + 1}`);
            setHabits([...habitService.getAllHabits()]);
            triggerStatus("Habit Upgraded!");
        } catch (e) {
            alert(e.message);
        }
    };

    const cancelHabitCreate = () => {
        logTrace(`HabitUI: Creation cancelled`);
        setPendingHabit(null);
    };

    const resetActivity = () => {
        // Polling disabled, but keeping resetActivity for legacy support in case any other logic uses it
    };

    useEffect(() => {
        const handleGlobalClick = () => {
            resetActivity();
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

    const findFirstTask = (nodes) => {
        for (const node of nodes) {
            if (node.type === NodeTypes.TASK) return node;
            if (node.children) {
                const found = findFirstTask(node.children);
                if (found) return found;
            }
        }
        return null;
    };

    const getNextTaskForActivation = async () => {
        const momentumSkill = activeSkills.sort((a, b) => {
            const timeA = a.metadata?.lastWorkedAt ? new Date(a.metadata.lastWorkedAt).getTime() : 0;
            const timeB = b.metadata?.lastWorkedAt ? new Date(b.metadata.lastWorkedAt).getTime() : 0;
            return timeB - timeA;
        })[0];

        if (!momentumSkill) {
            logTrace("Activation: BLOCKED — No active skill with momentum");
            return null;
        }

        const skillObjectives = rawNodes.filter(n => n.type === NodeTypes.OBJECTIVE && n.parentId === momentumSkill.id);
        logTrace(`Activation Debug → Objectives under skill [${momentumSkill.name}]: ${skillObjectives.length}`);

        logTrace("Activation: About to resolve next task...");
        const nextTask = await backbone.getNextExecutableItem(momentumSkill.id, logTrace);

        if (nextTask) {
            logTrace("Activation: Resolver returned: " + nextTask.name);

            // Determine energy state based on recent dismissals
            const recentDismissals = nudgeHistory.filter(h => h.action === 'dismiss' && (now - h.timestamp) < 30 * 60 * 1000);
            const energyState = recentDismissals.length >= 2 ? 'low' : 'normal';

            const message = getActivationMessage(nextTask.name, energyState);
            return { ...nextTask, message };
        }

        logTrace("Activation: Resolver returned: NONE");
        return null;
    };

    // Idle Detection Logic - Disabled to stop re-render loops

    // Fatigue Approval Detection Logic
    useEffect(() => {
        if (focusMode || activeFatigueSkill) return;

        const skillWithFatigue = rawNodes.find(n =>
            n.type === NodeTypes.SKILL &&
            n.metadata?.fatigueSuggested === true &&
            n.metadata?.cooldownActive !== true &&
            (!n.metadata?.fatigueReminderAt || now > n.metadata.fatigueReminderAt)
        );

        if (skillWithFatigue) {
            setActiveFatigueSkill(skillWithFatigue);
        }
    }, [rawNodes, focusMode, activeFatigueSkill, now]);

    const handleCompleteHabit = async (habitId) => {
        logTrace(`HabitUI: Completion checkbox clicked for habit ${habitId}`);
        try {
            await habitService.completeHabit(habitId);
            triggerStatus("Habit Logged!");
            setHabits([...habitService.getAllHabits()]);
            await refreshTree();
            resetActivity();
        } catch (e) {
            logTrace(`HabitService ERROR: ${e.message}`);
            alert(e.message);
        }
    };

    const handleToggleHabitActive = async (habitId, isActive) => {
        try {
            await habitService.updateHabit(habitId, { isActive });
            setHabits([...habitService.getAllHabits()]);
        } catch (e) {
            alert(e.message);
        }
    };

    const handleDeleteHabit = async (habitId) => {
        const h = habitService.getAllHabits().find(x => x.id === habitId);
        if (!h) return;

        logTrace(`HabitUI: Deleting habit ${habitId}`);
        setLastDeletedHabit({ habit: h, timestamp: Date.now() });

        try {
            await habitService.deleteHabit(habitId);
            setHabits([...habitService.getAllHabits()]);

            // Auto-clear undo after 8 seconds
            setTimeout(() => {
                setLastDeletedHabit(prev => {
                    if (prev && prev.habit.id === habitId) return null;
                    return prev;
                });
            }, 8000);
        } catch (e) {
            logTrace(`HabitService ERROR: ${e.message}`);
            alert(e.message);
        }
    };

    const handleUndoDeleteHabit = async () => {
        if (!lastDeletedHabit) return;
        const { habit } = lastDeletedHabit;

        try {
            logTrace(`HabitUI: Undoing deletion for ${habit.id}`);
            await habitService.restoreHabit(habit);
            setHabits([...habitService.getAllHabits()]);
            setLastDeletedHabit(null);
            triggerStatus("Habit Restored!");
        } catch (e) {
            logTrace(`HabitService ERROR: ${e.message}`);
            alert(e.message);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            const isZ = e.key.toLowerCase() === 'z';
            const isMod = e.metaKey || e.ctrlKey;

            if (isZ && isMod && lastDeletedHabit) {
                e.preventDefault();
                handleUndoDeleteHabit();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lastDeletedHabit]);



    const handleUpdateStatus = async (nodeId, newStatus) => {
        try {
            const node = rawNodes.find(n => n.id === nodeId);
            await backbone.updateNode(nodeId, {
                metadata: { ...node.metadata, status: newStatus }
            });
            refreshTree();
            resetActivity();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleToggleActive = async (node) => {
        try {
            const isActivating = !node.metadata?.isActive;

            if (isActivating) {
                const sameAreaActiveSkill = rawNodes.find(n =>
                    n.type === NodeTypes.SKILL &&
                    n.metadata?.isActive &&
                    n.parentId === node.parentId &&
                    n.id !== node.id
                );

                if (sameAreaActiveSkill) {
                    const lifeArea = rawNodes.find(n => n.id === node.parentId);
                    const areaName = lifeArea?.name || "Life Area";
                    const anchor = lifeArea?.metadata?.identityAnchor || "your identity";

                    logTrace(`Switching Angles within ${areaName} to continue expressing ${anchor}.`);

                    // Check for active objective wish - note: tree nodes have children
                    const activeObjective = (node.children || []).find(o =>
                        o.type === NodeTypes.OBJECTIVE &&
                        o.metadata?.status === ObjectiveStatuses.ACTIVE
                    );

                    if (activeObjective?.metadata?.wish) {
                        logTrace(`Current Objective: ${activeObjective.metadata.wish}`);
                    }
                }
            }

            await backbone.updateNode(node.id, {
                metadata: { isActive: isActivating }
            });
            refreshTree();
        } catch (e) {
            if (e.message === "ACTIVE_LIMIT_REACHED") {
                setActiveLimitModal(node);
            } else {
                alert(e.message);
            }
        }
    };

    const handleResumeEarly = async (skillId) => {
        try {
            const node = rawNodes.find(n => n.id === skillId);

            // Check for rotation message
            const sameAreaActiveSkill = rawNodes.find(n =>
                n.type === NodeTypes.SKILL &&
                n.metadata?.isActive &&
                n.parentId === node.parentId &&
                n.id !== node.id
            );

            if (sameAreaActiveSkill) {
                const lifeArea = rawNodes.find(n => n.id === node.parentId);
                const areaName = lifeArea?.name || "Life Area";
                const anchor = lifeArea?.metadata?.identityAnchor || "your identity";

                logTrace(`Switching Angles within ${areaName} to continue expressing ${anchor}.`);

                const activeObjective = (node.children || []).find(o =>
                    o.type === NodeTypes.OBJECTIVE &&
                    o.metadata?.status === ObjectiveStatuses.ACTIVE
                );

                if (activeObjective?.metadata?.wish) {
                    logTrace(`Current Objective: ${activeObjective.metadata.wish}`);
                }
            }

            await backbone.resumeCooldownEarly(skillId);
            refreshTree();
        } catch (e) {
            if (e.message === "ACTIVE_LIMIT_REACHED") {
                const node = rawNodes.find(n => n.id === skillId);
                setActiveLimitModal(node);
            } else {
                alert(e.message);
            }
        }
    };

    const handleSwapSkill = async (deactivateSkill, activateSkill) => {
        try {
            // Check for rotation message if moving within same area
            // (either the one we deactivated or another one)
            const sameAreaActiveSkill = rawNodes.find(n =>
                n.type === NodeTypes.SKILL &&
                n.metadata?.isActive &&
                n.parentId === activateSkill.parentId &&
                n.id !== deactivateSkill.id // Ensure we don't count the one we are about to deactivate
            );

            if (sameAreaActiveSkill || activateSkill.parentId === deactivateSkill.parentId) {
                const lifeArea = rawNodes.find(n => n.id === activateSkill.parentId);
                const areaName = lifeArea?.name || "Life Area";
                const anchor = lifeArea?.metadata?.identityAnchor || "your identity";

                logTrace(`Switching Angles within ${areaName} to continue expressing ${anchor}.`);

                const activeObjective = (activateSkill.children || []).find(o =>
                    o.type === NodeTypes.OBJECTIVE &&
                    o.metadata?.status === ObjectiveStatuses.ACTIVE
                );

                if (activeObjective?.metadata?.wish) {
                    logTrace(`Current Objective: ${activeObjective.metadata.wish}`);
                }
            }

            // 1. Deactivate current skill
            await backbone.updateNode(deactivateSkill.id, {
                metadata: { isActive: false }
            });
            console.log("Skill Deactivated for Slot:", deactivateSkill.name);

            // 2. Activate new skill
            if (activateSkill.metadata?.cooldownActive) {
                await backbone.resumeCooldownEarly(activateSkill.id);
            } else {
                await backbone.updateNode(activateSkill.id, {
                    metadata: { isActive: true }
                });
            }

            setActiveLimitModal(null);
            refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleStartManualCooldown = async (skillId) => {
        try {
            await backbone.startManualCooldown(skillId);
            refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleUpdateOrderIndex = async (node, newIndex) => {
        try {
            await backbone.updateNode(node.id, {
                metadata: { ...node.metadata, orderIndex: parseInt(newIndex) || 0 }
            });
            refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleUpdateIdentityAnchor = async (nodeId, newAnchor) => {
        try {
            const node = rawNodes.find(n => n.id === nodeId);
            await backbone.updateNode(nodeId, {
                metadata: { ...node.metadata, identityAnchor: newAnchor }
            });
            refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleDismissHryvniaModal = async () => {
        if (!hryvniaBonusModal) return;
        try {
            const node = rawNodes.find(n => n.id === hryvniaBonusModal.aspectId);
            await backbone.updateNode(node.id, {
                metadata: { ...node.metadata, hryvniaBonusClaimed: true }
            });
            setHryvniaBonusModal(null);
            refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleRedeemReward = async (rewardId) => {
        console.warn(">>> handleRedeemReward V4 STARTING (No Confirm) <<< ID:", rewardId);
        const reward = rawNodes.find(n => n.id === rewardId);
        console.warn(">>> handleRedeemReward V4 REWARD FOUND:", reward?.name || "NONE");
        if (!reward) return;
        const cost = reward.metadata?.hryvniaCost || 0;

        try {
            console.log("DEBUG: Calling backbone.redeemReward with:", rewardId);
            console.log("DEBUG: backbone methods:", Object.keys(backbone));
            const success = await backbone.redeemReward(rewardId);
            console.log("DEBUG: backbone.redeemReward result:", success);
            if (success) {
                triggerStatus(`[Reward Redeemed] -${cost} Hryvnia: ${reward.name}`);
                logTrace(`[Reward Redeemed] -${cost} Hryvnia: ${reward.name}`);
            }
            refreshTree();
        } catch (e) {
            console.error("REDEEM ERROR:", e);
            alert(e.message);
        }
    };

    const handleRefillMarketplaceUI = async () => {
        try {
            await backbone.refillMarketplace();
            await refreshTree();
            triggerStatus("Marketplace Refilled!");
        } catch (e) {
            alert(e.message);
        }
    };

    const handleClaimMicroReward = async (taskId) => {
        try {
            await backbone.claimMicroReward(taskId);
            refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleUpdateWoop = async (objectiveId, fields) => {
        try {
            const node = rawNodes.find(n => n.id === objectiveId);
            await backbone.updateNode(objectiveId, {
                metadata: { ...node.metadata, ...fields }
            });
            refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleFatigueAction = async (skillId, action) => {
        const skill = rawNodes.find(n => n.id === skillId);
        if (!skill) return;

        let metadataUpdates = {};

        if (action === 'rest') {
            const wasActive = skill.metadata?.isActive;
            metadataUpdates = {
                isActive: false,
                cooldownActive: true,
                cooldownStart: Date.now(),
                cooldownEnd: Date.now() + (5 * 24 * 60 * 60 * 1000),
                fatigueSuggested: false,
                fatigueReminderAt: null
            };
            logTrace(`Fatigue: User chose REST for [${skill.name}]`);
            console.log(`Cooldown Activated → isActive: false`);
            if (wasActive) {
                console.log(`Active focus cleared for [${skill.name}]`);
            }
        } else if (action === 'keep') {
            metadataUpdates = {
                fatigueSuggested: false
            };
            logTrace(`Fatigue: User chose KEEP ACTIVE for [${skill.name}]`);
        } else if (action === 'remind') {
            metadataUpdates = {
                fatigueReminderAt: Date.now() + (24 * 60 * 60 * 1000)
            };
            logTrace(`Fatigue: User chose REMIND TOMORROW for [${skill.name}]`);
        }

        const finalMetadata = { ...skill.metadata, ...metadataUpdates };

        try {
            await backbone.updateNode(skillId, {
                metadata: finalMetadata
            });
            setActiveFatigueSkill(null);
            await refreshTree();
        } catch (e) {
            alert(e.message);
        }
    };

    const calculateProgress = (node) => {
        // Only Aspect and Objective calculate progress
        if (node.type !== NodeTypes.ASPECT && node.type !== NodeTypes.OBJECTIVE) {
            return null;
        }

        if (!node.children || node.children.length === 0) {
            return 0;
        }

        const totalProgress = node.children.reduce((acc, child) => {
            // Children of Objective are Aspects. Children of Aspect are Tasks.
            if (child.type === NodeTypes.TASK) {
                return acc + (child.metadata?.status === TaskStatuses.DONE ? 100 : 0);
            }
            return acc + (calculateProgress(child) || 0);
        }, 0);

        return Math.round(totalProgress / node.children.length);
    };

    const isAncestorLocked = (node) => {
        if (node.metadata?.locked) return true;
        // In this UI context, we check the tree path or just rely on service errors.
        // But for visual cues, we check metadata.locked.
        return node.metadata?.locked;
    };

    const renderNode = (node, parentLocked = false, parentSoftLocked = false) => {
        const progress = calculateProgress(node);
        const softLocked = parentSoftLocked;
        const isBackendLocked = lockedNodes.has(node.id);
        const locked = parentLocked || node.metadata?.locked || softLocked || isBackendLocked;
        const isActiveSkill = node.type === NodeTypes.SKILL && node.metadata?.isActive;
        const childType = {
            [NodeTypes.LIFE_AREA]: NodeTypes.SKILL,
            [NodeTypes.SKILL]: NodeTypes.OBJECTIVE,
            [NodeTypes.OBJECTIVE]: NodeTypes.ASPECT,
            [NodeTypes.ASPECT]: NodeTypes.TASK,
        }[node.type];

        // Achievements view filter
        if (viewMode === 'achievements' && node.type === NodeTypes.OBJECTIVE) {
            if (node.metadata?.status !== ObjectiveStatuses.ACHIEVED || !node.metadata?.locked) {
                return null;
            }
        }

        return (
            <div key={node.id} style={{
                marginLeft: '20px',
                borderLeft: `1px solid ${locked ? (softLocked && node.type === NodeTypes.ASPECT ? 'var(--color-text-secondary)' : 'var(--color-danger)') : (isActiveSkill ? 'var(--color-success)' : 'var(--color-border)')}`,
                padding: '10px',
                marginBottom: '5px',
                backgroundColor: (softLocked && node.type === NodeTypes.ASPECT) ? 'var(--alpha-high)' : (locked ? 'var(--alpha-low)' : (isActiveSkill ? 'var(--alpha-med)' : 'var(--alpha-low)')),
                opacity: softLocked ? 0.6 : (locked ? 0.8 : 1),
                border: isActiveSkill ? '1px solid var(--color-success)' : 'none',
                boxShadow: isActiveSkill ? '0 0 10px var(--alpha-high)' : 'none',
                borderRadius: '4px',
                filter: softLocked ? 'grayscale(0.8)' : 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.7em', width: '80px' }}>{node.type}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                        <b style={{ color: softLocked ? 'var(--color-text-secondary)' : (locked ? 'var(--color-danger)' : (isActiveSkill ? 'var(--color-success)' : 'var(--color-text-main)')), fontSize: '1.1em' }}>
                            {(locked && !softLocked) && '🔒 '}{softLocked && '🔗 '}{node.name}
                            {isActiveSkill && ' 🔥'}
                        </b>
                        {node.type === NodeTypes.LIFE_AREA && node.metadata?.identityAnchor && (
                            <span style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                                {node.metadata.identityAnchor}
                            </span>
                        )}
                    </div>

                    {focusMode && node.metadata?.isHabit && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8em', color: 'var(--color-warning)', backgroundColor: 'var(--alpha-high)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--color-warning)' }}>
                                IF {node.metadata?.ifThenTrigger || '...'} THEN
                            </span>
                            <span style={{ fontSize: '0.9em', color: 'var(--color-secondary)', fontWeight: 'bold' }}>
                                {node.metadata?.phaseLevel === 0 ? `[MVE] ${node.metadata?.mveDescription || 'Do 5 seconds'}` : `[PHASE 1] 10-Minute Session (Permission to stop)`}
                            </span>
                        </div>
                    )}

                    {isActiveSkill && (
                        <span style={{ fontSize: '0.7em', color: 'var(--color-success)', fontWeight: 'bold', background: 'var(--alpha-high)', padding: '2px 6px', borderRadius: '4px' }}>
                            FOCUSED
                        </span>
                    )}

                    {node.type === NodeTypes.SKILL && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label style={{
                                fontSize: '0.8em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: node.metadata?.cooldownActive ? 'not-allowed' : 'pointer',
                                color: node.metadata?.cooldownActive ? '#444' : (node.metadata?.isActive ? '#0f0' : '#888'),
                                opacity: node.metadata?.cooldownActive ? 0.6 : 1
                            }}>
                                <input
                                    type="checkbox"
                                    checked={!!node.metadata?.isActive}
                                    onChange={() => handleToggleActive(node)}
                                    disabled={node.metadata?.cooldownActive}
                                />
                                Active Focus
                            </label>

                            {node.metadata?.cooldownActive ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '0.7em', color: 'var(--color-warning)', background: 'var(--alpha-high)', padding: '2px 8px', borderRadius: '4px' }}>
                                        😴 On Cooldown ({Math.ceil((node.metadata.cooldownEnd - now) / (24 * 60 * 60 * 1000))} days left)
                                    </span>
                                    <button
                                        onClick={() => handleResumeEarly(node.id)}
                                        style={{
                                            fontSize: '0.7em',
                                            backgroundColor: 'var(--color-bg-secondary)',
                                            color: 'var(--color-secondary)',
                                            border: '1px solid var(--color-secondary)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        ↩ Resume Early
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleStartManualCooldown(node.id)}
                                    style={{
                                        fontSize: '0.7em',
                                        backgroundColor: 'var(--color-bg-secondary)',
                                        color: 'var(--color-text-secondary)',
                                        border: '1px solid var(--color-border)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    😴 Rest 5 Days
                                </button>
                            )}

                            {/* Identity Tier Selector */}
                            {!focusMode && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '15px', borderLeft: '1px solid var(--color-border)' }}>
                                    <span style={{ fontSize: '0.75em', color: 'var(--color-text-secondary)' }}>Tier:</span>
                                    <select
                                        value={node.metadata?.identityTier || ''}
                                        onChange={(e) => backbone.updateNode(node.id, { metadata: { ...node.metadata, identityTier: e.target.value } }).then(refreshTree)}
                                        style={{
                                            fontSize: '0.8em',
                                            padding: '2px',
                                            backgroundColor: 'var(--color-bg-secondary)',
                                            color: node.metadata?.identityTier === IdentityTiers.CORE ? 'var(--color-warning)' : 'var(--color-text-main)',
                                            border: '1px solid var(--color-border)',
                                            fontWeight: node.metadata?.identityTier === IdentityTiers.CORE ? 'bold' : 'normal'
                                        }}
                                    >
                                        <option value="" disabled>Select Tier</option>
                                        {Object.values(IdentityTiers).map(tier => (
                                            <option key={tier} value={tier} style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-main)' }}>{getIdentityTierLabel(tier)}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Temporary Debug Display (Small Badge) */}
                            {node.metadata?.identityTier && (
                                <span style={{
                                    fontSize: '9px',
                                    color: node.metadata.identityTier === IdentityTiers.CORE ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                                    border: `1px solid ${node.metadata.identityTier === IdentityTiers.CORE ? 'var(--color-warning)' : 'var(--color-border)'}`,
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    marginLeft: '5px'
                                }}>
                                    {getIdentityTierLabel(node.metadata.identityTier)}
                                </span>
                            )}

                            {/* PINCH State Display (Debug) */}
                            {node.metadata?.pinchState && (
                                <span style={{
                                    fontSize: '9px',
                                    color: 'var(--color-danger)',
                                    backgroundColor: 'var(--alpha-high)',
                                    border: '1px solid var(--color-danger)',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    marginLeft: '5px',
                                    fontWeight: 'bold'
                                }}>
                                    {node.metadata.pinchState}
                                </span>
                            )}

                            {/* Aura Visualization */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', paddingLeft: '15px', borderLeft: '1px solid var(--color-border)' }}>
                                <div style={{
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    color: 'var(--color-secondary)',
                                    backgroundColor: 'var(--alpha-high)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--color-secondary)'
                                }}>
                                    L{node.metadata?.auraLevel || 1}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                                        <span>Aura</span>
                                        <span>{(node.metadata?.auraTotal || 0) % 12} / 12</span>
                                    </div>
                                    <div style={{ width: '100%', height: '3px', backgroundColor: 'var(--alpha-low)', borderRadius: '1.5px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${((node.metadata?.auraTotal || 0) % 12) / 12 * 100}%`,
                                            height: '100%',
                                            backgroundColor: 'var(--color-primary)',
                                            boxShadow: '0 0 4px var(--color-primary)'
                                        }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {progress !== null && (
                        <span style={{
                            fontSize: '0.8em',
                            color: progress === 100 ? 'var(--color-success)' : 'var(--color-secondary)',
                            padding: '2px 6px',
                            backgroundColor: 'var(--alpha-med)',
                            borderRadius: '10px'
                        }}>
                            {progress}% Done
                        </span>
                    )}

                    {/* Life Area Identity Anchor Editor */}
                    {node.type === NodeTypes.LIFE_AREA && !locked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.75em', color: 'var(--color-text-secondary)' }}>Identity Anchor:</span>
                            <input
                                type="text"
                                value={node.metadata?.identityAnchor || ''}
                                onChange={(e) => handleUpdateIdentityAnchor(node.id, e.target.value)}
                                placeholder="Who are you here?"
                                style={{
                                    fontSize: '0.8em',
                                    padding: '2px 8px',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    color: 'var(--color-text-main)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    width: '180px'
                                }}
                            />
                        </div>
                    )}

                    {/* Objective Status Selector + Burnout Risk Badge */}
                    {node.type === NodeTypes.OBJECTIVE && (
                        <select
                            disabled={locked}
                            value={node.metadata?.status || ObjectiveStatuses.NOT_STARTED}
                            onChange={(e) => handleUpdateStatus(node.id, e.target.value)}
                            style={{ fontSize: '0.8em', padding: '2px', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                        >
                            {Object.values(ObjectiveStatuses).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}

                    {/* Burnout Risk Indicator */}
                    {node.type === NodeTypes.OBJECTIVE && node.metadata?.burnoutRisk === true && (
                        <span style={{
                            fontSize: '0.7em',
                            color: 'var(--color-warning)',
                            backgroundColor: 'var(--alpha-high)',
                            border: '1px solid var(--color-warning)',
                            padding: '1px 7px',
                            borderRadius: '4px',
                            fontWeight: '600',
                            letterSpacing: '0.02em',
                            opacity: 0.85
                        }}>
                            ⚠ Incoming Burnout Risk
                        </span>
                    )}

                    {/* WOOP EDITOR (Objective Level) */}
                    {node.type === NodeTypes.OBJECTIVE && !locked && (
                        <div style={{ marginLeft: '10px' }}>
                            <button
                                onClick={() => setExpandedWoop(prev => ({ ...prev, [node.id]: !prev[node.id] }))}
                                style={{
                                    fontSize: '0.7em',
                                    background: 'none',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                }}
                            >
                                🧭 {expandedWoop[node.id] ? 'Hide' : 'Show'} Wish & Outcome
                            </button>

                            {expandedWoop[node.id] && (
                                <div style={{
                                    marginTop: '8px',
                                    padding: '10px',
                                    backgroundColor: 'var(--alpha-low)',
                                    border: '1px solid var(--color-secondary)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    width: '300px'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.75em', color: 'var(--color-secondary)', marginBottom: '2px' }}>Wish</div>
                                        <input
                                            type="text"
                                            defaultValue={node.metadata?.wish || ''}
                                            onBlur={(e) => handleUpdateWoop(node.id, { wish: e.target.value })}
                                            placeholder="What do you want to become?"
                                            style={{
                                                width: '100%',
                                                fontSize: '0.8em',
                                                padding: '4px',
                                                backgroundColor: 'var(--color-bg-main)',
                                                color: 'var(--color-text-main)',
                                                border: '1px solid var(--color-border)'
                                            }}
                                        />
                                        <div style={{ fontSize: '0.65em', color: 'var(--color-text-secondary)', marginTop: '2px' }}>“What do you want to become or achieve here?”</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75em', color: 'var(--color-secondary)', marginBottom: '2px' }}>Outcome</div>
                                        <textarea
                                            defaultValue={node.metadata?.outcome || ''}
                                            onBlur={(e) => handleUpdateWoop(node.id, { outcome: e.target.value })}
                                            placeholder="How will it feel?"
                                            style={{
                                                width: '100%',
                                                fontSize: '0.8em',
                                                padding: '4px',
                                                backgroundColor: 'var(--color-bg-main)',
                                                color: 'var(--color-text-main)',
                                                border: '1px solid var(--color-border)',
                                                minHeight: '40px',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                        <div style={{ fontSize: '0.65em', color: 'var(--color-text-secondary)', marginTop: '2px' }}>“If this works perfectly, how will it feel?”</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}



                    {/* Task Order & Status */}
                    {node.type === NodeTypes.TASK && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.7em', color: 'var(--color-text-secondary)' }}>Ord:</span>
                                <input
                                    type="number"
                                    value={node.metadata?.orderIndex || 0}
                                    onChange={(e) => handleUpdateOrderIndex(node, e.target.value)}
                                    style={{ width: '40px', fontSize: '0.8em', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                                />
                            </div>


                            {node.metadata?.itemType === 'REPETITION' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', borderLeft: '1px solid var(--color-border)' }}>
                                    <span style={{ fontSize: '0.8em', color: 'var(--color-warning)', fontWeight: 'bold' }}>
                                        {node.metadata.currentUnits || 0} / {node.metadata.targetUnits || 0} {node.metadata.unitName || 'units'}
                                    </span>
                                    <button
                                        disabled={locked}
                                        onClick={() => backbone.incrementTaskRepetition(node.id).then(refreshTree)}
                                        style={{
                                            fontSize: '0.7em',
                                            padding: '2px 8px',
                                            backgroundColor: 'var(--color-bg-secondary)',
                                            color: 'var(--color-warning)',
                                            border: '1px solid var(--color-warning)',
                                            borderRadius: '4px',
                                            cursor: locked ? 'not-allowed' : 'pointer',
                                            opacity: locked ? 0.5 : 1
                                        }}
                                    >
                                        +1 {node.metadata.unitName || 'Unit'}
                                    </button>
                                </div>
                            ) : (
                                <select
                                    disabled={locked}
                                    value={node.metadata?.status || TaskStatuses.NOT_STARTED}
                                    onChange={(e) => handleUpdateStatus(node.id, e.target.value)}
                                    style={{
                                        fontSize: '0.8em',
                                        padding: '2px',
                                        backgroundColor: 'var(--color-bg-secondary)',
                                        color: node.metadata?.status === TaskStatuses.DONE ? 'var(--color-success)' : (node.metadata?.status === TaskStatuses.IN_PROGRESS ? 'var(--color-warning)' : 'var(--color-text-main)'),
                                        borderColor: 'var(--color-border)'
                                    }}
                                >
                                    {Object.values(TaskStatuses).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            )}

                            <div style={{ fontSize: '0.75em', color: 'var(--color-text-secondary)', borderLeft: '1px solid var(--color-border)', paddingLeft: '10px' }}>
                                Total: <span style={{ color: 'var(--color-text-secondary)' }}>{calculateTotalTaskTime(node.metadata?.sessions)}</span>
                            </div>

                            {/* Task Reward Attachment */}
                            {!locked && !focusMode && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '10px', borderLeft: '1px solid var(--color-border)', paddingLeft: '10px' }}>
                                    <span style={{ fontSize: '0.75em', color: 'var(--color-primary)' }}>Reward:</span>
                                    <select
                                        value={node.metadata?.rewardId || ''}
                                        onChange={(e) => backbone.updateNode(node.id, { metadata: { ...node.metadata, rewardId: e.target.value } }).then(refreshTree)}
                                        style={{ fontSize: '0.8em', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
                                    >
                                        <option value="">None</option>
                                        {rawNodes.filter(n => n.type === NodeTypes.REWARD && n.metadata?.rewardCategory === 'TASK').map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {!locked && (
                                <div style={{ display: 'flex', gap: '5px', padding: '0 10px', borderLeft: '1px solid var(--color-border)' }}>
                                    <span style={{ fontSize: '0.75em', color: 'var(--color-text-secondary)' }}>Session:</span>
                                    {/* Task Session Start Buttons */}
                                    {[5, 10, 20].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => handleStartSession(node.id, m, 'task')}
                                            style={{ fontSize: '0.7em', padding: '1px 4px', backgroundColor: m === 10 ? 'var(--color-bg-card)' : 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}
                                        >
                                            {m}m
                                        </button>
                                    ))}
                                </div>
                            )}

                        </div>
                    )}

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
                        {!locked && childType && (
                            <button
                                onClick={() => prepareAddNode(childType, node.id)}
                                style={{ fontSize: '0.7em', padding: '2px 8px', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-secondary)', border: '1px solid var(--color-secondary)', borderRadius: '4px' }}
                            >
                                + Add {childType}
                            </button>
                        )}
                        {!locked && (
                            node.type === NodeTypes.LIFE_AREA ||
                            node.type === NodeTypes.SKILL ||
                            node.type === NodeTypes.OBJECTIVE ||
                            node.type === NodeTypes.ASPECT ||
                            node.type === NodeTypes.TASK
                        ) && (
                                <button
                                    onClick={() => handleDeleteNode(node.id)}
                                    style={{ fontSize: '0.7em', padding: '2px 8px', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '4px' }}
                                >
                                    🗑️
                                </button>
                            )}
                    </div>
                </div>

                {/* HABIT ENGINE SECTION */}
                {node.type === NodeTypes.SKILL && (
                    <div style={{ margin: '5px 0 10px 20px', padding: '5px', backgroundColor: 'rgba(255,165,0,0.05)', borderLeft: '2px solid orange', borderRadius: '4px' }}>

                        {/* SKILL INSIGHT BANNER */}
                        <SkillInsightBanner skillNode={node} habits={habits} />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '5px 0' }}>
                            <span style={{ fontSize: '0.8em', color: 'var(--color-warning)', fontWeight: 'bold' }}>Habit Engine</span>
                            {!locked && !focusMode && (
                                <button
                                    onClick={() => {
                                        console.log("HabitUI: RAW BUTTON CLICK DETECTED for node:", node.id);
                                        handleCreateHabit(node.id);
                                    }}
                                    style={{ fontSize: '0.7em', padding: '1px 5px', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)', cursor: 'pointer' }}
                                >+ New Habit</button>
                            )}
                        </div>

                        {pendingHabit && pendingHabit.skillId === node.id && (
                            <div style={{ margin: '5px 0 10px 0', padding: '10px', backgroundColor: 'var(--alpha-high)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '0.8em', color: 'var(--color-warning)', width: '50px' }}>IF:</span>
                                        <input
                                            autoFocus
                                            placeholder="trigger (e.g. open laptop)"
                                            value={pendingHabit.ifTrigger || ''}
                                            onChange={(e) => setPendingHabit({ ...pendingHabit, ifTrigger: e.target.value })}
                                            style={{ flex: 1, backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', padding: '4px 8px', fontSize: '0.8em' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '0.8em', color: 'var(--color-secondary)', width: '50px' }}>THEN:</span>
                                        <input
                                            placeholder="MVE action (5-sec version)"
                                            value={pendingHabit.mveAction || ''}
                                            onChange={(e) => setPendingHabit({ ...pendingHabit, mveAction: e.target.value })}
                                            style={{ flex: 1, backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', padding: '4px 8px', fontSize: '0.8em' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '5px' }}>
                                        <button onClick={cancelHabitCreate} style={{ fontSize: '0.75em', padding: '3px 10px', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-main)', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Cancel</button>
                                        <button onClick={confirmHabitCreate} style={{ fontSize: '0.75em', padding: '3px 10px', backgroundColor: 'var(--color-warning)', color: 'var(--color-text-inverse)', fontWeight: 'bold', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Confirm</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {habits.filter(h => (h.linkedSkillIds?.includes(node.id) || h.linkedSkillId === node.id)).map(h => {
                            if (focusMode && !h.isActive) return null;
                            const currentPhase = h.phases ? h.phases[h.currentPhaseLevel] : null;
                            const eligibility = habitEligibilities[h.id];
                            const isEligibleForUpgrade = eligibility?.evolutionReady;

                            return (
                                <div key={h.id} style={{
                                    marginTop: '4px',
                                    padding: '6px',
                                    backgroundColor: h.isActive ? 'var(--alpha-high)' : 'var(--alpha-low)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {focusMode ? (
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '0.9em', color: 'var(--color-warning)', fontWeight: 'bold' }}>IF {h.ifTrigger}</span>
                                                <span style={{ fontSize: '0.9em', color: 'var(--color-text-main)' }}>➔</span>
                                                <span style={{ fontSize: '0.9em', color: 'var(--color-secondary)' }}>{currentPhase?.description || '---'}</span>
                                                <span style={{ marginLeft: 'auto', fontSize: '0.7em', color: 'var(--color-text-secondary)', marginRight: '10px' }}>Lvl {h.currentPhaseLevel}</span>

                                                <button
                                                    onClick={() => handleStartSession(h.id, 10, 'habit')}
                                                    style={{ fontSize: '0.75em', padding: '4px 10px', backgroundColor: 'var(--color-warning)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                    🚀 SPRINT (10m)
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        console.log("HabitUI: Focus Mode Done button clicked for", h.id);
                                                        handleCompleteHabit(h.id);
                                                    }}
                                                    style={{ fontSize: '0.8em', padding: '4px 12px', backgroundColor: 'var(--color-success)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 0 5px var(--color-success)' }}
                                                >
                                                    DONE
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Completion Checkbox (The Habit Checkbox) */}
                                                <input
                                                    type="checkbox"
                                                    title="Log Completion"
                                                    checked={false} // Resets immediately
                                                    onChange={() => {
                                                        console.log("HabitUI: Management Checkbox clicked for", h.id);
                                                        handleCompleteHabit(h.id);
                                                    }}
                                                    style={{ cursor: 'pointer', width: '20px', height: '20px' }}
                                                />

                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.8em', color: 'var(--color-text-main)' }}>
                                                        <span style={{ color: 'var(--color-warning)' }}>IF</span> {h.ifTrigger} <span style={{ color: 'var(--color-text-secondary)' }}>THEN</span> {currentPhase?.description || '---'}
                                                    </div>
                                                    <div style={{ fontSize: '0.7em', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                        Level {h.currentPhaseLevel} • Total: {h.totalCompletions}
                                                    </div>
                                                    {eligibility && (
                                                        <div style={{ fontSize: '0.65em', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                            Gate Status: {eligibility.gateStatus.lifetime.current}/{eligibility.gateStatus.lifetime.required} Life • {eligibility.gateStatus.stability.completedDays}/{eligibility.gateStatus.stability.required} Stability • Fri: {eligibility.gateStatus.friction.average.toFixed(1)}
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => handleStartSession(h.id, 10, 'habit')}
                                                    style={{ fontSize: '0.7em', padding: '2px 8px', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)', borderRadius: '3px', cursor: 'pointer' }}
                                                >
                                                    🚀 Sprint
                                                </button>

                                                {/* Upgrade Button */}
                                                {isEligibleForUpgrade ? (
                                                    <button
                                                        onClick={() => handleUpgradeHabit(h.id)}
                                                        style={{
                                                            fontSize: '0.7em',
                                                            padding: '2px 8px',
                                                            backgroundColor: 'var(--color-secondary)',
                                                            color: 'var(--color-text-inverse)',
                                                            fontWeight: 'bold',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer',
                                                            boxShadow: '0 0 5px var(--color-secondary)'
                                                        }}
                                                    >
                                                        ▲ SOLIDIFY PHASE
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '0.65em', color: '#444', fontStyle: 'italic' }}>
                                                        Not yet ready for solidification.
                                                    </span>
                                                )}

                                                {/* Focus Mode Toggle (Star) */}
                                                <button
                                                    onClick={() => handleToggleHabitActive(h.id, !h.isActive)}
                                                    title={h.isActive ? "Remove from Focus" : "Add to Focus (Max 4)"}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        fontSize: '1.2em',
                                                        cursor: 'pointer',
                                                        padding: '0 5px',
                                                        color: h.isActive ? '#fb0' : '#444',
                                                        filter: h.isActive ? 'drop-shadow(0 0 2px #fb0)' : 'none'
                                                    }}
                                                >
                                                    ★
                                                </button>

                                                <button onClick={() => handleDeleteHabit(h.id)} style={{ fontSize: '0.7em', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                                            </>
                                        )}
                                    </div>

                                    {/* HABIT SESSION LOGS */}
                                    {h.sessions && h.sessions.length > 0 && (
                                        <div style={{ padding: '0 10px 5px 28px', fontSize: '0.7em', color: '#777' }}>
                                            {h.sessions.map(s => {
                                                const elapsed = Math.round((now - s.startTime) / 1000);
                                                const isLive = s.status === 'active';
                                                return (
                                                    <div key={s.id} style={{ display: 'flex', gap: '8px', marginBottom: '2px', alignItems: 'center' }}>
                                                        <span>• Sprint:</span>
                                                        {isLive ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffa500' }}>
                                                                <span style={{ fontWeight: 'bold' }}>LIVE: {formatTime(elapsed)}</span>
                                                                <button
                                                                    onClick={() => handleCompleteSessionUI(h.id, s.id, 'habit')}
                                                                    style={{ fontSize: '0.8em', padding: '0 4px', backgroundColor: '#2e2', border: 'none', borderRadius: '2px' }}
                                                                >Stop</button>
                                                                {s.predictedPleasure !== undefined && (
                                                                    <span style={{ fontSize: '0.9em', color: '#888', opacity: 0.8 }}>
                                                                        🧠 {s.predictedPleasure} → ?
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span>{formatTime(s.actualDuration)} [Ended {new Date(s.endTime).toLocaleTimeString()}]</span>
                                                                {s.predictedPleasure !== undefined && (
                                                                    <span style={{ color: '#777', borderLeft: '1px solid #333', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                        <span>🧠 {s.predictedPleasure} → {s.actualPleasure ?? '?'}</span>
                                                                        {s.mastery !== undefined && <span>| ⚡ {s.mastery}</span>}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {habits.filter(h => (h.linkedSkillIds?.includes(node.id) || h.linkedSkillId === node.id)).length === 0 && !focusMode && (
                            <div style={{ fontSize: '0.7em', color: '#666', fontStyle: 'italic', padding: '5px' }}>No habits linked yet.</div>
                        )}
                    </div>
                )}

                {node.metadata?.achievedAt && (
                    <div style={{ fontSize: '0.7em', color: '#0f0', marginTop: '3px', paddingLeft: '95px' }}>
                        ✓ Achieved on {new Date(node.metadata.achievedAt).toLocaleDateString()}
                    </div>
                )}

                {isActiveSkill && node.metadata?.activatedAt && (
                    <div style={{ fontSize: '0.7em', color: '#0f0', marginTop: '3px', paddingLeft: '95px', opacity: 0.7 }}>
                        🔥 Activated at {new Date(node.metadata.activatedAt).toLocaleTimeString()}
                    </div>
                )}

                {node.type === NodeTypes.TASK && node.metadata?.sessions?.length > 0 && (
                    <div style={{ fontSize: '0.75em', color: '#888', marginTop: '5px', paddingLeft: '95px' }}>
                        <div style={{ color: '#555', marginBottom: '3px', fontWeight: 'bold' }}>Execution Logs:</div>
                        {node.metadata.sessions.map(s => {
                            const elapsed = Math.round((now - s.startTime) / 1000);
                            const isLive = s.status === 'active';

                            return (
                                <div key={s.id} style={{ display: 'flex', gap: '10px', marginBottom: '2px', alignItems: 'center' }}>
                                    <span>- {s.targetDuration}m Target</span>

                                    {isLive ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffa500' }}>
                                            <span style={{ fontWeight: 'bold' }}>LIVE: {formatTime(elapsed)} / {s.targetDuration}:00</span>
                                            {!locked && (
                                                <button
                                                    onClick={() => handleCompleteSessionUI(node.id, s.id, 'task')}
                                                    style={{ fontSize: '0.8em', padding: '0 4px', backgroundColor: '#2e2' }}
                                                >
                                                    Stop & Log
                                                </button>
                                            )}
                                            {s.predictedPleasure !== undefined && (
                                                <span style={{ fontSize: '0.9em', color: '#888', opacity: 0.8 }}>
                                                    🧠 {s.predictedPleasure} → ?
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555' }}>
                                            <span>Completed: {formatTime(s.actualDuration)} spent [Ended {new Date(s.endTime).toLocaleTimeString()}]</span>
                                            {s.predictedPleasure !== undefined && (
                                                <span style={{ color: '#777', borderLeft: '1px solid #333', paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span>🧠 {s.predictedPleasure} → {s.actualPleasure ?? '?'}</span>
                                                    {s.mastery !== undefined && <span>| ⚡ {s.mastery}</span>}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {pendingCreate && pendingCreate.parentId === node.id && (
                    <div style={{ padding: '10px', backgroundColor: 'var(--alpha-high)', marginTop: '5px', borderRadius: '4px', marginLeft: '95px', border: '1px solid var(--color-border)' }}>
                        <input
                            autoFocus
                            placeholder={`Name your ${pendingCreate.type}...`}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (pendingCreate.type === NodeTypes.SKILL ? (skillIdentityTier && confirmAddNode()) : confirmAddNode())}
                            style={{ padding: '5px', width: '200px', marginRight: '10px', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                        />

                        {pendingCreate.type === NodeTypes.SKILL && (
                            <select
                                value={skillIdentityTier}
                                onChange={(e) => setSkillIdentityTier(e.target.value)}
                                style={{
                                    padding: '5px',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    color: 'var(--color-text-main)',
                                    border: '1px solid var(--color-border)',
                                    marginRight: '10px',
                                    fontSize: '0.85em'
                                }}
                            >
                                <option value="" disabled style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>Select Identity Tier...</option>
                                {Object.values(IdentityTiers).map(tier => (
                                    <option key={tier} value={tier} style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-main)' }}>{getIdentityTierLabel(tier)}</option>
                                ))}
                            </select>
                        )}

                        <button
                            onClick={confirmAddNode}
                            disabled={pendingCreate.type === NodeTypes.SKILL && !skillIdentityTier}
                            style={{ marginRight: '5px', opacity: (pendingCreate.type === NodeTypes.SKILL && !skillIdentityTier) ? 0.5 : 1, backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                        >
                            Confirm
                        </button>
                        <button onClick={cancelAddNode} style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                )}


                {node.isAspectComplete && (
                    <div style={{
                        fontSize: '0.9em',
                        color: 'var(--color-success)',
                        fontWeight: 'bold',
                        marginTop: '10px',
                        padding: '10px',
                        backgroundColor: 'rgba(0, 255, 0, 0.05)',
                        border: '1px dashed #0f0',
                        textAlign: 'center',
                        letterSpacing: '0.1em',
                        borderRadius: '4px'
                    }}>
                        ASPECT COMPLETE ✓
                    </div>
                )}

                {/* Children Recursion */}
                {!locked && node.children && node.children.length > 0 && node.children
                    .sort((a, b) => (a.metadata?.orderIndex || 0) - (b.metadata?.orderIndex || 0))
                    .map(child => renderNode(child, locked, softLocked))}
            </div>
        );
    };


    const activeSkills = rawNodes.filter(n => n.type === NodeTypes.SKILL && n.metadata?.isActive);
    const hasActiveSkills = activeSkills.length > 0;

    const getFilteredTree = (nodes, shouldLog = false) => {
        console.log("getFilteredTree: focusMode =", focusMode, "nodes count =", nodes.length);
        if (!focusMode) return nodes;

        // 1. Identify the single active skill with the most recent momentum
        const momentumSkill = activeSkills
            .sort((a, b) => {
                const timeA = a.metadata?.lastWorkedAt ? new Date(a.metadata.lastWorkedAt).getTime() : 0;
                const timeB = b.metadata?.lastWorkedAt ? new Date(b.metadata.lastWorkedAt).getTime() : 0;
                return timeB - timeA; // Descending
            })[0];

        if (!momentumSkill) return [];

        const filterNode = (node) => {
            // Life Area: keep if it contains the momentum skill
            if (node.type === NodeTypes.LIFE_AREA) {
                const children = node.children.map(filterNode).filter(Boolean);
                return children.length > 0 ? { ...node, children } : null;
            }

            // Skill: keep only if it is the momentum skill
            if (node.type === NodeTypes.SKILL) {
                if (node.id !== momentumSkill.id) return null;
                const children = node.children.map(filterNode).filter(Boolean);
                return { ...node, children };
            }

            // Objective: only first ACTIVE
            if (node.type === NodeTypes.OBJECTIVE) {
                if (node.metadata?.status !== ObjectiveStatuses.ACTIVE) return null;
                const children = node.children.map(filterNode).filter(Boolean);
                return children.length > 0 ? { ...node, children: [children[0]] } : null;
            }

            // Aspect: find the first non-done task
            if (node.type === NodeTypes.ASPECT) {

                // For Aspect, we find the first non-done task
                const tasks = (node.children || [])
                    .filter(c => c.type === NodeTypes.TASK)
                    .sort((a, b) => (a.metadata?.orderIndex || 0) - (b.metadata?.orderIndex || 0));

                if (shouldLog) {
                    logTrace("Activation Debug → Total tasks found: " + tasks.length);
                    logTrace("Activation Debug → Tasks under active skill:");
                    tasks.forEach(t => {
                        logTrace(`Task: ${t.name} | Status: ${t.metadata?.status}`);
                    });
                }

                const nextTask = tasks.find(t => t.metadata?.status !== TaskStatuses.DONE);

                if (nextTask) {
                    return { ...node, children: [nextTask] };
                } else if (tasks.length > 0) {
                    // All tasks done
                    return {
                        ...node,
                        isAspectComplete: true,
                        children: []
                    };
                }
                return null;
            }

            return node;
        };

        return nodes.map(filterNode).filter(Boolean);
    };

    const displayTree = getFilteredTree(tree).filter(n => n.type !== NodeTypes.REWARD_VAULT && n.id !== 'ROOT');
    console.log("RENDER MODE:", focusMode ? "FOCUS" : "PLANNING", "DisplayTree Size:", displayTree.length);


    console.log("RENDER MODE:", focusMode ? "FOCUS" : "PLANNING");
    if (loading) return <div style={{ color: 'var(--color-text-main)', padding: '20px' }}>Loading Backbone V2...</div>;

    return (
        <div style={{
            padding: '40px',
            fontFamily: 'var(--font-family-sans)',
            backgroundColor: 'var(--color-bg-main)',
            minHeight: '100vh',
            color: 'var(--color-text-main)',
            position: 'relative',
            transition: 'background var(--transition-normal), color var(--transition-normal)'
        }}>
            <div id="daily-area-reinforcement" style={{ marginBottom: '30px', fontSize: '0.9em' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Identity Reinforced Today</div>
                {Object.keys(todayAreaLog).length === 0 ? (
                    <div style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}>No areas reinforced yet today.</div>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {Object.entries(todayAreaLog).map(([areaId, count]) => {
                            const areaNode = rawNodes.find(n => n.id === areaId);
                            const identityAnchor = areaNode?.metadata?.identityAnchor || areaNode?.name || areaId;
                            return (
                                <li key={areaId} style={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                                    • {identityAnchor} ×{count}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* UNDO TOAST */}
            {lastDeletedHabit && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100000,
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-danger)',
                    padding: '8px 16px',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    animation: 'slideDown 0.3s ease-out'
                }}>
                    <span style={{ fontSize: '0.9em', color: 'var(--color-text-main)' }}>Habit deleted</span>
                    <button
                        onClick={handleUndoDeleteHabit}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-danger)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.9em',
                            padding: '0 4px'
                        }}
                    >
                        Undo (⌘Z)
                    </button>
                    <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--color-border)' }} />
                    <button
                        onClick={() => setLastDeletedHabit(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            fontSize: '1em'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <div style={{ maxWidth: '600px', margin: '20px 0' }}>
                <ScheduledRestWidget />
            </div>

            {(() => {
                const rootNode = rawNodes.find(n => n.id === 'ROOT');
                const activeSprint = rootNode?.metadata?.activeSprint;
                const sprintSuggested = rootNode?.metadata?.sprintSuggested;

                return (
                    <>
                        {sprintSuggested && !activeSprint && (
                            <div style={{
                                padding: '12px 20px',
                                backgroundColor: 'var(--color-bg-secondary)',
                                border: '1px solid var(--color-warning)',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.9em',
                                color: 'var(--color-text-main)'
                            }}>
                                <span>⚡ Feeling stuck? Try a 5-minute Sprint.</span>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => backbone.startSprint(5).then(refreshTree)}
                                        style={{ backgroundColor: 'var(--color-warning)', color: 'var(--color-text-inverse)', fontWeight: 'bold', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Start Sprint
                                    </button>
                                    <button
                                        onClick={() => backbone.dismissSprintSuggestion().then(refreshTree)}
                                        style={{ backgroundColor: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeSprint && (
                            <div style={{
                                padding: '12px 20px',
                                backgroundColor: 'var(--alpha-med)',
                                border: '1px solid var(--color-warning)',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                color: 'var(--color-text-main)'
                            }}>
                                <span style={{ color: 'var(--color-warning)', fontWeight: 'bold' }}>
                                    Sprint Active: {(() => {
                                        const total = activeSprint.durationMinutes * 60;
                                        const elapsed = Math.round((now - activeSprint.startedAt) / 1000);
                                        const remaining = Math.max(0, total - elapsed);
                                        return formatTime(remaining);
                                    })()}
                                </span>
                                <button
                                    onClick={() => backbone.endSprint().then(refreshTree)}
                                    style={{ backgroundColor: 'var(--color-warning)', color: 'var(--color-text-inverse)', padding: '2px 8px', fontSize: '0.8em', border: 'none', borderRadius: '2px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    Stop Sprint
                                </button>
                                <span style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)' }}>You have permission to stop anytime.</span>
                            </div>
                        )}
                    </>
                );
            })()}

            <div style={{ marginTop: '20px', display: 'flex', gap: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div>
                        <h1 style={{ margin: 0 }}>Hierarchy Backbone V2 Tester</h1>
                    </div>

                    {focusMode ? (
                        <div style={{
                            padding: '6px 20px',
                            backgroundColor: 'var(--alpha-high)',
                            border: '1px solid var(--color-danger)',
                            borderRadius: '4px',
                            color: 'var(--color-danger)',
                            fontSize: '0.9em',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px'
                        }}>
                            <span>FOCUS MODE ON</span>
                            <button
                                onClick={async () => {
                                    logTrace(`Activation: Manual nudge requested`);
                                    await backbone.recordNudge();
                                    await refreshTree();

                                    const momentumSkill = activeSkills.sort((a, b) => {
                                        const timeA = a.metadata?.lastWorkedAt ? new Date(a.metadata.lastWorkedAt).getTime() : 0;
                                        const timeB = b.metadata?.lastWorkedAt ? new Date(b.metadata.lastWorkedAt).getTime() : 0;
                                        return timeB - timeA;
                                    })[0];

                                    logTrace(`Activation Debug → isFocusMode: ${focusMode}`);
                                    logTrace(`Activation Debug → activeSkillId: ${momentumSkill?.id || 'NONE'}`);

                                    if (!focusMode) logTrace("Activation: BLOCKED — Not in focus mode");
                                    if (!momentumSkill) logTrace("Activation: BLOCKED — No active skill");

                                    if (focusMode && momentumSkill) {
                                        const activationData = await getNextTaskForActivation();

                                        if (!activationData) {
                                            logTrace("Activation: BLOCKED — No next task found");
                                        } else {
                                            logTrace(`Activation: Showing suggestion for task: ${activationData.name}`);
                                            setShowActivation({
                                                taskId: activationData.id,
                                                name: activationData.name,
                                                message: activationData.message
                                            });
                                        }
                                    }
                                }}
                                style={{
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-danger)',
                                    border: '1px solid var(--color-danger)',
                                    padding: '2px 10px',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    fontSize: '0.8em'
                                }}
                            >
                                Nudge me
                            </button>

                            <button
                                onClick={() => backbone.startSprint(5).then(refreshTree)}
                                style={{
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-warning)',
                                    border: '1px solid var(--color-warning)',
                                    padding: '2px 10px',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    fontSize: '0.8em'
                                }}
                            >
                                Sprint (5m)
                            </button>

                            {/* WOOP CONTEXT */}
                            {(() => {
                                const momentumSkill = activeSkills.sort((a, b) => {
                                    const timeA = a.metadata?.lastWorkedAt ? new Date(a.metadata.lastWorkedAt).getTime() : 0;
                                    const timeB = b.metadata?.lastWorkedAt ? new Date(b.metadata.lastWorkedAt).getTime() : 0;
                                    return timeB - timeA;
                                })[0];
                                if (!momentumSkill) return null;
                                const activeObjective = (momentumSkill.children || []).find(o => o.type === NodeTypes.OBJECTIVE && o.metadata?.status === ObjectiveStatuses.ACTIVE);
                                if (!activeObjective || (!activeObjective.metadata?.wish && !activeObjective.metadata?.outcome)) return null;

                                return (
                                    <div style={{ marginLeft: '20px', borderLeft: '1px solid var(--alpha-high)', paddingLeft: '15px' }}>
                                        {activeObjective.metadata?.wish && (
                                            <div style={{ fontSize: '1.1em', color: 'var(--color-text-main)' }}>
                                                Working toward: <span style={{ color: 'var(--color-secondary)' }}>{activeObjective.metadata.wish}</span>
                                            </div>
                                        )}
                                        {activeObjective.metadata?.outcome && (
                                            <div style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                                                Because it will mean: {activeObjective.metadata.outcome}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <button
                                onClick={async () => {
                                    logTrace(`FocusMode: EXIT`);
                                    await backbone.trackFocusMode(false);
                                    setFocusMode(false);
                                    resetActivity();
                                    await refreshTree();
                                }}
                                style={{
                                    backgroundColor: 'var(--color-danger)',
                                    color: 'var(--color-text-inverse)',
                                    border: 'none',
                                    padding: '2px 10px',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    fontSize: '0.8em',
                                    marginLeft: 'auto'
                                }}
                            >
                                EXIT
                            </button>
                        </div>
                    ) : (
                        hasActiveSkills && (
                            <button
                                onClick={async () => {
                                    logTrace(`FocusMode: ENTER`);
                                    await backbone.trackFocusMode(true, logTrace);
                                    setFocusMode(true);
                                    resetActivity();
                                    await refreshTree();
                                }}
                                style={{
                                    padding: '6px 20px',
                                    backgroundColor: '#0f0',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                ENTER FOCUS MODE
                            </button>
                        )
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setViewMode('full')}
                        style={{ padding: '8px 15px', backgroundColor: viewMode === 'full' ? 'var(--color-secondary)' : 'var(--color-bg-secondary)', color: viewMode === 'full' ? 'var(--color-text-inverse)' : 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                    >
                        Full Hierarchy
                    </button>
                    <button
                        onClick={() => setViewMode('achievements')}
                        style={{ padding: '8px 15px', backgroundColor: viewMode === 'achievements' ? 'var(--color-success)' : 'var(--color-bg-secondary)', color: viewMode === 'achievements' ? 'var(--color-text-inverse)' : 'var(--color-text-main)', border: '1px solid var(--color-border)' }}
                    >
                        Achievements View (Locked)
                    </button>
                    {!focusMode && (
                        <div style={{
                            marginLeft: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: 'var(--alpha-med)',
                            padding: '6px 15px',
                            borderRadius: '20px',
                            border: '1px solid var(--color-warning)',
                            fontWeight: 'bold',
                            color: 'var(--color-warning)'
                        }}>
                            💰 Hryvnia: {hryvniaBalance}
                        </div>
                    )}
                </div>
            </div>

            {actionStatus && (
                <div style={{
                    padding: '10px',
                    backgroundColor: '#00d2ff',
                    color: '#000',
                    margin: '20px 0',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    textAlign: 'center'
                }}>
                    {actionStatus}
                </div>
            )}

            {!focusMode && (
                <div style={{
                    padding: '10px',
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    marginBottom: '20px',
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'monospace'
                }}>
                    <div style={{ borderBottom: '1px solid var(--color-border)', marginBottom: '5px', paddingBottom: '3px', fontWeight: 'bold', color: 'var(--color-text-main)' }}>Internal Trace Log</div>
                    {traces.map((t, i) => <div key={i}>{t}</div>)}
                </div>
            )}

            {!focusMode && viewMode === 'full' && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                        onClick={() => prepareAddNode(NodeTypes.LIFE_AREA)}
                        style={{ padding: '10px 20px', fontSize: '1em', cursor: 'pointer' }}
                    >
                        + Create Life Area
                    </button>

                    <button
                        onClick={refreshTree}
                        style={{
                            padding: '10px 20px',
                            fontSize: '1em',
                            cursor: 'pointer',
                            backgroundColor: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-main)',
                            border: '1px solid var(--color-border)'
                        }}
                    >
                        ↻ Force Refresh
                    </button>
                </div>
            )
            }

            {
                !focusMode && pendingCreate && pendingCreate.parentId === null && viewMode === 'full' && (
                    <div style={{ padding: '20px', backgroundColor: 'var(--color-bg-secondary)', marginBottom: '20px', borderRadius: '4px', border: '1px solid var(--color-secondary)' }}>
                        <h3 style={{ marginTop: 0 }}>Create New Life Area</h3>
                        <input
                            autoFocus
                            placeholder="Enter Life Area name..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && confirmAddNode()}
                            style={{ padding: '10px', width: '300px', marginRight: '10px', fontSize: '1.1em', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                        />
                        <button onClick={confirmAddNode} style={{ padding: '10px 20px', fontSize: '1em', backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Confirm</button>
                        <button onClick={cancelAddNode} style={{ padding: '10px 20px', fontSize: '1em', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: '4px', marginLeft: '5px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                )
            }

            {
                !focusMode && pendingCreate && pendingCreate.parentId !== null && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-secondary)', borderRadius: '12px', padding: '24px', width: '400px', boxShadow: 'var(--shadow-lg)' }}>
                            <h3 style={{ margin: '0 0 15px 0', color: 'var(--color-text-main)' }}>Add {pendingCreate.type}</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '5px' }}>Name</label>
                                    <input
                                        autoFocus
                                        placeholder={`Enter ${pendingCreate.type} name...`}
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && confirmAddNode()}
                                        style={{ width: '100%', padding: '8px', fontSize: '1em', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                    />
                                </div>

                                {pendingCreate.type === NodeTypes.ASPECT && (
                                    <div>
                                        <label style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '5px' }}>Aspect Type</label>
                                        <select
                                            value={aspectType}
                                            onChange={(e) => setAspectType(e.target.value)}
                                            style={{ width: '100%', padding: '8px', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                        >
                                            <option value="finite">Finite</option>
                                            <option value="repetition">Repetition</option>
                                            <option value="hybrid">Hybrid</option>
                                        </select>
                                    </div>
                                )}

                                {pendingCreate.type === NodeTypes.TASK && (
                                    <>
                                        <div>
                                            <label style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '5px' }}>Item Type</label>
                                            <select
                                                value={itemType}
                                                onChange={(e) => setItemType(e.target.value)}
                                                style={{ width: '100%', padding: '8px', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                            >
                                                <option value="task">Finite Task</option>
                                                <option value="REPETITION">Repetition Block</option>
                                            </select>
                                        </div>

                                        {itemType === 'REPETITION' && (
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '5px' }}>Unit Name</label>
                                                    <input
                                                        placeholder="e.g. pages"
                                                        value={unitName}
                                                        onChange={(e) => setUnitName(e.target.value)}
                                                        style={{ width: '100%', padding: '8px', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                                    />
                                                </div>
                                                <div style={{ width: '100px' }}>
                                                    <label style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '5px' }}>Target</label>
                                                    <input
                                                        type="number"
                                                        value={targetUnits}
                                                        onChange={(e) => setTargetUnits(e.target.value)}
                                                        style={{ width: '100%', padding: '8px', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                                <button onClick={cancelAddNode} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={confirmAddNode} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--color-secondary)', border: 'none', color: 'var(--color-text-inverse)', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}>Add Item</button>
                            </div>
                        </div>
                    </div>
                )
            }


            <div style={{ marginTop: '20px' }}>
                {displayTree.length === 0 ? (
                    <div style={{ padding: '100px 20px', textAlign: 'center', opacity: 0.3 }}>
                        <p style={{ fontSize: '18px', letterSpacing: '0.05em' }}>
                            {focusMode ? 'NO ACTIVE FOCUS OBJECTS' : 'EMPTY REPOSITORY'}
                        </p>
                        {focusMode && (
                            <button
                                onClick={() => setFocusMode(false)}
                                style={{ marginTop: '20px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', padding: '5px 15px', cursor: 'pointer', fontSize: '12px' }}
                            >
                                Return to Full View
                            </button>
                        )}
                    </div>
                ) : (
                    displayTree.filter(n => n.type !== NodeTypes.REWARD).map(n => renderNode(n))
                )}
            </div>

            {/* REWARD SYSTEM SECTION */}
            {
                !focusMode && (
                    <div style={{ marginTop: '40px', borderTop: '2px solid var(--color-border)', paddingTop: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>🏆 Reward System UPDATED</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ fontSize: '1.2em', color: 'var(--color-warning)', fontWeight: 'bold' }}>
                                    {hryvniaBalance} Hryvnia
                                </span>
                            </div>
                        </div>

                        {/* ACTIVE MARKETPLACE */}
                        <div style={{ marginBottom: '30px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--alpha-med)', paddingBottom: '5px' }}>
                                <h3 style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '0.9em', letterSpacing: '0.1em' }}>ACTIVE MARKETPLACE (8 ITEMS)</h3>
                                <button
                                    onClick={handleRefillMarketplaceUI}
                                    style={{ backgroundColor: 'transparent', color: 'var(--color-secondary)', border: '1px solid var(--color-secondary)', padding: '2px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7em', fontWeight: 'bold' }}
                                >
                                    🔄 REFILL
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                {(() => {
                                    const rootNode = rawNodes.find(n => n.id === 'ROOT');
                                    const mkt = rootNode?.metadata?.activeMarketplace || [];
                                    console.log("ACTIVE MARKETPLACE ARRAY:", mkt);
                                    console.log("ACTIVE MARKETPLACE LENGTH:", mkt.length);

                                    if (mkt.length === 0) {
                                        return <p style={{ color: '#666', fontSize: '0.8em', fontStyle: 'italic' }}>No active rewards. Click refill.</p>;
                                    }

                                    return mkt.map(item => {
                                        const rId = typeof item === 'string' ? item : item.rewardId;
                                        return rawNodes.find(n => n.id === rId);
                                    }).filter(Boolean).map(reward => (
                                        <div key={reward.id} style={{
                                            backgroundColor: 'var(--color-bg-secondary)',
                                            border: '1px solid var(--alpha-low)',
                                            borderRadius: '8px',
                                            padding: '15px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '10px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <h4 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '0.95em' }}>{reward.name}</h4>
                                                <span style={{ fontSize: '0.7em', color: 'var(--color-secondary)', opacity: 0.6 }}>ID: {reward.id}</span>
                                            </div>

                                            <p style={{ margin: 0, fontSize: '0.85em', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                                "{reward.metadata?.sensoryDescription || 'No description'}"
                                            </p>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                                                <span style={{ color: 'var(--color-warning)', fontWeight: 'bold', fontSize: '0.9em' }}>{reward.metadata?.hryvniaCost || 0} Hryvnia</span>
                                                <button
                                                    onClick={async () => {
                                                        console.warn(">>> REDEEM BUTTON UI V4 CLICKED <<< ID:", reward.id);
                                                        await handleRedeemReward(reward.id);
                                                    }}
                                                    disabled={hryvniaBalance < (reward.metadata?.hryvniaCost || 0)}
                                                    style={{
                                                        marginLeft: 'auto',
                                                        backgroundColor: hryvniaBalance >= (reward.metadata?.hryvniaCost || 0) ? 'var(--color-secondary)' : 'var(--color-bg-card)',
                                                        color: 'var(--color-text-inverse)',
                                                        border: 'none',
                                                        padding: '4px 12px',
                                                        borderRadius: '4px',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.8em',
                                                        cursor: hryvniaBalance >= (reward.metadata?.hryvniaCost || 0) ? 'pointer' : 'not-allowed'
                                                    }}
                                                >
                                                    REDEEM
                                                </button>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* REWARD BANK */}
                        <div style={{ marginBottom: '30px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--alpha-med)', paddingBottom: '5px' }}>
                                <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '0.9em', letterSpacing: '0.1em' }}>REWARD BANK (POOL)</h3>
                                <button
                                    onClick={() => prepareAddNode(NodeTypes.REWARD, 'REWARD_BANK')}
                                    style={{ backgroundColor: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', padding: '2px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7em', fontWeight: 'bold' }}
                                >
                                    + ADD TO BANK
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                {rawNodes.filter(n => n.type === NodeTypes.REWARD && n.parentId === 'REWARD_BANK').map(reward => (
                                    <div key={reward.id} style={{
                                        backgroundColor: 'var(--color-bg-secondary)',
                                        border: '1px solid var(--alpha-low)',
                                        borderRadius: '8px',
                                        padding: '15px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        opacity: 0.8
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <h4 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '0.95em' }}>{reward.name}</h4>
                                            <button
                                                onClick={() => handleDeleteNode(reward.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9em', color: 'var(--color-text-secondary)', opacity: 0.5 }}
                                            >🗑️</button>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <div style={{
                                                fontSize: '0.6em',
                                                backgroundColor: reward.metadata?.rewardCategory === 'MARKETPLACE' ? '#0af33' : '#fb033',
                                                color: reward.metadata?.rewardCategory === 'MARKETPLACE' ? '#0af' : '#fb0',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontWeight: 'bold',
                                                border: `1px solid ${reward.metadata?.rewardCategory === 'MARKETPLACE' ? '#0af55' : '#fb055'}`
                                            }}>
                                                {reward.metadata?.rewardCategory || 'UNCATEGORIZED'}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <label style={{ fontSize: '0.7em', color: 'var(--color-text-secondary)' }}>Cost:</label>
                                            <input
                                                type="number"
                                                value={reward.metadata?.hryvniaCost || 0}
                                                onChange={(e) => backbone.updateNode(reward.id, { metadata: { ...reward.metadata, hryvniaCost: parseInt(e.target.value) || 0 } }).then(refreshTree)}
                                                style={{ width: '60px', fontSize: '0.75em', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', padding: '2px' }}
                                            />
                                        </div>

                                        <textarea
                                            placeholder="Sensory description..."
                                            value={reward.metadata?.sensoryDescription || ''}
                                            onChange={(e) => backbone.updateNode(reward.id, { metadata: { ...reward.metadata, sensoryDescription: e.target.value } }).then(refreshTree)}
                                            style={{ height: '40px', fontSize: '0.75em', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px' }}
                                        />

                                        {activeMarketplace.some(item => (typeof item === 'string' ? item : item.rewardId) === reward.id) && (
                                            <div style={{ fontSize: '0.65em', color: 'var(--color-secondary)', fontWeight: 'bold' }}>📍 ACTIVE IN MARKETPLACE</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {!focusMode && viewMode === 'full' && (
                <div style={{ marginTop: '40px', borderTop: '2px solid var(--color-border)', paddingTop: '20px' }}>
                    <h3 style={{ color: 'var(--color-secondary)' }}>V2 Repository Raw Data (JSON)</h3>
                    <pre style={{
                        backgroundColor: 'var(--color-bg-sidebar-solid)',
                        padding: '15px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        maxHeight: '400px',
                        fontSize: '12px',
                        color: 'var(--color-success)',
                        border: '1px solid var(--color-border)'
                    }}>
                        {JSON.stringify(rawNodes, null, 2)}
                    </pre>
                </div>
            )}
            {/* SESSION SETUP MODAL */}
            {
                activeSessionSetup && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '320px', boxShadow: 'var(--shadow-lg)' }}>
                            <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-text-main)' }}>Pleasure Prediction</h3>
                            <p style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                                How good do you think this {activeSessionSetup.duration}m {activeSessionSetup.type} session will feel? (0–10)
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '24px' }}>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={activeSessionSetup.predictedPleasure}
                                    onChange={(e) => setActiveSessionSetup({ ...activeSessionSetup, predictedPleasure: e.target.value })}
                                    style={{ flex: 1, accentColor: 'var(--color-warning)' }}
                                />
                                <span style={{ fontSize: '1.5em', fontWeight: 'bold', color: 'var(--color-warning)', minWidth: '30px' }}>{activeSessionSetup.predictedPleasure}</span>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <p style={{ fontSize: '0.75em', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                                    Initiation Delay (minutes) – Dev Only
                                </p>
                                <input
                                    type="number"
                                    min="0"
                                    value={activeSessionSetup.initiationDelay || 0}
                                    onChange={(e) => setActiveSessionSetup({ ...activeSessionSetup, initiationDelay: parseInt(e.target.value) || 0 })}
                                    style={{
                                        width: '100%',
                                        backgroundColor: 'var(--color-bg-main)',
                                        color: 'var(--color-warning)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '4px',
                                        padding: '6px',
                                        fontSize: '0.9em'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setActiveSessionSetup(null)} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--color-bg-secondary)', border: 'none', color: 'var(--color-text-main)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={confirmStartSession} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--color-warning)', border: 'none', color: 'var(--color-text-inverse)', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}>Start Timer</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* SESSION WRAPUP MODAL */}
            {
                activeSessionWrapup && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '320px', boxShadow: 'var(--shadow-lg)' }}>
                            <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-text-main)' }}>Session Correction</h3>

                            <div style={{ marginBottom: '16px' }}>
                                <p style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>How hard was it to start? (0–10)</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        value={activeSessionWrapup.startCost}
                                        onChange={(e) => setActiveSessionWrapup({ ...activeSessionWrapup, startCost: e.target.value })}
                                        style={{ flex: 1, accentColor: 'var(--color-warning)' }}
                                    />
                                    <span style={{ fontSize: '1.2em', fontWeight: 'bold', color: 'var(--color-warning)', minWidth: '25px' }}>{activeSessionWrapup.startCost}</span>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <p style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>How good did it actually feel? (0–10)</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        value={activeSessionWrapup.actualPleasure}
                                        onChange={(e) => setActiveSessionWrapup({ ...activeSessionWrapup, actualPleasure: e.target.value })}
                                        style={{ flex: 1, accentColor: 'var(--color-success)' }}
                                    />
                                    <span style={{ fontSize: '1.2em', fontWeight: 'bold', color: 'var(--color-success)', minWidth: '25px' }}>{activeSessionWrapup.actualPleasure}</span>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <p style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>How much mastery did you feel? (0–10)</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        value={activeSessionWrapup.mastery}
                                        onChange={(e) => setActiveSessionWrapup({ ...activeSessionWrapup, mastery: e.target.value })}
                                        style={{ flex: 1, accentColor: 'var(--color-secondary)' }}
                                    />
                                    <span style={{ fontSize: '1.2em', fontWeight: 'bold', color: 'var(--color-secondary)', minWidth: '25px' }}>{activeSessionWrapup.mastery}</span>
                                </div>
                            </div>

                            <button onClick={confirmCompleteSession} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--color-success)', border: 'none', color: 'var(--color-text-inverse)', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}>Log Results</button>
                        </div>
                    </div>
                )
            }
            {/* ACTIVATION MODAL */}
            {
                showActivation && (
                    <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 300000 }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-danger)', borderRadius: '8px', padding: '20px', width: '300px', boxShadow: 'var(--shadow-lg)' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: 'var(--color-danger)', fontSize: '0.9em', fontWeight: 'bold', letterSpacing: '0.05em' }}>ACTIVATION ENGINE</h4>
                            <p style={{ margin: '0 0 15px 0', fontSize: '1.05em', lineHeight: '1.4', color: 'var(--color-text-main)' }}>{showActivation.message}</p>
                            <p style={{ margin: '0 0 20px 0', fontSize: '0.8em', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Permission to stop after {ACTIVATION_DURATION} minutes.</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => {
                                        logTrace(`Activation: Nudge DISMISSED`);
                                        setNudgeHistory(prev => [...prev, { timestamp: Date.now(), action: 'dismiss' }]);
                                        setShowActivation(null);
                                    }}
                                    style={{ flex: 1, padding: '8px', backgroundColor: 'var(--color-bg-secondary)', border: 'none', color: 'var(--color-text-main)', borderRadius: '4px', fontSize: '0.85em', cursor: 'pointer' }}
                                >
                                    Not now
                                </button>
                                <button
                                    onClick={() => {
                                        logTrace(`Activation: Nudge ACCEPTED for [${showActivation.name}]`);
                                        setNudgeHistory(prev => [...prev, { timestamp: Date.now(), action: 'accept' }]);
                                        handleStartSession(showActivation.taskId, ACTIVATION_DURATION, 'task');
                                        setShowActivation(null);
                                    }}
                                    style={{ flex: 1.2, padding: '8px', backgroundColor: 'var(--color-danger)', border: 'none', color: 'var(--color-text-inverse)', fontWeight: 'bold', borderRadius: '4px', fontSize: '0.85em', cursor: 'pointer' }}
                                >
                                    Start 5m
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* FATIGUE APPROVAL MODAL */}
            {
                activeFatigueSkill && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 400000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '30px', width: '400px', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
                            <div style={{ fontSize: '3em', marginBottom: '15px' }}>🧘</div>
                            <h2 style={{ margin: '0 0 10px 0', color: 'var(--color-text-main)', fontSize: '1.5em' }}>Skill feels heavy</h2>
                            <p style={{ margin: '0 0 25px 0', fontSize: '1em', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                                You’ve shown signs of friction in <b>{activeFatigueSkill.name}</b>. Would you like to rest it for 5 days?
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={() => handleFatigueAction(activeFatigueSkill.id, 'rest')}
                                    style={{ padding: '12px', backgroundColor: 'var(--color-text-main)', border: 'none', color: 'var(--color-bg-main)', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', fontSize: '1em' }}
                                >
                                    Rest for 5 days
                                </button>
                                <button
                                    onClick={() => handleFatigueAction(activeFatigueSkill.id, 'keep')}
                                    style={{ padding: '12px', backgroundColor: 'var(--color-bg-secondary)', border: 'none', color: 'var(--color-text-main)', borderRadius: '8px', cursor: 'pointer', fontSize: '1em' }}
                                >
                                    Keep active
                                </button>
                                <button
                                    onClick={() => handleFatigueAction(activeFatigueSkill.id, 'remind')}
                                    style={{ padding: '12px', backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9em' }}
                                >
                                    Remind me tomorrow
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ACTIVE LIMIT MODAL */}
            {
                activeLimitModal && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 500000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '30px', width: '420px', boxShadow: 'var(--shadow-lg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--alpha-low)', paddingBottom: '15px' }}>
                                <span style={{ fontSize: '2em' }}>⚡</span>
                                <div>
                                    <h2 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '1.2em' }}>Active Focus Limit Reached</h2>
                                    <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>Only 4 skills can be active at once.</p>
                                </div>
                            </div>

                            <p style={{ margin: '0 0 20px 0', fontSize: '0.95em', color: 'var(--color-text-main)', lineHeight: '1.5' }}>
                                To activate <b>{activeLimitModal.name}</b>, you must first rest one of your current active skills:
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
                                {rawNodes.filter(n => n.type === NodeTypes.SKILL && n.metadata?.isActive).map(activeSkill => (
                                    <div key={activeSkill.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        backgroundColor: 'var(--color-bg-secondary)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '8px'
                                    }}>
                                        <span style={{ color: 'var(--color-text-main)', fontWeight: 'bold', fontSize: '0.9em' }}>{activeSkill.name}</span>
                                        <button
                                            onClick={() => handleSwapSkill(activeSkill, activeLimitModal)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: 'var(--color-bg-card)',
                                                color: 'var(--color-warning)',
                                                border: '1px solid var(--color-warning)',
                                                borderRadius: '6px',
                                                fontSize: '0.8em',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Rest This Skill
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setActiveLimitModal(null)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-secondary)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.9em'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )
            }

            {/* HRYVNIA BONUS MODAL */}
            {
                hryvniaBonusModal && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 400000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-success)', borderRadius: '12px', padding: '30px', width: '350px', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
                            <h2 style={{ color: 'var(--color-success)', margin: '0 0 10px 0' }}>ASPECT COMPLETE!</h2>
                            <div style={{ fontSize: '3em', margin: '20px 0' }}>💰</div>
                            <p style={{ fontSize: '1.2em', color: 'var(--color-text-main)', marginBottom: '10px' }}>
                                +{hryvniaBonusModal.amount} Hryvnia
                            </p>
                            <p style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)', marginBottom: '30px' }}>
                                Awarded for completing: <br /><strong>{hryvniaBonusModal.aspectName}</strong>
                            </p>
                            <button
                                onClick={handleDismissHryvniaModal}
                                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--color-success)', border: 'none', color: 'var(--color-text-inverse)', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                CLAIM REWARD
                            </button>
                        </div>
                    </div>
                )
            }

            {/* MICRO REWARD UNLOCKED NOTIFICATION */}
            {
                unlockedMicroReward && (
                    <div style={{ position: 'fixed', bottom: '30px', left: '30px', zIndex: 400000 }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-warning)', borderRadius: '12px', padding: '20px', width: '300px', boxShadow: 'var(--shadow-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ color: 'var(--color-warning)', fontWeight: 'bold', fontSize: '0.9em' }}>⚡ MICRO REWARD UNLOCKED</span>
                                <button onClick={() => setUnlockedMicroReward(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>×</button>
                            </div>
                            <h4 style={{ margin: '0 0 5px 0', color: 'var(--color-text-main)' }}>{unlockedMicroReward.rewardName}</h4>
                            <p style={{ margin: '0 0 15px 0', fontSize: '0.85em', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                "{unlockedMicroReward.sensoryDescription}"
                            </p>
                            <button
                                onClick={() => {
                                    handleClaimMicroReward(unlockedMicroReward.taskId);
                                    setUnlockedMicroReward(null);
                                }}
                                style={{ width: '100%', padding: '8px', backgroundColor: 'var(--color-warning)', border: 'none', color: 'var(--color-text-inverse)', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                CLAIM NOW
                            </button>
                        </div>
                    </div>
                )
            }

            {/* REWARD CREATION MODAL */}
            {
                pendingCreate && pendingCreate.type === NodeTypes.REWARD && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 600000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                        <div style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-warning)', borderRadius: '16px', padding: '30px', width: '420px', boxShadow: 'var(--shadow-lg)' }}>
                            <h2 style={{ margin: '0 0 20px 0', color: 'var(--color-warning)', fontSize: '1.4em' }}>Create New Reward</h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Name</label>
                                    <input
                                        autoFocus
                                        placeholder="Enter reward name..."
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && confirmAddNode()}
                                        style={{ width: '100%', padding: '10px', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', borderRadius: '6px' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Description (Internal)</label>
                                    <textarea
                                        placeholder="What is this reward?"
                                        value={rewardDescription}
                                        onChange={(e) => setRewardDescription(e.target.value)}
                                        style={{ width: '100%', minHeight: '60px', padding: '10px', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', borderRadius: '6px' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Sensory Description (Visual/Tactile)</label>
                                    <textarea
                                        placeholder="How does it feel? (e.g. cold beer, warm pizza)"
                                        value={rewardSensory}
                                        onChange={(e) => setRewardSensory(e.target.value)}
                                        style={{ width: '100%', minHeight: '60px', padding: '10px', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', borderRadius: '6px' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8em', color: '#888', marginBottom: '5px' }}>Category</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => setRewardCategory('MARKETPLACE')}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                backgroundColor: rewardCategory === 'MARKETPLACE' ? 'var(--color-secondary)' : 'var(--color-bg-secondary)',
                                                color: rewardCategory === 'MARKETPLACE' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            MARKETPLACE
                                        </button>
                                        <button
                                            onClick={() => setRewardCategory('TASK')}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                backgroundColor: rewardCategory === 'TASK' ? 'var(--color-warning)' : 'var(--color-bg-secondary)',
                                                color: rewardCategory === 'TASK' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            TASK
                                        </button>
                                    </div>
                                </div>

                                {rewardCategory === 'MARKETPLACE' && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>Hryvnia Cost</label>
                                        <input
                                            type="number"
                                            value={rewardCost}
                                            onChange={(e) => setRewardCost(parseInt(e.target.value) || 0)}
                                            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button
                                        onClick={cancelAddNode}
                                        style={{ flex: 1, padding: '12px', backgroundColor: 'var(--color-bg-secondary)', border: 'none', color: 'var(--color-text-main)', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmAddNode}
                                        style={{ flex: 1.5, padding: '12px', backgroundColor: 'var(--color-warning)', border: 'none', color: 'var(--color-text-inverse)', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                        Create Reward
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// --- ACTIVATION ENGINE HELPERS ---
const getActivationMessage = (taskName, energyState = 'normal') => {
    const pool = {
        normal: [
            `Looks like you've been paused for a bit. Want to try 5 minutes on ${taskName}?`,
            `You've handled this before. Want to start with 5 minutes on ${taskName}?`,
            `5-minute sprint on ${taskName}? Just to build momentum.`,
            `When it feels heavy, starting small helps. 5 minutes on ${taskName}?`
        ],
        low: [
            `Let's make this tiny. Just 3–5 minutes on ${taskName}.`,
            `Just a micro-step. Maybe 3 minutes on ${taskName}?`,
            `Low energy today? Let's just do 5 minutes on ${taskName} and see.`
        ]
    };

    const messages = pool[energyState] || pool.normal;
    return messages[Math.floor(Math.random() * messages.length)];
};

const getPleasureAnalytics = (skillNode, habits = []) => {
    // Collect all completed sessions for this skill (from tasks and habits)
    const allSessions = [];

    // From Tasks
    const collectTaskSessions = (node) => {
        if (node.type === NodeTypes.TASK && node.metadata?.sessions) {
            allSessions.push(...node.metadata.sessions.filter(s => s.status === 'completed' && s.actualPleasure !== undefined));
        }
        if (node.children) node.children.forEach(collectTaskSessions);
    };
    collectTaskSessions(skillNode);

    // From Habits linked to this skill
    habits.filter(h => (h.linkedSkillIds?.includes(skillNode.id) || h.linkedSkillId === skillNode.id)).forEach(h => {
        if (h.sessions) {
            allSessions.push(...h.sessions.filter(s => s.status === 'completed' && s.actualPleasure !== undefined));
        }
    });

    if (allSessions.length < 5) return null;

    // Sort by time
    allSessions.sort((a, b) => b.endTime - a.endTime);
    const last5 = allSessions.slice(0, 5);

    const avgPredicted = last5.reduce((acc, s) => acc + (s.predictedPleasure || 0), 0) / 5;
    const avgActual = last5.reduce((acc, s) => acc + (s.actualPleasure || 0), 0) / 5;

    return {
        avgPredicted,
        avgActual,
        underprediction: avgActual >= avgPredicted + 2,
        count: allSessions.length
    };
};

// Component for the Analytics Banner
const SkillInsightBanner = ({ skillNode, habits }) => {
    const analytics = getPleasureAnalytics(skillNode, habits);
    if (!analytics || !analytics.underprediction) return null;

    return (
        <div style={{
            marginTop: '8px',
            backgroundColor: 'var(--alpha-low)',
            border: '1px solid var(--color-success)',
            borderRadius: '12px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'fadeIn 0.5s ease-out'
        }}>
            <span style={{ fontSize: '1.2em' }}>🧠</span>
            <span style={{ fontSize: '0.85em', color: 'var(--color-success)', fontWeight: 'bold' }}>
                Insight: This tends to feel better than expected.
            </span>
            <span style={{ fontSize: '0.7em', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                (Actual {analytics.avgActual.toFixed(1)} vs Pred {analytics.avgPredicted.toFixed(1)})
            </span>
        </div>
    );
};

export default StructuralTester;
