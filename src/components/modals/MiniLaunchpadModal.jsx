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

    // --- ZUSTAND SELECTORS ---
    const allNodes = useBackboneStore(state => state.nodes);
    const storeLoading = useBackboneStore(state => state.loading);

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
        navigate('/focus', { state: { taskId: task.id, autoStart: true } });
        onClose();
    }, [navigate, onClose]);


    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <div className="mini-launchpad-overlay" onClick={onClose}>
                <motion.div 
                    className={`mini-launchpad-modal glass-panel energy-level-${energyLevel}`}
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
                            {energyLevel !== 3 && activeExp?.metadata?.wish && (
                                <p className="experiment-wish"><span className="label-subtle">Experiment:</span> {activeExp.metadata.wish}</p>
                            )}
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
                            <div className="empty-state">
                                <p>No active tasks found in Today or In-Progress.</p>
                                <p className="hint">Add a task from the Skill Library to get started.</p>
                            </div>
                        )}
                    </div>

                    <footer className="modal-footer">
                        <button 
                            className="view-library-btn"
                            onClick={() => {
                                navigate(`/skill/${skill.id}`);
                                onClose();
                            }}
                        >
                            View Skill Library
                        </button>
                    </footer>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body // Using document.body for top-level overlay
    );
};

export default MiniLaunchpadModal;
