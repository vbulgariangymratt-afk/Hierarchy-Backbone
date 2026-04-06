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
import { useSettings } from '../context/SettingsContext';
import './SkillPage.css';
import { Pencil } from 'lucide-react';

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
    const { energyLevel } = useSettings();
    const [skill, setSkill] = useState(null);
    const [allNodes, setAllNodes] = useState([]);
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
    const [planningToast, setPlanningToast] = useState(null);
    const [newHabitTrigger, setNewHabitTrigger] = useState('');
    const [newHabitAction, setNewHabitAction] = useState('');
    const [newHabitPeriod, setNewHabitPeriod] = useState('day');
    const [newHabitCount, setNewHabitCount] = useState(1);
    const [skillHabits, setSkillHabits] = useState([]);
    
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

    const objectives = useMemo(() => 
        (allNodes || []).filter(n => n.type === NodeTypes.OBJECTIVE && n.parentId === id),
    [allNodes, id]);

    const habits = useMemo(() => skillHabits, [skillHabits]);

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
    const activeObjectives = useMemo(() => {
        console.log('[FILTER] objectives coming in:', objectives.length);
        console.log('[OBJECTIVE RAW]', objectives.map(o => ({
            id: o.id,
            name: o.name,
            status: o.metadata?.status,
            childCount: allNodes.filter(n => n.parentId === o.id).length,
            children: allNodes.filter(n => n.parentId === o.id).map(n => ({
              id: n.id,
              name: n.name,
              type: n.type,
              status: n.metadata?.status
            }))
        })));
        return objectives.filter(o => {
            const keep = !o.metadata?.isArchived && !o.metadata?.isSleeping && o.metadata?.status !== 'COMPLETED' && o.metadata?.status !== 'ACHIEVED';
            console.log('[FILTER] node:', o.id, 'status:', o.metadata?.status, 'keep:', keep);
            return keep;
        });
    }, [objectives]);

    const archivedObjectives = useMemo(() => 
        objectives.filter(o => 
            o.metadata?.status === ObjectiveStatuses.COMPLETED || 
            o.metadata?.status === ObjectiveStatuses.ACHIEVED || 
            o.metadata?.isArchived === true
        ), 
    [objectives]);

    const sleepingObjectives = useMemo(() => 
        objectives.filter(o => o.metadata?.status === ObjectiveStatuses.SLEEPING || o.metadata?.isSleeping === true), 
    [objectives]);

    const anyBurnoutRisk = useMemo(() => 
        activeObjectives.some(o => o.metadata?.burnoutRisk === true), 
    [activeObjectives]);

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

        const belongsToSkill = (nodeId) => {
            let curr = allNodes.find(n => n.id === nodeId);
            while (curr) {
                if (curr.id === id) return true;
                curr = allNodes.find(n => n.id === curr.parentId);
            }
            return false;
        };

        const tasks = allNodes.filter(n => n.type === NodeTypes.TASK && belongsToSkill(n.id));

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

        const aspects = allNodes.filter(n => n.type === NodeTypes.ASPECT && belongsToSkill(n.id));
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

        habits.filter(h => h.isActive && h.skillId === id).forEach(h => {
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
        const [nodes, habitsData] = await Promise.all([
            repository.getAll(),
            habitService.getHabitsBySkill(id)
        ]);
            setAllNodes(nodes);
            setSkillHabits(habitsData || []);
            
            const skillNode = nodes.find(n => n.id === id);
            if (skillNode) {
                setSkill(skillNode);
                setTempBecoming(skillNode.metadata?.identityAnchor || '');
            } else {
                console.log("SkillPage fetch - Skill node not found for ID:", id);
                setSkill(null);
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
                        metadata: { identityAnchor: val }
                    });
                } finally {
                    setIsSyncingBecoming(false);
                }
            }, 800); 
        };
    }, [skill?.id, skill?.metadata]);

    const handleLogPulse = useCallback(async (obj) => {
        console.log(`[PULSE] Logging MVE for objective: ${obj.id}`);
        try {
            await backbone.awardHryvnia(1, "MVE Pulse");
            await backbone.incrementDailyCompletionCount();
            
            const now = Date.now();
            await backbone.updateNode(obj.id, {
                metadata: {
                    ...obj.metadata,
                    mveCompletedAt: now
                }
            });
            fetchData();
        } catch (error) {
            console.error("Failed to log MVE pulse:", error);
        }
    }, [fetchData]);

    const handleStatusUpdate = useCallback(async (obj, newStatus) => {
        const now = Date.now();
        const metadata = { ...obj.metadata };
        const oldStatus = obj.metadata?.status || (obj.metadata?.isSleeping ? 'SLEEPING' : (obj.metadata?.isArchived ? 'COMPLETED' : 'ACTIVE'));
        
        // Timer Logic: If we were paused/sleeping and are now resuming, shift activatedAt forward
        if (newStatus === 'ACTIVE' && (oldStatus === 'SLEEPING' || oldStatus === 'ROTATING')) {
            if (metadata.deactivatedAt && metadata.activatedAt) {
                const pauseDuration = now - metadata.deactivatedAt;
                metadata.activatedAt = metadata.activatedAt + pauseDuration;
            }
        }

        if (newStatus === 'ACTIVE') {
            const activeInSkill = objectives.filter(o => o.metadata?.isActive === true).length;
            if (activeInSkill >= 1 && !obj.metadata?.isActive) {
                setIsLimitModalOpen(true);
                return;
            }
            metadata.status = 'ACTIVE';
            metadata.isActive = true;
            metadata.isSleeping = false;
            metadata.isArchived = false;
            if (!metadata.activatedAt) metadata.activatedAt = now;
            metadata.deactivatedAt = null;
        } else if (newStatus === 'SLEEPING') {
            metadata.status = 'SLEEPING';
            metadata.isActive = false;
            metadata.isSleeping = true;
            metadata.isArchived = false;
            metadata.deactivatedAt = now;
        } else if (newStatus === 'COMPLETED') {
            metadata.status = 'COMPLETED';
            metadata.isActive = false;
            metadata.isSleeping = false;
            metadata.isArchived = true;
            metadata.completedAt = now;
            metadata.deactivatedAt = now;
        } else if (newStatus === 'ROTATING') {
            // Paused state
            metadata.status = 'ROTATING';
            metadata.isActive = false;
            metadata.isSleeping = false;
            metadata.isArchived = false;
            metadata.deactivatedAt = now;
        }

        try {
            await backbone.updateNode(obj.id, { metadata });
            fetchData();
        } catch (error) {
            console.error("Failed to update objective status:", error);
        }
    }, [objectives, fetchData]);

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
            metadata: { wish: tempWish }
        }).catch(error => {
            console.error("[DEBUG SkillPage] Failed to save wish inline:", error);
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
            metadata: { outcome: tempOutcome }
        }).catch(error => {
            console.error("[DEBUG SkillPage] Failed to save outcome inline:", error);
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
        console.log(`[DEBUG SkillPage] handleSuggestionClick - patching metadata.isToday for ${task.id}`);
        backbone.updateNode(task.id, {
            metadata: { isToday: true }
        }).catch(err => {
            console.error("[DEBUG SkillPage] Failed to add suggestion to today:", err);
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

        // MVE Repeating Task Logic: In Energy 1-2, MVE tasks are 'Indestructible' pulses
        const isMVETask = task.name.toLowerCase().includes('minimum viable effort') || 
                          task.metadata?.isMVETask ||
                          (task.name.toLowerCase() === (allNodes.find(n => n.id === (allNodes.find(a => a.id === task.parentId)?.parentId))?.metadata?.mve || '').toLowerCase()) ||
                          (energyLevel <= 2); // In low energy mode, any interaction on this page is a pulse pulse reset

        if (isMVETask && nextStatus === TaskStatuses.DONE) {
            console.log(`[MVE] Pulse detected for task: ${task.name}. Resetting to uncompleted state.`);
            
            // 1. Find parent experiment to trigger the MVE Portal
            const parentAspect = allNodes.find(n => n.id === task.parentId);
            const parentExperiment = allNodes.find(n => n.id === parentAspect?.parentId);
            if (parentExperiment) {
                handleLogPulse(parentExperiment);
            }

            // 2. Persist completion log but reset the UI state to 0%/Not Started
            backbone.updateNode(task.id, {
                metadata: {
                    ...task.metadata,
                    status: TaskStatuses.NOT_STARTED,
                    completedAt: null,
                    lastPulseAt: Date.now()
                }
            }).catch(console.error);

            // Optimistic reset in UI
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

        console.log(`[DEBUG SkillPage] handleToggleTaskStatus - patching metadata.status to ${nextStatus} for ${task.id}`);
        backbone.updateNode(task.id, {
            metadata: {
                status: nextStatus,
                completedAt
            }
        }).catch(error => {
            console.error("[DEBUG SkillPage] Failed to toggle task status:", error);
            fetchData();
        });
    }, [fetchData, allNodes, handleLogPulse]);

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

        console.log(`[DEBUG SkillPage] handleAddToToday - patching metadata for ${taskId}:`, nextState);
        backbone.updateNode(taskId, {
            metadata: nextState
        }).catch(error => {
            console.error("[DEBUG SkillPage] Failed to toggle planning status:", error);
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
                metadata: { notes }
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
                metadata: { rewardId }
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
                metadata: { rewardId: null }
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
                        metadata: { orderIndex: index }
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
                newHabitAction.trim(),
                newHabitPeriod,
                parseInt(newHabitCount)
            );
            setNewHabitTrigger('');
            setNewHabitAction('');
            setNewHabitPeriod('day');
            setNewHabitCount(1);
            setIsCreatingHabit(false);
            fetchData();
        } catch (error) {
            console.error("Failed to create habit:", error);
        }
    }, [newHabitTrigger, newHabitAction, newHabitPeriod, newHabitCount, id, fetchData]);

    const getObjectiveTimeInfo = useCallback((obj) => {
        const m = obj.metadata || {};
        const isActive = m.isActive === true || (!m.isActive && !m.isSleeping && !m.isArchived);
        const isPaused = m.status === 'ROTATING' || m.status === 'SLEEPING' || m.isSleeping;
        
        if ((!isActive && !isPaused) || !m.activatedAt) return null;

        const now = Date.now();
        const endTime = (isPaused && m.deactivatedAt) ? m.deactivatedAt : now;
        const diff = endTime - m.activatedAt;
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

    // --- EXPIRY DECISION FLOW ---
    const expiringObjective = useMemo(() => {
        return (activeObjectives || []).find(obj => {
            if (!obj.metadata?.activatedAt || !obj.metadata?.durationInDays) return false;
            const expiry = obj.metadata.activatedAt + (obj.metadata.durationInDays * 24 * 60 * 60 * 1000);
            return Date.now() >= expiry;
        });
    }, [activeObjectives]);

    const handleCompleteExpiry = async (id) => {
        await backbone.completeObjective(id);
        fetchData(); // Sync local state
    };

    const handleExtendExpiry = async (id, days = 7) => {
        await backbone.extendObjective(id, days);
        fetchData();
    };

    const handleArchiveExpiry = async (id) => {
        const obj = activeObjectives.find(o => o.id === id);
        if (!obj) return;
        await backbone.updateNode(id, {
            metadata: {
                ...obj.metadata,
                status: ObjectiveStatuses.ARCHIVED,
                isActive: false,
                isArchived: true,
                archivedAt: Date.now()
            }
        });
        fetchData();
    };
    // ----------------------------

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

    // Auto-expand active experiments in Energy 3-5 on entry
    useEffect(() => {
        if (!loading && energyLevel >= 3 && activeObjectives.length > 0) {
            setExpandedObjectiveIds(prev => {
                const activeIds = activeObjectives.map(o => o.id);
                const missingIds = activeIds.filter(id => !prev.includes(id));
                if (missingIds.length === 0) return prev;
                return [...prev, ...missingIds];
            });
        }
    }, [loading, energyLevel, skill?.id]);

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

    // --- ENERGY 1-2 GATING: SURVIVAL VIEW ---
    if (energyLevel <= 2) {
        const mveTask = allNodes.find(n => 
            n.type === NodeTypes.TASK && 
            n.metadata?.status !== TaskStatuses.DONE &&
            n.metadata?.isLowEnergySafe !== false &&
            getChildren(n.parentId, NodeTypes.TASK).some(t => {
                const aspect = allNodes.find(a => a.id === n.parentId);
                const obj = allNodes.find(o => o.id === aspect?.parentId);
                return obj?.parentId === skill.id;
            })
        );

        let displayedHabits = habits;
        if (energyLevel === 1) {
            const getHabitScore = (habit) => {
                const completions = habit.completions || [];
                const frictionScores = { light: 1, medium: 2, heavy: 3 };
                const last8 = completions.slice(-8);
                const avgFriction = last8.length > 0 
                    ? last8.reduce((sum, c) => sum + frictionScores[c.friction], 0) / last8.length 
                    : 3;
                const twelveDaysAgo = Date.now() - (12 * 24 * 60 * 60 * 1000);
                const uniqueDays = new Set(completions.filter(c => c.timestamp >= twelveDaysAgo).map(c => new Date(c.timestamp).toLocaleDateString('en-CA'))).size;
                const stability = uniqueDays / 12;
                return avgFriction - (stability * 2); 
            };
            displayedHabits = [...habits].sort((a, b) => getHabitScore(a) - getHabitScore(b)).slice(0, 2);
        }

        return (
            <div className="skill-page energy-survival-mode" style={{ background: 'var(--bg-app)', minHeight: '100vh', padding: '40px' }}>
                <button className="back-button" onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '40px' }}>
                    <span>&larr;</span> Back
                </button>
                
                <div style={{ maxWidth: '440px', margin: '60px auto 0 auto', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '32px', color: '#fff', marginBottom: '8px', fontWeight: 800, letterSpacing: '-0.03em' }}>Fuel: {skill.name}</h1>
                    <p style={{ color: '#444', fontSize: '15px', marginBottom: '48px', fontWeight: 500 }}>Just a tiny win for your future self.</p>

                    <div className="mini-launchpad-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '28px', padding: '48px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <h2 style={{ fontSize: '22px', color: '#fff', marginBottom: '12px', fontWeight: 600, lineHeight: 1.3 }}>{mveTask?.name || "Ready to focus?"}</h2>
                        <p style={{ color: '#444', fontSize: '13px', marginBottom: '40px', fontWeight: 700, letterSpacing: '0.05em' }}>⏱️ 2 MIN SPRINT</p>

                        <button 
                            className="start-focus-btn"
                            onClick={() => mveTask && navigate('/focus', { state: { taskId: mveTask.id, autoStart: true } })}
                            style={{ width: '100%', padding: '20px', borderRadius: '18px', background: '#fff', color: '#000', fontSize: '18px', fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                            onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
                            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                        >
                            Start Focus Session
                        </button>
                    </div>

                    {displayedHabits.length > 0 && (
                        <div style={{ marginTop: '48px', textAlign: 'left' }}>
                            <div style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.05)' }}></div>
                                Maintenance
                                <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.05)' }}></div>
                            </div>
                            <div className="survival-habits-grid" style={{ display: 'grid', gap: '12px' }}>
                                {displayedHabits.map(habit => (
                                    <div 
                                        key={habit.id} 
                                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                    >
                                        <div>
                                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{habit.ifTrigger} &rarr; {habit.phases[habit.currentPhaseLevel || 0]?.description}</div>
                                            <div style={{ color: '#444', fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>{habitService.getHabitProgress(habit).displayProgress}</div>
                                        </div>
                                        <button 
                                            onClick={() => handleHabitComplete(habit.id)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            Done
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button 
                         onClick={() => navigate('/launchpad')}
                         style={{ marginTop: '32px', background: 'transparent', border: 'none', color: '#333', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}
                    >
                        Go back to Launchpad
                    </button>
                </div>
            </div>
        );
    }


    const PinchAnalysis = ({ skill, energyLevel }) => {
        if (energyLevel < 4) return null;
        const pinch = skill.metadata?.pinchState;
        if (!pinch || pinch === 'NONE') return null;

        const driverMapping = {
            'NOVELTY': 'Novelty',
            'CHALLENGE': 'Challenge',
            'PASSION': 'Passion',
            'INTEREST': 'Flow',
            'HURRY': 'Hurry'
        };
        const driverName = driverMapping[pinch] || pinch;

        return (
            <div className="pinch-analysis-station" style={{ marginTop: '48px', background: 'transparent', border: 'none', padding: '0' }}>
                <div className="pinch-status-header" style={{ marginBottom: '4px' }}>
                    <p style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: '400', letterSpacing: '-0.01em', margin: 0, padding: '2px 0' }}>
                        • Your brain needs to feel "{driverName}" right now to reach peak performance.
                    </p>
                </div>
                <div className="pinch-body">
                    <p className="pinch-explanation" style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6', maxWidth: '600px', margin: 0, padding: '2px 0' }}>
                        • {pinch === 'NOVELTY' && "Attention is decaying. The current experiment structure has become predictable. Consider a 'Micro-Pivot' or adding a fresh Aspect."}
                        {pinch === 'CHALLENGE' && "Mastery has plateaued. You are going through the motions without growth. Increase the difficulty or move to a more complex stage."}
                        {pinch === 'PASSION' && "High value, high resistance. Your 'Becoming' statement is strong, but initiation is blocked. Break the next task into a 2-minute Minimum Viable Effort."}
                        {pinch === 'INTEREST' && "Low intrinsic fuel. This skill needs more 'Play' or 'Novelty' to sustain momentum. Look for an unorthodox angle."}
                        {pinch === 'HURRY' && "Execution lag detected. You are over-planning. Pick any task and start for 5 minutes now."}
                    </p>
                </div>
            </div>
        );
    };

    const renderObjective = (obj) => {

        const isEditing = editingObjectiveId === obj.id;
        const isExpanded = expandedObjectiveIds.includes(obj.id);
        const isSleeping = obj.metadata?.isSleeping === true;
        const aspects = getChildren(obj.id, NodeTypes.ASPECT);
        const timeInfo = getObjectiveTimeInfo(obj);

        // Dynamic Calculation of Experiment Metric (Accumulated)
        const allTasksInExperiment = aspects.flatMap(a => getChildren(a.id, NodeTypes.TASK));
        const totalCompletedInExperiment = allTasksInExperiment.filter(t => t.metadata?.status === TaskStatuses.DONE).length;
        const mveFocusTask = allTasksInExperiment.find(t => t.metadata?.status !== TaskStatuses.DONE);
        const todayStr = new Date().toDateString();
        const isMVECompletedToday = obj.metadata?.mveCompletedAt && 
            new Date(obj.metadata.mveCompletedAt).toDateString() === todayStr;
        
        // Final value to display as the experiment metric
        let accumulationValue = 0;
        const accType = obj.metadata?.accumulationType;
        
        if (accType === 'minutes') {
            accumulationValue = allTasksInExperiment.reduce((sum, t) => {
                const sessMin = (t.metadata?.sessions || []).reduce((sSum, s) => {
                    if (s.status === 'completed' && s.actualDuration) {
                        return sSum + Math.round(s.actualDuration / 60);
                    }
                    return sSum;
                }, 0);
                return sum + sessMin;
            }, 0);
        } else if (accType === 'reps') {
            accumulationValue = allTasksInExperiment.reduce((sum, t) => sum + (t.metadata?.currentUnits || 0), 0);
        } else if (accType === 'sessions') {
            accumulationValue = allTasksInExperiment.reduce((sum, t) => sum + (t.metadata?.sessions || []).filter(s => s.status === 'completed').length, 0);
        } else {
            // THE BUG FIX: Default to count of completed tasks (e.g. for "Fixes")
            accumulationValue = totalCompletedInExperiment;
        }

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
                            <label>Minimum Viable Effort</label>
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
                    layout={energyLevel > 2 ? "position" : false}
                    key={obj.id}
                    transition={macOSSpring}
                >
                    <div 
                        className={`objective-container ${isSleeping ? 'is-sleeping' : 'is-focused'} ${obj.metadata?.burnoutRisk ? 'burnout-risk-border' : ''}`}
                    >
                    {energyLevel >= 3 && (
                        <div 
                            className="objective-header" 
                            onClick={() => !isSleeping && toggleObjective(obj.id)}
                            style={{
                                paddingBottom: energyLevel >= 5 ? '12px' : '24px',
                                borderBottom: energyLevel >= 5 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                                position: 'relative'
                            }}
                        >
                        <div className="objective-header-left" style={{ display: 'flex', alignItems: 'flex-start', marginLeft: '-38px' }}>
                            <span className={`objective-toggle-icon ${isExpanded && !isSleeping ? 'expanded' : ''}`} style={{ marginTop: '2px', marginRight: '8px' }}>
                                {isSleeping ? '💤' : (obj.metadata?.iconUrl ? <NodeIcon iconUrl={obj.metadata.iconUrl} size={18} /> : '‣')}
                            </span>
                            <div className="objective-title-stack" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                                    <span className="objective-title-static" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.01em' }} onDoubleClick={(e) => { e.stopPropagation(); handleStartInlineEdit(obj.id, obj.name); }}>{obj.name}</span>
                                )}
                                {energyLevel >= 4 && (
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', opacity: 0.8, lineHeight: '1.4', maxWidth: '500px' }}>
                                        {obj.metadata?.wish || "Something worth doing."}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="objective-action-strip" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                 {energyLevel >= 4 && (
                                     <button
                                         onClick={() => handleStartEditObjective(obj)}
                                         style={{
                                             display: 'flex',
                                             alignItems: 'center',
                                             justifyContent: 'center',
                                             width: '28px',
                                             height: '28px',
                                             borderRadius: '6px',
                                             background: 'rgba(255, 255, 255, 0.03)',
                                             border: '1px solid rgba(255, 255, 255, 0.04)',
                                             color: 'var(--text-secondary)',
                                             cursor: 'pointer',
                                             transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                             flexShrink: 0
                                         }}
                                         className="experiment-edit-pill"
                                         onMouseEnter={(e) => {
                                             e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                             e.currentTarget.style.color = 'white';
                                         }}
                                         onMouseLeave={(e) => {
                                             e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                             e.currentTarget.style.color = 'var(--text-secondary)';
                                         }}
                                     >
                                         <Pencil size={11} strokeWidth={2.5} />
                                     </button>
                                 )}
                             <div className="experiment-progress-strip" style={{ 
                                 display: 'flex', 
                                 alignItems: 'center', 
                                 gap: '10px', 
                                 background: 'rgba(255, 255, 255, 0.03)', 
                                 boxSizing: 'border-box',
                                 height: '28px',
                                 padding: '0 12px', 
                                 lineHeight: '1',
                                 borderRadius: '6px', 
                                 fontSize: '11px', 
                                 fontWeight: '600', 
                                 color: 'var(--text-secondary)',
                                 border: '1px solid rgba(255, 255, 255, 0.04)',
                                 backdropFilter: 'blur(8px)',
                                 WebkitBackdropFilter: 'blur(8px)'
                             }}>
                                {timeInfo && (
                                    <span className="day-info" style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                        Day {timeInfo.days}{obj.metadata?.durationInDays ? `/${obj.metadata.durationInDays}d` : ''}
                                    </span>
                                )}
                                <span style={{ opacity: 0.1, width: '1px', height: '10px', background: 'currentColor' }}></span>
                                <span className="metric-info" style={{ opacity: 0.8 }}>
                                    {accumulationValue} {obj.metadata?.accumulationType || 'units'}
                                </span>
                                {energyLevel >= 3 && obj.metadata?.mve && (
                                    <>
                                        <span style={{ opacity: 0.1, width: '1px', height: '10px', background: 'currentColor' }}></span>
                                        <div className="mve-stealth-anchor">
                                            <span className="mve-stealth-icon" style={{ opacity: 0.8, cursor: 'help', display: 'flex', alignItems: 'center' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
                                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                                </svg>
                                            </span>
                                            <div className="mve-stealth-tooltip">
                                                <div className="tooltip-label">Minimum Viable Effort</div>
                                                {obj.metadata.mve}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="objective-status-actions">
                                <select 
                                    className="objective-status-selector"
                                    value={obj.metadata?.status || (obj.metadata?.isSleeping ? 'SLEEPING' : (obj.metadata?.isArchived ? 'COMPLETED' : 'ACTIVE'))}
                                    onChange={(e) => handleStatusUpdate(obj, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="SLEEPING">Sleeping</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="ROTATING">Paused</option>
                                </select>
                                
                                <button 
                                    className="trash-experiment-btn"
                                    title="Delete Experiment"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteObjective(obj);
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        </div>
                    )}
                    {energyLevel <= 2 && (
                        <div 
                            key="mve-portal-always-on"
                            className="objective-content mve-portal-active"
                            style={{ overflow: 'visible', padding: '0 24px 24px' }}
                        >
                                         <motion.div 
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="mve-hero-portal-combined"
                                                style={{
                                                    textAlign: 'center',
                                                    padding: '48px 32px',
                                                    margin: '12px 0 32px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '20px',
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    backdropFilter: 'blur(32px) saturate(140%)',
                                                    WebkitBackdropFilter: 'blur(32px) saturate(140%)',
                                                    borderRadius: '28px',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
                                                
                                                {isMVECompletedToday && (
                                                    <div style={{ position: 'relative', zIndex: 3, marginBottom: '16px' }}>
                                                        <div style={{ color: 'var(--color-primary)', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>MVE Unlocked</div>
                                                        <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>Great Work. The rest is bonus.</div>
                                                    </div>
                                                )}

                                                <div className="mve-intro" style={{ color: '#a1a1aa', fontSize: '15px', fontWeight: '500', opacity: 0.9, letterSpacing: '-0.01em' }}>
                                                    Since you're feeling low energy, why don't you
                                                </div>
                                                <h2 className="mve-task" style={{ color: '#ffffff', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.03em', maxWidth: '580px', lineHeight: '1.25', margin: 0 }}>
                                                    {obj.metadata?.mve || 'Just reflect back on what is working'}
                                                </h2>
                                                
                                                <div className="mve-actions" style={{ marginTop: '12px', display: 'flex', gap: '14px', zIndex: 2 }}>
                                                    <button 
                                                        className="pulse-log-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleLogPulse(obj);
                                                        }}
                                                        style={{
                                                            padding: '12px 28px',
                                                            borderRadius: '14px',
                                                            background: isMVECompletedToday ? 'rgba(255, 255, 255, 0.1)' : 'var(--color-primary)',
                                                            color: 'white',
                                                            border: isMVECompletedToday ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                                                            fontSize: '14px',
                                                            fontWeight: '700',
                                                            cursor: 'pointer',
                                                            boxShadow: isMVECompletedToday ? 'none' : '0 8px 20px rgba(var(--color-primary-rgb), 0.3)',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {isMVECompletedToday ? 'Pulse Logged' : 'Log Pulse'}
                                                    </button>
                                                    {mveFocusTask && (
                                                        <button 
                                                            className="focus-session-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate('/focus', { state: { taskId: mveFocusTask.id, autoStart: true } });
                                                            }}
                                                            style={{
                                                                padding: '12px 28px',
                                                                borderRadius: '14px',
                                                                background: 'rgba(255, 255, 255, 0.08)',
                                                                color: 'white',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                fontSize: '14px',
                                                                fontWeight: '600',
                                                                cursor: 'pointer',
                                                                backdropFilter: 'blur(10px)'
                                                            }}
                                                        >
                                                            Start Focus Session
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                <button 
                                                    className="goto-launchpad-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate('/launchpad');
                                                    }}
                                                    style={{
                                                        fontSize: '13px',
                                                        color: 'rgba(255,255,255,0.4)',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        marginTop: '8px',
                                                        textDecoration: 'underline'
                                                    }}
                                                >
                                                    Go to {skill?.name} Launchpad
                                                </button>
                                            </motion.div>
                        </div>
                    )}
                    {energyLevel > 2 && (
                        <AnimatePresence mode="wait">
                            {isExpanded && !isSleeping && (
                                <motion.div 
                                    key="experiment-content-expanded"
                                    className="objective-content"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={macOSSpring}
                                        style={{ overflow: 'visible' }}
                                    >
                                        <div style={{ overflow: 'visible' }}>
                                            {isMVECompletedToday && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mve-success-portal"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                        borderRadius: '20px',
                                                        padding: '24px',
                                                        marginBottom: '32px',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                        ,backdropFilter: 'blur(10px)'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ color: 'var(--color-primary)', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>MVE Unlocked</div>
                                                        <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>Great Work. The rest is bonus.</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '12px' }}>
                                                        <button 
                                                            onClick={() => navigate('/launchpad')}
                                                            style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', fontWeight: '600' }}
                                                        >
                                                            Go to Launchpad
                                                        </button>
                                                        {mveFocusTask && (
                                                            <button 
                                                                onClick={() => navigate('/focus', { state: { taskId: mveFocusTask.id, autoStart: true } })}
                                                                style={{ padding: '8px 16px', borderRadius: '10px', background: 'var(--color-primary)', color: 'white', border: 'none', fontSize: '12px', fontWeight: '600', boxShadow: '0 4px 12px rgba(var(--color-primary-rgb), 0.2)' }}
                                                            >
                                                                Start Focus Session
                                                            </button>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                            {energyLevel >= 5 && (
                                                <div className="experiment-display-card">
                                                    <AnimatePresence mode="wait">
                                                        <motion.div 
                                                            key="analytical-box"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="woop-box"
                                                            style={{ overflow: 'hidden' }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '40px', padding: '12px 0 24px 0' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                    <div style={{ fontSize: '15px', color: 'white', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                                                        <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Your wish:</span>
                                                                        <span style={{ color: '#a1a1aa', lineHeight: '1.5' }}>{obj.metadata?.wish || "the wish goes here"}</span>
                                                                    </div>

                                                                    <div style={{ fontSize: '15px', color: 'white', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                                                        <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Core outcome:</span>
                                                                        <span style={{ color: '#a1a1aa', lineHeight: '1.5' }}>{obj.metadata?.outcome || "outcome goes here"}</span>
                                                                    </div>
                                                                </div>

                                                                <span style={{ 
                                                                    background: 'rgba(255, 255, 255, 0.05)', 
                                                                    padding: '4px 10px', 
                                                                    borderRadius: '6px', 
                                                                    fontFamily: 'monospace', 
                                                                    fontSize: '12px', 
                                                                    color: 'var(--text-secondary)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                                                    whiteSpace: 'nowrap'
                                                                }}>Feedback and adjustment</span>
                                                            </div>
                                                        </motion.div>
                                                    </AnimatePresence>
                                                </div>
                                            )}
                                        </div>

                                        <AnimatePresence>
                                            {(energyLevel >= 3 || (obj.metadata?.mveCompletedAt && new Date(obj.metadata.mveCompletedAt).toDateString() === new Date().toDateString())) && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 20 }}
                                                    transition={macOSSpring}
                                                >
                                                    <div className="masonry-columns-wrapper" style={{ display: 'flex', gap: '24px', paddingTop: '8px' }}>
                                                        {(() => {
                                                            const leftColumn = [];
                                                            const rightColumn = [];
                                                            let leftHeight = 0;
                                                            let rightHeight = 0;

                                                            const sortedAspects = [...aspects].sort((a, b) => {
                                                                const aTasks = getChildren(a.id, NodeTypes.TASK);
                                                                const bTasks = getChildren(b.id, NodeTypes.TASK);
                                                                
                                                                const aToday = aTasks.some(t => t.metadata?.isToday);
                                                                const bToday = bTasks.some(t => t.metadata?.isToday);
                                                                
                                                                if (aToday && !bToday) return -1;
                                                                if (!aToday && bToday) return 1;
                                                                
                                                                const aFixes = aTasks.filter(t => t.metadata?.status === TaskStatuses.DONE).length;
                                                                const bFixes = bTasks.filter(t => t.metadata?.status === TaskStatuses.DONE).length;
                                                                
                                                                return bFixes - aFixes;
                                                            });

                                                            const aspectsToRender = energyLevel === 3 ? sortedAspects.slice(0, 2) : aspects;
                                    
                                                            aspectsToRender.forEach(aspect => {
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
                                                                                            className="aspect-name text-white font-semibold" 
                                                                                            onClick={e => e.stopPropagation()}
                                                                                            onDoubleClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                e.preventDefault();
                                                                                                handleStartInlineEdit(aspect.id, aspect.name);
                                                                                            }}
                                                                                            style={{ cursor: 'text', userSelect: 'none', color: 'white', fontWeight: 600 }}
                                                                                            title="Double-click to rename"
                                                                                        >{aspect.name}</span>
                                                                                    )}
                                                                                    <span className="aspect-task-count text-zinc-500" style={{ display: 'inline-flex', gap: '3px', color: '#71717a' }}>
                                                                                        {(() => {
                                                                                            const aspectTasksForCount = getChildren(aspect.id, NodeTypes.TASK);
                                                                                            const doneInAspect = aspectTasksForCount.filter(t => t.metadata?.status === TaskStatuses.DONE).length;
                                                                                            
                                                                                            let aVal = 0;
                                                                                            if (accType === 'minutes') {
                                                                                                aVal = aspectTasksForCount.reduce((sum, t) => sum + (t.metadata?.sessions || []).reduce((sSum, s) => s.status === 'completed' ? sSum + Math.round((s.actualDuration || 0) / 60) : sSum, 0), 0);
                                                                                            } else if (accType === 'reps') {
                                                                                                aVal = aspectTasksForCount.reduce((sum, t) => sum + (t.metadata?.currentUnits || 0), 0);
                                                                                            } else if (accType === 'sessions') {
                                                                                                aVal = aspectTasksForCount.reduce((sum, t) => sum + (t.metadata?.sessions || []).filter(s => s.status === 'completed').length, 0);
                                                                                            } else {
                                                                                                aVal = doneInAspect;
                                                                                            }
                                                                                            
                                                                                            return (
                                                                                                <>
                                                                                                    {aVal} {accType} &bull; {doneInAspect} logs
                                                                                                </>
                                                                                            );
                                                                                        })()}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="aspect-header-right">
                                                                                    {isNoveltyHighlighted && firstIncompleteTask && (
                                                                                        <button
                                                                                            className="novelty-sprint-btn"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleAddToToday(firstIncompleteTask);
                                                                                            }}
                                                                                        >
                                                                                            Sprint
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                            
                                                                            <div className="aspect-tasks">
                                                                                <AnimatePresence>
                                                                                    {aspectTasks.slice(0, visibleTasksCount).map(task => (
                                                                                        <SortableTaskRow 
                                                                                            key={task.id}
                                                                                            task={task}
                                                                                            isExpanded={expandedTaskIds.includes(task.id)}
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
                                                                        </div>
                                            
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
                                    </motion.div>
                                )}
                        </AnimatePresence>
                    )}
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

                <PinchAnalysis skill={skill} energyLevel={energyLevel} />
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




            {/* HABITS SECTION (Always Show) */}
            <section className="skill-section habits-skill-wrapper" style={{ marginTop: '32px' }}>
                <header className="section-header-row">
                    <span className="section-label">Habits</span>
                    {!isCreatingHabit && (
                        <button className="add-habit-trigger-btn" onClick={() => setIsCreatingHabit(true)}>+ Create Habit</button>
                    )}
                </header>

                {isCreatingHabit && (
                    <div className="habit-creation-inline glass-card">
                        <div className="creation-row">
                            <span className="creation-prefix">If</span>
                            <input
                                autoFocus
                                placeholder="I sit down to work..."
                                value={newHabitTrigger}
                                onChange={e => setNewHabitTrigger(e.target.value)}
                                className="habit-creation-input"
                            />
                            <span className="creation-prefix">Then</span>
                            <input
                                placeholder="I open the hierarchy..."
                                value={newHabitAction}
                                onChange={e => setNewHabitAction(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateHabit()}
                                className="habit-creation-input"
                            />
                        </div>
                        <div className="creation-row frequency-config-row">
                            <div className="frequency-input-group">
                                <input 
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={newHabitCount}
                                    onChange={e => setNewHabitCount(parseInt(e.target.value) || 1)}
                                    className="minimal-num-input"
                                />
                                <span className="frequency-sep">times per</span>
                                <select 
                                    className="minimal-select"
                                    value={newHabitPeriod}
                                    onChange={e => setNewHabitPeriod(e.target.value)}
                                >
                                    <option value="day">day</option>
                                    <option value="week">week</option>
                                </select>
                            </div>
                        </div>
                        <div className="creation-actions">
                            <button className="confirm-btn" onClick={() => handleCreateHabit()}>Establish Habit</button>
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
                                onUpdate={fetchSkills}
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

            {/* Expiry Decision Prompt */}
            <AnimatePresence>
                {expiringObjective && (
                    <motion.div 
                        className="expiry-decision-card"
                        initial={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 24, scale: 1 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <div className="card-content">
                            <div className="card-header-row">
                                <span className="expiry-tag">DURATION LIMIT REACHED</span>
                            </div>
                            <h3 className="expiry-title">Experiment Expiry: {expiringObjective.name}</h3>
                            <p className="expiry-description">
                                This experiment has completed its intended {expiringObjective.metadata?.durationInDays}-day cycle. 
                                What is the next phase for this experiment?
                            </p>
                            <div className="expiry-actions">
                                <button className="btn-decision-exp complete" onClick={() => handleCompleteExpiry(expiringObjective.id)}>
                                    Complete & Log
                                </button>
                                <button className="btn-decision-exp extend" onClick={() => handleExtendExpiry(expiringObjective.id)}>
                                    Extend +7 Days
                                </button>
                                <button className="btn-decision-exp archive" onClick={() => handleArchiveExpiry(expiringObjective.id)}>
                                    Archive (Retired)
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {activeObjectives.length > 0 && (
                <section className="skill-section active-experiments-section">
                    <span className="section-label">Active Experiments</span>
                    <LayoutGroup id="active-objectives">
                        <div className="active-experiments-list">
                            {(activeObjectives || []).map(obj => (
                                <div key={obj.id}>
                                    {console.log('[RENDER CHECK]', obj.id, 'energy:', energyLevel, 'expanded:', expandedObjectiveIds.includes(obj.id))}
                                    {renderObjective(obj)}
                                </div>
                            ))}
                        </div>
                    </LayoutGroup>
                </section>
            )}

            {sleepingObjectives.length > 0 && energyLevel >= 3 && (
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
            {energyLevel >= 4 && (
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
                                    placeholder="Minimum Viable Effort..."
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
            )}


            {/* Experiment Archive */}
            {archivedObjectives.length > 0 && energyLevel >= 3 && (
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
            <AnimatePresence>
                {planningToast && (
                    <motion.div 
                        className="planning-toast"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                    >
                        {planningToast}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SkillPage;
