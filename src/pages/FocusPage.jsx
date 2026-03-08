import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { backbone, NodeTypes, TaskStatuses } from '../backbone-v2/index';
import './FocusPage.css';
import GlassPanel from '../components/ui/GlassPanel';

const ACKS = ["Good.", "Nice.", "Done."];

const FocusPage = () => {
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [skill, setSkill] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isGlowing, setIsGlowing] = useState(false);
    const [ack, setAck] = useState(null);
    const [isToggled, setIsToggled] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [isInterestMode, setIsInterestMode] = useState(false);

    // Session State
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [seconds, setSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(true);
    const timerRef = useRef(null);
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
    const [uninterruptedSeconds, setUninterruptedSeconds] = useState(0);
    const [checkpointToast, setCheckpointToast] = useState(null);

    const triggerCheckpoint = useCallback(() => {
        setCheckpointsCompleted(c => {
            const nextC = c + 1;
            if (nextC % 2 === 0) setCheckpointToast("Nice work — momentum rising 🚀");
            else setCheckpointToast("Checkpoint reached ⚡ Momentum building");
            setTimeout(() => setCheckpointToast(null), 3000);
            return nextC;
        });
    }, []);

    const handleToggleSubStep = async (index) => {
        const updated = [...subSteps];
        const current = updated[index];
        const isNowCompleted = !current.isCompleted;
        updated[index] = { ...current, isCompleted: isNowCompleted };
        setSubSteps(updated);

        await backbone.updateNode(task.id, {
            metadata: { ...task.metadata, subSteps: updated }
        });

        if (isNowCompleted) triggerCheckpoint();
    };

    const handleAddSubStep = async (e) => {
        if (e.key === 'Enter' && newSubStep.trim()) {
            const updated = [...subSteps, { id: Date.now().toString(), text: newSubStep.trim(), isCompleted: false }];
            setSubSteps(updated);
            setNewSubStep('');
            await backbone.updateNode(task.id, {
                metadata: { ...task.metadata, subSteps: updated }
            });
        }
    };

    const loadNextTask = useCallback(async () => {
        setLoading(true);
        setIsToggled(false);
        setIsToggling(false);
        setActiveSessionId(null);
        setSeconds(0);
        setIsPaused(true);
        try {
            const nextTask = await backbone.getTodayFocusTask();
            if (nextTask) {
                setTask(nextTask);
                // Find parent skill
                const allNodes = await backbone.getAllNodes();
                let parent = allNodes.find(n => n.id === nextTask.parentId);
                while (parent && parent.type !== NodeTypes.SKILL) {
                    parent = allNodes.find(n => n.id === parent.parentId);
                }
                setSkill(parent);

                // Detect burnout safe mode from ancestor objective
                let objNode = allNodes.find(n => n.id === nextTask.parentId);
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
    }, []);

    useEffect(() => {
        loadNextTask();
    }, [loadNextTask]);

    // Timer Interval
    useEffect(() => {
        if (!isPaused && activeSessionId) {
            timerRef.current = setInterval(() => {
                setSeconds(prev => {
                    const next = prev + 1;

                    // PASSION/INTEREST Safe Start
                    if ((isPassionSafeSession || (isInterestMode && !isInterestExploring)) && !wasContinued && next >= TARGET_SECONDS) {
                        setIsPaused(true);
                        if (isInterestMode) setShowInterestContinuePrompt(true);
                        else setShowPassionContinuePrompt(true);
                        clearInterval(timerRef.current);
                        return TARGET_SECONDS;
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
                    if (isInterestMode && next > 0) {
                        const secondsRemaining = 5400 - next;
                        if (secondsRemaining === 600) setHyperfocusWarning("10 minutes remaining");
                        else if (secondsRemaining === 300) setHyperfocusWarning("5 minutes remaining");
                        else if (secondsRemaining === 60) setHyperfocusWarning("1 minute remaining");
                        else if (secondsRemaining === 0) {
                            setIsPaused(true);
                            setShowHyperfocusGuard(true);
                            clearInterval(timerRef.current);
                        }
                    }

                    return next;
                });
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isPaused, activeSessionId]);

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const handleStartSession = async () => {
        if (activeSessionId) {
            setIsPaused(false);
            return;
        }

        // Logic check: Is it the first ever session?
        const sessions = task.metadata?.sessions || [];
        const firstSession = sessions.length === 0;

        if (firstSession) {
            setShowSetup(true);
        } else {
            // Start immediately if not first session
            await startBackboneSession(5); // Default pleasure for subsequent sessions
        }
    };

    const startBackboneSession = async (pleasureValue) => {
        try {
            const sess = await backbone.startSession(task.id, 10, pleasureValue, 0);
            setActiveSessionId(sess.id);
            setIsPaused(false);
            setShowSetup(false);
        } catch (error) {
            console.error("Failed to start session:", error);
        }
    };

    const handlePauseSession = () => {
        if (!activeSessionId) return;
        setIsPaused(true);
        setUninterruptedSeconds(0);
        setShowSummary(true);
    };

    const completeBackboneSession = async () => {
        try {
            await backbone.completeSession(task.id, activeSessionId, actualPleasure, mastery);
            setActiveSessionId(null);
            setSeconds(0);
            setShowSummary(false);

            // Subtle reinforcement
            setIsGlowing(true);
            setTimeout(() => setIsGlowing(false), 300);

            if (isNavigatingAway) {
                await backbone.trackFocusMode(false);
                navigate('/launchpad');
            }
        } catch (error) {
            console.error("Failed to complete session:", error);
        }
    };

    const handleAction = async () => {
        if (!task || isToggling) return;

        // If session is active, we must pause/complete it first
        if (activeSessionId) {
            setIsPaused(true);
            // We set a flag or just show the summary. 
            // The completion logic will proceed after summary is submitted.
            // But for "Mechanical Closure", maybe we complete the task first then ask for summary?
            // User requested: "If session active: Trigger Pause logic first. After session closed: Mark task complete."

            // To handle this sequence, we can set a 'pendingTaskComplete' flag.
            setPendingTaskComplete(true);
            setShowSummary(true);
            return;
        }

        proceedWithTaskCompletion();
    };

    const [pendingTaskComplete, setPendingTaskComplete] = useState(false);

    const proceedWithTaskCompletion = async () => {
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
                try {
                    if (task.metadata?.itemType === 'REPETITION') {
                        await backbone.incrementTaskRepetition(task.id);
                    } else {
                        await backbone.updateNode(task.id, {
                            metadata: {
                                ...task.metadata,
                                status: TaskStatuses.DONE,
                                completedAt: Date.now()
                            }
                        });
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
                            }, 3000);
                        } else {
                            loadNextTask();
                            setPendingTaskComplete(false);
                        }
                    }, 400);
                } catch (error) {
                    console.error("Focus mode action failed:", error);
                    setIsToggling(false);
                    setIsToggled(false);
                    setPendingTaskComplete(false);
                }
            }, 600);
        }, 100);
    };

    const handleSummarySubmit = async () => {
        await completeBackboneSession();
        if (pendingTaskComplete) {
            proceedWithTaskCompletion();
        }
    };

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
        navigate('/launchpad');
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
                {isNoveltySprint && <span className="focus-novelty-session-label">⚡ Experiment Session</span>}
                {skill && <span className="focus-skill-label">{skill.name}</span>}
            </header>

            <main className="focus-content">
                {/* Safe Mode / Interest Mode on-ramp framing */}
                {(safeMode || (isInterestMode && !isInterestExploring)) && !activeSessionId && isPaused && (
                    <div className="focus-safe-onramp">
                        {isInterestMode ? "Just 10 minutes of exploration." : "Let\u2019s just do 10 minutes."}
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
                                {Math.ceil((TARGET_SECONDS - seconds) / 60)}m
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

                <GlassPanel className={`focus-action-card ${isGlowing ? 'glow' : ''}`}>
                    <h1 className="focus-task-name">{task.name}</h1>

                    {checkpointsCompleted > 0 && (
                        <div className="focus-momentum-bar-container">
                            <div
                                className="focus-momentum-bar-fill"
                                style={{ width: `${Math.min(checkpointsCompleted * 33.33, 100)}%` }}
                            />
                        </div>
                    )}

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
                </GlassPanel>

                {task.metadata?.ifThen && (
                    <div className="focus-prompt">
                        <span className="prompt-label">If–Then:</span>
                        <p className="prompt-text">{task.metadata.ifThen}</p>
                    </div>
                )}

                <div className="substeps-container">
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 800, marginBottom: '8px', letterSpacing: '0.05em' }}>
                        Sub-steps
                    </div>
                    {subSteps.map((s, idx) => (
                        <div key={s.id} className={`substep-row ${s.isCompleted ? 'checked' : ''}`} onClick={() => handleToggleSubStep(idx)}>
                            <div className={`substep-checkbox ${s.isCompleted ? 'checked' : ''}`}>
                                ✓
                            </div>
                            <div className="substep-text">{s.text}</div>
                        </div>
                    ))}
                    <input
                        className="substep-input"
                        placeholder="Add sub-step..."
                        value={newSubStep}
                        onChange={e => setNewSubStep(e.target.value)}
                        onKeyDown={handleAddSubStep}
                    />
                </div>
            </main>

            <footer className="focus-footer">
                <div
                    className={`focus-toggle-container ${isToggled ? 'completed' : ''} ${!activeSessionId && isPaused && !isToggled ? 'disabled' : ''}`}
                    onClick={handleAction}
                    title={!activeSessionId ? "Start session first" : ""}
                >
                    <div className={`focus-toggle-track ${isToggled ? 'active' : ''}`}>
                        <div
                            className="focus-toggle-fill"
                            style={{ width: isToggled ? '100%' : '0%' }}
                        />
                        <div className="focus-toggle-label">
                            {isToggled ? "Confirmed" : ""}
                        </div>
                        <motion.div
                            className="focus-toggle-knob"
                            animate={{ x: isToggled ? 72 : 0 }}
                            transition={{
                                type: "tween",
                                ease: [0.4, 0, 0.2, 1], // Grounded, solid ease
                                duration: 0.4
                            }}
                        />
                    </div>
                </div>
            </footer>

            {/* MODALS */}
            {showSetup && (
                <div className="focus-modal-overlay">
                    <div className="focus-modal-content">
                        <h3>Session Intent</h3>
                        <div className="focus-modal-group">
                            <span className="focus-modal-label">Predicted Pleasure</span>
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
                        <h3>Session Closure</h3>
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
                                        navigate('/launchpad');
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
                        ⚠️ {hyperfocusWarning}
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
                            className="identity-savoring-card"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                        >
                            <p className="identity-savoring-text">{savoringIdentity}</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FocusPage;
