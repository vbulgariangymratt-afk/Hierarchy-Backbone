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
import { Search } from 'lucide-react';
import './SkillPage.css';

import NodeIcon from '../components/NodeIcon';
import HabitCard from '../components/HabitCard';
import EvolutionArchitectModal from '../components/modals/EvolutionArchitectModal';
import useSkillPageData from '../hooks/useSkillPageData';
import useObjectiveHandlers from '../hooks/useObjectiveHandlers';
import useTaskHandlers from '../hooks/useTaskHandlers';
import SkillSurvivalView from '../components/SkillSurvivalView';
import ObjectiveCreationForm from '../components/ObjectiveCreationForm';
import ObjectiveCard from '../components/ObjectiveCard';

const bionicify = (text) => {
    if (!text) return '';
    return text.split('\n').map((line, lineIdx) => {
        return (
            <span key={lineIdx} style={{ display: 'block', marginBottom: line.trim() === '' ? '12px' : '0' }}>
                {line.split(' ').map((word, wordIdx) => {
                    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“”]/g,"");
                    if (cleanWord.length === 0) return <span key={wordIdx} style={{ marginRight: '0.28em' }}>{word}</span>;
                    
                    const boldLength = Math.max(1, Math.ceil(cleanWord.length * 0.45));
                    const prependedPunctuationCount = word.indexOf(cleanWord[0]);
                    const splitIdx = Math.max(0, prependedPunctuationCount) + boldLength;
                    
                    const boldPart = word.substring(0, splitIdx);
                    const normalPart = word.substring(splitIdx);
                    
                    return (
                        <span key={wordIdx} style={{ display: 'inline-block', marginRight: '0.28em' }}>
                            <strong style={{ fontWeight: 700 }}>{boldPart}</strong>{normalPart}
                        </span>
                    );
                })}
            </span>
        );
    });
};

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
    const { showCompletedTasks, backgroundMode } = useTheme();
    const { energyLevel, activeExperimentLimit, maintenanceSkillIds } = useSettings();

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

    const totalCompletedTasks = useMemo(() => {
        const skillObjectives = (allNodes || []).filter(n => n.type === NodeTypes.OBJECTIVE && n.parentId === id);
        const skillObjectiveIds = new Set(skillObjectives.map(o => o.id));
        const skillAspects = (allNodes || []).filter(n => n.type === NodeTypes.ASPECT && skillObjectiveIds.has(n.parentId));
        const skillAspectIds = new Set(skillAspects.map(a => a.id));

        const skillTasks = (allNodes || []).filter(n => 
            n.type === NodeTypes.TASK && 
            skillAspectIds.has(n.parentId)
        );

        let totalCount = 0;
        skillTasks.forEach(task => {
            if (task.metadata?.itemType === 'REPETITION') {
                totalCount += (Number(task.metadata?.currentUnits) || 0);
            } else if (task.metadata?.status === TaskStatuses.DONE) {
                totalCount += 1;
            }
        });

        return totalCount;
    }, [allNodes, id]);

    // UI State for expansion & becoming section
    const [expandedAspectIds, setExpandedAspectIds] = useState([]);
    const [aspectShowMoreIds, setAspectShowMoreIds] = useState([]);
    const [tempBecoming, setTempBecoming] = useState('');
    const [isSyncingBecoming, setIsSyncingBecoming] = useState(false);

    // Dependency Search State
    const [depSearchQuery, setDepSearchQuery] = useState('');
    const [showDepResults, setShowDepResults] = useState(false);
    const [collapsedCompletedAspects, setCollapsedCompletedAspects] = useState({});
    const [activeHabitForEvolution, setActiveHabitForEvolution] = useState(null);
    const [isHabitsExpanded, setIsHabitsExpanded] = useState(energyLevel === 3 ? (maintenanceSkillIds || []).includes(id) : energyLevel < 4);
    const [isSleepingHabitsExpanded, setIsSleepingHabitsExpanded] = useState(false);

    // Create Habit State
    const [isCreatingHabit, setIsCreatingHabit] = useState(false);
    const [adhdFlowStep, setAdhdFlowStep] = useState(1);
    const [newHabitTrigger, setNewHabitTrigger] = useState('');
    const [newHabitAction, setNewHabitAction] = useState('');
    const [newHabitPeriod, setNewHabitPeriod] = useState('daily');
    const [newHabitCount, setNewHabitCount] = useState(1);
    
    // ADHD Habit Flow Steps State
    const [finalHabitAction, setFinalHabitAction] = useState('');
    const [habitTrigger, setHabitTrigger] = useState('');
    const [smallestHabitAction, setSmallestHabitAction] = useState('');
    const [activeReasonIndex, setActiveReasonIndex] = useState(0);

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
        objectiveToDelete, setObjectiveToDelete,
        isLimitModalOpen, setIsLimitModalOpen,
        isConfirmSleepModalOpen, setIsConfirmSleepModalOpen,
        pendingSleepObj, setPendingSleepObj,
        performObjectiveToggle
    } = objectiveHandlers;

    const activeHabits = useMemo(() => (skillHabits || []).filter(h => !h.isSleeping), [skillHabits]);
    const sleepingHabits = useMemo(() => (skillHabits || []).filter(h => h.isSleeping), [skillHabits]);

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

    const isKeepItAlivePage = useMemo(() => 
        (maintenanceSkillIds || []).includes(id),
    [maintenanceSkillIds, id]);
    const shouldHideTasksAndExperiments = energyLevel === 3 && isKeepItAlivePage;

    useEffect(() => {
        if (energyLevel === 3) {
            setIsHabitsExpanded(isKeepItAlivePage);
        } else if (energyLevel < 3) {
            setIsHabitsExpanded(true);
        }
    }, [energyLevel, isKeepItAlivePage]);

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
        const aspects = getChildren(obj.id, NodeTypes.ASPECT);
        const aspectIds = new Set(aspects.map(a => a.id));
        
        // Filter tasks to ONLY those that belong to this objective's aspects
        const tasks = (allNodes || []).filter(n => 
            n.type === NodeTypes.TASK && aspectIds.has(n.parentId)
        );
        
        const m = obj.metadata || {};
        const activityDates = new Set();

        tasks.forEach(t => {
            if (t.metadata?.completedAt) activityDates.add(new Date(t.metadata.completedAt).toLocaleDateString('en-CA'));
            (t.metadata?.sessions || []).forEach(s => {
                if (s.status === 'completed' && s.endTime) {
                    activityDates.add(new Date(s.endTime).toLocaleDateString('en-CA'));
                }
            });
        });

        // Scoped MVE completions
        if (m.mveCompletedAt) activityDates.add(new Date(m.mveCompletedAt).toLocaleDateString('en-CA'));
        
        // Scoped accumulation logs
        aspects.forEach(a => {
            (a.metadata?.logs || []).forEach(l => {
                if (l.timestamp) activityDates.add(new Date(l.timestamp).toLocaleDateString('en-CA'));
            });
        });

        // Repetition interactions saved to the master ROOT log
        const rootNode = (allNodes || []).find(n => n.id === 'ROOT');
        if (rootNode?.metadata?.dailyRepLog) {
            Object.entries(rootNode.metadata.dailyRepLog).forEach(([dateStr, logs]) => {
                for (const t of tasks) {
                    if (logs[t.id]) {
                        activityDates.add(dateStr);
                        break;
                    }
                }
            });
        }

        // Localized repetition interactions
        tasks.forEach(t => {
            (t.metadata?.repetitionTimestamps || []).forEach(ts => {
                activityDates.add(new Date(ts).toLocaleDateString('en-CA'));
            });
        });

        // Return total unique days of activity
        return { days: activityDates.size };
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

    // Memoize all tasks in the skill for dependency searching
    const allSkillTasks = useMemo(() => {
        if (!skill || !allNodes) return [];
        // Objectives -> Aspects -> Tasks
        const objectives = allNodes.filter(n => n.parentId === skill.id && n.type === NodeTypes.OBJECTIVE);
        const objIds = objectives.map(o => o.id);
        const aspects = allNodes.filter(n => objIds.includes(n.parentId) && n.type === NodeTypes.ASPECT);
        const aspectIds = aspects.map(a => a.id);
        return allNodes.filter(n => aspectIds.includes(n.parentId) && n.type === NodeTypes.TASK);
    }, [allNodes, skill]);

    const filteredDepTasks = useMemo(() => {
        if (!depSearchQuery.trim()) return [];
        const query = depSearchQuery.toLowerCase();
        return allSkillTasks.filter(t => 
            t.name.toLowerCase().includes(query) && 
            t.metadata?.status !== TaskStatuses.DONE
        ).slice(0, 8);
    }, [allSkillTasks, depSearchQuery]);

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

    const handleToggleSleepHabit = useCallback(async (habit) => {
        try {
            await habitService.updateHabit(habit.id, { isSleeping: !habit.isSleeping });
            await fetchSkills();
            fetchData();
        } catch (error) {
            console.error("Failed to toggle sleep status:", error);
        }
    }, [fetchSkills, fetchData]);

    const handleDeleteHabit = useCallback(async (habitId) => {
        try {
            await habitService.deleteHabit(habitId);
            await fetchSkills();
            fetchData();
        } catch (error) {
            console.error("Failed to delete habit:", error);
        }
    }, [fetchSkills, fetchData]);

    const handleCreateHabit = useCallback(async (e) => {
        if (e) e.preventDefault();
        if (!habitTrigger.trim() || !smallestHabitAction.trim()) return;
        try {
            await habitService.createHabit(
                id,
                habitTrigger.trim(),
                smallestHabitAction.trim(),
                newHabitPeriod,
                newHabitCount
            );
            setIsCreatingHabit(false);
            setAdhdFlowStep(1);
            setFinalHabitAction('');
            setHabitTrigger('');
            setSmallestHabitAction('');
            setNewHabitPeriod('daily');
            setNewHabitCount(1);
            setActiveReasonIndex(0);
            fetchData();
            fetchSkills();
        } catch (error) {
            console.error("Failed to create habit:", error);
        }
    }, [id, habitTrigger, smallestHabitAction, newHabitPeriod, newHabitCount, fetchData, fetchSkills]);

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
        if (skill?.metadata?.identityAnchor !== undefined) {
            const rawVal = skill.metadata.identityAnchor || '';
            setTempBecoming(rawVal ? (rawVal.charAt(0).toLowerCase() + rawVal.slice(1)) : '');
        }
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

    // Enter key advances the habit creation flow
    useEffect(() => {
        if (!isCreatingHabit) return;
        const handleKeyDown = (e) => {
            if (e.key !== 'Enter') return;
            // Don't hijack Enter if the user is in a textarea (shouldn't be any, but just in case)
            if (e.target.tagName === 'TEXTAREA') return;
            // Prevent form submission / default behaviour
            e.preventDefault();

            const REASONS_LENGTH = 4;
            switch (adhdFlowStep) {
                case 1:
                    setAdhdFlowStep(2);
                    break;
                case 2:
                    if (finalHabitAction.trim()) setAdhdFlowStep(3);
                    break;
                case 3:
                    if (habitTrigger.trim()) setAdhdFlowStep(4);
                    break;
                case 4:
                    if (smallestHabitAction.trim()) setAdhdFlowStep(6);
                    break;
                case 5:
                    // cycle reasons; on the last one, move forward to step 6
                    setActiveReasonIndex(prev => {
                        if (prev < REASONS_LENGTH - 1) return prev + 1;
                        setAdhdFlowStep(6);
                        return 0;
                    });
                    break;
                case 6:
                    handleCreateHabit();
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCreatingHabit, adhdFlowStep, finalHabitAction, habitTrigger, smallestHabitAction]);

    if (loading) return <div className="skill-page-loading">Loading Hierarchy...</div>;
    if (!skill) return <div className="skill-page-error">Skill not found.</div>;

    if (isCreatingHabit) {
        return (
            <div className="adhd-habit-flow-overlay">
                <div style={{ height: '24px' }} />

                <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'flex-start', width: '100%', textAlign: 'left' }}>
                    {adhdFlowStep === 1 && (
                        <>
                            <p style={{ fontSize: '24px', fontWeight: 400, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                                {bionicify(`Its not as simple as “just do it consistently” for our type of brains\n\nLemme show you adhd does it`)}
                            </p>
                            <button 
                                onClick={() => setAdhdFlowStep(2)}
                                className="adhd-habit-flow-btn-accent"
                            >
                                show me
                            </button>
                        </>
                    )}

                    {adhdFlowStep === 2 && (
                        <>
                            <p style={{ fontSize: '22px', fontWeight: 400, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                                {bionicify(`what is the overall habit that you want to achieve? (study Russian every day) for example (exclude frequency for now)`)}
                            </p>
                            <input 
                                autoFocus
                                placeholder="e.g. study Russian"
                                value={finalHabitAction}
                                onChange={e => setFinalHabitAction(e.target.value)}
                                className="adhd-habit-flow-input"
                            />
                            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                                <button 
                                    onClick={() => setAdhdFlowStep(1)}
                                    className="adhd-habit-flow-btn-secondary"
                                >
                                    Back
                                </button>
                                <button 
                                    onClick={() => setAdhdFlowStep(3)}
                                    disabled={!finalHabitAction.trim()}
                                    className="adhd-habit-flow-btn-accent"
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )}

                    {adhdFlowStep === 3 && (
                        <>
                            <p style={{ fontSize: '22px', fontWeight: 400, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                                {bionicify(`and what will be your trigger? for example if you want to study russian, your trigger might be to sit on your desk\n\nSo your habit would look like: IF I ${habitTrigger.trim() || '___'} THEN I ${finalHabitAction}`)}
                            </p>
                            <p style={{ fontSize: '15px', opacity: 0.55, margin: '4px 0 0 0', fontWeight: 300 }}>
                                {bionicify(`make sure to chain it to an action you already do`)}
                            </p>
                            <input 
                                autoFocus
                                placeholder="e.g. sit on my desk"
                                value={habitTrigger}
                                onChange={e => setHabitTrigger(e.target.value)}
                                className="adhd-habit-flow-input"
                            />
                            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                                <button 
                                    onClick={() => setAdhdFlowStep(2)}
                                    className="adhd-habit-flow-btn-secondary"
                                >
                                    Back
                                </button>
                                <button 
                                    onClick={() => setAdhdFlowStep(4)}
                                    disabled={!habitTrigger.trim()}
                                    className="adhd-habit-flow-btn-accent"
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )}

                    {adhdFlowStep === 4 && (
                        <>
                            <p style={{ fontSize: '20px', fontWeight: 400, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                                {bionicify(`now ignore your desired habit for a while, think of the absolute, most insignificant smallest version of this habit that you can do\n\nFor example if your habit to study x thing every day, the smallest version of this would be: open the book on your desk (and thats it)\n\nSo it would look like: IF I ${habitTrigger} THEN I ${smallestHabitAction.trim() || '___'}\n\nAnd that would be phase 1 of your habit`)}
                            </p>
                            <input 
                                autoFocus
                                placeholder="e.g. open the book on my desk"
                                value={smallestHabitAction}
                                onChange={e => setSmallestHabitAction(e.target.value)}
                                className="adhd-habit-flow-input"
                            />
                            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                                <button 
                                    onClick={() => setAdhdFlowStep(3)}
                                    className="adhd-habit-flow-btn-secondary"
                                >
                                    Back
                                </button>
                                <button 
                                    onClick={() => setAdhdFlowStep(5)}
                                    className="adhd-habit-flow-btn-secondary"
                                >
                                    why like this?
                                </button>
                                <button 
                                    onClick={() => setAdhdFlowStep(6)}
                                    disabled={!smallestHabitAction.trim()}
                                    className="adhd-habit-flow-btn-accent"
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )}

                    {adhdFlowStep === 5 && (
                        <>
                            <div style={{ maxWidth: '650px', width: '100%' }}>
                                {(() => {
                                    const reasons = [
                                        `1: Our brains dont reward us when doing “boring but important” stuff, if we start with the apparently huge task of ${finalHabitAction} your brain will treat it as a threat cuz of the massive effort to start and you’ll burn out in 3 days`,
                                        `2: Our brains have time blindness, so if we say “do x thing at 8 am” you’ll just forget, if you dont forget you’ll resist cuz it feels like a “should” task instead of something you want to do, and it just creates micro anxiety around that`,
                                        `3: starting with the smallest possible action is way easier for adhd than with the final massive habit, costs way less energy, effort backfires in adhd so we remove it from the process of forming the habit, so you build step by step basically`,
                                        `Think of all the habits & trackers that you’ve tried to implement and failed, they failed for these previous reasons, that way doesnt work for us, we need to do stuff differently bruv`
                                    ];
                                    return (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', justifyContent: 'flex-start', marginBottom: '24px' }}>
                                                <button 
                                                    onClick={() => setActiveReasonIndex(prev => (prev > 0 ? prev - 1 : reasons.length - 1))}
                                                    className="adhd-reason-nav-btn"
                                                >
                                                    &larr;
                                                </button>
                                                <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-primary)', letterSpacing: '0.05em' }}>
                                                    Reason {activeReasonIndex + 1}
                                                </span>
                                                <button 
                                                    onClick={() => setActiveReasonIndex(prev => (prev < reasons.length - 1 ? prev + 1 : 0))}
                                                    className="adhd-reason-nav-btn"
                                                >
                                                    &rarr;
                                                </button>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '18px', lineHeight: 1.6, minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', textAlign: 'left' }}>
                                                {bionicify(reasons[activeReasonIndex])}
                                            </p>
                                        </>
                                    );
                                })()}
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
                                <button 
                                    onClick={() => setAdhdFlowStep(4)}
                                    className="adhd-habit-flow-btn-secondary"
                                >
                                    Back
                                </button>
                            </div>
                        </>
                    )}

                    {adhdFlowStep === 6 && (
                        <>
                            <p style={{ fontSize: '22px', fontWeight: 400, lineHeight: 1.6, margin: 0, letterSpacing: '-0.01em' }}>
                                {bionicify(`how often do you wanna do this habit? (final form eventually)`)}
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', marginTop: '20px', width: '100%' }}>
                                <span style={{ fontSize: '11px', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                                    {bionicify(`Frequency Target`)}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '18px' }}>
                                    <input 
                                        type="number" 
                                        value={newHabitCount}
                                        onChange={e => setNewHabitCount(parseInt(e.target.value) || 1)}
                                        min="1"
                                        className="adhd-habit-flow-input"
                                        style={{ width: '60px' }}
                                    />
                                    <span style={{ opacity: 0.6, fontSize: '16px' }}>
                                        {bionicify(`times per`)}
                                    </span>
                                    <select 
                                        value={newHabitPeriod}
                                        onChange={e => setNewHabitPeriod(e.target.value)}
                                        className="adhd-habit-flow-select"
                                    >
                                        <option value="daily">day</option>
                                        <option value="weekly">week</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
                                <button 
                                    onClick={() => setAdhdFlowStep(4)}
                                    className="adhd-habit-flow-btn-secondary"
                                >
                                    Back
                                </button>
                                <button 
                                    onClick={handleCreateHabit}
                                    className="adhd-habit-flow-btn-accent"
                                >
                                    Create Habit
                                </button>
                            </div>
                        </>
                    )}

                </div>

                <div style={{ paddingBottom: '20px' }}>
                    <button 
                        onClick={() => setIsCreatingHabit(false)}
                        className="adhd-habit-flow-btn-later"
                    >
                        Save for later
                    </button>
                </div>
            </div>
        );
    }

    if (energyLevel <= 2) {
        return (
            <SkillSurvivalView 
                skill={skill} energyLevel={energyLevel} allNodes={allNodes}
                habits={activeHabits} navigate={navigate} handleHabitComplete={handleHabitComplete} getChildren={getChildren}
            />
        );
    }    const PinchAnalysis = ({ skill, energyLevel }) => {
        if (energyLevel < 4) return null;
        const pinch = skill.metadata?.pinchState;
        if (!pinch || pinch === 'NONE') return null;

        const explanation = {
            'NOVELTY': "Attention is decaying. The current experiment structure has become predictable.",
            'CHALLENGE': "Mastery has plateaued. Increase the difficulty.",
            'PASSION': "High value, high resistance. Break the next task into a 2-minute MVE.",
            'INTEREST': null,
            'HURRY': null
        }[pinch];

        if (!explanation) return null;

        return (
            <div className="pinch-explanation-banner">
                <span className="pinch-explanation-icon">⚡</span>
                <p className="pinch-explanation-text">{explanation}</p>
            </div>
        );
    };

    return (
        <div id="skill-page-wrapper" className={`skill-page energy-level-${energyLevel}`}>
            <button className="back-button" onClick={() => navigate(-1)}><span>&larr;</span> Back to Area</button>

            <header className="skill-header">
                <div className="skill-header-main-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                </div>
                <div className="skill-identity-row">
                    <span className="identity-prefix">Becoming</span>
                    <input
                        className="skill-identity-input" placeholder="Define who you are becoming..."
                        value={tempBecoming} onChange={(e) => {
                            const val = e.target.value;
                            const formatted = val ? (val.charAt(0).toLowerCase() + val.slice(1)) : '';
                            setTempBecoming(formatted);
                            debouncedUpdateBecoming(formatted);
                        }}
                    />
                    {isSyncingBecoming && <span className="sync-indicator" style={{ marginRight: '16px' }}>Saving...</span>}
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                        {totalCompletedTasks > 0 && (
                            <span className="skill-completed-badge" title="Total completed tasks in this skill">
                                ✓ {totalCompletedTasks} completed
                            </span>
                        )}
                        {energyLevel >= 4 && skill.metadata?.pinchState && ['NOVELTY', 'CHALLENGE', 'PASSION', 'INTEREST', 'HURRY'].includes(skill.metadata.pinchState) && (
                            <span className={`pinch-state-badge pinch-${skill.metadata.pinchState.toLowerCase()}`}>
                                { { 'NOVELTY': 'Novelty', 'CHALLENGE': 'Challenge', 'PASSION': 'Passion', 'INTEREST': 'Interest', 'HURRY': 'Hurry' }[skill.metadata.pinchState] }
                            </span>
                        )}
                    </div>
                </div>
                <PinchAnalysis skill={skill} energyLevel={energyLevel} />
            </header>

            <section className="skill-section habits-skill-wrapper">
                <header className="section-header-row" onClick={() => energyLevel >= 3 && setIsHabitsExpanded(!isHabitsExpanded)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: energyLevel >= 3 ? 'pointer' : 'default' }}>
                        {energyLevel >= 3 && (
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
                            onClick={(e) => { e.stopPropagation(); setIsCreatingHabit(true); setAdhdFlowStep(1); setActiveReasonIndex(0); setIsHabitsExpanded(true); }}
                        >
                            + Create Habit
                        </button>
                    )}
                </header>
                <AnimatePresence>
                    {isCreatingHabit && isHabitsExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
                            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                            transition={macOSSpring}
                            style={{ overflow: 'hidden' }}
                        >
                            <div className="habit-creation-inline">
                                <div className="creation-row">
                                    <span className="creation-prefix">IF</span>
                                    <input 
                                        autoFocus
                                        placeholder="Trigger/Cue (e.g. After I pour my morning coffee...)" 
                                        value={newHabitTrigger}
                                        onChange={e => setNewHabitTrigger(e.target.value)}
                                    />
                                </div>
                                
                                <div className="creation-row">
                                    <span className="creation-prefix">THEN</span>
                                    <input 
                                        placeholder="Action (e.g. I will write down 1 task)" 
                                        value={newHabitAction}
                                        onChange={e => setNewHabitAction(e.target.value)}
                                    />
                                </div>

                                <div className="frequency-config-row">
                                    <div className="frequency-input-group">
                                        <span className="creation-prefix">Target:</span>
                                        <input 
                                            type="number" 
                                            className="minimal-num-input" 
                                            value={newHabitCount}
                                            onChange={e => setNewHabitCount(parseInt(e.target.value) || 1)}
                                            min="1"
                                        />
                                        <span className="frequency-sep">times per</span>
                                        <select 
                                            className="minimal-select"
                                            value={newHabitPeriod}
                                            onChange={e => setNewHabitPeriod(e.target.value)}
                                        >
                                            <option value="daily">Day</option>
                                            <option value="weekly">Week</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="creation-actions">
                                    <button className="confirm-btn" onClick={handleCreateHabit}>Create Habit</button>
                                    <button className="cancel-btn" onClick={() => setIsCreatingHabit(false)}>Cancel</button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {(isHabitsExpanded || energyLevel < 3) && (
                        <motion.div initial={energyLevel >= 3 ? { height: 0, opacity: 0 } : false} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={macOSSpring}>
                            <div className="habits-grid">
                                {activeHabits.map(habit => <HabitCard key={habit.id} habit={habit} energyLevel={energyLevel} onOpenEvolution={setActiveHabitForEvolution} onToggleActive={fetchData} onUpdate={fetchSkills} onSleep={handleToggleSleepHabit} onDelete={handleDeleteHabit} />)}
                            </div>
                            {sleepingHabits.length > 0 && energyLevel >= 3 && !shouldHideTasksAndExperiments && (
                                <div className="sleeping-section" style={{ marginTop: '24px' }}>
                                    <div className="section-header" onClick={() => setIsSleepingHabitsExpanded(!isSleepingHabitsExpanded)}>
                                        <motion.span 
                                            animate={{ rotate: isSleepingHabitsExpanded ? 90 : 0 }}
                                            style={{ display: 'inline-block', fontSize: '10px', opacity: 0.8, color: 'var(--text-secondary)' }}
                                        >
                                            ▶
                                        </motion.span>
                                        <h2>Sleeping Habits</h2>
                                        <span className="count-badge">{sleepingHabits.length}</span>
                                    </div>
                                    {isSleepingHabitsExpanded && (
                                        <div className="sleeping-content experiments-grid" style={{ opacity: 0.6, marginTop: '16px' }}>
                                            {sleepingHabits.map(habit => <HabitCard key={habit.id} habit={habit} energyLevel={energyLevel} onOpenEvolution={setActiveHabitForEvolution} onToggleActive={fetchData} onUpdate={fetchSkills} onSleep={handleToggleSleepHabit} onDelete={handleDeleteHabit} />)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            {activeHabitForEvolution && (
                <EvolutionArchitectModal 
                    habit={activeHabitForEvolution} 
                    skill={skill} 
                    onClose={() => setActiveHabitForEvolution(null)} 
                    onRefresh={() => {
                        fetchData();
                        fetchSkills();
                    }} 
                />
            )}

            {activeObjectives.length > 0 && !shouldHideTasksAndExperiments && (
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
                                    newTaskUnitName={taskHandlers.newTaskUnitName}
                                    setNewTaskUnitName={taskHandlers.setNewTaskUnitName}
                                    newTaskTargetUnits={taskHandlers.newTaskTargetUnits}
                                    setNewTaskTargetUnits={taskHandlers.setNewTaskTargetUnits}
                                    newTaskDependencyId={taskHandlers.newTaskDependencyId}
                                    setNewTaskDependencyId={taskHandlers.setNewTaskDependencyId}
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
                                    allNodes={allNodes}
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

            {sleepingObjectives.length > 0 && energyLevel >= 3 && !shouldHideTasksAndExperiments && (
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
                                        newTaskUnitName={taskHandlers.newTaskUnitName}
                                        setNewTaskUnitName={taskHandlers.setNewTaskUnitName}
                                        newTaskTargetUnits={taskHandlers.newTaskTargetUnits}
                                        setNewTaskTargetUnits={taskHandlers.setNewTaskTargetUnits}
                                        newTaskDependencyId={taskHandlers.newTaskDependencyId}
                                        setNewTaskDependencyId={taskHandlers.setNewTaskDependencyId}
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
                                        allNodes={allNodes}
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

            {/* ── Task Delete Confirmation Modal ── */}
            {taskHandlers.taskToDelete && (
                <div
                    className="delete-confirm-overlay"
                    onClick={() => taskHandlers.setTaskToDelete(null)}
                >
                    <div
                        className="delete-confirm-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="delete-confirm-message">
                            Delete task <strong>"{taskHandlers.taskToDelete.name}"</strong>?
                        </p>
                        <div className="delete-confirm-actions">
                            <button
                                className="delete-confirm-cancel"
                                onClick={() => taskHandlers.setTaskToDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-confirm-btn"
                                onClick={taskHandlers.handleDeleteTask}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Aspect Delete Confirmation Modal ── */}
            {taskHandlers.aspectToDelete && (
                <div
                    className="delete-confirm-overlay"
                    onClick={() => taskHandlers.setAspectToDelete(null)}
                >
                    <div
                        className="delete-confirm-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="delete-confirm-message">
                            Delete aspect <strong>"{taskHandlers.aspectToDelete.name}"</strong> and all its tasks?
                        </p>
                        <div className="delete-confirm-actions">
                            <button
                                className="delete-confirm-cancel"
                                onClick={() => taskHandlers.setAspectToDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-confirm-btn"
                                onClick={taskHandlers.handleDeleteAspect}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Task Creation Modal ── */}
            {taskHandlers.creatingTaskForAspectId && (
                <div 
                    className="task-creation-overlay"
                    onClick={() => taskHandlers.setCreatingTaskForAspectId(null)}
                >
                    <div 
                        className="task-creation-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="task-creation-body" style={{ paddingTop: '28px' }}>
                            <div className="creation-field">
                                <label>Task Name</label>
                                <input 
                                    autoFocus
                                    placeholder="What needs to be done?"
                                    value={taskHandlers.newTaskName}
                                    onChange={(e) => taskHandlers.setNewTaskName(e.target.value)}
                                    onKeyDown={(e) => taskHandlers.handleCreateTask(e, taskHandlers.creatingTaskForAspectId)}
                                />
                            </div>

                            <div className="creation-field">
                                <label>Activity Type</label>
                                <div className="switch-card">
                                    <div className="switch-label-group">
                                        <div className="switch-title">Repeated Activity</div>
                                        <div className="switch-desc">Track quantitative reps, counts, or time duration</div>
                                    </div>
                                    <label className="switch-control">
                                        <input 
                                            type="checkbox"
                                            checked={taskHandlers.newTaskItemType === 'REPETITION'}
                                            onChange={(e) => {
                                                taskHandlers.setNewTaskItemType(e.target.checked ? 'REPETITION' : 'FINITE');
                                            }}
                                        />
                                        <span className="switch-slider"></span>
                                    </label>
                                </div>
                            </div>

                            {taskHandlers.newTaskItemType === 'REPETITION' && (
                                <div className="repetition-grid">
                                    <div className="creation-field">
                                        <label>Target Units</label>
                                        <input 
                                            type="number"
                                            placeholder="0"
                                            value={taskHandlers.newTaskTargetUnits}
                                            onChange={(e) => taskHandlers.setNewTaskTargetUnits(e.target.value)}
                                        />
                                    </div>
                                    <div className="creation-field">
                                        <label>Unit Name</label>
                                        <input 
                                            placeholder="eg: reps, mins..."
                                            value={taskHandlers.newTaskUnitName}
                                            onChange={(e) => taskHandlers.setNewTaskUnitName(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="creation-field">
                                <label>Depends On (Optional)</label>
                                {taskHandlers.newTaskDependencyId ? (
                                    <div className="selected-dep-pill">
                                        <span className="name">
                                            After: {allNodes.find(n => n.id === taskHandlers.newTaskDependencyId)?.name}
                                        </span>
                                        <span 
                                            className="clear" 
                                            onClick={() => taskHandlers.setNewTaskDependencyId('')}
                                        >
                                            &times;
                                        </span>
                                    </div>
                                ) : (
                                    <div className="dep-search-container">
                                        <input 
                                            placeholder="Search tasks in this skill..."
                                            value={depSearchQuery}
                                            onChange={(e) => {
                                                setDepSearchQuery(e.target.value);
                                                setShowDepResults(true);
                                            }}
                                            onFocus={() => setShowDepResults(true)}
                                            style={{ paddingRight: '36px' }}
                                        />
                                        <Search size={14} className="search-icon-inline" style={{ position: 'absolute', right: '14px', top: '12px', opacity: 0.4, pointerEvents: 'none', color: 'var(--text-secondary)' }} />
                                        
                                        {showDepResults && filteredDepTasks.length > 0 && (
                                            <div className="dep-search-results">
                                                {filteredDepTasks.map(t => {
                                                    const aspect = allNodes.find(n => n.id === t.parentId);
                                                    const objective = allNodes.find(n => n.id === aspect?.parentId);
                                                    return (
                                                        <div 
                                                            key={t.id} 
                                                            className="dep-result-item"
                                                            onClick={() => {
                                                                taskHandlers.setNewTaskDependencyId(t.id);
                                                                setDepSearchQuery('');
                                                                setShowDepResults(false);
                                                            }}
                                                        >
                                                            <div className="task-name">{t.name}</div>
                                                            <div className="aspect-path">
                                                                {objective?.name} › {aspect?.name}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {showDepResults && depSearchQuery.trim() && filteredDepTasks.length === 0 && (
                                            <div className="dep-search-results" style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.6 }}>
                                                No tasks found matching "{depSearchQuery}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="task-creation-footer">
                            <button 
                                className="task-creation-cancel"
                                onClick={() => taskHandlers.setCreatingTaskForAspectId(null)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="task-creation-confirm"
                                onClick={(e) => taskHandlers.handleCreateTask(e, taskHandlers.creatingTaskForAspectId)}
                            >
                                Create Task
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Experiment Delete Confirmation Modal ── */}
            {objectiveToDelete && (
                <div
                    className="delete-confirm-overlay"
                    onClick={() => setObjectiveToDelete(null)}
                >
                    <div
                        className="delete-confirm-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="delete-confirm-message">
                            Delete experiment <strong>"{objectiveToDelete.name}"</strong>?
                            <br />
                            <small style={{ opacity: 0.6, fontSize: '11px', marginTop: '8px', display: 'block' }}>All associated aspects and tasks will be removed.</small>
                        </p>
                        <div className="delete-confirm-actions">
                            <button
                                className="delete-confirm-cancel"
                                onClick={() => setObjectiveToDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-confirm-btn"
                                onClick={confirmDeleteObjective}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Experiment Limit Modal ── */}
            {isLimitModalOpen && (
                <div className="modal-overlay" onClick={() => setIsLimitModalOpen(false)}>
                    <div className="confirmation-modal" onClick={e => e.stopPropagation()}>
                        <h3>Experiment Limit Reached</h3>
                        <p style={{ fontSize: '14px', margin: '16px 0', opacity: 0.8 }}>
                            You can only have <strong>{activeExperimentLimit || 1}</strong> active experiment{activeExperimentLimit > 1 ? 's' : ''} at a time in this skill. 
                            Please complete or sleep an existing one first.
                        </p>
                        <button 
                            className="delete-confirm-cancel" 
                            style={{ width: '100%', marginTop: '10px' }}
                            onClick={() => setIsLimitModalOpen(false)}
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {/* ── Confirm Sleep Modal (14-day rule) ── */}
            {isConfirmSleepModalOpen && (
                <div className="modal-overlay" onClick={() => { setIsConfirmSleepModalOpen(false); setPendingSleepObj(null); }}>
                    <div className="confirmation-modal" onClick={e => e.stopPropagation()}>
                        <h3>Sleep Experiment Early?</h3>
                        <p style={{ fontSize: '14px', margin: '16px 0', opacity: 0.8 }}>
                            This experiment hasn't reached the 14-day stability threshold yet. 
                            Are you sure you want to pause it now?
                        </p>
                        <div className="delete-confirm-actions">
                            <button
                                className="delete-confirm-cancel"
                                onClick={() => { setIsConfirmSleepModalOpen(false); setPendingSleepObj(null); }}
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-confirm-btn"
                                style={{ background: 'var(--color-primary)' }}
                                onClick={async () => {
                                    if (pendingSleepObj) await performObjectiveToggle(pendingSleepObj);
                                    setIsConfirmSleepModalOpen(false);
                                    setPendingSleepObj(null);
                                }}
                            >
                                Sleep Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SkillPage;
