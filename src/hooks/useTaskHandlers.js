import { useState, useCallback } from 'react';
import { backbone, NodeTypes, TaskStatuses } from '../backbone-v2/index';
import { arrayMove } from '@dnd-kit/sortable';

/**
 * Custom hook to manage task and aspect-related state and handlers.
 */
export const useTaskHandlers = ({
    id,
    allNodes,
    setAllNodes,
    fetchData,
    getChildren,
    energyLevel,
    handleLogPulse
}) => {
    // Aspect Creation State
    const [creatingAspectForObjId, setCreatingAspectForObjId] = useState(null);
    const [newAspectName, setNewAspectName] = useState('');

    // Task Creation State
    const [creatingTaskForAspectId, setCreatingTaskForAspectId] = useState(null);
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskDependencyId, setNewTaskDependencyId] = useState('');
    const [newTaskItemType, setNewTaskItemType] = useState('FINITE'); // 'FINITE' or 'REPETITION'
    const [newTaskUnitName, setNewTaskUnitName] = useState('units');
    const [newTaskTargetUnits, setNewTaskTargetUnits] = useState(0);

    // Drag-and-Drop State
    const [dragActiveId, setDragActiveId] = useState(null);

    // Deletion State
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [aspectToDelete, setAspectToDelete] = useState(null);

    // Expansion & UI State
    const [isSleepingExpanded, setIsSleepingExpanded] = useState(false);
    const [expandedTaskIds, setExpandedTaskIds] = useState([]);
    const [isSelectingRewardForTaskId, setIsSelectingRewardForTaskId] = useState(null);

    // UI Feedback State
    const [planningToast, setPlanningToast] = useState(null);

    /**
     * Helper to check if an experiment should be paused after a task is completed/deleted.
     */
    const checkAndAutoPauseExperiment = useCallback(async (experimentId, currentTaskId) => {
        if (!experimentId) return;
        const experiment = allNodes.find(n => n.id === experimentId);
        if (experiment && experiment.metadata?.status === 'ACTIVE') {
            const aspectIds = allNodes.filter(n => n.parentId === experimentId && n.type === NodeTypes.ASPECT).map(n => n.id);
            const otherPending = allNodes.filter(n => 
                n.type === NodeTypes.TASK && 
                aspectIds.includes(n.parentId) && 
                n.id !== currentTaskId && 
                n.metadata?.status !== TaskStatuses.DONE
            );
            if (otherPending.length === 0) {
                try {
                    await backbone.updateNode(experimentId, {
                        metadata: {
                            ...experiment.metadata,
                            status: 'ROTATING',
                            isActive: false,
                            deactivatedAt: Date.now()
                        }
                    });
                    fetchData();
                } catch (err) {
                    console.error("[AUTO-PAUSE] Failed to auto-pause experiment", err);
                }
            } else {
                fetchData();
            }
        } else {
            fetchData();
        }
    }, [allNodes, fetchData]);

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
            metadata.targetUnits = (newTaskTargetUnits === '' || parseInt(newTaskTargetUnits) === 0) ? 0 : parseInt(newTaskTargetUnits);
            metadata.currentUnits = 0;
        }

        setNewTaskName('');
        setNewTaskDependencyId('');
        setNewTaskItemType('FINITE');
        setNewTaskUnitName('units');
        setNewTaskTargetUnits(0);
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
                        currentUnits: nextUnits,
                        repetitionTimestamps: [...(n.metadata?.repetitionTimestamps || []), Date.now()]
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
            .then(() => {
                if (nextUnits >= targetUnits && targetUnits > 0) {
                    const parentAspect = allNodes.find(n => n.id === parentAspectId);
                    checkAndAutoPauseExperiment(parentAspect?.parentId, taskId);
                } else {
                    fetchData();
                }
            })
            .catch(error => {
                console.error("Failed to increment repetition:", error);
                fetchData();
            });
    }, [allNodes, setAllNodes, fetchData, checkAndAutoPauseExperiment]);

    const handleToggleTaskStatus = useCallback((task) => {
        const currentStatus = task.metadata?.status || TaskStatuses.NOT_STARTED;
        const nextStatus = currentStatus === TaskStatuses.DONE ? TaskStatuses.NOT_STARTED : TaskStatuses.DONE;
        const completedAt = nextStatus === TaskStatuses.DONE ? Date.now() : null;

        const isMVETask = task.name.toLowerCase().includes('minimum viable effort') || 
                          task.metadata?.isMVETask ||
                          (energyLevel <= 2);

        if (isMVETask && nextStatus === TaskStatuses.DONE) {
            const parentAspect = allNodes.find(n => n.id === task.parentId);
            const parentExperiment = allNodes.find(n => n.id === parentAspect?.parentId);
            if (parentExperiment) {
                handleLogPulse(parentExperiment);
            }

            backbone.updateNode(task.id, {
                metadata: {
                    ...task.metadata,
                    status: TaskStatuses.NOT_STARTED,
                    completedAt: null,
                    lastPulseAt: Date.now()
                }
            }).catch(console.error);

            setAllNodes(prev => prev.map(n => n.id === task.id ? { ...n, metadata: { ...n.metadata, status: TaskStatuses.NOT_STARTED, completedAt: null } } : n));
            return;
        }

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
                status: nextStatus,
                completedAt
            }
        }).then(() => {
            if (nextStatus === TaskStatuses.DONE) {
                const parentAspect = allNodes.find(n => n.id === task.parentId);
                checkAndAutoPauseExperiment(parentAspect?.parentId, task.id);
            } else {
                fetchData();
            }
        }).catch(error => {
            console.error("[DEBUG SkillPage] Failed to toggle task status:", error);
            fetchData();
        });
    }, [fetchData, allNodes, setAllNodes, handleLogPulse, checkAndAutoPauseExperiment, energyLevel]);

    const handleAddToToday = useCallback((e, taskId) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        const task = allNodes.find(n => n.id === taskId);
        if (!task) return;

        const isToday = !!task.metadata?.isToday;
        const isTomorrow = !!task.metadata?.tomorrow;

        let nextState = {};
        if (!isToday && !isTomorrow) {
            nextState = { isToday: true, tomorrow: false };
        } else if (isToday && !isTomorrow) {
            nextState = { isToday: false, tomorrow: true };
            setPlanningToast("Moved to tomorrow");
            setTimeout(() => setPlanningToast(null), 2000);
        } else {
            nextState = { isToday: false, tomorrow: false };
        }

        setAllNodes(prevNodes => prevNodes.map(n => {
            if (n.id === taskId) {
                return {
                    ...n,
                    metadata: {
                        ...n.metadata,
                        ...nextState
                    }
                };
            }
            return n;
        }));

        backbone.updateNode(taskId, {
            metadata: nextState
        }).catch(error => {
            console.error("[DEBUG SkillPage] Failed to toggle planning status:", error);
            fetchData();
        });
    }, [allNodes, setAllNodes, fetchData]);

    const handleDeleteTask = useCallback(async () => {
        if (!taskToDelete) return;
        const idToDelete = taskToDelete.id;
        const taskParentId = taskToDelete.parentId;
        setTaskToDelete(null);

        const parentAspect = allNodes.find(n => n.id === taskParentId);
        const experimentId = parentAspect?.parentId;

        backbone.deleteNode(idToDelete)
            .then(() => {
                if (experimentId) {
                    checkAndAutoPauseExperiment(experimentId, idToDelete);
                } else {
                    fetchData();
                }
            })
            .catch(error => {
                console.error("Failed to delete task:", error);
                alert("Error deleting task: " + error.message);
                fetchData();
            });
    }, [taskToDelete, fetchData, allNodes, checkAndAutoPauseExperiment]);

    const handleDeleteAspect = useCallback(async () => {
        if (!aspectToDelete) return;
        const idToDelete = aspectToDelete.id;
        const experimentId = aspectToDelete.parentId;
        setAspectToDelete(null);

        try {
            await backbone.deleteNode(idToDelete);
            if (experimentId) {
                await checkAndAutoPauseExperiment(experimentId, null);
            } else {
                fetchData();
            }
        } catch (error) {
            console.error("Failed to delete aspect:", error);
            alert("Error deleting aspect: " + error.message);
            fetchData();
        }
    }, [aspectToDelete, fetchData, checkAndAutoPauseExperiment]);

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
    }, [allNodes, setAllNodes]);

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
    }, [allNodes, setAllNodes, getChildren]);

    // ─── Reward Handlers ──────────────────────────────────────────────────────
    const handleRemoveReward = useCallback(async (taskId) => {
        // Optimistic UI
        setAllNodes(prev => prev.map(n =>
            n.id === taskId
                ? { ...n, metadata: { ...n.metadata, rewardId: null } }
                : n
        ));
        try {
            await backbone.updateNode(taskId, { metadata: { rewardId: null } });
        } catch (err) {
            console.error('[useTaskHandlers] handleRemoveReward failed:', err);
            fetchData(); // revert on failure
        }
    }, [setAllNodes, fetchData]);

    const handleAttachReward = useCallback(async (taskId, rewardId) => {
        // Close picker immediately
        setIsSelectingRewardForTaskId(null);
        // Optimistic UI
        setAllNodes(prev => prev.map(n =>
            n.id === taskId
                ? { ...n, metadata: { ...n.metadata, rewardId } }
                : n
        ));
        try {
            await backbone.updateNode(taskId, { metadata: { rewardId } });
        } catch (err) {
            console.error('[useTaskHandlers] handleAttachReward failed:', err);
            fetchData(); // revert on failure
        }
    }, [setAllNodes, setIsSelectingRewardForTaskId, fetchData]);

    const handleSaveMVE = useCallback((aspectId, mveText) => {
        console.warn('[useTaskHandlers] handleSaveMVE not yet implemented', aspectId, mveText);
    }, []);


    return {
        // State
        creatingAspectForObjId, setCreatingAspectForObjId,
        newAspectName, setNewAspectName,
        creatingTaskForAspectId, setCreatingTaskForAspectId,
        newTaskName, setNewTaskName,
        newTaskDependencyId, setNewTaskDependencyId,
        newTaskItemType, setNewTaskItemType,
        newTaskUnitName, setNewTaskUnitName,
        newTaskTargetUnits, setNewTaskTargetUnits,
        dragActiveId, setDragActiveId,
        taskToDelete, setTaskToDelete,
        aspectToDelete, setAspectToDelete,
        planningToast, setPlanningToast,
        isSleepingExpanded, setIsSleepingExpanded,
        expandedTaskIds, setExpandedTaskIds,
        isSelectingRewardForTaskId, setIsSelectingRewardForTaskId,

        // Handlers
        handleCreateAspect,
        handleCreateTask,
        handleIncrementRepetition,
        handleToggleTaskStatus,
        handleAddToToday,
        handleDeleteTask,
        handleDeleteAspect,
        handleTaskDragStart,
        handleDragOver,
        handleDragEnd,
        checkAndAutoPauseExperiment,
        handleRemoveReward,
        handleAttachReward,
        handleSaveMVE,
    };
};

export default useTaskHandlers;
