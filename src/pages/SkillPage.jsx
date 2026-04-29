import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    backbone,
    habitService,
    NodeTypes,
    ObjectiveStatuses,
    TaskStatuses
} from '../backbone-v2/index';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import './SkillPage.css';

import NodeIcon from '../components/NodeIcon';
import HabitCard from '../components/HabitCard';
import EvolutionDrillIn from '../components/EvolutionDrillIn';
import useSkillPageData from '../hooks/useSkillPageData';
import useObjectiveHandlers from '../hooks/useObjectiveHandlers';
import useTaskHandlers from '../hooks/useTaskHandlers';
import SkillSurvivalView from '../components/SkillSurvivalView';
import ObjectiveCreationForm from '../components/ObjectiveCreationForm';
import ObjectiveCard from '../components/ObjectiveCard';

const macOSSpring = {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.8
};

const SkillPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { showCompletedTasks } = useTheme();
    const { energyLevel, activeExperimentLimit } = useSettings();

    // Drag Reorder Lock
    const isReorderingRef = useRef(false);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    // Data Hook
    const { 
        skill, 
        allNodes, 
        loading, 
        skillHabits, 
        setAllNodes, 
        fetchData, 
        fetchSkills 
    } = useSkillPageData(id, isReorderingRef);

    // UI State for expansion & becoming section
    const [expandedAspectIds, setExpandedAspectIds] = useState([]);
    const [aspectShowMoreIds, setAspectShowMoreIds] = useState([]);
    const [tempBecoming, setTempBecoming] = useState('');
    const [isSyncingBecoming, setIsSyncingBecoming] = useState(false);
    const [collapsedCompletedAspects, setCollapsedCompletedAspects] = useState({});
    const [activeHabitForEvolution, setActiveHabitForEvolution] = useState(null);
    const [isHabitsExpanded, setIsHabitsExpanded] = useState(energyLevel !== 4);

    // Create Habit State
    const [isCreatingHabit, setIsCreatingHabit] = useState(false);
    const [newHabitTrigger, setNewHabitTrigger] = useState('');
    const [newHabitAction, setNewHabitAction] = useState('');
    const [newHabitPeriod, setNewHabitPeriod] = useState('day');
    const [newHabitCount, setNewHabitCount] = useState(1);

    // Inline rename state
    const [inlineEditingNodeId, setInlineEditingNodeId] = useState(null);
    const [inlineDraftName, setInlineDraftName] = useState('');
    const inlineInputRef = useRef(null);

    const [challengeDismissed, setChallengeDismissed] = useState(false);
    const [activeChallengeHighlight, setActiveChallengeHighlight] = useState(null);

    // Performance Optimized Data Access
    const nodesByParent = useMemo(() => {
        const map = new Map();
        for (const node of allNodes || []) {
            if (!node) continue;
            const parent = node.parentId || "root";
            if (!map.has(parent)) map.set(parent, []);
            map.get(parent).push(node);
        }
        return map;
    }, [allNodes]);

    const objectives = useMemo(() => 
        (allNodes || []).filter(n => n.type === NodeTypes.OBJECTIVE && n.parentId === id),
    [allNodes, id]);

    // Objective Handlers Hook
    const objectiveHandlers = useObjectiveHandlers({
        id,
        objectives,
        allNodes,
        fetchData,
        activeExperimentLimit
    });

    const {
        expandedObjectiveIds, setExpandedObjectiveIds,
        isCreatingObjective, setIsCreatingObjective,
        handleStatusUpdate,
        handleStartEditObjective,
        handleSaveObjectiveEdit,
        handleDeleteObjective,
        confirmDeleteObjective,
        handleUpdateObjectiveName,
        toggleObjective,
    } = objectiveHandlers;

    const habits = useMemo(() => skillHabits, [skillHabits]);

    const getChildren = useCallback((parentId, type) => {
        const children = nodesByParent.get(parentId || "root") || [];
        if (!type) return children;
        return children.filter(n => {
            if (type === NodeTypes.ASPECT) return n.type === 'ASPECT' || n.type === 'STAGE';
            return n.type === type;
        });
    }, [nodesByParent]);

    // Derived State
    const activeObjectives = useMemo(() => {
        return objectives.filter(o => {
            return !o.metadata?.isArchived && !o.metadata?.isSleeping && o.metadata?.status !== 'COMPLETED' && o.metadata?.status !== 'ACHIEVED';
        }).sort((a, b) => {
            const aPaused = a.metadata?.status === 'ROTATING';
            const bPaused = b.metadata?.status === 'ROTATING';
            if (aPaused && !bPaused) return 1;
            if (!aPaused && bPaused) return -1;
            return 0;
        });
    }, [objectives]);

    const sleepingObjectives = useMemo(() => 
        objectives.filter(o => o.metadata?.status === ObjectiveStatuses.SLEEPING || o.metadata?.isSleeping === true), 
    [objectives]);

    const isNoveltySprint = skill?.metadata?.pinchState === 'NOVELTY';
    const unexploredAspectIds = useMemo(() => {
        if (!isNoveltySprint || !skill?.id) return [];
        const aspects = getChildren(id, NodeTypes.ASPECT);
        const unexplored = aspects.filter(a => {
            const aspectTasks = getChildren(a.id, NodeTypes.TASK);
            return aspectTasks.length > 0 && !aspectTasks.some(t => t.metadata?.status === TaskStatuses.DONE);
        });
        return unexplored.slice(0, 2).map(a => a.id);
    }, [isNoveltySprint, skill?.id, id, getChildren]);

    const challengeInfo = useMemo(() => {
        const isChallengeState = skill?.metadata?.pinchState === 'CHALLENGE';
        let masteryCheckTaskId = null, newAngleTaskId = null, showChallengeCard = false;

        if (isChallengeState && !challengeDismissed) {
            const activeObj = (objectives || []).find(o => !o.metadata?.isSleeping);
            if (activeObj) {
                const aspects = getChildren(activeObj.id, NodeTypes.ASPECT);
                let bestProgress = -1, worstProgress = 2;

                aspects.forEach(a => {
                    const aTasks = getChildren(a.id, NodeTypes.TASK);
                    const incomplete = aTasks.sort((t1, t2) => (t1.metadata?.orderIndex || 0) - (t2.metadata?.orderIndex || 0))
                        .filter(t => t.metadata?.status !== TaskStatuses.DONE);

                    if (incomplete.length > 0) {
                        const progress = (aTasks.length - incomplete.length) / aTasks.length;
                        if (progress >= bestProgress) { bestProgress = progress; masteryCheckTaskId = incomplete[0].id; }
                        if (progress < worstProgress) { worstProgress = progress; newAngleTaskId = incomplete[0].id; }
                    }
                });
                if (masteryCheckTaskId === newAngleTaskId) newAngleTaskId = null;
                if (masteryCheckTaskId) showChallengeCard = true;
            }
        }
        return { masteryCheckTaskId, newAngleTaskId, showChallengeCard };
    }, [skill, challengeDismissed, objectives, getChildren]);

    const { masteryCheckTaskId, newAngleTaskId, showChallengeCard } = challengeInfo;

    const getObjectiveTimeInfo = useCallback((obj) => {
        const tasks = (allNodes || []).filter(n => n.type === NodeTypes.TASK); // Simplified for extraction
        const aspects = getChildren(obj.id, NodeTypes.ASPECT);
        const m = obj.metadata || {};
        const todayStr = new Date().toLocaleDateString('en-CA');
        const activityDates = new Set();

        tasks.forEach(t => {
            if (t.metadata?.completedAt) activityDates.add(new Date(t.metadata.completedAt).toLocaleDateString('en-CA'));
            (t.metadata?.sessions || []).forEach(s => s.endTime && activityDates.add(new Date(s.endTime).toLocaleDateString('en-CA')));
        });
        if (m.mveCompletedAt) activityDates.add(new Date(m.mveCompletedAt).toLocaleDateString('en-CA'));
        aspects.forEach(a => (a.metadata?.logs || []).forEach(l => l.timestamp && activityDates.add(new Date(l.timestamp).toLocaleDateString('en-CA'))));

        const activeDaysBeforeToday = Array.from(activityDates).filter(d => d !== todayStr);
        const displayDays = activeDaysBeforeToday.length + 1;
        return { days: displayDays };
    }, [allNodes, getChildren]);

    const expiringObjective = useMemo(() => {
        return (activeObjectives || []).find(obj => {
            if (!obj.metadata?.durationInDays) return false;
            const timeInfo = getObjectiveTimeInfo(obj);
            return timeInfo && timeInfo.days >= obj.metadata.durationInDays;
        });
    }, [activeObjectives, getObjectiveTimeInfo]);

    const handleLogPulse = useCallback(async (obj) => {
        try {
            await backbone.awardHryvnia(1, "MVE Pulse");
            await backbone.incrementDailyCompletionCount();
            await backbone.updateNode(obj.id, { metadata: { ...obj.metadata, mveCompletedAt: Date.now() } });
            fetchData();
        } catch (error) { console.error("Failed to log MVE pulse:", error); }
    }, [fetchData]);

    const taskHandlers = useTaskHandlers({
        id, allNodes, setAllNodes, fetchData, getChildren, energyLevel, handleLogPulse
    });

    const { 
        handleTaskDragStart, handleDragOver, handleDragEnd, dragActiveId, 
        isSleepingExpanded, setIsSleepingExpanded, expandedTaskIds, setExpandedTaskIds
    } = taskHandlers;

    // Inline Renaming Handlers
    const handleStartInlineEdit = useCallback((nodeId, name) => {
        setInlineEditingNodeId(nodeId);
        setInlineDraftName(name);
    }, []);

    const handleSaveInlineEdit = useCallback(async (nodeId) => {
        if (!inlineDraftName.trim()) { setInlineEditingNodeId(null); return; }
        try {
            await backbone.updateNode(nodeId, { name: inlineDraftName.trim() });
            setInlineEditingNodeId(null);
            fetchData();
        } catch (error) { console.error("Failed to save inline edit:", error); }
    }, [inlineDraftName, fetchData]);

    const handleInlineKeyDown = useCallback((e, nodeId) => {
        if (e.key === 'Enter') handleSaveInlineEdit(nodeId);
        if (e.key === 'Escape') setInlineEditingNodeId(null);
    }, [handleSaveInlineEdit]);

    const handleHabitComplete = useCallback(async (habitId) => {
        try { await habitService.logCompletion(habitId); fetchData(); } 
        catch (err) { console.error("Failed to log habit completion:", err); }
    }, [fetchData]);

    const handleChallengeAction = useCallback((type) => {
        if (type === 'MASTERY' && masteryCheckTaskId) {
            setActiveChallengeHighlight({ taskId: masteryCheckTaskId, type });
            const pId = allNodes.find(n => n.id === masteryCheckTaskId)?.parentId;
            if (pId) {
                setExpandedAspectIds(prev => prev.includes(pId) ? prev : [...prev, pId]);
                setTimeout(() => document.getElementById(`task-${masteryCheckTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
        } else if (type === 'NEW_ANGLE' && newAngleTaskId) {
            setActiveChallengeHighlight({ taskId: newAngleTaskId, type });
            const pId = allNodes.find(n => n.id === newAngleTaskId)?.parentId;
            if (pId) {
                setExpandedAspectIds(prev => prev.includes(pId) ? prev : [...prev, pId]);
                setTimeout(() => document.getElementById(`task-${newAngleTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
        } else if (type === 'DISMISS') { setChallengeDismissed(true); setActiveChallengeHighlight(null); }
    }, [masteryCheckTaskId, newAngleTaskId, allNodes]);

    const toggleAspect = useCallback((aspectId) => setExpandedAspectIds(prev => prev.includes(aspectId) ? prev.filter(id => id !== aspectId) : [...prev, aspectId]), []);
    const toggleTask = useCallback((taskId) => setExpandedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]), [setExpandedTaskIds]);

    const debouncedUpdateBecoming = useMemo(() => {
        let timeout;
        return (val) => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                if (!skill?.id) return;
                setIsSyncingBecoming(true);
                try { await backbone.updateNode(skill.id, { metadata: { identityAnchor: val } }); } 
                finally { setIsSyncingBecoming(false); }
            }, 800); 
        };
    }, [skill?.id]);

    useEffect(() => {
        if (skill?.metadata?.identityAnchor !== undefined) setTempBecoming(skill.metadata.identityAnchor || '');
    }, [skill?.id, skill?.metadata?.identityAnchor]);

    useEffect(() => {
        window.unexploredAspectIds = unexploredAspectIds;
    }, [unexploredAspectIds]);

    // Auto-expand active experiments
    useEffect(() => {
        if (!loading && energyLevel >= 3 && activeObjectives.length > 0) {
            setExpandedObjectiveIds(prev => {
                const activeIds = activeObjectives.filter(o => o.metadata?.status === 'ACTIVE').map(o => o.id);
                const missingIds = activeIds.filter(id => !prev.includes(id));
                return missingIds.length === 0 ? prev : [...prev, ...missingIds];
            });
        }
    }, [loading, energyLevel, skill?.id, activeObjectives]);

    if (loading) return <div className="skill-page-loading">Loading Hierarchy...</div>;
    if (!skill) return <div className="skill-page-error">Skill not found.</div>;

    if (energyLevel <= 2) {
        return (
            <SkillSurvivalView 
                skill={skill} energyLevel={energyLevel} allNodes={allNodes}
                habits={habits} navigate={navigate} handleHabitComplete={handleHabitComplete} getChildren={getChildren}
            />
        );
    }

    const PinchAnalysis = ({ skill, energyLevel }) => {
        if (energyLevel < 4) return null;
        const pinch = skill.metadata?.pinchState;
        if (!pinch || pinch === 'NONE') return null;
        const driverName = { 'NOVELTY': 'Novelty', 'CHALLENGE': 'Challenge', 'PASSION': 'Passion', 'INTEREST': 'Flow', 'HURRY': 'Hurry' }[pinch] || pinch;

        return (
            <div className="pinch-analysis-station">
                <div className="pinch-status-header">
                    <p>• Your brain needs to feel "{driverName}" right now to reach peak performance.</p>
                </div>
                <div className="pinch-body">
                    <p className="pinch-explanation">
                        • {pinch === 'NOVELTY' && "Attention is decaying. The current experiment structure has become predictable."}
                        {pinch === 'CHALLENGE' && "Mastery has plateaued. Increase the difficulty."}
                        {pinch === 'PASSION' && "High value, high resistance. Break the next task into a 2-minute MVE."}
                        {pinch === 'INTEREST' && "Low intrinsic fuel. Look for an unorthodox angle."}
                        {pinch === 'HURRY' && "Roadmap ready, 5-min kickoff to break the seal?"}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div id="skill-page-wrapper" className={`skill-page energy-level-${energyLevel}`}>
            <button className="back-button" onClick={() => navigate(-1)}><span>&larr;</span> Back to Area</button>

            <header className="skill-header">
                <div className="skill-header-main-row">
                    {inlineEditingNodeId === skill.id ? (
                        <input
                            ref={inlineInputRef} autoFocus value={inlineDraftName}
                            onChange={e => setInlineDraftName(e.target.value)}
                            onBlur={() => handleSaveInlineEdit(skill.id)}
                            onKeyDown={e => handleInlineKeyDown(e, skill.id)}
                            className="inline-skill-title-input"
                        />
                    ) : (
                        <h1 className="skill-title" onDoubleClick={() => handleStartInlineEdit(skill.id, skill.name)}>{skill.name}</h1>
                    )}
                    {skill.metadata?.pinchState === 'PASSION' && <span className="passion-core-badge">CORE</span>}
                </div>
                <div className="skill-identity-row">
                    <span className="identity-prefix">Becoming:</span>
                    <input
                        className="skill-identity-input" placeholder="Define who you are becoming..."
                        value={tempBecoming} onChange={(e) => { setTempBecoming(e.target.value); debouncedUpdateBecoming(e.target.value); }}
                    />
                    {isSyncingBecoming && <span className="sync-indicator">Saving...</span>}
                </div>
                <PinchAnalysis skill={skill} energyLevel={energyLevel} />
            </header>

            <section className="skill-section habits-skill-wrapper">
                <header className="section-header-row" onClick={() => energyLevel === 4 && setIsHabitsExpanded(!isHabitsExpanded)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: energyLevel === 4 ? 'pointer' : 'default' }}>
                        {energyLevel === 4 && (
                            <motion.span 
                                animate={{ rotate: isHabitsExpanded ? 90 : 0 }}
                                style={{ display: 'inline-block', fontSize: '10px', opacity: 0.8 }}
                            >
                                ▶
                            </motion.span>
                        )}
                        <span className="section-label">Habits</span>
                    </div>
                    {!isCreatingHabit && isHabitsExpanded && (
                        <button 
                            className="add-habit-trigger-btn" 
                            onClick={(e) => { e.stopPropagation(); setIsCreatingHabit(true); setIsHabitsExpanded(true); }}
                        >
                            + Create Habit
                        </button>
                    )}
                </header>
                <AnimatePresence>
                    {(isHabitsExpanded || energyLevel !== 4) && (
                        <motion.div initial={energyLevel === 4 ? { height: 0, opacity: 0 } : false} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={macOSSpring}>
                            <div className="habits-grid">
                                {(habits || []).map(habit => <HabitCard key={habit.id} habit={habit} onOpenEvolution={setActiveHabitForEvolution} onToggleActive={fetchData} onUpdate={fetchSkills} />)}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            {activeHabitForEvolution && <EvolutionDrillIn habit={activeHabitForEvolution} skill={skill} onClose={() => setActiveHabitForEvolution(null)} onRefresh={fetchData} />}

            {activeObjectives.length > 0 && (
                <section className="skill-section active-experiments-section">
                    <span className="section-label">Active Experiments</span>
                    <LayoutGroup id="active-objectives">
                        <div className="active-experiments-list">
                            {activeObjectives.map(obj => (
                                <ObjectiveCard 
                                    key={obj.id} obj={obj} energyLevel={energyLevel}
                                    isExpanded={expandedObjectiveIds.includes(obj.id)}
                                    isSleeping={obj.metadata?.isSleeping}
                                    aspects={getChildren(obj.id, NodeTypes.ASPECT)}
                                    timeInfo={getObjectiveTimeInfo(obj)}
                                    accType={obj.metadata?.accumulationType}
                                    isMVECompletedToday={obj.metadata?.mveCompletedAt && new Date(obj.metadata.mveCompletedAt).toDateString() === new Date().toDateString()}
                                    isEditing={objectiveHandlers.editingObjectiveId === obj.id}
                                    objectiveEditForm={objectiveHandlers.objectiveEditForm}
                                    setObjectiveEditForm={objectiveHandlers.setObjectiveEditForm}
                                    handleUpdateObjectiveName={handleUpdateObjectiveName}
                                    handleStartEditObjective={handleStartEditObjective}
                                    handleSaveObjectiveEdit={handleSaveObjectiveEdit}
                                    handleDeleteObjective={handleDeleteObjective}
                                    setEditingObjectiveId={objectiveHandlers.setEditingObjectiveId}
                                    setAspectToDelete={taskHandlers.setAspectToDelete}
                                    handleStatusUpdate={handleStatusUpdate}
                                    toggleObjective={toggleObjective}
                                    inlineEditingNodeId={inlineEditingNodeId}
                                    inlineDraftName={inlineDraftName}
                                    setInlineDraftName={setInlineDraftName}
                                    handleSaveInlineEdit={handleSaveInlineEdit}
                                    handleInlineKeyDown={handleInlineKeyDown}
                                    handleStartInlineEdit={handleStartInlineEdit}
                                    inlineInputRef={inlineInputRef}
                                    navigate={navigate}
                                    handleLogPulse={handleLogPulse}
                                    showCompletedTasks={showCompletedTasks}
                                    activeChallengeHighlight={activeChallengeHighlight}
                                    skill={skill}
                                    expandedTaskIds={expandedTaskIds}
                                    toggleTask={toggleTask}
                                    handleToggleTaskStatus={taskHandlers.handleToggleTaskStatus}
                                    handleAddToToday={taskHandlers.handleAddToToday}
                                    handleIncrementRepetition={taskHandlers.handleIncrementRepetition}
                                    setTaskToDelete={taskHandlers.setTaskToDelete}
                                    isSelectingRewardForTaskId={taskHandlers.isSelectingRewardForTaskId}
                                    setIsSelectingRewardForTaskId={taskHandlers.setIsSelectingRewardForTaskId}
                                    handleRemoveReward={taskHandlers.handleRemoveReward}
                                    handleAttachReward={taskHandlers.handleAttachReward}
                                    handleSaveMVE={taskHandlers.handleSaveMVE}
                                    creatingTaskForAspectId={taskHandlers.creatingTaskForAspectId}
                                    setCreatingTaskForAspectId={taskHandlers.setCreatingTaskForAspectId}
                                    newTaskName={taskHandlers.newTaskName}
                                    setNewTaskName={taskHandlers.setNewTaskName}
                                    newTaskItemType={taskHandlers.newTaskItemType}
                                    setNewTaskItemType={taskHandlers.setNewTaskItemType}
                                    handleCreateTask={taskHandlers.handleCreateTask}
                                    aspectShowMoreIds={aspectShowMoreIds}
                                    setAspectShowMoreIds={setAspectShowMoreIds}
                                    toggleAspect={toggleAspect}
                                    creatingAspectForObjId={taskHandlers.creatingAspectForObjId}
                                    setCreatingAspectForObjId={taskHandlers.setCreatingAspectForObjId}
                                    newAspectName={taskHandlers.newAspectName}
                                    setNewAspectName={taskHandlers.setNewAspectName}
                                    handleCreateAspect={taskHandlers.handleCreateAspect}
                                    collapsedCompletedAspects={collapsedCompletedAspects}
                                    setCollapsedCompletedAspects={setCollapsedCompletedAspects}
                                    macOSSpring={macOSSpring}
                                    getChildren={getChildren}
                                />
                            ))}
                        </div>
                    </LayoutGroup>
                </section>
            )}

            {energyLevel >= 4 && (
                <section className="skill-section creation-section">
                    {isCreatingObjective ? (
                        <ObjectiveCreationForm skillId={id} fetchData={fetchData} onCancel={() => setIsCreatingObjective(false)} />
                    ) : (
                        <button className="add-objective-btn" onClick={() => setIsCreatingObjective(true)}>+ New Experiment</button>
                    )}
                </section>
            )}

            {sleepingObjectives.length > 0 && energyLevel >= 3 && (
                <section className="skill-section sleeping-section">
                    <div className="section-header" onClick={() => setIsSleepingExpanded(!isSleepingExpanded)}>
                         <NodeIcon iconUrl={isSleepingExpanded ? "expanded-icon-url" : "collapsed-icon-url"} size={14} />
                        <h2>Sleeping Experiments</h2>
                        <span className="count-badge">{sleepingObjectives.length}</span>
                    </div>
                    {isSleepingExpanded && (
                        <LayoutGroup id="sleeping-objectives">
                            <div className="sleeping-content experiments-grid">
                                {sleepingObjectives.map(obj => (
                                    <ObjectiveCard 
                                        key={obj.id} obj={obj} energyLevel={energyLevel}
                                        isExpanded={expandedObjectiveIds.includes(obj.id)}
                                        isSleeping={true}
                                        aspects={getChildren(obj.id, NodeTypes.ASPECT)}
                                        timeInfo={getObjectiveTimeInfo(obj)}
                                        accType={obj.metadata?.accumulationType}
                                        isMVECompletedToday={obj.metadata?.mveCompletedAt && new Date(obj.metadata.mveCompletedAt).toDateString() === new Date().toDateString()}
                                        isEditing={objectiveHandlers.editingObjectiveId === obj.id}
                                        objectiveEditForm={objectiveHandlers.objectiveEditForm}
                                        setObjectiveEditForm={objectiveHandlers.setObjectiveEditForm}
                                        handleUpdateObjectiveName={handleUpdateObjectiveName}
                                        handleStartEditObjective={handleStartEditObjective}
                                        handleSaveObjectiveEdit={handleSaveObjectiveEdit}
                                        handleDeleteObjective={handleDeleteObjective}
                                        setEditingObjectiveId={objectiveHandlers.setEditingObjectiveId}
                                        setAspectToDelete={taskHandlers.setAspectToDelete}
                                        handleStatusUpdate={handleStatusUpdate}
                                        toggleObjective={toggleObjective}
                                        inlineEditingNodeId={inlineEditingNodeId}
                                        inlineDraftName={inlineDraftName}
                                        setInlineDraftName={setInlineDraftName}
                                        handleSaveInlineEdit={handleSaveInlineEdit}
                                        handleInlineKeyDown={handleInlineKeyDown}
                                        handleStartInlineEdit={handleStartInlineEdit}
                                        inlineInputRef={inlineInputRef}
                                        navigate={navigate}
                                        handleLogPulse={handleLogPulse}
                                        showCompletedTasks={showCompletedTasks}
                                        activeChallengeHighlight={activeChallengeHighlight}
                                        skill={skill}
                                        expandedTaskIds={expandedTaskIds}
                                        toggleTask={toggleTask}
                                        handleToggleTaskStatus={taskHandlers.handleToggleTaskStatus}
                                        handleAddToToday={taskHandlers.handleAddToToday}
                                        handleIncrementRepetition={taskHandlers.handleIncrementRepetition}
                                        setTaskToDelete={taskHandlers.setTaskToDelete}
                                        isSelectingRewardForTaskId={taskHandlers.isSelectingRewardForTaskId}
                                        setIsSelectingRewardForTaskId={taskHandlers.setIsSelectingRewardForTaskId}
                                        handleRemoveReward={taskHandlers.handleRemoveReward}
                                        handleAttachReward={taskHandlers.handleAttachReward}
                                        handleSaveMVE={taskHandlers.handleSaveMVE}
                                        creatingTaskForAspectId={taskHandlers.creatingTaskForAspectId}
                                        setCreatingTaskForAspectId={taskHandlers.setCreatingTaskForAspectId}
                                        newTaskName={taskHandlers.newTaskName}
                                        setNewTaskName={taskHandlers.setNewTaskName}
                                        newTaskItemType={taskHandlers.newTaskItemType}
                                        setNewTaskItemType={taskHandlers.setNewTaskItemType}
                                        handleCreateTask={taskHandlers.handleCreateTask}
                                        aspectShowMoreIds={aspectShowMoreIds}
                                        setAspectShowMoreIds={setAspectShowMoreIds}
                                        toggleAspect={toggleAspect}
                                        creatingAspectForObjId={taskHandlers.creatingAspectForObjId}
                                        setCreatingAspectForObjId={taskHandlers.setCreatingAspectForObjId}
                                        newAspectName={taskHandlers.newAspectName}
                                        setNewAspectName={taskHandlers.setNewAspectName}
                                        handleCreateAspect={taskHandlers.handleCreateAspect}
                                        collapsedCompletedAspects={collapsedCompletedAspects}
                                        setCollapsedCompletedAspects={setCollapsedCompletedAspects}
                                        macOSSpring={macOSSpring}
                                        getChildren={getChildren}
                                    />
                                ))}
                            </div>
                        </LayoutGroup>
                    )}
                </section>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleTaskDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                <DragOverlay dropAnimation={null}>
                    {dragActiveId ? <div className="drag-overlay-task">{allNodes.find(n => n.id === dragActiveId)?.name}</div> : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default SkillPage;
