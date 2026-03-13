import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    defaultDropAnimationSideEffects,
    useDroppable
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

const macOSSpring = {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.8
};

const CARD_BORDER_RADIUS = 18;
const CONTAINER_BORDER_RADIUS = 20;

const SkillPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
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
    const location = useLocation();

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

    // Deletion State
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [aspectToDelete, setAspectToDelete] = useState(null);
    const [objectiveToDelete, setObjectiveToDelete] = useState(null);
    const [aspectForDetails, setAspectForDetails] = useState(null);
    const [editingObjectiveId, setEditingObjectiveId] = useState(null);
    const [objectiveEditForm, setObjectiveEditForm] = useState(null);

    const taskNameInputRef = useRef(null);

    // Challenge Mode State
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

    // Active Drag Item
    const [activeId, setActiveId] = useState(null);

    const fetchData = async () => {
        try {
            const nodes = await repository.getAll();
            setAllNodes(nodes);

            const skillNode = nodes.find(n => n.id === id);
            if (skillNode) {
                setSkill(skillNode);
                const skillObjectives = nodes.filter(n => n.parentId === id && n.type === NodeTypes.OBJECTIVE);
                setObjectives(skillObjectives);

                const inProgress = skillObjectives.find(obj => obj.metadata?.isActive === true);
                if (inProgress && expandedObjectiveIds.length === 0 && !loading) {
                    console.log("Auto-expanding active experiment:", inProgress.id);
                    setExpandedObjectiveIds([inProgress.id]);
                }

                // Fetch Habits for this Skill
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
            }
        } catch (error) {
            console.error("Failed to fetch skill hierarchy:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            await backbone.checkExpirations();
            fetchData();
        };
        init();
        const sub1 = repository.subscribe(fetchData);
        return () => sub1();
    }, [id]);

    // Update local Becoming state when skill data arrives
    useEffect(() => {
        if (skill?.metadata?.identityAnchor !== undefined) {
            setTempBecoming(skill.metadata.identityAnchor || '');
        }
    }, [skill?.id, skill?.metadata?.identityAnchor]);

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
            }, 800); // 800ms debounce
        };
    }, [skill?.id, skill?.metadata]);

    useEffect(() => {
        if (creatingTaskForAspectId && taskNameInputRef.current) {
            setTimeout(() => taskNameInputRef.current.focus(), 50);
        }
    }, [creatingTaskForAspectId]);

    const handleCreateObjective = async (e) => {
        if (e && e.key !== 'Enter' && e.type !== 'click') return;

        const name = newObjectiveName.trim();
        const theme = newObjectiveTheme.trim();
        const mve = newObjectiveMVE.trim();
        const duration = parseInt(newObjectiveDuration);
        const accType = newObjectiveAccType;

        if (!name || !theme || !mve || isNaN(duration) || !accType) {
            // Keep fields until valid
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
    };
    const handleStartEditObjective = (obj) => {
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
    };

    const handleSaveObjectiveEdit = async (objId) => {
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
    };

    const handleInlineSaveWish = async (objId) => {
        try {
            const obj = allNodes.find(n => n.id === objId);
            await backbone.updateNode(objId, {
                metadata: { ...obj.metadata, wish: tempWish }
            });
            setInlineEditingWishId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to save wish inline:", error);
        }
    };

    const handleInlineSaveOutcome = async (objId) => {
        try {
            const obj = allNodes.find(n => n.id === objId);
            await backbone.updateNode(objId, {
                metadata: { ...obj.metadata, outcome: tempOutcome }
            });
            setInlineEditingOutcomeId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to save outcome inline:", error);
        }
    };

    const handleDeleteObjective = (obj) => {
        setObjectiveToDelete(obj);
    };

    const confirmDeleteObjective = async () => {
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
    };

    const handleDeleteLog = async (aspectId, logId) => {
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
    };

    const suggestions = useMemo(() => {
        if (!allNodes.length) return [];
        const tasks = allNodes.filter(n => n.type === NodeTypes.TASK);
        if (!tasks.length) return [];

        const nextTasks = [];

        // 1. Momentum logic
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
                    // Find Skill ID
                    let skillParent = allNodes.find(n => n.id === aspect.parentId); // Objective
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

        // 2. Near-Completion logic (Focusing on an engagement gap)
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
            // Avoid duplicate if same task as momentum
            if (!nextTasks.some(nt => nt.task.id === best.nextTask.id)) {
                // Find Skill ID for navigation
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

        // 3. Active Habits logic
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

        // 4. Return top 3 suggestions
        return nextTasks.slice(0, 3);
    }, [allNodes, habits, id]);

    const handleSuggestionClick = async (suggestion) => {
        if (suggestion.habit) {
            // Highlight specific habit card
            const el = document.getElementById(`habit-${suggestion.habit.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // We reuse the task highlight class if it exists or add a pulse
                el.classList.add('habit-highlight-pulse');
                setTimeout(() => el.classList.remove('habit-highlight-pulse'), 2000);
            }
            return;
        }

        const { task, skillId } = suggestion;

        // Mark as Today
        await backbone.updateNode(task.id, {
            metadata: { ...task.metadata, isToday: true }
        });

        if (skillId === id) {
            // Already on this skill page, just scroll
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
            // Navigate
            navigate(`/skill/${skillId}?scrollTo=${task.id}&markToday=true`);
        }
    };

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
    }, [loading, id, location.search, allNodes.length]);

    const handleCreateAspect = async (e, objId) => {
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
    };

    const handleCreateTask = async (e, aspectId) => {
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

        // Optimistic UI: Close form and reset inputs right away
        setNewTaskName('');
        setNewTaskDependencyId('');
        setNewTaskItemType('FINITE');
        setNewTaskUnitName('units');
        setNewTaskTargetUnits(1);
        setCreatingTaskForAspectId(null);

        // Run creation in background
        backbone.addNode({
            type: NodeTypes.TASK,
            parentId: aspectId,
            name: newTaskName.trim(),
            metadata: {
                ...metadata,
                type: newTaskItemType // "FINITE" or "REPETITION"
            }
        }).catch(error => {
            console.error("Failed to create task:", error);
            fetchData(); // Rollback/Sync on error
        });
    };

    const handleIncrementRepetition = (taskId) => {
        const task = allNodes.find(n => n.id === taskId);
        if (!task) return;

        const currentUnits = task.metadata?.currentUnits || 0;
        const targetUnits = task.metadata?.targetUnits || 0;
        const nextUnits = currentUnits + 1;

        // --- OPTIMISTIC UPDATE ---
        setAllNodes(prevNodes => prevNodes.map(n => {
            if (n.id === taskId) {
                const updatedMetadata = {
                    ...n.metadata,
                    currentUnits: nextUnits
                };
                // Auto-complete if target reached
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
        }));

        // Backend update in background
        backbone.incrementTaskRepetition(taskId)
            .catch(error => {
                console.error("Failed to increment repetition:", error);
                fetchData(); // Rollback/Sync on error
            });
    };

    const handleToggleTaskStatus = async (task) => {
        const currentStatus = task.metadata?.status || TaskStatuses.NOT_STARTED;
        const nextStatus = currentStatus === TaskStatuses.DONE ? TaskStatuses.NOT_STARTED : TaskStatuses.DONE;
        const completedAt = nextStatus === TaskStatuses.DONE ? Date.now() : null;

        // --- OPTIMISTIC UPDATE START ---
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
        // --- OPTIMISTIC UPDATE END ---

        // Fire and forget the update. 
        // No manual .then(fetchData) needed because we are subscribed to the repository.
        backbone.updateNode(task.id, {
            metadata: {
                ...task.metadata,
                status: nextStatus,
                completedAt
            }
        }).catch(error => {
            console.error("Failed to toggle task status:", error);
            fetchData(); // Rollback/Sync on absolute error
        });
    };

    const handleAddToToday = async (e, taskId) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        console.log("handleAddToToday runs for task:", taskId);
        const task = allNodes.find(n => n.id === taskId);
        if (!task) return;

        const isToday = !!task.metadata?.isToday;

        // --- OPTIMISTIC UPDATE START ---
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
        // --- OPTIMISTIC UPDATE END ---

        // Fire and forget, then refresh
        backbone.updateNode(taskId, {
            metadata: { isToday: !isToday }
        }).catch(error => {
            console.error("Failed to toggle today status:", error);
            fetchData(); // Rollback/Sync on error
        });
    };

    const handleDeleteTask = async () => {
        if (!taskToDelete) return;
        const idToDelete = taskToDelete.id;
        console.log("Deleting task:", idToDelete);
        // Optimistic UI: Close the delete modal immediately
        setTaskToDelete(null);

        // Deletion in background
        backbone.deleteNode(idToDelete)
            .then(() => {
                console.log("Task deleted successfully");
                fetchData();
            })
            .catch(error => {
                console.error("Failed to delete task:", error);
                alert("Error deleting task: " + error.message);
                fetchData(); // Sync state with backend on failure
            });
    };

    const handleDeleteAspect = async () => {
        if (!aspectToDelete) return;
        const idToDelete = aspectToDelete.id;
        console.log("Deleting aspect:", idToDelete);
        setAspectToDelete(null); // Immediate UI feedback: close modal

        try {
            await backbone.deleteNode(idToDelete);
            console.log("Aspect deleted successfully");
            fetchData();
        } catch (error) {
            console.error("Failed to delete aspect:", error);
            alert("Error deleting aspect: " + error.message);
            fetchData();
        }
    };

    const handleTaskDragStart = (event) => {
        setDragActiveId(event.active.id);
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setDragActiveId(null);
        if (!over) return;

        const activeTaskId = active.id;
        const overId = over.id;

        const activeTask = allNodes.find(n => n.id === activeTaskId);
        if (!activeTask) return;

        // Identify target container and index
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

        if (targetAspectId && targetIndex !== -1) {
            try {
                // Get fresh list of tasks in target aspect (excluding active if cross-aspect)
                const targetTasks = getChildren(targetAspectId, NodeTypes.TASK)
                    .filter(t => t.id !== activeTaskId);

                // Insert at target index
                targetTasks.splice(targetIndex, 0, activeTask);

                // Update all indices in target aspect
                await Promise.all(targetTasks.map((t, i) => {
                    const updates = { metadata: { ...t.metadata, orderIndex: i } };
                    if (t.id === activeTaskId) updates.parentId = targetAspectId;
                    return backbone.updateNode(t.id, updates);
                }));

                // If moving AT ALL, refresh
                fetchData();
            } catch (err) {
                console.error("DnD persistence failed:", err);
            }
        }
    };

    const handleUpdateObjectiveMetadata = async (objId, field, value) => {
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
    };

    const handleUpdateObjectiveName = async (objId, name) => {
        try {
            await backbone.updateNode(objId, { name });
            fetchData();
        } catch (error) {
            console.error("Failed to update objective name:", error);
        }
    };

    const toggleObjective = (objId) => {
        console.log("toggleExperiment triggered for:", objId);
        setExpandedObjectiveIds(prev =>
            prev.includes(objId) ? prev.filter(id => id !== objId) : [...prev, objId]
        );
    };

    const handleToggleObjectiveStatus = async (e, obj) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        const isCurrentlyActive = obj.metadata?.isActive === true || (!obj.metadata?.isActive && !obj.metadata?.isSleeping && !obj.metadata?.isArchived);

        if (!isCurrentlyActive) {
            // Check per-skill limit: Max 1
            const activeInSkill = objectives.filter(o => o.metadata?.isActive === true).length;
            if (activeInSkill >= 1) {
                setIsLimitModalOpen(true);
                return;
            }
        } else {
            // Check 14-day soft minimum
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
    };

    const performObjectiveToggle = async (obj) => {
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
    };

    const handleLogAspectAccumulation = async (aspectId, amount) => {
        const aspect = allNodes.find(n => n.id === aspectId);
        if (!aspect) return;

        const val = parseFloat(amount);
        if (isNaN(val)) return;

        try {
            const currentMetric = aspect.metadata?.accumulatedMetric || 0;
            const currentCount = aspect.metadata?.taskCount || 0;
            const currentLogs = aspect.metadata?.logs || [];

            const newLog = {
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: 'Manual Log',
                amount: val,
                timestamp: Date.now()
            };

            await backbone.updateNode(aspectId, {
                metadata: {
                    ...aspect.metadata,
                    accumulatedMetric: currentMetric + val,
                    taskCount: currentCount + 1,
                    logs: [...currentLogs, newLog]
                }
            });
            // Recalculate objective
            if (aspect.parentId) {
                await backbone.recalculateObjectiveAccumulation(aspect.parentId);
            }
            fetchData();
        } catch (error) {
            console.error("Failed to log accumulation:", error);
        }
    };

    const handleUpdateAspectNotes = async (aspectId, notes) => {
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
    };

    const toggleAspect = (aspectId) => {
        setExpandedAspectIds(prev =>
            prev.includes(aspectId) ? prev.filter(id => id !== aspectId) : [...prev, aspectId]
        );
    };

    const toggleTask = (taskId) => {
        setExpandedTaskIds(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const handleAttachReward = async (taskId, rewardId) => {
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
    };

    const handleRemoveReward = async (taskId) => {
        try {
            const task = allNodes.find(n => n.id === taskId);
            await backbone.updateNode(taskId, {
                metadata: { ...task.metadata, rewardId: null }
            });
            fetchData();
        } catch (error) {
            console.error("Failed to remove reward:", error);
        }
    };

    const toggleShowMore = (e, stageId) => {
        e.stopPropagation();
        setStageShowMoreIds(prev =>
            prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]
        );
    };

    const handleReorderTasks = async (newTasks, stageId) => {
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
    };

    const getChildren = (parentId, type) => {
        return allNodes
            .filter(n => {
                if (n.parentId !== parentId) return false;
                if (type === NodeTypes.ASPECT) {
                    return n.type === 'ASPECT' || n.type === 'STAGE';
                }
                return n.type === type;
            })
            .sort((a, b) => (a.metadata?.orderIndex || 0) - (b.metadata?.orderIndex || 0));
    };

    if (loading) return <div className="skill-page-loading">Loading Hierarchy...</div>;
    if (!skill) return <div className="skill-page-error">Skill not found.</div>;

    const activeObjectives = objectives.filter(o => {
        const m = o.metadata || {};
        return m.isActive === true || (!m.isActive && !m.isSleeping && !m.isArchived);
    });
    const sleepingObjectives = objectives.filter(o => o.metadata?.isSleeping === true);
    const archivedObjectives = objectives.filter(o => o.metadata?.isArchived === true);

    // Burnout Safe Mode: true if any objective on this skill has burnoutRisk
    const anyBurnoutRisk = objectives.some(o => o.metadata?.burnoutRisk === true);

    const getObjectiveTimeInfo = (obj) => {
        const m = obj.metadata || {};
        const isActive = m.isActive === true || (!m.isActive && !m.isSleeping && !m.isArchived);
        if (!isActive || !m.activatedAt) return null;

        const now = Date.now();
        const diff = now - obj.metadata.activatedAt;
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        const displayDays = days + 1; // Start at Day 1

        let phase = '';
        let hint = '';

        if (displayDays <= 14) phase = 'Early Phase';
        else if (displayDays <= 45) phase = 'Deep Phase';
        else if (displayDays <= 60) phase = 'Late Phase';
        else hint = 'Consider rotating or refreshing this Objective.';

        return { days: displayDays, rawDays: days, phase, hint };
    };

    const getTaskStatusInfo = (task) => {
        const status = task.metadata?.status;
        if (status === TaskStatuses.DONE) return { symbol: '✓', colorClass: 'status-done' };
        if (status === TaskStatuses.IN_PROGRESS) return { symbol: '◉', colorClass: 'status-progress' };
        return { symbol: '☐', colorClass: 'status-todo' };
    };

    const SortableTaskRow = ({ task }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging
        } = useSortable({
            id: task.id,
            data: { type: 'TASK', task }
        });

        const style = {
            transform: CSS.Translate.toString(transform),
            transition,
            opacity: isDragging ? 0.3 : 1,
            zIndex: isDragging ? 10 : 1,
        };

        const statusInfo = getTaskStatusInfo(task);
        const isDone = task.metadata?.status === TaskStatuses.DONE;
        const dependencyId = task.metadata?.dependsOnTaskId;
        const dependencyTask = dependencyId ? allNodes.find(n => n.id === dependencyId) : null;
        const isExpanded = expandedTaskIds.includes(task.id);
        const rewardId = task.metadata?.rewardId;
        const reward = rewardId ? allNodes.find(n => n.id === rewardId) : null;

        const isFresh = !isDone && (
            (task.metadata?.sessions?.length || 0) === 0 ||
            (task.updatedAt && (Date.now() - new Date(task.updatedAt).getTime()) > 14 * 24 * 60 * 60 * 1000)
        );

        const isChallengeTarget = activeChallengeHighlight?.taskId === task.id;
        const challengeType = activeChallengeHighlight?.type;

        let contrastClass = '';
        if (isDone) {
            contrastClass = 'task-ghosted';
        } else {
            contrastClass = 'task-high-contrast';
        }

        return (
            <div
                ref={setNodeRef}
                style={style}
                id={`task-${task.id}`}
                className={`task-row-container ${isExpanded ? 'is-expanded' : ''} ${isDragging ? 'is-dragging-ghost' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
            >
                <div
                    className={`task-row ${contrastClass}`}
                >
                    <div className="drag-handle" {...attributes} {...listeners} onClick={e => e.stopPropagation()}>
                        ⠿
                    </div>
                    {/* PASSION Safe Start Option */}
                    {skill?.metadata?.pinchState === 'PASSION' && !isDone && (
                        <button
                            className="task-safe-start-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                navigate(`/focus?taskId=${task.id}&safeSession=true`);
                            }}
                            title="Start 10-minute safe session"
                        >
                            ⏱ 10m
                        </button>
                    )}
                    {task.metadata?.itemType !== 'REPETITION' && (
                        <span
                            className={`task-status-symbol clickable ${statusInfo.colorClass}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleToggleTaskStatus(task);
                            }}
                            title={isDone ? "Mark as Not Started" : "Mark as Done"}
                        >
                            {statusInfo.symbol}
                        </span>
                    )}
                    <div className="task-name-text">
                        <span className="task-main-name">{task.name}</span>
                        {isChallengeTarget && challengeType === 'MASTERY' && <span className="challenge-badge mastery">Mastery Check</span>}
                        {isChallengeTarget && challengeType === 'NEW_ANGLE' && <span className="challenge-badge new-angle">New Angle</span>}
                        {rewardId && <span className="task-reward-badge-collapsed" title={`Reward: ${reward?.name || 'Unknown'}`}>🍬</span>}
                    </div>

                    <div className="task-actions-col">
                        {!isDone && (
                            <span
                                className={`task-today-badge ${task.metadata?.isToday ? 'active' : ''}`}
                                onClick={(e) => handleAddToToday(e, task.id)}
                            >
                                Today
                            </span>
                        )}
                        {task.metadata?.itemType === 'REPETITION' && (
                            <div className="task-repetition-ui">
                                <span className="task-repetition-progress">
                                    {task.metadata.currentUnits || 0} / {task.metadata.targetUnits || 0} {task.metadata.unitName || 'units'}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleIncrementRepetition(task.id);
                                    }}
                                    className="task-repetition-add-btn"
                                    title="Increment progress"
                                >
                                    +
                                </button>
                            </div>
                        )}
                    </div>
                    {dependencyId && <span className="task-dependency-icon" title={`Suggested next step after: ${dependencyTask?.name}`}>↗</span>}

                    <button
                        className="task-delete-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setTaskToDelete(task);
                        }}
                        title="Delete Task"
                    >
                        🗑️
                    </button>
                </div>

                {isExpanded && (
                    <div className="task-expanded-content" onClick={(e) => e.stopPropagation()}>
                        <div className="micro-reward-section">
                            <span className="expanded-label-small">Micro Reward</span>
                            {rewardId ? (
                                <div className="reward-info-block">
                                    {reward ? (
                                        <>
                                            <div className="reward-main">
                                                <span className="reward-icon-inline">🍬</span>
                                                <span className="reward-name-inline">{reward.name}</span>
                                                <span className="reward-tier-inline">T{reward.metadata?.rewardTier || 1}</span>
                                            </div>
                                            <div className="reward-actions-inline">
                                                <button className="reward-action-btn" onClick={() => setIsSelectingRewardForTaskId(task.id)}>Change</button>
                                                <button className="reward-action-btn remove" onClick={() => handleRemoveReward(task.id)}>Remove</button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="reward-error">
                                            <span>Reward not found</span>
                                            <button className="reward-action-btn remove" onClick={() => handleRemoveReward(task.id)}>Remove</button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    className="attach-reward-trigger"
                                    onClick={() => setIsSelectingRewardForTaskId(task.id)}
                                >
                                    + Attach Micro Reward
                                </button>
                            )}
                        </div>

                        {isSelectingRewardForTaskId === task.id && (
                            <div className="reward-picker-overlay" onClick={() => setIsSelectingRewardForTaskId(null)}>
                                <div className="reward-picker-container" onClick={(e) => e.stopPropagation()}>
                                    <h4 className="picker-title">Select Micro Reward</h4>
                                    <div className="reward-list-scroll">
                                        {allNodes
                                            .filter(n => n.type === NodeTypes.REWARD && n.metadata?.rewardCategory === 'TASK')
                                            .map(r => (
                                                <div
                                                    key={r.id}
                                                    className="reward-pick-item"
                                                    onClick={() => handleAttachReward(task.id, r.id)}
                                                >
                                                    <span className="pick-name">{r.name}</span>
                                                    <span className={`tier-badge tier-${r.metadata?.rewardTier || 1}`}>T{r.metadata?.rewardTier || 1}</span>
                                                </div>
                                            ))}
                                        {allNodes.filter(n => n.type === NodeTypes.REWARD && n.metadata?.rewardCategory === 'TASK').length === 0 && (
                                            <div className="no-rewards-found">No Micro Rewards found in Bank.</div>
                                        )}
                                    </div>
                                    <button className="picker-close-btn" onClick={() => setIsSelectingRewardForTaskId(null)}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const DroppableAspect = ({ aspect, aspectTasks, isUntouched, isNoveltyHighlighted, children }) => {
        const { setNodeRef, isOver } = useDroppable({
            id: aspect.id,
            data: { type: 'ASPECT', aspect }
        });

        return (
            <motion.div
                layout="position"
                ref={setNodeRef}
                className={`aspect-card ${isOver ? 'drag-over' : ''} ${isUntouched ? 'is-untouched' : ''} ${isNoveltyHighlighted ? 'novelty-highlight' : ''}`}
                transition={macOSSpring}
                style={{
                    borderRadius: CARD_BORDER_RADIUS,
                    overflow: 'hidden',
                    willChange: 'transform',
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'translateZ(0)'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    toggleAspect(aspect.id);
                }}
            >
                {isNoveltyHighlighted && (
                    <div className="novelty-badge">UNEXPLORED</div>
                )}
                {/* Plain div — no layout animation so children don't stretch */}
                <div style={{ width: '100%' }}>
                    {children}
                </div>
            </motion.div>
        );
    };

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
            <DndContext
                key={obj.id}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleTaskDragStart}
                onDragEnd={handleDragEnd}
            >
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
                            <span className="objective-title-static">{obj.name}</span>
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
                                    style={{ overflow: 'hidden' }}
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
                                                        >
                                                            <div className="aspect-card-internal">
                                                                <div className="aspect-header">
                                                                    <div className="aspect-title-group">
                                                                        <span className="aspect-name">{aspect.name}</span>
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
                                                                    <SortableContext items={aspectTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                                        <AnimatePresence>
                                                                            {(aspectShowMoreIds.includes(aspect.id) ? aspectTasks : aspectTasks.slice(0, 5)).map(task => (
                                                                                <SortableTaskRow key={task.id} task={task} />
                                                                            ))}
                                                                        </AnimatePresence>
                                                                    </SortableContext>
        
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
                <DragOverlay dropAnimation={null}>
                    {dragActiveId ? (
                        <div className="task-row-container dragging-overlay">
                            {allNodes.find(n => n.id === dragActiveId)?.name}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        );
    };

    const isNoveltySprint = skill?.metadata?.pinchState === 'NOVELTY';
    if (isNoveltySprint) {
        const activeAspects = allNodes.filter(n => n.type === NodeTypes.ASPECT && !n.metadata?.isSleeping && n.parentId && allNodes.find(p => p.id === n.parentId)?.parentId === skill?.id);
        const unexplored = activeAspects.filter(a => {
            const aspectTasks = allNodes.filter(n => n.parentId === a.id && n.type === NodeTypes.TASK);
            if (aspectTasks.length === 0) return false;
            return !aspectTasks.some(t => t.metadata?.status === TaskStatuses.DONE);
        });
        window.unexploredAspectIds = unexplored.slice(0, 2).map(a => a.id);
    } else {
        window.unexploredAspectIds = [];
    }

    const isChallengeState = skill?.metadata?.pinchState === 'CHALLENGE';
    let masteryCheckTaskId = null;
    let newAngleTaskId = null;
    let showChallengeCard = false;

    if (isChallengeState && !challengeDismissed) {
        const activeObj = objectives.find(o => !o.metadata?.isSleeping);
        if (activeObj) {
            const aspects = allNodes.filter(n => n.type === NodeTypes.ASPECT && n.parentId === activeObj.id);
            let bestProgress = -1;
            let worstProgress = 2; // progress is 0-1

            aspects.forEach(a => {
                const aTasks = allNodes.filter(n => n.parentId === a.id && n.type === NodeTypes.TASK);
                if (aTasks.length > 0) {
                    const sortedTasks = [...aTasks].sort((t1, t2) => (t1.metadata?.orderIndex || 0) - (t2.metadata?.orderIndex || 0));
                    const incomplete = sortedTasks.filter(t => t.metadata?.status !== TaskStatuses.DONE);

                    if (incomplete.length > 0) {
                        const firstInc = incomplete[0];
                        const progress = (aTasks.length - incomplete.length) / aTasks.length;

                        // Use >= to pick the most recent one if progress is identical
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

    const handleChallengeAction = (type) => {
        if (type === 'MASTERY' && masteryCheckTaskId) {
            setActiveChallengeHighlight({ taskId: masteryCheckTaskId, type });
            const pId = allNodes.find(n => n.id === masteryCheckTaskId)?.parentId;
            if (pId) {
                setExpandedAspectIds(prev => prev.includes(pId) ? prev : [...prev, pId]);
                setTimeout(() => {
                    const el = document.getElementById(`task-${masteryCheckTaskId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        } else if (type === 'NEW_ANGLE' && newAngleTaskId) {
            setActiveChallengeHighlight({ taskId: newAngleTaskId, type });
            const pId = allNodes.find(n => n.id === newAngleTaskId)?.parentId;
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
                    <h1 className="skill-title">{skill.name}</h1>
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
                        {suggestions.map((s) => (
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
                    {habits.length > 0 ? (
                        habits.map(habit => (
                            <HabitCard
                                key={habit.id}
                                habit={habit}
                                onOpenEvolution={() => setActiveHabitForEvolution(habit)}
                                onToggleActive={async (h) => {
                                    await habitService.updateHabit(h.id, { isActive: !h.isActive });
                                    fetchData();
                                }}
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
                            {activeObjectives.map(obj => renderObjective(obj))}
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
                                {sleepingObjectives.map(renderObjective)}
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
                        {archivedObjectives.map(obj => renderObjective(obj))}
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

const HabitCard = ({ habit, onOpenEvolution, onToggleActive }) => {
    const [completing, setCompleting] = useState(false);
    const currentPhase = habit.phases?.[habit.currentPhaseLevel] || {};
    const isCompletedToday = habit.lastCompletedAt &&
        new Date(habit.lastCompletedAt).toDateString() === new Date().toDateString();

    const handleComplete = async (friction) => {
        try {
            await habitService.completeHabit(habit.id, friction);
            setCompleting(false);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className={`habit-card-minimal ${isCompletedToday ? 'completed' : ''}`} id={`habit-${habit.id}`}>
            <div className="habit-card-main" onClick={onOpenEvolution}>
                <div className="habit-info">
                    <div className="habit-header-row">
                        <h4 className="habit-name">{habit.ifTrigger}</h4>
                        <span
                            className={`habit-activation-tag ${habit.isActive ? 'active' : 'paused'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleActive(habit);
                            }}
                        >
                            {habit.isActive ? '🟢 Active' : '⚪ Paused'}
                        </span>
                    </div>
                    <p className="habit-phase-desc">Then: {currentPhase.description}</p>
                    <span className="habit-phase-label">Phase {habit.currentPhaseLevel + 1}</span>
                </div>

                {!isCompletedToday && (
                    <div className="habit-actions" onClick={e => e.stopPropagation()}>
                        {!completing ? (
                            <button className="complete-btn" onClick={() => setCompleting(true)}>Complete</button>
                        ) : (
                            <div className="friction-selector-minimal">
                                <button onClick={() => handleComplete('low')} title="Easy">🟢</button>
                                <button onClick={() => handleComplete('medium')} title="Medium">🟡</button>
                                <button onClick={() => handleComplete('high')} title="Hard">🔴</button>
                            </div>
                        )}
                    </div>
                )}

                {isCompletedToday && <span className="completion-check">✓</span>}
            </div>
        </div>
    );
};

const EvolutionDrillIn = ({ habit, skill, onClose, onRefresh }) => {
    const [stats, setStats] = useState(null);
    const [newVariation, setNewVariation] = useState('');
    const [isUpgrading, setIsUpgrading] = useState(false);

    useEffect(() => {
        const loadStats = async () => {
            const eligibility = await habitService.evaluateEvolutionEligibility(habit.id);
            setStats(eligibility);
        };
        loadStats();
    }, [habit.id]);

    const handleLevelUp = async () => {
        if (habit.currentPhaseLevel >= 4 && !newVariation.trim()) {
            alert("Please define the next variation for this open-ended phase.");
            return;
        }

        try {
            setIsUpgrading(true);
            const desc = habit.currentPhaseLevel >= 4 ? newVariation.trim() : ""; // Backend handles growth if level < 5
            await habitService.upgradePhase(habit.id, desc);
            onRefresh();
            onClose();
        } catch (error) {
            alert(error.message);
        } finally {
            setIsUpgrading(false);
        }
    };

    if (!stats) return <div className="evolution-drill-in-overlay">Loading Evolution Data...</div>;

    const currentPhase = habit.phases?.[habit.currentPhaseLevel] || {};
    const stabilityPercent = Math.round((stats.stabilityCount / 12) * 100);
    const isReady = stats.evolutionReady;
    const isPostCap = habit.currentPhaseLevel >= 4;

    return (
        <div className="evolution-drill-in-overlay" onClick={onClose}>
            <div className="evolution-modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="header-text">
                        <h3>Habit Evolution</h3>
                        <p className="subtitle">{habit.ifTrigger}</p>
                    </div>
                    <button className="close-x" onClick={onClose}>×</button>
                </header>

                <div className="modal-body">
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <span className="label">Stability (12d)</span>
                            <span className="value">{stats.stabilityCount}/12</span>
                            <div className="progress-bar-bg">
                                <div className="progress-fill" style={{ width: `${stabilityPercent}%` }}></div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <span className="label">Lifetime</span>
                            <span className="value">{habit.totalCompletions || 0}</span>
                            <span className="sub-value">Goal: {currentPhase.threshold}</span>
                        </div>
                        <div className="metric-card">
                            <span className="label">Friction (8x)</span>
                            <span className="value">{stats.frictionAvg?.toFixed(1) || 'N/A'}</span>
                            <span className={`status-pill ${stats.frictionGate ? 'pass' : 'fail'}`}>
                                {stats.frictionGate ? 'Solid' : 'Unstable'}
                            </span>
                        </div>
                    </div>

                    <div className="identity-reinforcement">
                        <p className="becoming-message">This habit is stabilizing.</p>
                        <p className="identity-anchor">
                            You are becoming someone with {skill.metadata?.identityAnchor || 'unstoppable momentum'}.
                        </p>
                    </div>

                    {isReady ? (
                        <div className="evolution-actions">
                            {isPostCap ? (
                                <div className="post-cap-creation">
                                    <label>Define Habit Variation / Refinement</label>
                                    <textarea
                                        placeholder="Higher intensity, different context, or refined form..."
                                        value={newVariation}
                                        onChange={e => setNewVariation(e.target.value)}
                                    />
                                    <button
                                        className="evolve-btn"
                                        disabled={isUpgrading}
                                        onClick={handleLevelUp}
                                    >
                                        Solidify & Evolve
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="evolve-btn"
                                    disabled={isUpgrading}
                                    onClick={handleLevelUp}
                                >
                                    Solidify & Evolve
                                </button>
                            )}
                            <p className="manual-hint">Manual confirmation required to upgrade phase.</p>
                        </div>
                    ) : (
                        <div className="evolution-status-message">
                            Continuing baseline execution. Evolution gates are currently locked.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SkillPage;
