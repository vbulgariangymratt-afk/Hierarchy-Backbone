import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    backbone,
    repository,
    habitService,
    NodeTypes,
    ObjectiveStatuses,
    TaskStatuses
} from '../backbone-v2/index';
import { useTheme } from '../context/ThemeContext';
import './SkillPage.css';
import NodeIcon from '../components/NodeIcon';
import SortableTaskRow from '../components/SortableTaskRow';
import DroppableAspect from '../components/DroppableAspect';
import HabitCard from '../components/HabitCard';
import EvolutionDrillIn from '../components/EvolutionDrillIn';

const macOSSpring = {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.8
};


console.log("SkillPage module loaded");

const SkillPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const { showCompletedTasks, setShowCompletedTasks } = useTheme();
    const [skill, setSkill] = useState(null);
    const [objectives, setObjectives] = useState([]);
    const [allNodes, setAllNodes] = useState([]);
    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State for expansion
    const [expandedObjectiveIds, setExpandedObjectiveIds] = useState([]);
    const [expandedAspectIds, setExpandedAspectIds] = useState([]);
    const [aspectShowMoreIds, setAspectShowMoreIds] = useState([]);
    
    // Becoming Section Performance Optimization
    const [tempBecoming, setTempBecoming] = useState('');
    const [isSyncingBecoming, setIsSyncingBecoming] = useState(false);

    const [dragActiveId, setDragActiveId] = useState(null);
    const navigate = useNavigate();

    // UI state for creation
    const [isCreatingObjective, setIsCreatingObjective] = useState(false);
    const [newObjectiveName, setNewObjectiveName] = useState('');
    const [newObjectiveTheme, setNewObjectiveTheme] = useState('');
    const [newObjectiveDuration, setNewObjectiveDuration] = useState(30);
    const [newObjectiveAccType, setNewObjectiveAccType] = useState('minutes');
    const [newObjectiveMVE, setNewObjectiveMVE] = useState('');
    const [newObjectiveWish, setNewObjectiveWish] = useState('');
    const [newObjectiveOutcome, setNewObjectiveOutcome] = useState('');
    const [newObjectiveIconUrl, setNewObjectiveIconUrl] = useState('');
    const [inlineEditingWishId, setInlineEditingWishId] = useState(null);
    const [inlineEditingOutcomeId, setInlineEditingOutcomeId] = useState(null);
    const [tempWish, setTempWish] = useState('');
    const [tempOutcome, setTempOutcome] = useState('');
    const [creatingAspectForObjId, setCreatingAspectForObjId] = useState(null);
    const [newAspectName, setNewAspectName] = useState('');
    const [creatingTaskForAspectId, setCreatingTaskForAspectId] = useState(null);
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskDependencyId, setNewTaskDependencyId] = useState('');
    const [newTaskItemType, setNewTaskItemType] = useState('FINITE'); // 'FINITE' or 'REPETITION'
    const [newTaskUnitName, setNewTaskUnitName] = useState('units');
    const [newTaskTargetUnits, setNewTaskTargetUnits] = useState(1);
    const [expandedTaskIds, setExpandedTaskIds] = useState([]);
    const [isSelectingRewardForTaskId, setIsSelectingRewardForTaskId] = useState(null);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [isConfirmSleepModalOpen, setIsConfirmSleepModalOpen] = useState(false);
    const [pendingSleepObj, setPendingSleepObj] = useState(null);
    const [isSleepingExpanded, setIsSleepingExpanded] = useState(false);

    // Evolution Drill-In State
    const [activeHabitForEvolution, setActiveHabitForEvolution] = useState(null);

    // Create Habit State
    const [isCreatingHabit, setIsCreatingHabit] = useState(false);
    const [newHabitTrigger, setNewHabitTrigger] = useState('');
    const [newHabitAction, setNewHabitAction] = useState('');
    
    // Drag Reorder Lock
    const isReorderingRef = useRef(false);

    // Deletion State
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [aspectToDelete, setAspectToDelete] = useState(null);
    const [objectiveToDelete, setObjectiveToDelete] = useState(null);
    const [aspectForDetails, setAspectForDetails] = useState(null);
    const [editingObjectiveId, setEditingObjectiveId] = useState(null);
    const [objectiveEditForm, setObjectiveEditForm] = useState(null);

    // Inline rename state
    const [inlineEditingNodeId, setInlineEditingNodeId] = useState(null);
    const [inlineDraftName, setInlineDraftName] = useState('');
    const inlineInputRef = useRef(null);

    const taskNameInputRef = useRef(null);
    
    // Performance Optimized Data Access
    const nodesByParent = useMemo(() => {
        const map = new Map();
        for (const node of allNodes || []) {
            if (!node) continue;
            const parent = node.parentId || "root";
            if (!map.has(parent)) {
                map.set(parent, []);
            }
            map.get(parent).push(node);
        }
        return map;
    }, [allNodes]);

    const getChildren = useCallback((parentId, type) => {
        if (!nodesByParent) return [];
        const parentKey = parentId || "root";
        const children = nodesByParent.get(parentKey) || [];
        
        if (!type) return children;

        return children.filter(n => {
            if (type === NodeTypes.ASPECT) {
                return n.type === 'ASPECT' || n.type === 'STAGE';
            }
            return n.type === type;
        });
    }, [nodesByParent]);

    // Derived State
    const activeObjectives = useMemo(() => 
        (objectives || []).filter(o => o.metadata?.isActive === true || (!o.metadata?.isActive && !o.metadata?.isSleeping && !o.metadata?.isArchived)), 
    [objectives]);
    const sleepingObjectives = useMemo(() => 
        (objectives || []).filter(o => o.metadata?.isSleeping === true), 
    [objectives]);
    const archivedObjectives = useMemo(() => 
        (objectives || []).filter(o => o.metadata?.isArchived === true), 
    [objectives]);
    const anyBurnoutRisk = useMemo(() => 
        (objectives || []).some(o => o.metadata?.burnoutRisk === true), 
    [objectives]);

    const [activeId, setActiveId] = useState(null);
    const [challengeDismissed, setChallengeDismissed] = useState(false);
    const [activeChallengeHighlight, setActiveChallengeHighlight] = useState(null);

    // Dnd-kit Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    // Independent Memoized Values
    const isNoveltySprint = skill?.metadata?.pinchState === 'NOVELTY';
    const unexploredAspectIds = useMemo(() => {
        if (!isNoveltySprint || !skill?.id) return [];
        
        // Get aspects that belong to active objectives of this skill
        const aspects = getChildren(id, NodeTypes.ASPECT);
        
        const unexplored = aspects.filter(a => {
            const aspectTasks = getChildren(a.id, NodeTypes.TASK);
            if (aspectTasks.length === 0) return false;
            return !aspectTasks.some(t => t.metadata?.status === TaskStatuses.DONE);
        });
        
        return unexplored.slice(0, 2).map(a => a.id);
    }, [isNoveltySprint, skill?.id, id, getChildren]);

    const isChallengeState = skill?.metadata?.pinchState === 'CHALLENGE';
    const challengeInfo = useMemo(() => {
        let masteryCheckTaskId = null;
        let newAngleTaskId = null;
        let showChallengeCard = false;

        if (isChallengeState && !challengeDismissed) {
            const activeObj = (objectives || []).find(o => !o.metadata?.isSleeping);
            if (activeObj) {
                const aspects = (allNodes || []).filter(n => n.type === NodeTypes.ASPECT && n.parentId === activeObj.id);
                let bestProgress = -1;
                let worstProgress = 2;

                aspects.forEach(a => {
                    const aTasks = (allNodes || []).filter(n => n.parentId === a.id && n.type === NodeTypes.TASK);
                    if (aTasks.length > 0) {
                        const sortedTasks = [...aTasks].sort((t1, t2) => (t1.metadata?.orderIndex || 0) - (t2.metadata?.orderIndex || 0));
                        const incomplete = sortedTasks.filter(t => t.metadata?.status !== TaskStatuses.DONE);

                        if (incomplete.length > 0) {
                            const firstInc = incomplete[0];
                            const progress = (aTasks.length - incomplete.length) / aTasks.length;

                            if (progress >= bestProgress) {
                                bestProgress = progress;
                                masteryCheckTaskId = firstInc.id;
                            }
                            if (progress < worstProgress) {
                                worstProgress = progress;
                                newAngleTaskId = firstInc.id;
                            }
                        }
                    }
                });
                if (masteryCheckTaskId === newAngleTaskId) newAngleTaskId = null;
                if (masteryCheckTaskId) showChallengeCard = true;
            }
        }
        return { masteryCheckTaskId, newAngleTaskId, showChallengeCard };
    }, [isChallengeState, challengeDismissed, objectives, allNodes]);

    const { masteryCheckTaskId, newAngleTaskId, showChallengeCard } = challengeInfo;

    const suggestions = useMemo(() => {
        if (!allNodes.length) return [];
        const tasks = allNodes.filter(n => n.type === NodeTypes.TASK);
        if (!tasks.length) return [];

        const nextTasks = [];
        let latestSessionTime = 0;
        let latestTaskId = null;

        tasks.forEach(t => {
            const sessions = t.metadata?.sessions || [];
            sessions.forEach(s => {
                if (s.status === 'completed' && s.endTime > latestSessionTime) {
                    latestSessionTime = s.endTime;
                    latestTaskId = t.id;
                }
            });
        });

        if (latestTaskId) {
            const latestTask = allNodes.find(n => n.id === latestTaskId);
            const aspect = allNodes.find(n => n.id === latestTask.parentId);
            if (aspect) {
                const aspectTasks = allNodes.filter(n => n.parentId === aspect.id && n.type === NodeTypes.TASK)
                    .sort((a, b) => (a.metadata?.orderIndex || 0) - (b.metadata?.orderIndex || 0));

                const nextIncompleteInAspect = aspectTasks.find(t => t.metadata?.status !== TaskStatuses.DONE);
                if (nextIncompleteInAspect) {
                    let skillParent = allNodes.find(n => n.id === aspect.parentId);
                    while (skillParent && skillParent.type !== NodeTypes.SKILL) {
                        skillParent = allNodes.find(n => n.id === skillParent?.parentId);
                    }

                    nextTasks.push({
                        task: nextIncompleteInAspect,
                        type: 'MOMENTUM',
                        label: `Continue: ${nextIncompleteInAspect.name} (Momentum)`,
                        skillId: skillParent?.id
                    });
                }
            }
        }

        const aspects = allNodes.filter(n => n.type === NodeTypes.ASPECT);
        const aspectProgress = aspects.map(a => {
            const aspectTasks = allNodes.filter(n => n.parentId === a.id && n.type === NodeTypes.TASK);
            if (aspectTasks.length === 0) return { aspect: a, progress: 0, nextTask: null };

            const completedCount = aspectTasks.filter(t => t.metadata?.status === TaskStatuses.DONE).length;
            const progress = completedCount / aspectTasks.length;
            const nextTask = aspectTasks
                .sort((a, b) => (a.metadata?.orderIndex || 0) - (b.metadata?.orderIndex || 0))
                .find(t => t.metadata?.status !== TaskStatuses.DONE);

            return { aspect: a, progress, nextTask, completedCount, totalCount: aspectTasks.length };
        }).filter(ap => ap.nextTask && ap.progress < 1).sort((a, b) => b.progress - a.progress);

        if (aspectProgress.length > 0) {
            const best = aspectProgress[0];
            if (!nextTasks.some(nt => nt.task.id === best.nextTask.id)) {
                let skillParent = allNodes.find(n => n.id === best.aspect.parentId);
                while (skillParent && skillParent.type !== NodeTypes.SKILL) {
                    skillParent = allNodes.find(n => n.id === skillParent?.parentId);
                }

                nextTasks.push({
                    task: best.nextTask,
                    type: 'COMPLETION',
                    label: `Focus: ${best.nextTask.name} (${best.completedCount}/${best.totalCount} logs)`,
                    skillId: skillParent?.id
                });
            }
        }

        habits.filter(h => h.isActive).forEach(h => {
            const isCompletedToday = h.lastCompletedAt &&
                new Date(h.lastCompletedAt).toDateString() === new Date().toDateString();

            if (!isCompletedToday) {
                nextTasks.push({
                    habit: h,
                    type: 'HABIT',
                    label: `Habit: ${h.ifTrigger} (Active)`,
                    skillId: id
                });
            }
        });

        return nextTasks.slice(0, 3);
    }, [allNodes, habits, id]);

    const fetchSkills = useCallback(async () => {
        const nodes = await repository.getAll();
        console.log("SkillPage fetch - allNodes count:", nodes?.length);
        const sortedNodes = [...(nodes || [])].sort((a, b) => (a.metadata?.orderIndex || 0) - (b.metadata?.orderIndex || 0));
        setAllNodes(sortedNodes);

        const skillNode = sortedNodes.find(n => n.id === id);
        if (skillNode) {
            setSkill(skillNode);
            const skillObjectives = sortedNodes.filter(n => n.parentId === id && n.type === NodeTypes.OBJECTIVE);
            setObjectives(skillObjectives);

            const inProgress = skillObjectives.find(obj => obj.metadata?.isActive === true);
            if (inProgress && expandedObjectiveIds.length === 0 && !loading) {
                console.log("Auto-expanding active experiment:", inProgress.id);
                setExpandedObjectiveIds([inProgress.id]);
            }

            const allRepoHabits = habitService.getAllHabits();
            const todayStr = new Date().toDateString();

            const matchedHabits = allRepoHabits.filter(h =>
                (h.linkedSkillIds && h.linkedSkillIds.includes(id)) ||
                h.linkedSkillId === id
            ).sort((a, b) => {
                const aCompleted = a.lastCompletedAt && new Date(a.lastCompletedAt).toDateString() === todayStr;
                const bCompleted = b.lastCompletedAt && new Date(b.lastCompletedAt).toDateString() === todayStr;
                if (aCompleted && !bCompleted) return 1;
                if (!aCompleted && bCompleted) return -1;
                return 0;
            });
            setHabits(matchedHabits);
        } else {
            console.log("SkillPage fetch - Skill node not found for ID:", id);
            setSkill(null);
            setObjectives([]);
            setHabits([]);
        }
    }, [id, expandedObjectiveIds, loading]);

    const fetchData = useCallback(async () => {
        try {
            await fetchSkills();
        } catch (error) {
            console.error("Failed to fetch skill hierarchy:", error);
        } finally {
            setLoading(false);
        }
    }, [fetchSkills]);

    const debouncedUpdateBecoming = useMemo(() => {
        let timeout;
        return (val) => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                if (!skill?.id) return;
                setIsSyncingBecoming(true);
                try {
                    await backbone.updateNode(skill.id, {
                        metadata: { ...skill.metadata, identityAnchor: val }
                    });
                } finally {
                    setIsSyncingBecoming(false);
                }
            }, 800); 
        };
    }, [skill?.id, skill?.metadata]);

    const handleCreateObjective = useCallback(async (e) => {
        if (e && e.key !== 'Enter' && e.type !== 'click') return;

        const name = newObjectiveName.trim();
        const theme = newObjectiveTheme.trim();
        const mve = newObjectiveMVE.trim();
        const duration = parseInt(newObjectiveDuration);
        const accType = newObjectiveAccType;

        if (!name || !theme || !mve || isNaN(duration) || !accType) {
            return;
        }

        try {
            await backbone.addNode({
                type: NodeTypes.OBJECTIVE,
                parentId: id,
                name: name,
                metadata: {
                    status: ObjectiveStatuses.ACTIVE,
                    isActive: true,
                    isSleeping: false,
                    isArchived: false,
                    activatedAt: Date.now(),
                    theme,
                    durationInDays: duration,
                    accumulationType: accType,
                    mve,
                    wish: newObjectiveWish.trim(),
                    outcome: newObjectiveOutcome.trim(),
                    iconUrl: newObjectiveIconUrl.trim(),
                    masterAccumulatedMetric: 0
                }
            });
            setNewObjectiveName('');
            setNewObjectiveTheme('');
            setNewObjectiveMVE('');
            setNewObjectiveWish('');
            setNewObjectiveOutcome('');
            setNewObjectiveIconUrl('');
            setIsCreatingObjective(false);
            fetchData();
        } catch (error) {
            console.error("Failed to create objective:", error);
        }
    }, [newObjectiveName, newObjectiveTheme, newObjectiveMVE, newObjectiveDuration, newObjectiveAccType, newObjectiveWish, newObjectiveOutcome, newObjectiveIconUrl, id]);

    const handleStartEditObjective = useCallback((obj) => {
        setEditingObjectiveId(obj.id);
        setObjectiveEditForm({
            theme: obj.metadata?.theme || '',
            durationInDays: obj.metadata?.durationInDays || 30,
            accumulationType: obj.metadata?.accumulationType || 'minutes',
            mve: obj.metadata?.mve || '',
            wish: obj.metadata?.wish || '',
            outcome: obj.metadata?.outcome || '',
            iconUrl: obj.metadata?.iconUrl || ''
        });
    }, []);

    const handleSaveObjectiveEdit = useCallback(async (objId) => {
        if (!objectiveEditForm) return;
        try {
            await backbone.updateNode(objId, {
                metadata: {
                    ...allNodes.find(n => n.id === objId)?.metadata,
                    ...objectiveEditForm
                }
            });
            setEditingObjectiveId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to save objective edit:", error);
        }
    }, [objectiveEditForm, allNodes]);

    const handleInlineSaveWish = useCallback((objId) => {
        const obj = allNodes.find(n => n.id === objId);
        if (!obj) return;

        setAllNodes(prev => prev.map(n => 
            n.id === objId 
                ? { ...n, metadata: { ...n.metadata, wish: tempWish }, updatedAt: new Date().toISOString() } 
                : n
        ));
        setInlineEditingWishId(null);

        backbone.updateNode(objId, {
            metadata: { ...obj.metadata, wish: tempWish }
        }).catch(error => {
            console.error("Failed to save wish inline:", error);
            fetchData();
        });
    }, [allNodes, tempWish]);

    const handleInlineSaveOutcome = useCallback((objId) => {
        const obj = allNodes.find(n => n.id === objId);
        if (!obj) return;

        setAllNodes(prev => prev.map(n => 
            n.id === objId 
                ? { ...n, metadata: { ...n.metadata, outcome: tempOutcome }, updatedAt: new Date().toISOString() } 
                : n
        ));
        setInlineEditingOutcomeId(null);

        backbone.updateNode(objId, {
            metadata: { ...obj.metadata, outcome: tempOutcome }
        }).catch(error => {
            console.error("Failed to save outcome inline:", error);
            fetchData();
        });
    }, [allNodes, tempOutcome]);

    const handleDeleteObjective = useCallback((obj) => {
        setObjectiveToDelete(obj);
    }, []);

    const confirmDeleteObjective = useCallback(async () => {
        if (!objectiveToDelete) return;
        const idToDelete = objectiveToDelete.id;
        setObjectiveToDelete(null);
        try {
            await backbone.deleteNode(idToDelete);
            setEditingObjectiveId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to delete objective:", error);
        }
    }, [objectiveToDelete]);

    const handleDeleteLog = useCallback(async (aspectId, logId) => {
        const aspect = allNodes.find(n => n.id === aspectId);
        if (!aspect) return;

        if (!window.confirm("Delete this log entry?")) return;

        const logs = aspect.metadata?.logs || [];
        const logToRemove = logs.find(l => l.id === logId);
        if (!logToRemove) return;

        const newLogs = logs.filter(l => l.id !== logId);
        const newMetric = (aspect.metadata?.accumulatedMetric || 0) - logToRemove.amount;
        const newCount = (aspect.metadata?.taskCount || 0) - 1;

        try {
            await backbone.updateNode(aspectId, {
                metadata: {
                    ...aspect.metadata,
                    logs: newLogs,
                    accumulatedMetric: Math.max(0, newMetric),
                    taskCount: Math.max(0, newCount)
                }
            });
            // Recalculate objective
            if (aspect.parentId) {
                await backbone.recalculateObjectiveAccumulation(aspect.parentId);
            }
            fetchData();
        } catch (error) {
            console.error("Failed to delete log:", error);
        }
    }, [allNodes]);


    const handleSuggestionClick = useCallback((suggestion) => {
        if (suggestion.habit) {
            const el = document.getElementById(`habit-${suggestion.habit.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('habit-highlight-pulse');
                setTimeout(() => el.classList.remove('habit-highlight-pulse'), 2000);
            }
            return;
        }

        const { task, skillId } = suggestion;

        // Optimistic UI update
        setAllNodes(prevNodes => prevNodes.map(n => {
            if (n.id === task.id) {
                return { 
                    ...n, 
                    metadata: { ...n.metadata, isToday: true } 
                };
            }
            return n;
        }));

        // Fire-and-forget backend update
        backbone.updateNode(task.id, {
            metadata: { ...task.metadata, isToday: true }
        }).catch(err => {
            console.error("Failed to add suggestion to today:", err);
            fetchData(); // Rollback/Sync on error
        });

        if (skillId === id) {
            const aspect = allNodes.find(n => n.id === task.parentId);
            const obj = allNodes.find(n => n.id === aspect?.parentId);
            if (obj) setExpandedObjectiveIds(prev => prev.includes(obj.id) ? prev : [...prev, obj.id]);
            if (aspect) setExpandedAspectIds(prev => prev.includes(aspect.id) ? prev : [...prev, aspect.id]);

            setTimeout(() => {
                const el = document.getElementById(`task-${task.id}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('task-highlight-pulse');
                    setTimeout(() => el.classList.remove('task-highlight-pulse'), 2000);
                }
            }, 300);
        } else {
            navigate(`/skill/${skillId}?scrollTo=${task.id}&markToday=true`);
        }
    }, [id, allNodes, navigate, fetchData]);


    const handleCreateAspect = useCallback(async (e, objId) => {
        if (e && e.key !== 'Enter' && e.type !== 'click') return;
        if (!newAspectName.trim()) return;

        try {
            await backbone.addNode({
                type: NodeTypes.ASPECT,
                parentId: objId,
                name: newAspectName.trim(),
                metadata: {}
            });
            setNewAspectName('');
            setCreatingAspectForObjId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to create aspect:", error);
        }
    }, [newAspectName, fetchData]);

    const handleCreateTask = useCallback(async (e, aspectId) => {
        if (e && e.key && e.key !== 'Enter') return;
        if (e && e.stopPropagation) e.stopPropagation();
        if (!newTaskName.trim()) return;

        const metadata = {
            status: TaskStatuses.NOT_STARTED,
            dependsOnTaskId: newTaskDependencyId || null,
            itemType: newTaskItemType
        };

        if (newTaskItemType === 'REPETITION') {
            metadata.unitName = newTaskUnitName;
            metadata.targetUnits = parseInt(newTaskTargetUnits) || 1;
            metadata.currentUnits = 0;
        }

        setNewTaskName('');
        setNewTaskDependencyId('');
        setNewTaskItemType('FINITE');
        setNewTaskUnitName('units');
        setNewTaskTargetUnits(1);
        setCreatingTaskForAspectId(null);

        backbone.addNode({
            type: NodeTypes.TASK,
            parentId: aspectId,
            name: newTaskName.trim(),
            metadata: {
                ...metadata,
                type: newTaskItemType
            }
        }).catch(error => {
            console.error("Failed to create task:", error);
            fetchData();
        });
    }, [newTaskName, newTaskDependencyId, newTaskItemType, newTaskUnitName, newTaskTargetUnits, fetchData]);

    const handleIncrementRepetition = useCallback((taskId) => {
        const task = allNodes.find(n => n.id === taskId);
        if (!task) return;

        const currentUnits = task.metadata?.currentUnits || 0;
        const targetUnits = task.metadata?.targetUnits || 0;
        const nextUnits = currentUnits + 1;

        const parentAspectId = task.parentId;
        const parentAspect = allNodes.find(n => n.id === parentAspectId);
        const ancestorObjectiveId = parentAspect?.parentId;
        const ancestorObjective = allNodes.find(n => n.id === ancestorObjectiveId);

        const shouldAccumulate = parentAspect && ancestorObjective?.metadata?.accumulationType === 'reps';

        setAllNodes(prevNodes => {
            const updatedNodes = prevNodes.map(n => {
                if (n.id === taskId) {
                    const updatedMetadata = {
                        ...n.metadata,
                        currentUnits: nextUnits
                    };
                    if (nextUnits >= targetUnits && targetUnits > 0) {
                        updatedMetadata.status = TaskStatuses.DONE;
                        updatedMetadata.completedAt = Date.now();
                    }

                    return {
                        ...n,
                        metadata: updatedMetadata
                    };
                }
                return n;
            });

            if (shouldAccumulate) {
                const afterAspectUpdate = updatedNodes.map(n => {
                    if (n.id === parentAspectId) {
                        return {
                            ...n,
                            metadata: {
                                ...n.metadata,
                                accumulatedMetric: (n.metadata?.accumulatedMetric || 0) + 1,
                                taskCount: (n.metadata?.taskCount || 0) + 1
                            }
                        };
                    }
                    return n;
                });

                const childAspects = afterAspectUpdate.filter(n => n.parentId === ancestorObjectiveId && n.type === NodeTypes.ASPECT);
                const totalMetric = childAspects.reduce((sum, a) => sum + (a.metadata?.accumulatedMetric || 0), 0);

                return afterAspectUpdate.map(n => {
                    if (n.id === ancestorObjectiveId) {
                        return {
                            ...n,
                            metadata: {
                                ...n.metadata,
                                masterAccumulatedMetric: totalMetric
                            }
                        };
                    }
                    return n;
                });
            }

            return updatedNodes;
        });

        backbone.incrementTaskRepetition(taskId)
            .catch(error => {
                console.error("Failed to increment repetition:", error);
                fetchData();
            });
    }, [allNodes, fetchData]);

    const handleToggleTaskStatus = useCallback((task) => {
        const currentStatus = task.metadata?.status || TaskStatuses.NOT_STARTED;
        const nextStatus = currentStatus === TaskStatuses.DONE ? TaskStatuses.NOT_STARTED : TaskStatuses.DONE;
        const completedAt = nextStatus === TaskStatuses.DONE ? Date.now() : null;

        setAllNodes(prevNodes => prevNodes.map(n => {
            if (n.id === task.id) {
                return {
                    ...n,
                    updatedAt: new Date().toISOString(),
                    metadata: {
                        ...n.metadata,
                        status: nextStatus,
                        completedAt
                    }
                };
            }
            return n;
        }));

        backbone.updateNode(task.id, {
            metadata: {
                ...task.metadata,
                status: nextStatus,
                completedAt
            }
        }).catch(error => {
            console.error("Failed to toggle task status:", error);
            fetchData();
        });
    }, [fetchData]);

    const handleAddToToday = useCallback((e, taskId) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        const task = allNodes.find(n => n.id === taskId);
        if (!task) return;

        const isToday = !!task.metadata?.isToday;

        setAllNodes(prevNodes => prevNodes.map(n => {
            if (n.id === taskId) {
                return {
                    ...n,
                    metadata: {
                        ...n.metadata,
                        isToday: !isToday
                    }
                };
            }
            return n;
        }));

        backbone.updateNode(taskId, {
            metadata: { isToday: !isToday }
        }).catch(error => {
            console.error("Failed to toggle today status:", error);
            fetchData();
        });
    }, [allNodes, fetchData]);

    const handleDeleteTask = useCallback(async () => {
        if (!taskToDelete) return;
        const idToDelete = taskToDelete.id;
        setTaskToDelete(null);

        backbone.deleteNode(idToDelete)
            .then(() => {
                fetchData();
            })
            .catch(error => {
                console.error("Failed to delete task:", error);
                alert("Error deleting task: " + error.message);
                fetchData();
            });
    }, [taskToDelete, fetchData]);

    const handleDeleteAspect = useCallback(async () => {
        if (!aspectToDelete) return;
        const idToDelete = aspectToDelete.id;
        setAspectToDelete(null);

        try {
            await backbone.deleteNode(idToDelete);
            fetchData();
        } catch (error) {
            console.error("Failed to delete aspect:", error);
            alert("Error deleting aspect: " + error.message);
            fetchData();
        }
    }, [aspectToDelete, fetchData]);

    const handleTaskDragStart = useCallback((event) => {
        setDragActiveId(event.active.id);
    }, []);

    const handleDragOver = useCallback((event) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const activeTask = allNodes.find(n => n.id === activeId);
        if (!activeTask || activeTask.type !== NodeTypes.TASK) return;

        const overData = over.data.current;
        let overContainerId = null;

        if (overData?.type === 'ASPECT') {
            overContainerId = overId;
        } else if (overData?.type === 'TASK') {
            const overTask = allNodes.find(n => n.id === overId);
            overContainerId = overTask?.parentId;
        }

        setAllNodes(prev => {
            const activeIndex = prev.findIndex(n => n.id === activeId);
            const overIndex = prev.findIndex(n => n.id === overId);
            
            if (activeIndex === -1 || overIndex === -1) return prev;

            const reordered = arrayMove(prev, activeIndex, overIndex);
            return reordered.map(n => {
                if (n.id === activeId) return { ...n, parentId: overContainerId };
                return n;
            });
        });
    }, [allNodes]);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setDragActiveId(null);
        if (!over) return;

        const activeTaskId = active.id;
        const overId = over.id;

        const activeTask = allNodes.find(n => n.id === activeTaskId);
        if (!activeTask) return;

        const overData = over.data.current;
        let targetAspectId = null;
        let targetIndex = -1;

        if (overData?.type === 'ASPECT') {
            targetAspectId = overId;
            const targetTasks = getChildren(targetAspectId, NodeTypes.TASK);
            targetIndex = targetTasks.length;
        } else if (overData?.type === 'TASK') {
            const overTask = allNodes.find(n => n.id === overId);
            if (!overTask) return;
            targetAspectId = overTask.parentId;
            const targetTasks = getChildren(targetAspectId, NodeTypes.TASK);
            targetIndex = targetTasks.findIndex(t => t.id === overId);
        }

        const targetContainer = allNodes.find(n => n.id === targetAspectId);
        if (!targetContainer || (targetContainer.type !== NodeTypes.ASPECT && targetContainer.type !== NodeTypes.STAGE)) {
            console.warn("DnD Aborted: Invalid target container type", targetContainer?.type);
            return;
        }

        const sourceAspectId = activeTask.parentId;
        const currentTargetTasks = getChildren(targetAspectId, NodeTypes.TASK);
        const currentSourceTasks = getChildren(sourceAspectId, NodeTypes.TASK);

        let reorderedNodes = [];

        if (targetAspectId === sourceAspectId) {
            const oldIndex = currentTargetTasks.findIndex(t => t.id === activeTaskId);
            const newList = arrayMove(currentTargetTasks, oldIndex, targetIndex);
            
            reorderedNodes = newList.map((t, i) => ({
                ...t,
                metadata: { ...t.metadata, orderIndex: i }
            }));
        } else {
            const sourceTasks = currentSourceTasks.filter(t => t.id !== activeTaskId);
            const targetTasks = [...currentTargetTasks];
            
            targetTasks.splice(targetIndex, 0, { 
                ...activeTask, 
                parentId: targetAspectId 
            });

            const reindexedSource = sourceTasks.map((t, i) => ({ ...t, metadata: { ...t.metadata, orderIndex: i } }));
            const reindexedTarget = targetTasks.map((t, i) => ({ ...t, metadata: { ...t.metadata, orderIndex: i } }));
            
            reorderedNodes = [...reindexedSource, ...reindexedTarget];
        }

        setAllNodes(prev => {
            const otherNodes = prev.filter(n => !reorderedNodes.some(rn => rn.id === n.id));
            const aspectIndex = otherNodes.findIndex(n => n.id === targetAspectId);
            const insertIndex = aspectIndex !== -1 ? aspectIndex + 1 : 0;
            
            const newAll = [...otherNodes];
            newAll.splice(insertIndex, 0, ...reorderedNodes);
            return newAll;
        });
    }, [allNodes, getChildren]);

    const handleUpdateObjectiveMetadata = useCallback(async (objId, field, value) => {
        const obj = objectives.find(o => o.id === objId);
        if (!obj) return;

        try {
            await backbone.updateNode(objId, {
                metadata: {
                    ...obj.metadata,
                    [field]: value
                }
            });
            fetchData();
        } catch (error) {
            console.error(`Failed to update objective ${field}:`, error);
        }
    }, [objectives, fetchData]);

    const handleUpdateObjectiveName = useCallback(async (objId, name) => {
        try {
            await backbone.updateNode(objId, { name });
            fetchData();
        } catch (error) {
            console.error("Failed to update objective name:", error);
        }
    }, [fetchData]);

    const toggleObjective = useCallback((objId) => {
        setExpandedObjectiveIds(prev =>
            prev.includes(objId) ? prev.filter(id => id !== objId) : [...prev, objId]
        );
    }, []);

    const performObjectiveToggle = useCallback(async (obj) => {
        console.log("Experiment close attempt:", obj);
        console.log("experimentNode.id:", obj?.id);
        console.log("experimentNode.parentId:", obj?.parentId);
        console.log("experimentNode.type:", obj?.type);
        console.log("experimentNode.status:", obj?.metadata?.status);
        console.log("experimentNode.order:", obj?.metadata?.orderIndex);

        const isCurrentlyActive = obj.metadata?.isActive === true || (!obj.metadata?.isActive && !obj.metadata?.isSleeping && !obj.metadata?.isArchived);
        const nextIsActive = !isCurrentlyActive;
        const nextStatus = nextIsActive ? ObjectiveStatuses.ACTIVE : ObjectiveStatuses.SLEEPING;
        const now = Date.now();

        try {
            await backbone.updateNode(obj.id, {
                metadata: {
                    ...obj.metadata,
                    status: nextStatus,
                    isActive: nextStatus === 'ACTIVE',
                    isSleeping: nextStatus === 'SLEEPING',
                    isArchived: false,
                    [nextStatus === 'ACTIVE' ? 'activatedAt' : 'deactivatedAt']: now
                }
            });
            fetchData();
        } catch (error) {
            console.error("Failed to toggle objective status:", error);
        }
    }, [fetchData]);

    const handleToggleObjectiveStatus = useCallback(async (e, obj) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        const isCurrentlyActive = obj.metadata?.isActive === true || (!obj.metadata?.isActive && !obj.metadata?.isSleeping && !obj.metadata?.isArchived);

        if (!isCurrentlyActive) {
            const activeInSkill = objectives.filter(o => o.metadata?.isActive === true).length;
            if (activeInSkill >= 1) {
                setIsLimitModalOpen(true);
                return;
            }
        } else {
            const activatedAt = obj.metadata?.activatedAt;
            if (activatedAt) {
                const daysActive = Math.floor((Date.now() - activatedAt) / (24 * 60 * 60 * 1000));
                if (daysActive < 14) {
                    setPendingSleepObj(obj);
                    setIsConfirmSleepModalOpen(true);
                    return;
                }
            }
        }

        await performObjectiveToggle(obj);
    }, [objectives, performObjectiveToggle]);

    const handleChallengeAction = useCallback((type) => {
        if (type === 'MASTERY' && masteryCheckTaskId) {
            setActiveChallengeHighlight({ taskId: masteryCheckTaskId, type });
            const pId = (allNodes || []).find(n => n.id === masteryCheckTaskId)?.parentId;
            if (pId) {
                setExpandedAspectIds(prev => prev.includes(pId) ? prev : [...prev, pId]);
                setTimeout(() => {
                    const el = document.getElementById(`task-${masteryCheckTaskId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        } else if (type === 'NEW_ANGLE' && newAngleTaskId) {
            setActiveChallengeHighlight({ taskId: newAngleTaskId, type });
            const pId = (allNodes || []).find(n => n.id === newAngleTaskId)?.parentId;
            if (pId) {
                setExpandedAspectIds(prev => prev.includes(pId) ? prev : [...prev, pId]);
                setTimeout(() => {
                    const el = document.getElementById(`task-${newAngleTaskId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        } else if (type === 'DISMISS') {
            setChallengeDismissed(true);
            setActiveChallengeHighlight(null);
        }
    }, [masteryCheckTaskId, newAngleTaskId, allNodes]);

    const handleLogAspectAccumulation = useCallback((aspectId, amount) => {
        const val = parseFloat(amount);
        if (isNaN(val)) return;

        const aspect = allNodes.find(n => n.id === aspectId);
        if (!aspect) return;

        const objectiveId = aspect.parentId;

        const newLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: 'Manual Log',
            amount: val,
            timestamp: Date.now()
        };

        setAllNodes(prevNodes => {
            const updatedNodes = prevNodes.map(n => {
                if (n.id === aspectId) {
                    return {
                        ...n,
                        metadata: {
                            ...n.metadata,
                            accumulatedMetric: (n.metadata?.accumulatedMetric || 0) + val,
                            taskCount: (n.metadata?.taskCount || 0) + 1,
                            logs: [...(n.metadata?.logs || []), newLog]
                        }
                    };
                }
                return n;
            });

            if (objectiveId) {
                const childAspects = updatedNodes.filter(n => n.parentId === objectiveId && n.type === NodeTypes.ASPECT);
                const totalMetric = childAspects.reduce((sum, a) => sum + (a.metadata?.accumulatedMetric || 0), 0);

                return updatedNodes.map(n => {
                    if (n.id === objectiveId) {
                        return {
                            ...n,
                            metadata: {
                                ...n.metadata,
                                masterAccumulatedMetric: totalMetric
                            }
                        };
                    }
                    return n;
                });
            }

            return updatedNodes;
        });

        (async () => {
            try {
                const currentAspect = allNodes.find(n => n.id === aspectId);
                await backbone.updateNode(aspectId, {
                    metadata: {
                        ...currentAspect.metadata,
                        accumulatedMetric: (currentAspect.metadata?.accumulatedMetric || 0) + val,
                        taskCount: (currentAspect.metadata?.taskCount || 0) + 1,
                        logs: [...(currentAspect.metadata?.logs || []), newLog]
                    }
                });
                if (objectiveId) {
                    await backbone.recalculateObjectiveAccumulation(objectiveId);
                }
            } catch (error) {
                console.error("Failed to log accumulation:", error);
                fetchData();
            }
        })();
    }, [allNodes, fetchData]);

    const handleUpdateAspectNotes = useCallback(async (aspectId, notes) => {
        const aspect = allNodes.find(n => n.id === aspectId);
        if (!aspect) return;
        try {
            await backbone.updateNode(aspectId, {
                metadata: { ...aspect.metadata, notes }
            });
            fetchData();
        } catch (error) {
            console.error("Failed to update aspect notes:", error);
        }
    }, [allNodes, fetchData]);

    const toggleAspect = useCallback((aspectId) => {
        setExpandedAspectIds(prev =>
            prev.includes(aspectId) ? prev.filter(id => id !== aspectId) : [...prev, aspectId]
        );
    }, []);

    const toggleTask = useCallback((taskId) => {
        setExpandedTaskIds(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    }, []);

    const handleAttachReward = useCallback(async (taskId, rewardId) => {
        try {
            const task = allNodes.find(n => n.id === taskId);
            await backbone.updateNode(taskId, {
                metadata: { ...task.metadata, rewardId }
            });
            setIsSelectingRewardForTaskId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to attach reward:", error);
        }
    }, [allNodes, fetchData]);

    const handleRemoveReward = useCallback(async (taskId) => {
        try {
            const task = allNodes.find(n => n.id === taskId);
            await backbone.updateNode(taskId, {
                metadata: { ...task.metadata, rewardId: null }
            });
            fetchData();
        } catch (error) {
            console.error("Failed to remove reward:", error);
        }
    }, [allNodes, fetchData]);

    const toggleShowMore = useCallback((e, stageId) => {
        e.stopPropagation();
        setAspectShowMoreIds(prev =>
            prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]
        );
    }, []);

    const handleReorderTasks = useCallback(async (newTasks, stageId) => {
        try {
            await Promise.all(newTasks.map((task, index) => {
                if (task.metadata?.orderIndex !== index) {
                    return backbone.updateNode(task.id, {
                        metadata: { ...task.metadata, orderIndex: index }
                    });
                }
                return Promise.resolve();
            }));
            fetchData();
        } catch (error) {
            console.error("Failed to reorder tasks:", error);
        }
    }, [fetchData]);

    const handleStartInlineEdit = useCallback((nodeId, currentName) => {
        setInlineEditingNodeId(nodeId);
        setInlineDraftName(currentName);
    }, []);

    const handleSaveInlineEdit = useCallback(async (nodeId) => {
        if (!inlineEditingNodeId) return;
        const trimmed = inlineDraftName.trim();
        if (trimmed && trimmed !== (nodeId === id ? skill?.name : allNodes.find(n => n.id === nodeId)?.name)) {
            try {
                await backbone.updateNode(nodeId, { name: trimmed });
                fetchData();
            } catch (err) {
                console.error("Failed to rename node:", err);
            }
        }
        setInlineEditingNodeId(null);
    }, [inlineEditingNodeId, inlineDraftName, id, skill, allNodes, fetchData]);

    const handleInlineKeyDown = useCallback((e, nodeId) => {
        if (e.key === 'Enter') {
            handleSaveInlineEdit(nodeId);
        } else if (e.key === 'Escape') {
            setInlineEditingNodeId(null);
        }
    }, [handleSaveInlineEdit]);

    useEffect(() => {
        if (inlineEditingNodeId && inlineInputRef.current) {
            inlineInputRef.current.focus();
            inlineInputRef.current.select();
        }
    }, [inlineEditingNodeId]);


    const handleOpenEvolution = useCallback((habit) => {
        setActiveHabitForEvolution(habit);
    }, []);

    const handleToggleHabitActive = useCallback(async (h) => {
        await habitService.updateHabit(h.id, { isActive: !h.isActive });
        fetchData();
    }, [fetchData]);

    const handleCreateHabit = useCallback(async (e) => {
        if (e && e.key && e.key !== 'Enter') return;
        if (!newHabitTrigger.trim() || !newHabitAction.trim()) return;

        try {
            await habitService.createHabit(
                id,
                newHabitTrigger.trim(),
                newHabitAction.trim()
            );
            setNewHabitTrigger('');
            setNewHabitAction('');
            setIsCreatingHabit(false);
            fetchData();
        } catch (error) {
            console.error("Failed to create habit:", error);
        }
    }, [newHabitTrigger, newHabitAction, id, fetchData]);

    const getObjectiveTimeInfo = useCallback((obj) => {
        const m = obj.metadata || {};
        const isActive = m.isActive === true || (!m.isActive && !m.isSleeping && !m.isArchived);
        if (!isActive || !m.activatedAt) return null;

        const now = Date.now();
        const diff = now - obj.metadata.activatedAt;
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        const displayDays = days + 1;

        let phase = '';
        let hint = '';

        if (displayDays <= 14) phase = 'Early Phase';
        else if (displayDays <= 45) phase = 'Deep Phase';
        else if (displayDays <= 60) phase = 'Late Phase';
        else hint = 'Consider rotating or refreshing this Objective.';

        return { days: displayDays, rawDays: days, phase, hint };
    }, []);

    // Effects
    useEffect(() => {
        const init = async () => {
            await backbone.checkExpirations();
            fetchData();
        };
        init();
        const sub1 = repository.subscribe(() => {
            if (!isReorderingRef.current) {
                fetchData();
            }
        });
        return () => sub1();
    }, [fetchData, id]);

    useEffect(() => {
        if (skill?.metadata?.identityAnchor !== undefined) {
            setTempBecoming(skill.metadata.identityAnchor || '');
        }
    }, [skill?.id, skill?.metadata?.identityAnchor]);

    useEffect(() => {
        if (creatingTaskForAspectId && taskNameInputRef.current) {
            setTimeout(() => taskNameInputRef.current.focus(), 50);
        }
    }, [creatingTaskForAspectId]);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const scrollToId = queryParams.get('scrollTo');
        const mkToday = queryParams.get('markToday');

        if (!loading && scrollToId && allNodes.length > 0) {
            const targetTask = allNodes.find(n => n.id === scrollToId);
            if (targetTask) {
                if (mkToday === 'true' && !targetTask.metadata?.isToday) {
                    handleAddToToday(null, targetTask.id);
                }

                const aspect = allNodes.find(n => n.id === targetTask.parentId);
                if (aspect) {
                    const obj = allNodes.find(n => n.id === aspect.parentId);
                    if (obj) {
                        setExpandedObjectiveIds(prev => prev.includes(obj.id) ? prev : [...prev, obj.id]);
                        setExpandedAspectIds(prev => prev.includes(aspect.id) ? prev : [...prev, aspect.id]);

                        setTimeout(() => {
                            const el = document.getElementById(`task-${scrollToId}`);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('task-highlight-pulse');
                                setTimeout(() => el.classList.remove('task-highlight-pulse'), 2000);
                            }
                        }, 500);
                    }
                }
            }
        }
    }, [loading, id, location.search, allNodes.length, handleAddToToday]);

    useEffect(() => {
        window.unexploredAspectIds = unexploredAspectIds;
    }, [unexploredAspectIds]);

    // DIAGNOSTIC LOGGING - Moved to useEffect for performance
    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            console.log("--- SkillPage Diagnostic ---");
            console.log("SkillPage skill:", skill);
            console.log("allNodes length:", allNodes?.length);
            console.log("activeObjectives:", activeObjectives);
            
            (activeObjectives || []).forEach((obj, index) => {
                console.log(`Active Experiment [${index}]:`, {
                    id: obj.id,
                    parentId: obj.parentId,
                    type: obj.type,
                    status: obj.metadata?.status,
                    order: obj.metadata?.orderIndex,
                    metadata: obj.metadata
                });
            });

            console.log("sleepingObjectives:", sleepingObjectives);
            console.log("archivedObjectives:", archivedObjectives);
            console.log("nodesByParent size:", nodesByParent?.size);
            console.log("loading:", loading);
            console.log("----------------------------");
        }
    }, [skill, allNodes.length, activeObjectives, sleepingObjectives, archivedObjectives, nodesByParent.size, loading]);

    if (loading) {
        return <div className="skill-page-loading">Loading Hierarchy...</div>;
    }
    if (!skill) {
        return <div className="skill-page-error">Skill not found.</div>;
    }


    const renderObjective = (obj) => {
        const isEditing = editingObjectiveId === obj.id;
        const isExpanded = expandedObjectiveIds.includes(obj.id);
        const isSleeping = obj.metadata?.isSleeping === true;
        const aspects = getChildren(obj.id, NodeTypes.ASPECT);
        const timeInfo = getObjectiveTimeInfo(obj);

        if (isEditing) {
            return (
                <div className="experiment-edit-container" key={obj.id}>
                    <div className="edit-grid">
                        <div className="edit-field">
                            <label>Experiment Title</label>
                            <input
                                className="edit-input"
                                value={obj.name}
                                onChange={(e) => handleUpdateObjectiveName(obj.id, e.target.value)}
                            />
                        </div>
                        <div className="edit-field">
                            <label>Theme</label>
                            <input
                                className="edit-input"
                                value={objectiveEditForm?.theme}
                                onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, theme: e.target.value })}
                            />
                        </div>
                        <div className="edit-field">
                            <label>Duration (Days)</label>
                            <input
                                type="number"
                                className="edit-input"
                                value={objectiveEditForm?.durationInDays}
                                onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, durationInDays: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="edit-field">
                            <label>Accumulation Unit</label>
                            <input
                                className="edit-input"
                                placeholder="eg: minutes, reps, pages..."
                                value={objectiveEditForm?.accumulationType}
                                onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, accumulationType: e.target.value })}
                            />
                        </div>
                        <div className="edit-field full-width">
                            <label>Minimum Viable Effort (MVE)</label>
                            <textarea
                                className="edit-textarea"
                                value={objectiveEditForm?.mve}
                                onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, mve: e.target.value })}
                            />
                        </div>
                        <div className="edit-field full-width">
                            <label>Wish</label>
                            <input
                                className="edit-input"
                                placeholder="What do I want?"
                                value={objectiveEditForm?.wish}
                                onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, wish: e.target.value })}
                            />
                        </div>
                        <div className="edit-field full-width">
                            <label>Outcome</label>
                            <input
                                className="edit-input"
                                placeholder="What does success look like?"
                                value={objectiveEditForm?.outcome}
                                onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, outcome: e.target.value })}
                            />
                        </div>
                        <div className="edit-field full-width">
                            <label>Icon URL (notionicons.so)</label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                    className="edit-input"
                                    placeholder="https://notionicons.so/icon/..."
                                    value={objectiveEditForm?.iconUrl}
                                    style={{ flex: 1 }}
                                    onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, iconUrl: e.target.value })}
                                />
                                {objectiveEditForm?.iconUrl && (
                                    <div className="icon-preview" style={{ width: '32px', height: '32px', background: 'var(--alpha-low)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)' }}>
                                        <img src={objectiveEditForm.iconUrl} alt="preview" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="edit-actions">
                        <div className="edit-left">
                            <button className="save-btn" onClick={() => handleSaveObjectiveEdit(obj.id)}>Save Changes</button>
                            <button className="cancel-btn" onClick={() => setEditingObjectiveId(null)}>Cancel</button>
                        </div>
                        <button className="delete-experiment-btn" onClick={() => handleDeleteObjective(obj)}>Delete Experiment</button>
                    </div>
                </div>
            );
        }

        return (
                <motion.div 
                    layout="position"
                    key={obj.id}
                    transition={macOSSpring}
                >
                    <div 
                        className={`objective-container ${isSleeping ? 'is-sleeping' : 'is-focused'} ${obj.metadata?.burnoutRisk ? 'burnout-risk-border' : ''}`}
                    >
                    <div className="objective-header" onClick={() => !isSleeping && toggleObjective(obj.id)}>
                        <div className="objective-header-left">
                            <span className={`objective-toggle-icon ${isExpanded && !isSleeping ? 'expanded' : ''}`}>
                                {isSleeping ? '💤' : (obj.metadata?.iconUrl ? <NodeIcon iconUrl={obj.metadata.iconUrl} size={18} /> : '‣')}
                            </span>
                            {inlineEditingNodeId === obj.id ? (
                                <input
                                    ref={inlineInputRef}
                                    value={inlineDraftName}
                                    onChange={e => setInlineDraftName(e.target.value)}
                                    onBlur={() => handleSaveInlineEdit(obj.id)}
                                    onKeyDown={e => handleInlineKeyDown(e, obj.id)}
                                    onClick={e => e.stopPropagation()}
                                    style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-primary)', color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none' }}
                                />
                            ) : (
                                <span className="objective-title-static" onDoubleClick={(e) => { e.stopPropagation(); handleStartInlineEdit(obj.id, obj.name); }}>{obj.name}</span>
                            )}
                            {!isSleeping && <span className="focus-pill">Active Experiment</span>}
                            {timeInfo && (
                                <div className="objective-time-badge">
                                    <span className="day-count">Day {timeInfo.days}</span>
                                    {obj.metadata?.durationInDays && (
                                        <span className="time-remaining"> / {obj.metadata.durationInDays}d</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="objective-status-actions">
                            {!isSleeping && (
                                <>
                                    <button
                                        className="edit-experiment-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleStartEditObjective(obj);
                                        }}
                                        style={{ marginRight: '10px' }}
                                    >
                                        Edit Experiment
                                    </button>
                                    <button
                                        className="delete-experiment-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleDeleteObjective(obj);
                                        }}
                                        style={{ marginRight: '10px' }}
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
                            <button
                                className={`obj-status-btn ${isSleeping ? 'activate' : 'sleep'}`}
                                onClick={(e) => {
                                    console.log("Experiment close clicked:", obj.id);
                                    console.log("Experiment node:", obj);
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleToggleObjectiveStatus(e, obj);
                                }}
                            >
                                {isSleeping ? 'Activate' : 'Put to Sleep'}
                            </button>
                        </div>
                    </div>
                        <AnimatePresence>
                            {isExpanded && !isSleeping && (
                                <motion.div 
                                    className="objective-content"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={macOSSpring}
                                    style={{ overflow: 'visible' }}
                                >
                                        <div className="experiment-display-card">
                                            <div className="experiment-display-header">
                                                <div className="experiment-display-info">
                                                    <span className="experiment-theme-badge">{obj.metadata?.theme || 'General'}</span>
                                                    <label className="show-completed-toggle-inline" style={{ 
                                                        marginLeft: '12px', 
                                                        fontSize: '11px', 
                                                        opacity: 0.6, 
                                                        cursor: 'pointer', 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '4px',
                                                        userSelect: 'none'
                                                    }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={showCompletedTasks} 
                                                            onChange={(e) => setShowCompletedTasks(e.target.checked)}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        Show completed
                                                    </label>
                                                    <div className="experiment-main-metric">
                                                        {obj.metadata?.masterAccumulatedMetric || 0} {obj.metadata?.accumulationType || 'units'}
                                                        <span style={{ fontSize: '14px', fontWeight: '400', opacity: '0.6', marginLeft: '10px' }}>Accumulated</span>
                                                    </div>
                                                </div>
                                                <div className="experiment-mve-preview">
                                                    <label className="mve-label">Minimum Viable Effort</label>
                                                    <div className="mve-text">{obj.metadata?.mve || 'No MVE defined.'}</div>
                                                </div>
                                            </div>
                                            {(!obj.metadata?.isArchived) && (
                                                <div className="woop-box">
                                                    <div className="woop-item" onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (inlineEditingWishId !== obj.id) {
                                                            setInlineEditingWishId(obj.id);
                                                            setTempWish(obj.metadata?.wish || '');
                                                        }
                                                    }}>
                                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Wish</label>
                                                        {inlineEditingWishId === obj.id ? (
                                                            <input
                                                                autoFocus
                                                                className="inline-edit-input"
                                                                style={{
                                                                    width: '100%',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    borderBottom: '1px solid var(--color-primary)',
                                                                    color: 'var(--text-primary)',
                                                                    fontSize: '14px',
                                                                    outline: 'none',
                                                                    padding: '2px 0'
                                                                }}
                                                                value={tempWish}
                                                                onChange={(e) => setTempWish(e.target.value)}
                                                                onBlur={() => handleInlineSaveWish(obj.id)}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleInlineSaveWish(obj.id)}
                                                            />
                                                        ) : (
                                                            <div style={{
                                                                fontSize: '14px',
                                                                color: obj.metadata?.wish ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                cursor: 'pointer',
                                                                minHeight: '20px',
                                                                fontStyle: obj.metadata?.wish ? 'normal' : 'italic'
                                                            }}>
                                                                {obj.metadata?.wish || "What do I want?"}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="woop-item" onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (inlineEditingOutcomeId !== obj.id) {
                                                            setInlineEditingOutcomeId(obj.id);
                                                            setTempOutcome(obj.metadata?.outcome || '');
                                                        }
                                                    }}>
                                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Outcome</label>
                                                        {inlineEditingOutcomeId === obj.id ? (
                                                            <input
                                                                autoFocus
                                                                className="inline-edit-input"
                                                                style={{
                                                                    width: '100%',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    borderBottom: '1px solid var(--color-primary)',
                                                                    color: 'var(--text-primary)',
                                                                    fontSize: '14px',
                                                                    outline: 'none',
                                                                    padding: '2px 0'
                                                                }}
                                                                value={tempOutcome}
                                                                onChange={(e) => setTempOutcome(e.target.value)}
                                                                onBlur={() => handleInlineSaveOutcome(obj.id)}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleInlineSaveOutcome(obj.id)}
                                                            />
                                                        ) : (
                                                            <div style={{
                                                                fontSize: '14px',
                                                                color: obj.metadata?.outcome ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                cursor: 'pointer',
                                                                minHeight: '20px',
                                                                fontStyle: obj.metadata?.outcome ? 'normal' : 'italic'
                                                            }}>
                                                                {obj.metadata?.outcome || "What does success look like?"}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
        
                                        <div className="aspects-section-header">
                                            <span className="section-subtitle">Engagement Aspects</span>
                                            <p className="aspects-helper-text">Aspects are parallel lenses of engagement inside this experiment.</p>
                                        </div>
                                        <div className="masonry-columns-wrapper" style={{ display: 'flex', gap: '24px', padding: '32px' }}>
                                            {(() => {
                                                const leftColumn = [];
                                                const rightColumn = [];
                                                let leftHeight = 0;
                                                let rightHeight = 0;
        
                                                aspects.forEach(aspect => {
                                                    const rawAspectTasks = getChildren(aspect.id, NodeTypes.TASK);
                                                    const aspectTasks = showCompletedTasks 
                                                        ? rawAspectTasks 
                                                        : rawAspectTasks.filter(t => t.metadata?.status !== TaskStatuses.DONE);
                                                        
                                                    const isUntouched = skill.metadata?.pinchState === 'INTEREST' &&
                                                        aspectTasks.length > 0 &&
                                                        !aspectTasks.some(t => t.metadata?.status === TaskStatuses.DONE);
        
                                                    const isNoveltyHighlighted = window.unexploredAspectIds?.includes(aspect.id);
                                                    const firstIncompleteTask = aspectTasks.find(t => t.metadata?.status !== TaskStatuses.DONE);
        
                                                    const visibleTasksCount = aspectShowMoreIds.includes(aspect.id) ? aspectTasks.length : Math.min(aspectTasks.length, 5);
                                                    const estimatedHeight = 110 + (visibleTasksCount * 45) + 30;
        
                                                    const aspectElement = (
                                                        <DroppableAspect
                                                            key={aspect.id}
                                                            aspect={aspect}
                                                            aspectTasks={aspectTasks}
                                                            isUntouched={isUntouched}
                                                            isNoveltyHighlighted={isNoveltyHighlighted}
                                                            isExpanded={aspectShowMoreIds.includes(aspect.id)}
                                                            isEditing={inlineEditingNodeId === aspect.id}
                                                            onToggleAspect={toggleAspect}
                                                        >
                                                            <div className="aspect-card-internal">
                                                                <div className="aspect-header">
                                                                    <div className="aspect-title-group">
                                                                        {inlineEditingNodeId === aspect.id ? (
                                                                            <input
                                                                                ref={inlineInputRef}
                                                                                autoFocus
                                                                                value={inlineDraftName}
                                                                                onChange={e => setInlineDraftName(e.target.value)}
                                                                                onBlur={() => handleSaveInlineEdit(aspect.id)}
                                                                                onKeyDown={e => handleInlineKeyDown(e, aspect.id)}
                                                                                onClick={e => e.stopPropagation()}
                                                                                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-accent)', color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none', width: '100%' }}
                                                                            />
                                                                        ) : (
                                                                            <span 
                                                                                className="aspect-name" 
                                                                                onClick={e => e.stopPropagation()}
                                                                                onDoubleClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();
                                                                                    handleStartInlineEdit(aspect.id, aspect.name);
                                                                                }}
                                                                                style={{ cursor: 'text', userSelect: 'none' }}
                                                                                title="Double-click to rename"
                                                                            >{aspect.name}</span>
                                                                        )}
                                                                        <span className="aspect-task-count">
                                                                            {aspect.metadata?.accumulatedMetric || 0} {obj.metadata?.accumulationType} &bull; {aspect.metadata?.taskCount || 0} logs
                                                                        </span>
                                                                    </div>
                                                                    <div className="aspect-header-right">
                                                                        {isNoveltyHighlighted && firstIncompleteTask && (
                                                                            <button
                                                                                className="novelty-sprint-btn"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();
                                                                                    navigate(`/focus?taskId=${firstIncompleteTask.id}&safeSession=true`);
                                                                                }}
                                                                            >
                                                                                Start 10-minute experiment
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            className="aspect-delete-btn"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                setAspectToDelete(aspect);
                                                                            }}
                                                                            title="Delete Aspect"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="aspect-tasks" onClick={e => e.stopPropagation()}>
                                                                    {(() => {
                                                                        const visibleTasks = aspectShowMoreIds.includes(aspect.id) 
                                                                            ? aspectTasks 
                                                                            : aspectTasks.slice(0, 5);
                                                                            
                                                                        return (
                                                                                <AnimatePresence>
                                                                                    {(visibleTasks || []).map(task => (
                                                                                        <SortableTaskRow 
                                                                                            key={task.id} 
                                                                                            task={task} 
                                                                                            allNodes={allNodes}
                                                                                            expandedTaskIds={expandedTaskIds}
                                                                                            activeChallengeHighlight={activeChallengeHighlight}
                                                                                            skill={skill}
                                                                                            onToggleTask={toggleTask}
                                                                                            onToggleTaskStatus={handleToggleTaskStatus}
                                                                                            onAddToToday={handleAddToToday}
                                                                                            onIncrementRepetition={handleIncrementRepetition}
                                                                                            onDeleteTask={setTaskToDelete}
                                                                                            isSelectingRewardForTaskId={isSelectingRewardForTaskId}
                                                                                            onSetSelectingRewardForTaskId={setIsSelectingRewardForTaskId}
                                                                                            onRemoveReward={handleRemoveReward}
                                                                                            onAttachReward={handleAttachReward}
                                                                                            />
                                                                                        ))}
                                                                                </AnimatePresence>
                                                                        );
                                                                    })()}
        
                                                                    {aspectTasks.length > 5 && (
                                                                        <div style={{ textAlign: 'center', marginTop: '4px' }}>
                                                                            <button
                                                                                className="show-all-tasks-btn"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setAspectShowMoreIds(prev => 
                                                                                        prev.includes(aspect.id) 
                                                                                            ? prev.filter(id => id !== aspect.id)
                                                                                            : [...prev, aspect.id]
                                                                                    );
                                                                                }}
                                                                                style={{
                                                                                    background: 'transparent',
                                                                                    border: 'none',
                                                                                    color: 'var(--text-secondary)',
                                                                                    fontSize: '11px',
                                                                                    fontWeight: '600',
                                                                                    cursor: 'pointer',
                                                                                    opacity: 0.7,
                                                                                    padding: '4px 8px',
                                                                                    transition: 'opacity 0.2s',
                                                                                }}
                                                                                onMouseEnter={e => e.target.style.opacity = 1}
                                                                                onMouseLeave={e => e.target.style.opacity = 0.7}
                                                                            >
                                                                                {aspectShowMoreIds.includes(aspect.id) ? 'Show fewer tasks' : 'Show all tasks'}
                                                                            </button>
                                                                        </div>
                                                                    )}
        
                                                                    <button
                                                                        className="add-task-btn"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setCreatingTaskForAspectId(aspect.id);
                                                                            setNewTaskItemType('FINITE');
                                                                        }}
                                                                    >
                                                                        + Add Task
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </DroppableAspect>
                                                    );
        
                                                    if (leftHeight <= rightHeight) {
                                                        leftColumn.push(aspectElement);
                                                        leftHeight += estimatedHeight;
                                                    } else {
                                                        rightColumn.push(aspectElement);
                                                        rightHeight += estimatedHeight;
                                                    }
                                                });
        
                                                const addAspectElement = creatingAspectForObjId === obj.id ? (
                                                    <motion.div layout="position" key="add-aspect-btn" className="aspect-card creation-card" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            autoFocus
                                                            className="inline-creation-input"
                                                            placeholder="Aspect name..."
                                                            value={newAspectName}
                                                            onChange={(e) => setNewAspectName(e.target.value)}
                                                            onKeyDown={(e) => handleCreateAspect(e, obj.id)}
                                                            onBlur={() => setCreatingAspectForObjId(null)}
                                                        />
                                                    </motion.div>
                                                ) : (
                                                    <motion.button
                                                        layout="position"
                                                        key="add-aspect-btn"
                                                        className="add-aspect-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCreatingAspectForObjId(obj.id);
                                                        }}
                                                        transition={macOSSpring}
                                                    >
                                                        + Add Aspect
                                                    </motion.button>
                                                );
        
                                                const addAspectHeight = 60;
                                                if (leftHeight <= rightHeight) {
                                                    leftColumn.push(addAspectElement);
                                                    leftHeight += addAspectHeight;
                                                } else {
                                                    rightColumn.push(addAspectElement);
                                                    rightHeight += addAspectHeight;
                                                }
        
                                                return (
                                                    <>
                                                        <div 
                                                            className="masonry-column" 
                                                            style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}
                                                        >
                                                            {leftColumn}
                                                        </div>
                                                        <div 
                                                            className="masonry-column" 
                                                            style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}
                                                        >
                                                            {rightColumn}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
        );
    };


    return (
        <div className={`skill-page ${isNoveltySprint ? 'novelty-sprint-glow' : ''}`}>
            {isNoveltySprint && (
                <div className="novelty-banner">
                    <span className="novelty-banner-icon">⚡</span>
                    <div>
                        <strong>Novelty Sprint Active</strong>
                        <div style={{ opacity: 0.8 }}>Exploring a new aspect of this skill</div>
                    </div>
                </div>
            )}

            {showChallengeCard && !activeChallengeHighlight && (
                <div className="challenge-opportunity-card">
                    <div className="challenge-content">
                        <div className="challenge-banner-icon">⚡</div>
                        <div>
                            <div className="challenge-card-title">Challenge Opportunity</div>
                            <div className="challenge-card-desc">You might be ready for something more difficult.</div>
                        </div>
                    </div>
                    <div className="challenge-card-actions">
                        {masteryCheckTaskId && (
                            <button className="challenge-action-btn mastery-btn" onClick={() => handleChallengeAction('MASTERY')}>
                                Continue with a harder task
                            </button>
                        )}
                        {newAngleTaskId && (
                            <button className="challenge-action-btn new-angle-btn" onClick={() => handleChallengeAction('NEW_ANGLE')}>
                                Try a more difficult aspect
                            </button>
                        )}
                        <button className="challenge-action-btn dismiss-btn" onClick={() => handleChallengeAction('DISMISS')}>
                            Not now
                        </button>
                    </div>
                </div>
            )}

            <button className="back-button" onClick={() => navigate(-1)}>
                <span>&larr;</span> Back to Area
            </button>

            <header className="skill-header">
                <div className="skill-header-main-row">
                    {inlineEditingNodeId === skill.id ? (
                        <input
                            ref={inlineInputRef}
                            value={inlineDraftName}
                            onChange={e => setInlineDraftName(e.target.value)}
                            onBlur={() => handleSaveInlineEdit(skill.id)}
                            onKeyDown={e => handleInlineKeyDown(e, skill.id)}
                            style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--color-primary)', color: 'inherit', fontSize: '32px', fontWeight: 800, outline: 'none' }}
                        />
                    ) : (
                        <h1 className="skill-title" onDoubleClick={() => handleStartInlineEdit(skill.id, skill.name)}>{skill.name}</h1>
                    )}
                    {skill.metadata?.pinchState === 'PASSION' && (
                        <span className="passion-core-badge">CORE</span>
                    )}
                </div>
                <div className="skill-identity-row">
                    <span className="identity-prefix">Becoming:</span>
                    <input
                        className="skill-identity-input"
                        placeholder="Define who you are becoming..."
                        value={tempBecoming}
                        onChange={(e) => {
                            const val = e.target.value;
                            setTempBecoming(val);
                            debouncedUpdateBecoming(val);
                        }}
                    />
                    {isSyncingBecoming && <span className="sync-indicator" style={{ fontSize: '10px', opacity: 0.5, marginLeft: '8px' }}>Saving...</span>}
                </div>
                <p className="skill-subtitle">Planning Mode &bull; Structural Map</p>
            </header>

            {/* INTEREST Mode: Suggested Experiments Placeholder */}
            {skill.metadata?.pinchState === 'INTEREST' && (
                <div className="suggested-experiments-container">
                    <h3 className="experiments-title">Suggested Experiments</h3>
                    <div className="experiments-placeholder">
                        Micro-experiments will appear here.
                    </div>
                </div>
            )}


            {/* Suggested Focus — hidden during Safe Mode */}
            {!anyBurnoutRisk && suggestions.length > 0 && (
                <div className="suggested-focus-section">
                    <span className="suggestions-label">Suggested Focus</span>
                    <div className="suggestions-list">
                        {(suggestions || []).map((s) => (
                            <button
                                key={s.task?.id || s.habit?.id}
                                className={`suggestion-chip ${s.type.toLowerCase()}`}
                                onClick={() => handleSuggestionClick(s)}
                            >
                                <span className="chip-icon">
                                    {s.type === 'MOMENTUM' ? '⚡' : s.type === 'HABIT' ? '🔄' : '🏁'}
                                </span>
                                <span className="chip-text">{s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* HABITS SECTION */}
            <section className="skill-section habits-skill-wrapper">
                <header className="section-header-row">
                    <span className="section-label">Habits</span>
                    {!isCreatingHabit && (
                        <button className="add-habit-trigger-btn" onClick={() => setIsCreatingHabit(true)}>+ Create Habit</button>
                    )}
                </header>

                {isCreatingHabit && (
                    <div className="habit-creation-inline">
                        <div className="creation-row">
                            <span className="creation-prefix">If</span>
                            <input
                                autoFocus
                                placeholder="Trigger event..."
                                value={newHabitTrigger}
                                onChange={e => setNewHabitTrigger(e.target.value)}
                            />
                            <span className="creation-prefix">Then</span>
                            <input
                                placeholder="MVE Action..."
                                value={newHabitAction}
                                onChange={e => setNewHabitAction(e.target.value)}
                                onKeyDown={handleCreateHabit}
                            />
                        </div>
                        <div className="creation-actions">
                            <button className="confirm-btn" onClick={() => handleCreateHabit(null)}>Add Habit (MVE)</button>
                            <button className="cancel-btn" onClick={() => setIsCreatingHabit(false)}>Cancel</button>
                        </div>
                    </div>
                )}

                <div className="habits-grid">
                    {(habits || []).length > 0 ? (
                        (habits || []).map(habit => (
                            <HabitCard
                                key={habit.id}
                                habit={habit}
                                onOpenEvolution={handleOpenEvolution}
                                onToggleActive={handleToggleHabitActive}
                            />
                        ))
                    ) : !isCreatingHabit && (
                        <div className="no-habits-message">No habits established for this skill.</div>
                    )}
                </div>
            </section>

            {/* EVOLUTION DRILL-IN (Modal) */}
            {activeHabitForEvolution && (
                <EvolutionDrillIn
                    habit={activeHabitForEvolution}
                    skill={skill}
                    onClose={() => setActiveHabitForEvolution(null)}
                    onRefresh={fetchData}
                />
            )}

            {activeObjectives.length > 0 && (
                <section className="skill-section active-experiments-section">
                    <span className="section-label">Active Experiments</span>
                    <LayoutGroup id="active-objectives">
                        <div className="active-experiments-list">
                            {(activeObjectives || []).map(obj => renderObjective(obj))}
                        </div>
                    </LayoutGroup>
                </section>
            )}

            {sleepingObjectives.length > 0 && (
                <section className="skill-section sleeping-section">
                    <header
                        className="section-header-row collapsible"
                        onClick={() => setIsSleepingExpanded(!isSleepingExpanded)}
                    >
                        <span className="section-label">
                            Sleeping Experiments ({sleepingObjectives.length})
                        </span>
                        <span className={`collapse-arrow ${isSleepingExpanded ? 'expanded' : ''}`}>
                            {isSleepingExpanded ? '▼' : '▶'}
                        </span>
                    </header>

                    {isSleepingExpanded && (
                        <LayoutGroup id="sleeping-objectives">
                            <div className="sleeping-content">
                                {(sleepingObjectives || []).map(renderObjective)}
                            </div>
                        </LayoutGroup>
                    )}
                </section>
            )}

            {/* Experiment Creation Zone */}
            <section className="skill-section creation-section">
                {isCreatingObjective ? (
                    <div className="objective-creation-form">
                        <div className="creation-row">
                            <input
                                autoFocus
                                placeholder="Experiment Title..."
                                value={newObjectiveName}
                                onChange={e => setNewObjectiveName(e.target.value)}
                                className="form-input title-input"
                            />
                        </div>
                        <div className="creation-row">
                            <input
                                placeholder="Theme (e.g. Speed, Quality, Joy)..."
                                value={newObjectiveTheme}
                                onChange={e => setNewObjectiveTheme(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="creation-row meta-row">
                            <div className="input-group">
                                <label>Duration (Days)</label>
                                <input
                                    type="number"
                                    min="14" max="60"
                                    value={newObjectiveDuration}
                                    onChange={e => setNewObjectiveDuration(e.target.value)}
                                    className="form-input num-input"
                                />
                            </div>
                            <div className="input-group">
                                <label>Accumulation Unit</label>
                                <input
                                    type="text"
                                    placeholder="e.g. reps, minutes, pages..."
                                    value={newObjectiveAccType}
                                    onChange={e => setNewObjectiveAccType(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                        </div>
                        <div className="creation-row">
                            <textarea
                                placeholder="Minimum Viable Effort (MVE)..."
                                value={newObjectiveMVE}
                                onChange={e => setNewObjectiveMVE(e.target.value)}
                                className="form-input text-area"
                            />
                        </div>
                        <div className="creation-row">
                            <input
                                placeholder="Wish (What do I want?)"
                                value={newObjectiveWish}
                                onChange={e => setNewObjectiveWish(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="creation-row">
                            <input
                                placeholder="Outcome (What does success look like?)"
                                value={newObjectiveOutcome}
                                onChange={e => setNewObjectiveOutcome(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="creation-row" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                                placeholder="Icon URL (e.g. notionicons.so)"
                                value={newObjectiveIconUrl}
                                onChange={e => setNewObjectiveIconUrl(e.target.value)}
                                className="form-input"
                                style={{ flex: 1 }}
                            />
                            {newObjectiveIconUrl && (
                                <div className="icon-preview" style={{ width: '36px', height: '36px', background: 'var(--alpha-low)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)' }}>
                                    <img src={newObjectiveIconUrl} alt="preview" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                </div>
                            )}
                        </div>
                        <div className="creation-actions">
                            <button className="confirm-btn" onClick={() => handleCreateObjective(null)}>Launch Experiment</button>
                            <button className="cancel-btn" onClick={() => setIsCreatingObjective(false)}>Discard</button>
                        </div>
                    </div>
                ) : (
                    <button className="add-objective-btn" onClick={() => setIsCreatingObjective(true)}>
                        + New Experiment
                    </button>
                )}
            </section>

            {/* Experiment Archive */}
            {archivedObjectives.length > 0 && (
                <section className="skill-section archived-section">
                    <span className="section-label">Experiment Archive</span>
                    <div className="archived-list">
                        {(archivedObjectives || []).map(obj => renderObjective(obj))}
                    </div>
                </section>
            )}

            {/* LIMIT MODAL */}
            {isLimitModalOpen && (
                <div className="modal-overlay" onClick={() => setIsLimitModalOpen(false)}>
                    <div className="limit-modal" onClick={e => e.stopPropagation()}>
                        <div className="limit-modal-icon">⚖️</div>
                        <div className="limit-modal-message">
                            This Skill already has an Active Experiment. Put it to sleep to activate this one.
                        </div>
                        <button className="limit-modal-btn" onClick={() => setIsLimitModalOpen(false)}>
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {/* CONFIRM SLEEP MODAL */}
            {isConfirmSleepModalOpen && (
                <div className="modal-overlay" onClick={() => setIsConfirmSleepModalOpen(false)}>
                    <div className="limit-modal confirmation" onClick={e => e.stopPropagation()}>
                        <div className="limit-modal-icon">⏳</div>
                        <div className="limit-modal-message">
                            This Experiment has been active for {Math.floor((Date.now() - (pendingSleepObj?.metadata?.activatedAt || 0)) / (24 * 60 * 60 * 1000)) + 1} days. Rotate anyway?
                        </div>
                        <div className="modal-actions-row">
                            <button className="limit-modal-btn secondary" onClick={() => setIsConfirmSleepModalOpen(false)}>
                                Keep Active
                            </button>
                            <button className="limit-modal-btn" onClick={() => {
                                performObjectiveToggle(pendingSleepObj);
                                setIsConfirmSleepModalOpen(false);
                            }}>
                                Rotate Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE TASK CONFIRMATION MODAL */}
            {taskToDelete && (
                <div className="modal-overlay" onClick={() => setTaskToDelete(null)}>
                    <div className="confirmation-modal" onClick={e => e.stopPropagation()}>
                        <h3>Remove Task</h3>
                        <p>Remove this task from this aspect?</p>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setTaskToDelete(null)}>Cancel</button>
                            <button className="delete-btn" onClick={handleDeleteTask}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE ASPECT CONFIRMATION MODAL */}
            {aspectToDelete && (
                <div className="modal-overlay" onClick={() => setAspectToDelete(null)}>
                    <div className="confirmation-modal" onClick={e => e.stopPropagation()}>
                        <h3>Remove Aspect</h3>
                        <p>Delete "{aspectToDelete.name}"? All associated logs will be permanently removed.</p>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setAspectToDelete(null)}>Cancel</button>
                            <button className="delete-btn" onClick={handleDeleteAspect}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE EXPERIMENT CONFIRMATION MODAL */}
            {objectiveToDelete && (
                <div className="modal-overlay" onClick={() => setObjectiveToDelete(null)}>
                    <div className="confirmation-modal" onClick={e => e.stopPropagation()}>
                        <h3>Delete Experiment</h3>
                        <p>Delete <strong>"{objectiveToDelete.name}"</strong>? All Aspects and logs will be permanently removed. This cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setObjectiveToDelete(null)}>Cancel</button>
                            <button className="delete-btn" onClick={confirmDeleteObjective}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TASK CREATION MODAL - Using Portal to render on top of entire app */}
            {creatingTaskForAspectId && createPortal(
                <div className={`pre-rendered-modal-overlay active`} onClick={() => setCreatingTaskForAspectId(null)}>
                    <div className="confirmation-modal" onClick={e => e.stopPropagation()} style={{
                        background: 'var(--color-bg-card, #2c2c2e)',
                        border: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        width: '420px', // Slightly wider for premium feel
                        padding: '32px'
                    }}>
                        <h3 style={{ 
                            fontSize: '20px', 
                            fontWeight: '700', 
                            marginBottom: '24px', 
                            textAlign: 'left',
                            color: 'var(--text-primary)'
                        }}>Create New Mission</h3>

                        <div className="form-group" style={{ marginBottom: '24px', textAlign: 'left' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Task Type</label>
                            <div style={{ display: 'flex', gap: '12px', background: 'var(--alpha-low)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                                <button
                                    className={`toggle-btn ${newTaskItemType === 'FINITE' ? 'active' : ''}`}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: newTaskItemType === 'FINITE' ? 'var(--color-primary)' : 'transparent',
                                        color: newTaskItemType === 'FINITE' ? 'white' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => setNewTaskItemType('FINITE')}
                                >
                                    Finite Task
                                </button>
                                <button
                                    className={`toggle-btn ${newTaskItemType === 'REPETITION' ? 'active' : ''}`}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: newTaskItemType === 'REPETITION' ? 'var(--color-primary)' : 'transparent',
                                        color: newTaskItemType === 'REPETITION' ? 'white' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => setNewTaskItemType('REPETITION')}
                                >
                                    Repetition Block
                                </button>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '24px', textAlign: 'left' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Task Name</label>
                            <input
                                ref={taskNameInputRef}
                                className="form-input"
                                autoFocus
                                style={{
                                    width: '100%',
                                    background: 'var(--alpha-low)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    boxSizing: 'border-box'
                                }}
                                placeholder="What needs to be done?"
                                value={newTaskName}
                                onChange={(e) => setNewTaskName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateTask(null, creatingTaskForAspectId)}
                            />
                        </div>

                        {newTaskItemType === 'REPETITION' && (
                            <div className="repetition-fields" style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                                <div className="form-group" style={{ flex: 2, textAlign: 'left' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Unit Name</label>
                                    <input
                                        className="form-input"
                                        style={{
                                            width: '100%',
                                            background: 'var(--alpha-low)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '12px',
                                            padding: '12px 16px',
                                            color: 'var(--text-primary)',
                                            fontSize: '14px',
                                            boxSizing: 'border-box'
                                        }}
                                        placeholder="e.g. reps, pages"
                                        value={newTaskUnitName}
                                        onChange={(e) => setNewTaskUnitName(e.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1, textAlign: 'left' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Target</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{
                                            width: '100%',
                                            background: 'var(--alpha-low)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '12px',
                                            padding: '12px 16px',
                                            color: 'var(--text-primary)',
                                            fontSize: '14px',
                                            boxSizing: 'border-box'
                                        }}
                                        value={newTaskTargetUnits}
                                        onChange={(e) => setNewTaskTargetUnits(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button className="cancel-btn" style={{ 
                                flex: 1, 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: '1px solid var(--color-border)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }} onClick={() => setCreatingTaskForAspectId(null)}>Cancel</button>
                            <button className="create-btn" style={{ 
                                flex: 1, 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: 'none',
                                background: 'var(--color-primary)',
                                color: 'white',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(var(--color-primary-rgb), 0.3)'
                            }} onClick={() => handleCreateTask(null, creatingTaskForAspectId)}>Create Task</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SkillPage;
