import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { backbone, NodeTypes, TaskStatuses } from '../backbone-v2/index';
import './FocusPage.css';
import GlassPanel from '../components/ui/GlassPanel';
import { useSession } from '../context/SessionContext';
import { getAspectStats, scoreLowEnergyTask } from '../utils/taskScoring';
import { formatDuration, formatTimer } from '../utils/timeUtils';
import RewardAnimation from '../components/RewardAnimation';
import { useSettings } from '../context/SettingsContext';



const ACKS = ["Good.", "Nice.", "Done."];

const FocusPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const TIMER_PERSISTENCE_KEY = 'backbone_active_timer';
    const [task, setTask] = useState(null);
    const [skill, setSkill] = useState(null);
    const [allNodes, setAllNodes] = useState([]);
    const [todayTasks, setTodayTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isGlowing, setIsGlowing] = useState(false);
    const [ack, setAck] = useState(null);
    const [isToggled, setIsToggled] = useState(false);
    const [knobSnapped, setKnobSnapped] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [isInterestMode, setIsInterestMode] = useState(false);

    // Session State
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [seconds, setSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(true);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null); // Wall-clock anchor — only set on start/resume
    const TARGET_SECONDS = 10 * 60; // always 10-minute sessions

    // Safe Mode
    const [safeMode, setSafeMode] = useState(false);

    // Modal State
    const [showSetup, setShowSetup] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [predictedPleasure, setPredictedPleasure] = useState(5);
    const [actualPleasure, setActualPleasure] = useState(5);
    const [mastery, setMastery] = useState(5);
    const [isNavigatingAway, setIsNavigatingAway] = useState(false);
    const [isPassionSafeSession, setIsPassionSafeSession] = useState(false);
    const [isInterestExploring, setIsInterestExploring] = useState(false);
    const [wasContinued, setWasContinued] = useState(false);
    const [showPassionContinuePrompt, setShowPassionContinuePrompt] = useState(false);
    const [showInterestContinuePrompt, setShowInterestContinuePrompt] = useState(false);
    const [showHyperfocusGuard, setShowHyperfocusGuard] = useState(false);
    const [hyperfocusWarning, setHyperfocusWarning] = useState(null);
    const [savoringIdentity, setSavoringIdentity] = useState(null);

    const [checkpointsCompleted, setCheckpointsCompleted] = useState(0);
    const [subSteps, setSubSteps] = useState([]);
    const [newSubStep, setNewSubStep] = useState('');
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [uninterruptedSeconds, setUninterruptedSeconds] = useState(0);
    const [checkpointToast, setCheckpointToast] = useState(null);

    // Momentum Loop Local State
    const [showMomentum, setShowMomentum] = useState(false);
    const [nextSuggestedTask, setNextSuggestedTask] = useState(null);
    const [hasAutoStarted, setHasAutoStarted] = useState(false);

    const [levelUpCelebration, setLevelUpCelebration] = useState(null); // { level: X, fading: false }


    // Reward Animation Ref
    const rewardRef = useRef(null);

    // Drag guard for sub-step reorder
    const isDraggingSubStep = useRef(false);
    const toggleContainerRef = useRef(null);


    // Snapshot / Locking State
    const lockedTaskIdsRef = useRef(null);

    // ── Sub-step Progressive Disclosure Logic ──
    const completedSubSteps = subSteps.filter(s => s.isCompleted);
    const incompleteSubSteps = subSteps.filter(s => !s.isCompleted);
    
    const activeSubStep = incompleteSubSteps[0];
    const upNextSubStep = incompleteSubSteps[1];

    const historyToDisplay = (showAllHistory ? completedSubSteps : completedSubSteps.slice(-3));

    const triggerCheckpoint = useCallback(() => {
        setCheckpointsCompleted(c => {
            const nextC = c + 1;
            if (nextC % 2 === 0) setCheckpointToast("Nice work — momentum rising");
            else setCheckpointToast("Checkpoint reached — momentum building");
            setTimeout(() => setCheckpointToast(null), 3000);
            return nextC;
        });
    }, []);

    // Central Session Context sync
    const { 
        setIsSessionActive, 
        setActiveSessionId: setGlobalSessionId, 
        registerCompleteHandler, 
        unregisterCompleteHandler,
        previousRoute,
        energyLevel
    } = useSession();

    const { todayRemovalMode } = useSettings();


    useEffect(() => {
        setIsSessionActive(!!activeSessionId);
        setGlobalSessionId(activeSessionId);
    }, [activeSessionId, setIsSessionActive, setGlobalSessionId]);

    // --- LEVEL UP CELEBRATION LISTENER ---
    useEffect(() => {
        const handleLevelUp = (e) => {
            const { skillId, newLevel } = e.detail;
            
            // Only trigger if it matches the current skill
            // (or if we want a global celebrate, but user said "proximal to action")
            if (skill && skillId !== skill.id) return;

            // Trigger visual bloom
            setLevelUpCelebration({ level: newLevel, fading: false });
            
            // Audio is handled centrally in Sidebar.jsx to ensure sync with sidebar glow

            // Start fade out after 2.7s (total 3s duration)
            setTimeout(() => {
                setLevelUpCelebration(prev => prev ? { ...prev, fading: true } : null);
                
                // Clear completely after fade out
                setTimeout(() => setLevelUpCelebration(null), 300);
            }, 2700);
        };

        window.addEventListener('skill-level-up', handleLevelUp);
        return () => window.removeEventListener('skill-level-up', handleLevelUp);
    }, [skill]);

    const aspectStats = React.useMemo(() => getAspectStats(allNodes), [allNodes]);

    // Precompute next suggested task for instant Momentum Loop
    useEffect(() => {
        if (energyLevel <= 2 && task && allNodes.length > 0) {
            const availableTasks = allNodes.filter(n => 
                n.type === NodeTypes.TASK && 
                n.metadata?.status !== TaskStatuses.DONE &&
                n.id !== task.id
            );
            if (availableTasks.length > 0) {
                const sorted = [...availableTasks].sort((a, b) => 
                    scoreLowEnergyTask(b, aspectStats) - scoreLowEnergyTask(a, aspectStats)
                );
                setNextSuggestedTask(sorted[0]);
            } else {
                setNextSuggestedTask(null);
            }
        } else {
            setNextSuggestedTask(null);
        }
    }, [task, allNodes, aspectStats, energyLevel]);


    const handleToggleSubStep = async (id) => {
        if (isDraggingSubStep.current) return;

        const now = Date.now();
        const updated = subSteps.map(s => {
            if (s.id === id) {
                const isNowCompleted = !s.isCompleted;
                return { 
                    ...s, 
                    isCompleted: isNowCompleted,
                    completedAt: isNowCompleted ? now : null 
                };
            }
            return s;
        });
        setSubSteps(updated);

        await backbone.updateNode(task.id, {
            metadata: { subSteps: updated }
        });
    };

    const handleAddSubStep = async (e) => {
        if (e.key === 'Enter' && newSubStep.trim()) {
            const updated = [...subSteps, { 
                id: Date.now().toString(), 
                text: newSubStep.trim(), 
                isCompleted: false,
                completedAt: null 
            }];
            setSubSteps(updated);
            setNewSubStep('');
            await backbone.updateNode(task.id, {
                metadata: { subSteps: updated }
            });
        }
    };

    const handleReorderSubSteps = async (newOrder) => {
        setSubSteps(newOrder);
        await backbone.updateNode(task.id, {
            metadata: { subSteps: newOrder }
        });
    };

    const loadNextTask = useCallback(async () => {
        setLoading(true);
        setIsToggled(false);
        setKnobSnapped(false);
        setIsToggling(false);
        
        // Note: we don't immediately clear activeSessionId/seconds here 
        // to avoid transient 'null' wiping the persisted state before we check it.
        try {
            const fetchedNodes = await backbone.getAllNodes();
            setAllNodes(fetchedNodes);
            // 1. Initial Snapshot Capture (only once per session)
            const todayTasksList = fetchedNodes.filter(n => 
                n.type === NodeTypes.TASK && 
                n.metadata?.isToday === true &&
                n.metadata?.status !== TaskStatuses.DONE
            );
            setTodayTasks(todayTasksList);

            if (lockedTaskIdsRef.current === null) {
                const ids = todayTasksList.map(t => t.id);
                lockedTaskIdsRef.current = ids;
            }

            // 1.5. Restore Persisted Session if it exists
            const savedTimerStr = localStorage.getItem(TIMER_PERSISTENCE_KEY);
            let restoredTimer = null;
            if (savedTimerStr) {
                try {
                    restoredTimer = JSON.parse(savedTimerStr);
                } catch (e) {
                    console.error("[Focus Mode] Failed to parse saved timer:", e);
                }
            }

            // 2. Select Next Task
            let nextTask = null;
            let didRestore = false;

            // Priority 0: Persisted session
            if (restoredTimer) {
                nextTask = fetchedNodes.find(n => n.id === restoredTimer.taskId);
                if (nextTask) {
                    setActiveSessionId(restoredTimer.activeSessionId);
                    setIsPaused(restoredTimer.isPaused);
                    didRestore = true;
                    
                    // If it was running, calculate current seconds immediately
                    if (!restoredTimer.isPaused && restoredTimer.startTime) {
                        startTimeRef.current = restoredTimer.startTime;
                        const elapsed = Math.floor((Date.now() - restoredTimer.startTime) / 1000);
                        setSeconds(elapsed);
                    } else {
                        setSeconds(restoredTimer.seconds || 0);
                        startTimeRef.current = restoredTimer.startTime || null;
                    }
                } else {
                    localStorage.removeItem(TIMER_PERSISTENCE_KEY);
                }
            }

            if (!didRestore) {
                setActiveSessionId(prev => prev ?? null);
                if (!startTimeRef.current) {
                    setSeconds(0);
                    setIsPaused(true);
                }
            }

            // Priority A: Specifically passed task from LaunchpadFlow
            const forcedTaskId = location.state?.taskId;
            if (forcedTaskId) {
                nextTask = fetchedNodes.find(n => n.id === forcedTaskId);
                // Clear state so subsequent loads (after task finish) don't loop the same task
                window.history.replaceState({}, document.title);
            }

            // Priority B: Snapshot-aware Backbone flow
            if (!nextTask) {
                // Subsequent loads in the same session - follow the locked list
                for (const id of lockedTaskIdsRef.current) {
                    const t = fetchedNodes.find(n => n.id === id);
                    if (t && t.metadata?.status !== TaskStatuses.DONE) {
                        nextTask = t;
                        break;
                    }
                }
            }

            if (nextTask) {
                setTask(nextTask);
                // Find parent skill
                let parent = fetchedNodes.find(n => n.id === nextTask.parentId);
                while (parent && parent.type !== NodeTypes.SKILL) {
                    parent = allNodes.find(n => n.id === parent.parentId);
                }
                setSkill(parent);

                // Detect burnout safe mode from ancestor objective
                let objNode = fetchedNodes.find(n => n.id === nextTask.parentId);
                while (objNode && objNode.type !== NodeTypes.OBJECTIVE) {
                    objNode = allNodes.find(n => n.id === objNode?.parentId);
                }
                setSafeMode(!!objNode?.metadata?.burnoutRisk);

                // INTEREST Mode check
                setIsInterestMode(parent?.metadata?.pinchState === 'INTEREST');
                setIsInterestExploring(false);
                setShowInterestContinuePrompt(false);
                setShowHyperfocusGuard(false);
                setHyperfocusWarning(null);

                // PASSION Safe Session check
                const queryParams = new URLSearchParams(window.location.search);
                if (queryParams.get('safeSession') === 'true' && parent?.metadata?.pinchState === 'PASSION') {
                    setIsPassionSafeSession(true);
                } else {
                    setIsPassionSafeSession(false);
                }
                setWasContinued(false);
                setCheckpointsCompleted(0);
                setUninterruptedSeconds(0);
                setSubSteps(nextTask.metadata?.subSteps || []);
                setShowAllHistory(false);
            } else {
                setTask(null);
                setSkill(null);
                setSafeMode(false);
            }
        } catch (error) {
            console.error("Focus mode failed to load task:", error);
        } finally {
            setLoading(false);
        }
    }, [location.state?.taskId]);

    const handleSwitchTask = useCallback((direction) => {
        if (todayTasks.length <= 1 || activeSessionId) return;

        const currentIndex = todayTasks.findIndex(t => t.id === task.id);
        let nextIndex = currentIndex + direction;
        if (nextIndex < 0) nextIndex = todayTasks.length - 1;
        if (nextIndex >= todayTasks.length) nextIndex = 0;

        const nextTask = todayTasks[nextIndex];

        // 1. Reset Session State
        setSeconds(0);
        setIsPaused(true);
        setActiveSessionId(null);
        startTimeRef.current = null;
        localStorage.removeItem(TIMER_PERSISTENCE_KEY);

        // 2. Setup Task Environment
        setTask(nextTask);
        
        let parent = allNodes.find(n => n.id === nextTask.parentId);
        while (parent && parent.type !== NodeTypes.SKILL) {
            parent = allNodes.find(n => n.id === parent.parentId);
        }
        setSkill(parent);

        let objNode = allNodes.find(n => n.id === nextTask.parentId);
        while (objNode && objNode.type !== NodeTypes.OBJECTIVE) {
            objNode = allNodes.find(n => n.id === objNode?.parentId);
        }
        setSafeMode(!!objNode?.metadata?.burnoutRisk);

        setIsInterestMode(parent?.metadata?.pinchState === 'INTEREST');
        setIsInterestExploring(false);
        setWasContinued(false);
        setCheckpointsCompleted(0);
        setUninterruptedSeconds(0);
        setSubSteps(nextTask.metadata?.subSteps || []);
        setShowAllHistory(false);

    }, [todayTasks, task, allNodes, activeSessionId]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (activeSessionId || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') handleSwitchTask(-1);
            if (e.key === 'ArrowRight') handleSwitchTask(1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSwitchTask, activeSessionId]);

    useEffect(() => {
        if (startTimeRef.current !== null) {
            return;
        }
        loadNextTask();
    }, [loadNextTask]);


    // Timer Interval — drift-proof via Date.now()
    useEffect(() => {
        if (!isPaused && activeSessionId) {
            // Set startTimeRef only if not already anchored (don't reset on re-renders)
            if (startTimeRef.current === null) {
                startTimeRef.current = Date.now() - (seconds * 1000);
            }

            // Persistence: save periodically when running
            const persistTimer = (currentSeconds) => {
                if (task?.id && activeSessionId) {
                    localStorage.setItem(TIMER_PERSISTENCE_KEY, JSON.stringify({
                        activeSessionId,
                        taskId: task.id,
                        isPaused: false,
                        seconds: currentSeconds,
                        startTime: startTimeRef.current
                    }));
                }
            };

            timerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);

                setSeconds(elapsed);
                
                // Save state every few seconds to keep it fresh
                if (elapsed % 5 === 0) persistTimer(elapsed);

                // PASSION/INTEREST Safe Start
                if ((isPassionSafeSession || (isInterestMode && !isInterestExploring)) && !wasContinued && elapsed >= TARGET_SECONDS) {
                    setIsPaused(true);
                    if (isInterestMode) setShowInterestContinuePrompt(true);
                    else setShowPassionContinuePrompt(true);
                    clearInterval(timerRef.current);
                    return;
                }

                // Layer 2 Core Loop
                setUninterruptedSeconds(u => {
                    const newU = u + 1;
                    if (newU >= 1800) { // 30 minutes trigger
                        triggerCheckpoint();
                        return 0;
                    }
                    return newU;
                });

                // INTEREST Hyperfocus Guard (90 mins = 5400 seconds)
                if (isInterestMode && elapsed > 0) {
                    const secondsRemaining = 5400 - elapsed;
                    if (secondsRemaining === 600) setHyperfocusWarning(`${formatDuration(10, 'minutes')} remaining`);
                    else if (secondsRemaining === 300) setHyperfocusWarning(`${formatDuration(5, 'minutes')} remaining`);
                    else if (secondsRemaining === 60) setHyperfocusWarning(`${formatDuration(1, 'minutes')} remaining`);

                    else if (secondsRemaining === 0) {
                        setIsPaused(true);
                        setShowHyperfocusGuard(true);
                        clearInterval(timerRef.current);
                    }
                }
            }, 1000);
        } else {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        return () => {
            clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [isPaused, activeSessionId, task?.id]);

    // Save state on pause/stop or when session details change
    useEffect(() => {
        if (activeSessionId && task?.id) {
            localStorage.setItem(TIMER_PERSISTENCE_KEY, JSON.stringify({
                activeSessionId,
                taskId: task.id,
                isPaused,
                seconds,
                startTime: startTimeRef.current
            }));
        }
    }, [isPaused, activeSessionId, task?.id]);

    useEffect(() => {
        return () => {};
    }, []);

    const formatTime = (totalSeconds) => formatTimer(totalSeconds);


    const handleStartSession = useCallback(async () => {
        if (activeSessionId) {
            // Resuming: re-anchor clock based on current elapsed seconds so drift-proof calc is correct
            startTimeRef.current = Date.now() - (seconds * 1000);
            setIsPaused(false);
            return;
        }

        setShowSetup(true);
    }, [activeSessionId, seconds]);

    const startBackboneSession = useCallback(async (pleasureValue) => {
        try {
            const sess = await backbone.startSession(task.id, 10, pleasureValue, 0);
            setActiveSessionId(sess.id);
            // Anchor the clock — this is the only place we set startTimeRef for a fresh session
            startTimeRef.current = Date.now();
            setSeconds(0);
            setIsPaused(false);
            setShowSetup(false);

            // Trigger Reward Animation: +1 Aura awarded for session start
            if (rewardRef.current) {
                rewardRef.current.showReward([{ type: 'aura', amount: 1 }]);
            }
        } catch (error) {

            console.error("[DEBUG FocusPage] startBackboneSession FAILED:", error);
        }
    }, [task?.id, setActiveSessionId]);

    // Auto-start logic
    useEffect(() => {
        if (!task || !location.state?.autoStart || hasAutoStarted) return;

        // Automatically trigger the Predicted Pleasure setup modal
        handleStartSession();
        setHasAutoStarted(true);
    }, [task, location.state?.autoStart, hasAutoStarted, handleStartSession]);

    const handlePauseSession = () => {
        if (!activeSessionId) return;
        setIsPaused(true);
        setUninterruptedSeconds(0);
        setShowSummary(true);
    };

    const completeBackboneSession = useCallback(async (preventLoad = false) => {
        console.time("sessionComplete");
        try {
            const currentTaskId = task.id;
            const currentSessionId = activeSessionId;


            // 1. SOFT RELOAD Logic: Mark MVE completed on the parent objective if in low energy
            if (energyLevel <= 2 && currentTaskId) {
                const parentAspect = allNodes.find(n => n.id === task.parentId);
                if (parentAspect && parentAspect.type === NodeTypes.ASPECT) {
                    const parentExperiment = allNodes.find(n => n.id === parentAspect.parentId);
                    if (parentExperiment && parentExperiment.type === NodeTypes.OBJECTIVE) {
                        const now = Date.now();
                        await backbone.updateNode(parentExperiment.id, {
                            metadata: {
                                ...parentExperiment.metadata,
                                mveCompletedAt: now
                            }
                        });
                    }
                }
            }

            // Optimistic UI updates
            setActiveSessionId(null);
            setSeconds(0);
            startTimeRef.current = null; // Reset anchor for next session
            setShowSummary(false);
            localStorage.removeItem(TIMER_PERSISTENCE_KEY);

            if (preventLoad) {
                // When completing a task, WAIT for the session save to finish
                // so it doesn't race with proceedWithTaskCompletion
                await backbone.completeSession(currentTaskId, currentSessionId, actualPleasure, mastery);
            } else {
                // Normal pause/stop — fire and forget is fine
                backbone.completeSession(currentTaskId, currentSessionId, actualPleasure, mastery)
                    .then(() => {})
                    .catch(err => console.error("[DEBUG FocusPage] completeSession background error:", err));

                // 1.5. Check for today task auto-removal
                if (todayRemovalMode === 'after_session' && currentTaskId) {
                    backbone.updateNode(currentTaskId, {
                        metadata: {
                            ...task.metadata,
                            isToday: false
                        }
                    }).catch(err => console.error("[Focus Mode] Failed to auto-remove today tag:", err));
                }

                // 2. INSTANT UI: Trigger Momentum Loop immediately
                if (energyLevel <= 2 && !isNavigatingAway && nextSuggestedTask) {
                    setShowMomentum(true);
                    return;
                }

                // Standard flow
                if (isNavigatingAway) {
                    backbone.trackFocusMode(false).catch(console.error);
                    navigate(previousRoute || '/launchpad');
                } else {
                    loadNextTask();
                }
            }
        } catch (error) {
            console.error("[DEBUG FocusPage] completeBackboneSession critical error:", error);
        } finally {
            console.timeEnd("sessionComplete");
        }
    }, [task?.id, activeSessionId, actualPleasure, mastery, isNavigatingAway, navigate, previousRoute, energyLevel, loadNextTask, nextSuggestedTask]);

    const [pendingTaskComplete, setPendingTaskComplete] = useState(false);

    const proceedWithTaskCompletion = useCallback(async () => {
        setIsToggling(true);

        // 1. Mechanical engagement delay (100ms)
        setTimeout(() => {
            setIsToggled(true);

            // 2. Visual reinforcement states triggered mid-animation
            setTimeout(() => {
                setIsGlowing(true);
                setTimeout(() => setIsGlowing(false), 450);

                if (Math.random() < 0.33 && !ack) {
                    const randomAck = ACKS[Math.floor(Math.random() * ACKS.length)];
                    setAck(randomAck);
                    setTimeout(() => setAck(null), 1300);
                }
            }, 300);

            // 3. Database Execution & Transition
            setTimeout(async () => {
                console.time("taskCompleteTransition");
                try {
                    // Start async work
                    
                    const taskUpdatePromise = task.metadata?.itemType === 'REPETITION'
                        ? backbone.incrementTaskRepetition(task.id)
                        : backbone.updateNode(task.id, {
                            metadata: {
                                status: TaskStatuses.DONE,
                                completedAt: Date.now()
                            }
                        });

                    // Fetch allNodes needed for identity savoring BEFORE the timeout finishes
                    const allNodes = await backbone.getAllNodes();

                    await taskUpdatePromise;
                    
                    const verifyByGrep = await backbone.getAllNodes();
                    const verify = verifyByGrep.find(n => n.id === task.id);

                    // Trigger Reward Animation: +1 Aura & +1 Hryvnia for Task Completion
                    if (rewardRef.current) {
                        rewardRef.current.showReward([
                            { type: 'aura', amount: 1 },
                            { type: 'hryvnia', amount: 1 }
                        ]);
                    }


                    // Load next task after a brief pause for neurological closure
                    setTimeout(() => {
                        // PASSION Identity Savoring
                        if (skill?.metadata?.pinchState === 'PASSION') {
                            const objNode = allNodes.find(n => n.parentId === skill.id && n.type === NodeTypes.OBJECTIVE);
                            const msg = Math.random() < 0.5
                                ? `You are becoming someone who ${objNode?.metadata?.wish || 'pursues excellence'}.`
                                : `This is what it looks like to become ${skill.name}.`;
                            setSavoringIdentity(msg);
                            setTimeout(() => {
                                setSavoringIdentity(null);
                                loadNextTask();
                                setPendingTaskComplete(false);
                                console.timeEnd("taskCompleteTransition");
                            }, 3000);
                        } else {
                            loadNextTask();
                            setPendingTaskComplete(false);
                            console.timeEnd("taskCompleteTransition");
                        }
                    }, 400);
                } catch (error) {
                    console.error("Focus mode action failed:", error);
                    setIsToggling(false);
                    setIsToggled(false);
                    setKnobSnapped(false);
                    setPendingTaskComplete(false);
                    console.timeEnd("taskCompleteTransition");
                }
            }, 600);
        }, 100);
    }, [task, skill, ack, loadNextTask]);


    const handleSummarySubmit = useCallback(async () => {
        // Step 1: Fully await the session save to prevent race conditions
        await completeBackboneSession(pendingTaskComplete);
        
        // Step 2: Only then proceed to mark the task as complete/increment repetition
        if (pendingTaskComplete) {
            await proceedWithTaskCompletion();
        }
    }, [completeBackboneSession, pendingTaskComplete, proceedWithTaskCompletion]);

    const handleAction = useCallback(async () => {
        if (!task || isToggling) return;

        // Already showing summary — submit it
        if (showSummary) {
            handleSummarySubmit();
            return;
        }

        // No active session — complete immediately with no victory lap
        if (!activeSessionId) {
            proceedWithTaskCompletion();
            return;
        }

        // Snap the knob immediately
        setKnobSnapped(true);

        // Transition to summary
        setIsPaused(true);
        setPendingTaskComplete(true);
        setShowSummary(true);

    }, [task, isToggling, activeSessionId, showSummary, handleSummarySubmit, proceedWithTaskCompletion]);

    useEffect(() => {
        // Expose handleAction to the global shortcut system
        registerCompleteHandler(handleAction);
        return () => unregisterCompleteHandler();
    }, [registerCompleteHandler, unregisterCompleteHandler, handleAction]);



    const handleExit = async () => {
        if (activeSessionId) {
            setIsNavigatingAway(true);
            setIsPaused(true);
            setShowSummary(true);
            return;
        }
        try {
            await backbone.trackFocusMode(false);
        } catch (error) {
            console.error("Failed to exit focus mode:", error);
        }
        navigate(previousRoute || '/launchpad');
    };

    const handleSaveForHighEnergy = async () => {
        if (!task) return;
        
        try {
            const updatedNode = await backbone.updateNode(task.id, { 
                metadata: { 
                    highEnergy: true,
                    isToday: false 
                } 
            });
            
            // Move to next task immediately
            setTask(null);
            loadNextTask();
        } catch (err) {
            console.error("[HIGH ENERGY SAVE] ERROR - Failed to save for high energy:", err);
        }
    };



    if (loading && !task) {
        return (
            <div className="focus-container loading">
                <div className="focus-spinner"></div>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="focus-container empty">
                <div className="focus-empty-state">
                    <h2>Focus Session Over</h2>
                    <p>All "Today" tasks are complete.</p>
                    <button className="focus-back-btn" onClick={handleExit}>
                        Return to Planning
                    </button>
                </div>
            </div>
        );
    }

    const isRepetition = task.metadata?.itemType === 'REPETITION';
    const isNoveltySprint = skill?.metadata?.pinchState === 'NOVELTY';

    return (
        <div className="focus-container">
            <button className="focus-exit-btn" onClick={handleExit}>Back to Planning</button>



            <header className="focus-header">
                {skill && (
                    <span 
                        className="focus-skill-label" 
                        style={{ color: 'var(--focus-color-status)' }}
                    >
                        {skill.name}
                    </span>
                )}
            </header>

            <main className="focus-content">
                {/* Safe Mode / Interest Mode on-ramp framing */}
                {(safeMode || (isInterestMode && !isInterestExploring)) && !activeSessionId && isPaused && (
                    <div className="focus-safe-onramp">
                        {isInterestMode ? `Just ${formatDuration(10, 'minutes')} of exploration.` : `Let’s just do ${formatDuration(10, 'minutes')}.`}
                    </div>
                )}

                <div className="focus-session-controls">
                    {(safeMode || (isInterestMode && !isInterestExploring)) && !wasContinued ? (
                        /* Circular progress ring instead of digital countdown */
                        <div className="focus-ring-timer">
                            <svg viewBox="0 0 64 64" className="focus-ring-svg">
                                <circle cx="32" cy="32" r="28" className="focus-ring-track" />
                                <circle
                                    cx="32" cy="32" r="28"
                                    className="focus-ring-fill"
                                    strokeDasharray={`${2 * Math.PI * 28}`}
                                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.min(seconds / TARGET_SECONDS, 1))}`}
                                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                                />
                            </svg>
                            <span className="focus-ring-label">
                                {formatDuration(TARGET_SECONDS - seconds)}
                            </span>
                        </div>
                    ) : (
                        <div className={`focus-timer-display ${!isPaused ? 'active' : ''}`}>
                            {formatTime(seconds)}
                        </div>
                    )}
                    <button
                        className={`focus-play-pause-btn ${!isPaused ? 'active' : ''}`}
                        onClick={isPaused ? handleStartSession : handlePauseSession}
                    >
                        {isPaused ? "▶" : "⏸"}
                    </button>
                </div>

                <div className={`focus-action-card ${isGlowing ? 'glow' : ''}`}>
                    <div className="focus-task-navigation">
                        {todayTasks.length > 1 && !activeSessionId && (
                            <button className="task-nav-btn prev" onClick={() => handleSwitchTask(-1)}>‹</button>
                        )}
                        <h1 className="focus-task-name">{task.name}</h1>
                        {todayTasks.length > 1 && !activeSessionId && (
                            <button className="task-nav-btn next" onClick={() => handleSwitchTask(1)}>›</button>
                        )}
                    </div>
                    


                    <AnimatePresence>
                        {checkpointToast && (
                            <motion.div
                                className="checkpoint-toast"
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                {checkpointToast}
                            </motion.div>
                        )}
                        {ack && (
                            <motion.div
                                className="focus-acknowledgment"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                {ack}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {task.metadata?.ifThen && (
                    <div className="focus-prompt">
                        <span className="prompt-label">If–Then:</span>
                        <p className="prompt-text">{task.metadata.ifThen}</p>
                    </div>
                )}

                <div className="substeps-container">
                    <div style={{ marginBottom: '10px', width: '100%' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--focus-color-status)', fontWeight: 800, letterSpacing: '0.1em', textAlign: 'center' }}>
                            Sub-steps
                        </div>
                        <div className="focus-momentum-bar-container">
                            <div
                                className="focus-momentum-bar-fill"
                                style={{ width: `${subSteps.length > 0 ? (subSteps.filter(s => s.isCompleted).length / subSteps.length) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                    <Reorder.Group
                        axis="y"
                        values={subSteps}
                        onReorder={handleReorderSubSteps}
                        className="substeps-list"
                        style={{ display: 'flex', flexDirection: 'column', gap: '6px', listStyle: 'none', padding: 0 }}
                    >
                        {/* 1. History Toggle Label */}
                        {completedSubSteps.length > 3 && (
                            <motion.div 
                                className="history-collapse-label"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.5 }}
                                onClick={() => setShowAllHistory(!showAllHistory)}
                                style={{ 
                                    fontSize: '11px', 
                                    color: '#708090', 
                                    cursor: 'pointer', 
                                    marginBottom: '4px', 
                                    paddingLeft: '32px',
                                    fontStyle: 'italic'
                                }}
                            >
                                {showAllHistory ? "Show less" : `+${completedSubSteps.length - 3} more completed`}
                            </motion.div>
                        )}

                        {/* 2. Ghosted History */}
                        {historyToDisplay.map((s) => (
                            <Reorder.Item
                                layout
                                key={s.id}
                                value={s}
                                className={`substep-row checked`}
                                onDragStart={() => { isDraggingSubStep.current = true; }}
                                onDragEnd={() => {
                                    setTimeout(() => { isDraggingSubStep.current = false; }, 100);
                                }}
                                onClick={() => handleToggleSubStep(s.id)}
                                style={{ opacity: 1 }}
                            >
                                <div className="substep-checkbox checked">
                                    ✓
                                </div>
                                <div className="substep-text" style={{ textDecoration: 'line-through', color: 'var(--focus-color-ghost)' }}>{s.text}</div>
                            </Reorder.Item>
                        ))}

                        {/* 3. Active Step */}
                        {activeSubStep && (
                            <Reorder.Item
                                layout
                                key={activeSubStep.id}
                                value={activeSubStep}
                                className="substep-row active"
                                onDragStart={() => { isDraggingSubStep.current = true; }}
                                onDragEnd={() => {
                                    setTimeout(() => { isDraggingSubStep.current = false; }, 100);
                                }}
                                onClick={() => handleToggleSubStep(activeSubStep.id)}
                                style={{ opacity: 1 }}
                            >
                                <div style={{ position: 'relative' }}>
                                    <motion.div 
                                        className="substep-checkbox"
                                        whileTap={{ scale: 0.9 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    >
                                        ✓
                                    </motion.div>
                                    {/* Sub-step Completion Sequence */}
                                </div>
                                <div className="substep-text" style={{ fontWeight: 600, color: 'var(--focus-color-focus)' }}>{activeSubStep.text}</div>
                            </Reorder.Item>
                        )}

                        {/* 4. Up Next Step */}
                        {upNextSubStep && (
                            <Reorder.Item
                                layout
                                key={upNextSubStep.id}
                                value={upNextSubStep}
                                className="substep-row next"
                                onDragStart={() => { isDraggingSubStep.current = true; }}
                                onDragEnd={() => {
                                    setTimeout(() => { isDraggingSubStep.current = false; }, 100);
                                }}
                                onClick={() => handleToggleSubStep(upNextSubStep.id)}
                                style={{ opacity: 1 }}
                            >
                                <motion.div 
                                    className="substep-checkbox"
                                    whileTap={{ scale: 0.9 }}
                                    style={{ borderColor: 'var(--focus-color-status)' }}
                                >
                                    ✓
                                </motion.div>
                                <div className="substep-text" style={{ color: 'var(--focus-color-status)' }}>{upNextSubStep.text}</div>
                            </Reorder.Item>
                        )}
                    </Reorder.Group>
                    <input
                        className="substep-input"
                        placeholder="Add sub-step..."
                        value={newSubStep}
                        onChange={e => setNewSubStep(e.target.value)}
                        onKeyDown={handleAddSubStep}
                    />
                </div>
                {/* Reward Toast layer */}
                <RewardAnimation ref={rewardRef} />
            </main>


            <footer className="focus-footer" style={{ overflow: 'visible' }}>
                <div
                    ref={toggleContainerRef}
                    className={`focus-toggle-container ${isToggled ? 'completed' : ''} ${!activeSessionId && isPaused && !isToggled ? 'disabled' : ''}`}
                    onMouseDown={handleAction}
                    title={!activeSessionId ? "Start session first" : ""}
                    style={{ position: 'relative', overflow: 'visible' }}
                >
                    {levelUpCelebration && <div className="aura-bloom" />}
                    {levelUpCelebration && (
                        <div className={`aura-level-up-label ${levelUpCelebration.fading ? 'fade-out' : 'fade-in'}`}>
                            Aura Level Up! (Level {levelUpCelebration.level})
                        </div>
                    )}
                    <motion.div 
                        className={`focus-toggle-track ${isToggled ? 'active' : ''}`}
                        animate={{ 
                            backgroundColor: knobSnapped ? 'rgba(16, 185, 129, 0.25)' : 'var(--alpha-med)' 
                        }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                        <div
                            className="focus-toggle-fill"
                            style={{ width: isToggled ? '100%' : '0%' }}
                        />
                        <div className="focus-toggle-label">
                            {isToggled ? "Confirmed" : ""}
                        </div>
                        <motion.div
                            className="focus-toggle-knob"
                            initial={{ x: 0 }}
                            animate={{ 
                                x: knobSnapped ? 36 : 0,
                                opacity: knobSnapped ? [1, 0.7, 1] : 1
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 28,
                                mass: 1,
                                opacity: { duration: 0.2 }
                            }}
                            style={{ zIndex: 2 }}
                        />
                    </motion.div>
                </div>
            </footer>

            {/* MOMENTUM LOOP OVERLAY */}
            <AnimatePresence>
                {showMomentum && (
                    <motion.div 
                        className="focus-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="focus-modal-content momentum-card">
                            <div className="momentum-visual"></div>
                            <h3>Nice. That was a small win.</h3>
                            <p style={{ opacity: 0.8, fontSize: '15px' }}>Ready for another tiny step?</p>
                            
                            {nextSuggestedTask && (
                                <div className="suggested-task-card">
                                    <span className="suggested-label">Suggesting:</span>
                                    <div className="suggested-name">{nextSuggestedTask.name}</div>
                                </div>
                            )}

                            <div className="momentum-actions">
                                <button 
                                    className="modal-submit-btn" 
                                    onClick={() => {
                                        setTask(nextSuggestedTask);
                                        setSubSteps(nextSuggestedTask.metadata?.subSteps || []);
                                        setShowMomentum(false);
                                        setSeconds(0);
                                        setIsPaused(true);
                                        // Restore manual confirmation via setup modal
                                        handleStartSession();
                                    }}
                                >
                                    Start
                                </button>
                                <button 
                                    className="modal-submit-btn secondary"
                                    onClick={() => navigate(previousRoute || '/launchpad')}
                                >
                                    I'm done for now
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODALS */}
            {showSetup && (
                <div className="focus-modal-overlay">
                    <div className="focus-modal-content">
                        <button className="focus-modal-close" onClick={() => setShowSetup(false)}>×</button>
                        <h3>Predicted Pleasure</h3>
                        <div className="focus-modal-group">
                            <div className="focus-scale-picker">
                                {[0, 2, 4, 6, 8, 10].map(val => (
                                    <button
                                        key={val}
                                        className={`scale-btn ${predictedPleasure === val ? 'selected' : ''}`}
                                        onClick={() => setPredictedPleasure(val)}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button className="modal-submit-btn" onClick={() => startBackboneSession(predictedPleasure)}>
                            Begin Focus
                        </button>
                    </div>
                </div>
            )}

            {showSummary && (
                <div className="focus-modal-overlay">
                    <div className="focus-modal-content">

                        <div className="focus-modal-group">
                            <span className="focus-modal-label">Actual Pleasure</span>
                            <div className="focus-scale-picker">
                                {[0, 2, 4, 6, 8, 10].map(val => (
                                    <button
                                        key={val}
                                        className={`scale-btn ${actualPleasure === val ? 'selected' : ''}`}
                                        onClick={() => setActualPleasure(val)}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="focus-modal-group">
                            <span className="focus-modal-label">Mastery / Flow</span>
                            <div className="focus-scale-picker">
                                {[0, 2, 4, 6, 8, 10].map(val => (
                                    <button
                                        key={val}
                                        className={`scale-btn ${mastery === val ? 'selected' : ''}`}
                                        onClick={() => setMastery(val)}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {safeMode ? (
                            /* Safe Mode: offer Continue or Stop Cleanly — no guilt language */
                            <div className="focus-safe-exit-choice">
                                <button className="modal-submit-btn safe-continue-btn" onClick={handleSummarySubmit}>
                                    Continue
                                </button>
                                <button
                                    className="modal-submit-btn safe-stop-btn"
                                    onClick={async () => {
                                        await completeBackboneSession();
                                        await backbone.trackFocusMode(false);
                                        navigate(previousRoute || '/launchpad');
                                    }}
                                >
                                    Stop Cleanly
                                </button>
                            </div>
                        ) : (
                            <button className="modal-submit-btn" onClick={handleSummarySubmit}>
                                {pendingTaskComplete ? "Save & Finish Task" : "Save & Pause Session"}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* PASSION Continue Prompt */}
            {showPassionContinuePrompt && (
                <div className="focus-modal-overlay">
                    <div className="focus-modal-content">
                        <h3>10 Minutes Reached</h3>
                        <p>You&rsquo;ve successfully completed the safe start. Do you want to continue?</p>
                        <div className="focus-modal-actions-passion">
                            <button
                                className="modal-submit-btn"
                                onClick={() => {
                                    setWasContinued(true);
                                    setShowPassionContinuePrompt(false);
                                    setIsPaused(false);
                                }}
                            >
                                Continue Savoring
                            </button>
                            <button
                                className="modal-submit-btn secondary"
                                onClick={handleExit}
                            >
                                Exit Gracefully
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* INTEREST Continue Prompt */}
            {showInterestContinuePrompt && (
                <div className="focus-modal-overlay">
                    <div className="focus-modal-content">
                        <h3>10 Minutes Reached</h3>
                        <p>Continue exploring?</p>
                        <div className="focus-modal-actions-passion">
                            <button
                                className="modal-submit-btn"
                                onClick={() => {
                                    setIsInterestExploring(true);
                                    setShowInterestContinuePrompt(false);
                                    setIsPaused(false);
                                }}
                            >
                                Continue Exploring
                            </button>
                            <button
                                className="modal-submit-btn secondary"
                                onClick={handleExit}
                            >
                                Stop Cleanly
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hyperfocus Guard Modal */}
            {showHyperfocusGuard && (
                <div className="focus-modal-overlay">
                    <div className="focus-modal-content">
                        <h3>Pause & Reset</h3>
                        <p>Check energy. Drink water. Breathe. Continue if intentional.</p>
                        <div className="focus-modal-actions-passion">
                            <button
                                className="modal-submit-btn"
                                onClick={() => {
                                    setShowHyperfocusGuard(false);
                                    setIsPaused(false);
                                }}
                            >
                                Continue
                            </button>
                            <button
                                className="modal-submit-btn secondary"
                                onClick={handleExit}
                            >
                                Take Break
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hyperfocus Warning Notification */}
            <AnimatePresence>
                {hyperfocusWarning && (
                    <motion.div
                        className="hyperfocus-warning-toast"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        onAnimationComplete={() => {
                            setTimeout(() => setHyperfocusWarning(null), 5000);
                        }}
                    >
                        {hyperfocusWarning}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PASSION Identity Savoring Overlay */}
            <AnimatePresence>
                {savoringIdentity && (
                    <motion.div
                        className="identity-savoring-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div 
                            className="savoring-message"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            {savoringIdentity}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Temporary Test Button for Focus Aura Celebration */}
            <button 
                onClick={() => {
                    if (skill) {
                        window.dispatchEvent(new CustomEvent('skill-level-up', { 
                            detail: { skillId: skill.id, newLevel: 'X' } 
                        }));
                    }
                }}
                style={{
                    position: 'fixed',
                    right: '32px',
                    bottom: '80px',
                    background: 'rgba(153, 186, 215, 0.2)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(153, 186, 215, 0.4)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    zIndex: 9999,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                title="Test Focus Level Up"
            >
                ✨
            </button>

            <button 
                className={`focus-save-energy-btn ${task.metadata?.highEnergy ? 'saved' : ''}`}
                onClick={handleSaveForHighEnergy}
                disabled={task.metadata?.highEnergy === true}
            >
                {task.metadata?.highEnergy ? "Saved for later" : "Save for high energy"}
            </button>

        </div>
    );
};

export default FocusPage;
