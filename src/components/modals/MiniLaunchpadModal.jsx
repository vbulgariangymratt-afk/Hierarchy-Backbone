import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { backbone, NodeTypes, TaskStatuses } from '../../backbone-v2/index';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useBackboneStore } from '../../store/backboneStore';
import { useShallow } from 'zustand/react/shallow';
import { scoreLowEnergyTask, getAspectStats } from '../../utils/taskScoring';
import MiniLaunchpadTaskButton from './MiniLaunchpadTaskButton';
import './MiniLaunchpadModal.css';


const MiniLaunchpadModal = ({ isOpen, onClose, skill }) => {
    const navigate = useNavigate();
    const { energyLevel } = useSettings();
    const [showGuidance, setShowGuidance] = useState(false);
    const [quickTaskName, setQuickTaskName] = useState("");
    const [creatingTask, setCreatingTask] = useState(false);

    // --- ZUSTAND SELECTORS ---
    const allNodes = useBackboneStore(state => state.nodes);
    const storeLoading = useBackboneStore(state => state.loading);

    const handleCreateAndStartTask = async () => {
        if (!quickTaskName.trim() || !skill) return;
        setCreatingTask(true);

        try {
            // 1. Find or create an active Objective (Experiment) under this skill
            let objective = allNodes.find(n => 
                n.type === NodeTypes.OBJECTIVE && 
                n.parentId === skill.id && 
                n.metadata?.isActive
            );

            if (!objective) {
                objective = await backbone.addNode({
                    name: "How much of this can I achieve in 7 days?",
                    type: NodeTypes.OBJECTIVE,
                    parentId: skill.id,
                    metadata: {
                        isActive: true,
                        status: "ACTIVE",
                        durationInDays: 7,
                        createdAt: Date.now()
                    }
                });
            }

            // 2. Find or create Aspect under the Objective
            let aspect = allNodes.find(n => 
                n.type === NodeTypes.ASPECT && 
                n.parentId === objective.id
            );

            if (!aspect) {
                aspect = await backbone.addNode({
                    name: "General",
                    type: NodeTypes.ASPECT,
                    parentId: objective.id,
                    metadata: {
                        status: "ACTIVE"
                    }
                });
            }

            // 3. Create Task under Aspect
            const newTask = await backbone.addNode({
                name: quickTaskName.trim(),
                type: NodeTypes.TASK,
                parentId: aspect.id,
                metadata: {
                    status: TaskStatuses.IN_PROGRESS,
                    isToday: true,
                    itemType: 'REPETITION',
                    type: 'REPETITION',
                    unitName: 'times',
                    targetUnits: 0,
                    currentUnits: 0,
                    createdAt: Date.now()
                }
            });

            setQuickTaskName("");
            
            // 4. Navigate to focus mode with the new task id AND autoStart flag
            navigate('/focus', { state: { taskId: newTask.id, autoStart: true, returnRoute: `/skill/${skill.id}` } });
            onClose();
        } catch (err) {
            console.error("Failed to create quick task:", err);
        } finally {
            setCreatingTask(false);
        }
    };

    // Guidance text based on PINCH
    const guidanceText = useMemo(() => {
        if (!skill) return "";
        const pinch = skill.metadata?.pinchState;
        if (!pinch || pinch === 'NONE') return "Trust the system. Pick a task.";
        if (pinch === 'NOVELTY') return "Your brain is bored. Try a task you haven't touched in a while.";
        if (pinch === 'CHALLENGE') return "You've mastered these steps. Time for a deeper challenge.";
        if (pinch === 'PASSION') return "This matters to you. Take a small, meaningful step.";
        if (pinch === 'INTEREST') return "Exploration fuels growth. Just 10 minutes.";
        if (pinch === 'HURRY') return "Initiation is hard. Break the seal on any small task.";
        return "Focus follows intention.";
    }, [skill]);

    // 1. Identify the Active Experiment for this skill
    const activeExp = useMemo(() => {
        if (!isOpen || !skill || !allNodes.length) return null;
        return allNodes.find(n => 
            n.type === NodeTypes.OBJECTIVE && 
            n.parentId === skill.id && 
            n.metadata?.isActive
        );
    }, [isOpen, skill, allNodes]);

    // 2. Filter and Sort Tasks based on Power/Energy logic
    const tasks = useMemo(() => {
        if (!isOpen || !skill || !allNodes.length) return [];

        // Find descendants
        const objectives = allNodes.filter(n => n.type === NodeTypes.OBJECTIVE && n.parentId === skill.id);
        const objectiveIds = new Set(objectives.map(o => o.id));
        const aspects = allNodes.filter(n => n.type === NodeTypes.ASPECT && objectiveIds.has(n.parentId));
        const aspectIds = new Set(aspects.map(a => a.id));
        
        const allSkillTasks = allNodes.filter(n => 
            n.type === NodeTypes.TASK && 
            aspectIds.has(n.parentId) && 
            n.metadata?.status !== TaskStatuses.DONE
        );

        let filtered = [];
        if (energyLevel <= 2) {
            // Energy 1-2: Only show MVE (easiest) tasks
            const aspectStats = getAspectStats(allNodes);
            filtered = [...allSkillTasks].sort((a, b) => 
                scoreLowEnergyTask(b, aspectStats) - scoreLowEnergyTask(a, aspectStats)
            );
        } else {
            // Energy 3+: Normal logic + PINCH integration
            const pinch = skill.metadata?.pinchState;
            if (energyLevel >= 4) {
                if (pinch === 'NOVELTY') {
                    filtered = [...allSkillTasks].sort((a, b) => 
                        (a.metadata?.sessions?.length || 0) - (b.metadata?.sessions?.length || 0)
                    );
                } else if (pinch === 'CHALLENGE') {
                    const aspectStats = getAspectStats(allNodes);
                    filtered = [...allSkillTasks].sort((a, b) => 
                        scoreLowEnergyTask(a, aspectStats) - scoreLowEnergyTask(b, aspectStats)
                    );
                } else {
                    filtered = allSkillTasks;
                }
            } else {
                filtered = allSkillTasks;
            }
        }

        // Apply standard prioritization for the top 3
        const todayTasks = filtered.filter(n => n.metadata?.isToday === true);
        const inProgressTasks = filtered.filter(n => n.metadata?.status === TaskStatuses.IN_PROGRESS && !n.metadata?.isToday);
        const fallbackTasks = filtered.filter(n => !n.metadata?.isToday && n.metadata?.status !== TaskStatuses.IN_PROGRESS);

        return [...todayTasks, ...inProgressTasks, ...fallbackTasks].slice(0, 3);
    }, [isOpen, skill, allNodes, energyLevel]);

    const handleTaskClick = useCallback((task) => {
        // Navigate to focus mode with the task id AND autoStart flag
        // This triggers the existing Pleasure Prediction system in FocusPage
        navigate('/focus', { state: { taskId: task.id, autoStart: true, returnRoute: `/skill/${skill.id}` } });
        onClose();
    }, [navigate, onClose]);


    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <div className="mini-launchpad-overlay" onClick={onClose}>
                <motion.div 
                    className="mini-launchpad-modal glass-panel"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <header className="modal-header">
                        <div className="title-group">
                            <h2>{skill?.name}</h2>
                            {skill?.metadata?.identityAnchor && (
                                <p className="becoming-statement"><span className="label-subtle">Becoming:</span> {skill.metadata.identityAnchor}</p>
                            )}
                            {energyLevel >= 3 && activeExp?.metadata?.wish && (
                                <p className="experiment-wish"><span className="label-subtle">Experiment:</span> {activeExp.metadata.wish}</p>
                            )}
                        </div>
                        <div className="modal-actions-header">
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>
                    </header>

                    {showGuidance && (
                        <motion.div 
                            className="guidance-overlay"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <p>{guidanceText}</p>
                        </motion.div>
                    )}


                    <div className="modal-content">
                        {storeLoading ? (
                            <div className="loading-state">Syncing focus data...</div>
                        ) : tasks.length > 0 ? (
                            <div className="task-list">
                                {tasks.map(task => (
                                    <MiniLaunchpadTaskButton 
                                        key={task.id} 
                                        task={task}
                                        onClick={handleTaskClick}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="launchpad-setup-flow" style={{ padding: 0, fontFamily: "'Lexend', sans-serif" }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', margin: '8px 0 24px 0' }}>
                                    <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.6', fontFamily: "'Lexend', sans-serif", textAlign: 'left' }}>
                                        Here you'd see 3 of your most active activities to take action.
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontWeight: 450, fontFamily: "'Lexend', sans-serif", textAlign: 'left', lineHeight: '1.4' }}>
                                            What is a repeatable action you enjoy for {skill?.name}?
                                        </h4>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                            <input
                                                type="text"
                                                value={quickTaskName}
                                                onChange={(e) => setQuickTaskName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && quickTaskName.trim()) {
                                                        handleCreateAndStartTask();
                                                    }
                                                }}
                                                placeholder="e.g. Listen to a song, watch a 5-min video..."
                                                style={{
                                                    flex: 1,
                                                    padding: '12px 16px',
                                                    borderRadius: '6px',
                                                    background: 'var(--alpha-low)',
                                                    border: '1px solid var(--color-border)',
                                                    color: 'var(--text-primary)',
                                                    fontFamily: "'Lexend', sans-serif",
                                                    fontSize: '16px'
                                                }}
                                            />
                                            <button
                                                onClick={handleCreateAndStartTask}
                                                disabled={!quickTaskName.trim() || creatingTask}
                                                style={{
                                                    padding: '0 20px',
                                                    borderRadius: '6px',
                                                    background: 'var(--color-accent, #7c3aed)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontFamily: "'Lexend', sans-serif",
                                                    fontSize: '16px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    opacity: quickTaskName.trim() ? 1 : 0.5
                                                }}
                                            >
                                                {creatingTask ? 'Creating...' : 'Create'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <footer className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', position: 'relative' }}>
                        <button 
                            className="view-library-btn"
                            onClick={() => {
                                navigate(`/skill/${skill.id}`);
                                onClose();
                            }}
                        >
                            View Skill Page
                        </button>
                        {tasks.length === 0 && (
                            <div className="tooltip-container">
                                <span 
                                    className="help-icon"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '4px',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'help',
                                        fontFamily: "'Lexend', sans-serif"
                                    }}
                                >
                                    ?
                                </span>
                                <div 
                                    className="tooltip-text"
                                    style={{
                                        visibility: 'hidden',
                                        width: '240px',
                                        backgroundColor: 'var(--color-bg-card, #1c1c1c)',
                                        border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
                                        color: 'var(--text-secondary)',
                                        textAlign: 'left',
                                        borderRadius: '6px',
                                        padding: '12px',
                                        position: 'absolute',
                                        bottom: '125%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        boxShadow: 'var(--shadow-lg)',
                                        opacity: 0,
                                        transition: 'opacity 0.2s, visibility 0.2s',
                                        zIndex: 1000,
                                        fontSize: '13px',
                                        lineHeight: '1.5',
                                        fontFamily: "'Lexend', sans-serif"
                                    }}
                                >
                                    <strong>Skill page</strong> is where you <strong>PLAN</strong> all your stuff related to this skill.
                                </div>
                            </div>
                        )}
                    </footer>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body // Using document.body for top-level overlay
    );
};

export default MiniLaunchpadModal;
