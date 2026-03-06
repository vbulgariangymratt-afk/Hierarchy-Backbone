
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Share2, MoreVertical, X, Check, CheckCircle, Zap, Trash2, Clock, Target, LayoutGrid, Brain, RotateCw, Play, PauseCircle, Repeat, Plus, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { useGlassClass } from '../hooks/useGlassClass';
import { getTodayString, getDateString, parseDateString, getCycleType as getSharedCycleType } from '../utils/dateUtils';

const getDurationEnd = (startTime, duration) => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + (duration || 60);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
};

const formatRange = (startStr, duration) => {
    const endStr = getDurationEnd(startStr, duration);
    const [h1, m1] = startStr.split(':').map(Number);
    const [h2, m2] = endStr.split(':').map(Number);
    const p1 = h1 >= 12 ? 'PM' : 'AM';
    const p2 = h2 >= 12 ? 'PM' : 'AM';
    const dH1 = h1 % 12 || 12;
    const dH2 = h2 % 12 || 12;
    return `${dH1}:${m1.toString().padStart(2, '0')} ${p1} - ${dH2}:${m2.toString().padStart(2, '0')} ${p2}`;
};

const variants = {
    enter: (direction) => ({
        x: direction > 0 ? '100%' : direction < 0 ? '-100%' : 0,
        opacity: 1
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1
    },
    exit: (direction) => ({
        zIndex: 0,
        x: direction < 0 ? '100%' : direction > 0 ? '-100%' : 0,
        opacity: 1
    })
};

const SubCalendar = ({ filterAreaId, areaId, filterSkillId, filterHabitId, isSmall = false }) => {
    const finalAreaId = filterAreaId || areaId;
    const { state, dispatch, scheduleTask, unscheduleTask, addTask, addBeliefTask, addDesireTask, updateTask, addTimeBlock, scheduleTimeBlock, deleteTimeBlock, updateTimeBlock, addTimeBlockToRoutine } = useStore();
    const glassClass = useGlassClass();
    const [currentWeekStart, setCurrentWeekStart] = useState(() => parseDateString(getTodayString()));
    const [sidebarSubTab, setSidebarSubTab] = useState(() => localStorage.getItem('calendarSidebarSubTab') || 'beliefs'); // 'beliefs' or 'desires'
    const [direction, setDirection] = useState(0);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [selectedTimeBlockId, setSelectedTimeBlockId] = useState(null);
    const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
    const [selectedTimeBlockDetail, setSelectedTimeBlockDetail] = useState(null);
    const [editingTimeBlockId, setEditingTimeBlockId] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showCycle, setShowCycle] = useState(false);
    const [showAreaColor, setShowAreaColor] = useState(true);
    const [dragOverSlot, setDragOverSlot] = useState(null); // { slotId: string, subSlot: number }
    const [resizingItem, setResizingItem] = useState(null); // { id, type, startY, initialDuration, currentDuration }
    const [copiedItem, setCopiedItem] = useState(null); // { id, type: 'task' | 'timeblock' }
    const [isHovered, setIsHovered] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({}); // Track expanded/collapsed groups
    const showBackgrounds = state.showBackgrounds !== false;

    // Update current time every minute for the red line
    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60 * 1000); // Every minute

        const handleKeyDown = (e) => {
            // Don't handle shortcuts if we are typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Copy (Cmd+C or Ctrl+C)
            if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
                e.preventDefault();
                if (selectedTimeBlockId) {
                    setCopiedItem({ id: selectedTimeBlockId, type: 'timeblock' });
                } else if (selectedTaskId && !selectedTaskId.startsWith('belief-')) {
                    setCopiedItem({ id: selectedTaskId, type: 'task' });
                }
                return;
            }

            // Paste (Cmd+V or Ctrl+V)
            if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                e.preventDefault();
                return;
            }

            // Delete
            if (e.key === '\\' || e.key === 'Backspace' || e.key === 'Delete') {
                if (selectedTimeBlockId) {
                    deleteTimeBlock(selectedTimeBlockId);
                    setSelectedTimeBlockId(null);
                    if (copiedItem?.id === selectedTimeBlockId) setCopiedItem(null);
                } else if (selectedTaskId) {
                    unscheduleTask(selectedTaskId);
                    setSelectedTaskId(null);
                    setSelectedTaskDetail(null);
                    if (copiedItem?.id === selectedTaskId) setCopiedItem(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearInterval(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedTimeBlockId, selectedTaskId, deleteTimeBlock, unscheduleTask, copiedItem]);

    // --- Resize Handlers ---
    React.useEffect(() => {
        const handleResizeMove = (e) => {
            if (!resizingItem) return;

            const deltaY = e.clientY - resizingItem.startY;
            const pixelStep = 15;
            const steps = Math.floor(deltaY / pixelStep);

            const durationChange = steps * 15;
            const newDuration = Math.max(15, resizingItem.initialDuration + durationChange);

            if (resizingItem.currentDuration !== undefined && newDuration !== resizingItem.currentDuration) {
                setResizingItem(prev => ({ ...prev, currentDuration: newDuration }));
            } else if (resizingItem.currentDuration === undefined) {
                setResizingItem(prev => ({ ...prev, currentDuration: newDuration }));
            }
        };

        const handleResizeEnd = () => {
            if (resizingItem && resizingItem.currentDuration !== undefined) {
                if (resizingItem.type === 'task') {
                    const task = state.tasks[resizingItem.id];
                    if (task) scheduleTask(task.id, task.scheduledDate, task.startTime, resizingItem.currentDuration);
                } else {
                    const tb = state.timeBlocks[resizingItem.id];
                    if (tb) scheduleTimeBlock(tb.id, tb.scheduledDate, tb.startTime, resizingItem.currentDuration);
                }
                setResizingItem(null);
            }
            document.body.style.cursor = 'default';
        };

        if (resizingItem) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = 'ns-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = 'default';
        };
    }, [resizingItem, state.tasks, state.timeBlocks, scheduleTask, scheduleTimeBlock]);

    const handleResizeStart = (e, item, type) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent text selection/drag start
        setResizingItem({
            id: item.id,
            type: type,
            startY: e.clientY,
            initialDuration: item.duration || (type === 'task' ? 60 : 120),
            currentDuration: item.duration || (type === 'task' ? 60 : 120)
        });
    };

    const handleDragStartItem = (e, id, type) => {
        if (resizingItem) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData(type === 'task' ? 'taskId' : 'timeBlockId', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    // Helpers

    const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    const formatDate = (date) => getDateString(date);

    const to12h = (timeStr, showMinutes = false) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        if (!showMinutes && m === 0) return `${displayH} ${period}`;
        return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
    };





    // Cycle Logic
    const getCycleMode = (date) => {
        const type = getSharedCycleType(getDateString(date));
        if (type === 'work1') return { label: 'Work 1', color: '#f87171' };
        if (type === 'work2') return { label: 'Work 2', color: '#fb923c' };
        return { label: 'Light Day', color: '#60a5fa' };
    };

    // Generate Scrollable Days Range
    const generatedDays = [];
    // Force 7 days
    const daysToShow = 7;
    const START_OFFSET = 0;
    const END_OFFSET = daysToShow - 1;
    const rangeStart = addDays(currentWeekStart, START_OFFSET);

    for (let i = 0; i <= (END_OFFSET - START_OFFSET); i++) {
        generatedDays.push(addDays(rangeStart, i));
    }



    // Helper to check if a task is "Finance" related

    const isOverlapping = (tb, itemStart, itemDuration) => {
        if (!tb.startTime || !itemStart) return false;
        const [tbH, tbM] = tb.startTime.split(':').map(Number);
        const tbStartMin = tbH * 60 + tbM;
        const tbEndMin = tbStartMin + (tb.duration || 120);

        const [itemH, itemM] = itemStart.split(':').map(Number);
        const itemStartMin = itemH * 60 + itemM;
        const itemEndMin = itemStartMin + (itemDuration || 60);

        return itemStartMin < tbEndMin && itemEndMin > tbStartMin;
    };

    const getTheme = (areaName) => {
        const themes = {
            'Finance': { bg: 'rgba(239, 68, 68, 0.15)', accent: '#ef4444' },
            'Wealth': { bg: 'rgba(239, 68, 68, 0.15)', accent: '#ef4444' },
            'Languages': { bg: 'rgba(59, 130, 246, 0.15)', accent: '#3b82f6' },
            'Spiritual': { bg: 'rgba(168, 85, 247, 0.15)', accent: '#a855f7' },
            'Hot Body': { bg: 'rgba(236, 72, 153, 0.15)', accent: '#ec4899' },
            'Latte': { bg: 'rgba(231, 213, 201, 0.15)', accent: '#e7d5c9' },
            'Latte app': { bg: 'rgba(231, 213, 201, 0.15)', accent: '#e7d5c9' }
        };
        return themes[areaName] || { bg: 'rgba(255, 255, 255, 0.08)', accent: 'rgba(255,255,255,0.4)' };
    };

    const allTasks = React.useMemo(() => Object.values(state.tasks || {}), [state.tasks]);

    // Filter Tasks by Area
    // Memoized Tasks and Timeblocks Filtered by Area
    const areaTasks = React.useMemo(() => {
        return allTasks.filter(task => {
            if (task.beliefId || task.desireId) {
                const area = state.areas[finalAreaId];
                return area?.name === 'Spiritual';
            }

            // Direct Area Match
            const objective = state.objectives[task.objectiveId];
            const skill = objective ? state.skills[objective.skillId] : null;
            const area = skill ? state.areas[skill.areaId] : null;

            if (area?.id === finalAreaId) return true;

            // Smart Link: If the area names are related (e.g. Finance & Wealth), show them together
            const currentArea = state.areas[finalAreaId];
            if (currentArea && area) {
                const cName = currentArea.name.toLowerCase();
                const aName = area.name.toLowerCase();

                // Group: Wealth & Finance
                if ((cName.includes('finance') || cName.includes('wealth')) && (aName.includes('finance') || aName.includes('wealth'))) return true;

                // Group: Latte
                if (cName.includes('latte') && aName.includes('latte')) return true;

                // Group: Physical / Hot Body
                if ((cName.includes('hot body') || cName.includes('physical')) && (aName.includes('hot body') || aName.includes('physical'))) return true;
            }

            // Contextual Match: Is it inside a timeblock of this area?
            if (task.scheduledDate && task.startTime) {
                return Object.values(state.timeBlocks).some(tb => {
                    if (tb.scheduledDate !== task.scheduledDate || !tb.startTime) return false;
                    if (tb.areaId && tb.areaId !== finalAreaId) return false;

                    const [tbH, tbM] = tb.startTime.split(':').map(Number);
                    const tbStartMin = tbH * 60 + tbM;
                    const tbEndMin = tbStartMin + (tb.duration || 120);

                    const [tH, tM] = task.startTime.split(':').map(Number);
                    const tStartMin = tH * 60 + tM;
                    const tEndMin = tStartMin + (task.duration || 60);

                    return tStartMin < tbEndMin && tEndMin > tbStartMin;
                });
            }
            return false;
        });
    }, [allTasks, state.objectives, state.skills, state.areas, finalAreaId, state.timeBlocks]);

    const scheduledTasks = React.useMemo(() => areaTasks.filter(t => t.scheduledDate && t.startTime), [areaTasks]);
    const unscheduledTasks = React.useMemo(() => areaTasks.filter(t => (!t.scheduledDate || !t.startTime) && !t.isCompleted), [areaTasks]);



    const allAreaTimeBlocks = React.useMemo(() => {
        const allTimeBlocks = Object.values(state.timeBlocks || {});
        return allTimeBlocks.filter(tb => {
            if (tb.areaId === finalAreaId) return true;

            // Smart Sync: Check if it contains tasks from this area
            const containsAreaTask = allTasks.some(t => {
                if (t.scheduledDate !== tb.scheduledDate) return false;
                if (!t.startTime) return false;

                const [tbH, tbM] = tb.startTime.split(':').map(Number);
                const tbStartMin = tbH * 60 + tbM;
                const tbEndMin = tbStartMin + (tb.duration || 120);

                const [tH, tM] = t.startTime.split(':').map(Number);
                const tStartMin = tH * 60 + tM;
                const tEndMin = tStartMin + (t.duration || 60);

                const overlaps = tStartMin < tbEndMin && tEndMin > tbStartMin;
                if (!overlaps) return false;

                // Does the task belong to this area?
                const objective = state.objectives[t.objectiveId];
                const skill = objective ? state.skills[objective.skillId] : null;
                return skill?.areaId === finalAreaId;
            });

            return containsAreaTask;
        });
    }, [state.timeBlocks, finalAreaId, allTasks, state.objectives, state.skills]);

    const scheduledTimeBlocks = React.useMemo(() => allAreaTimeBlocks.filter(tb => tb.scheduledDate && tb.startTime), [allAreaTimeBlocks]);
    const unscheduledTimeBlocks = React.useMemo(() => allAreaTimeBlocks.filter(tb => !tb.scheduledDate), [allAreaTimeBlocks]);



    // Pre-calculate block statistics
    const blockStats = React.useMemo(() => {
        const stats = {};
        scheduledTimeBlocks.forEach(tb => {
            const dateStr = tb.scheduledDate;
            const overlapping = scheduledTasks.filter(t =>
                t.scheduledDate === dateStr &&
                isOverlapping(tb, t.startTime, t.duration)
            );
            const total = overlapping.length;
            const completed = overlapping.filter(t => t.isCompleted).length;
            stats[tb.id] = {
                total,
                completed,
                percentage: total > 0 ? Math.round((completed / total) * 100) : null
            };
        });
        return stats;
    }, [scheduledTimeBlocks, scheduledTasks]);



    // Special logic for Spiritual Area: Add Beliefs to Unscheduled
    const area = state.areas[finalAreaId];
    const isSpiritual = area?.name === 'Spiritual';
    const unscheduledBeliefs = [];

    if (isSpiritual) {
        const activeBeliefs = Object.values(state.beliefs || {}).filter(b => {
            const status = b.status || 'not-started';
            return status === 'active' || status === 'not-started';
        });
        // A belief is scheduled if it has a scheduled, uncompleted task today or future
        const scheduledBeliefIds = new Set(allTasks.filter(t => t.beliefId && t.scheduledDate && !t.isCompleted).map(t => t.beliefId));

        const today = formatDate(new Date());

        activeBeliefs.forEach(belief => {
            const hasRecentSession = (belief.sessions || []).some(s => s.date === today);
            if (!scheduledBeliefIds.has(belief.id) && !hasRecentSession) {
                unscheduledBeliefs.push(belief);
            }
        });
    }

    // Group unscheduled beliefs by topic
    const groupedUnscheduledBeliefs = unscheduledBeliefs.reduce((acc, belief) => {
        const topicId = belief.topic || 'uncategorized';
        if (!acc[topicId]) acc[topicId] = [];
        acc[topicId].push(belief);
        return acc;
    }, {});

    const unscheduledDesires = [];
    if (isSpiritual) {
        const activeDesires = Object.values(state.desires || {}).filter(d => d.status !== 'manifested' && d.status !== 'failed');
        const scheduledDesireIds = new Set(allTasks.filter(t => t.desireId && t.scheduledDate && !t.isCompleted).map(t => t.desireId));
        const today = formatDate(new Date());

        activeDesires.forEach(desire => {
            const hasRecentSession = (desire.sessions || []).some(s => {
                const sessionDate = s.timestamp ? formatDate(new Date(s.timestamp)) : s.date;
                return sessionDate === today;
            });
            if (!scheduledDesireIds.has(desire.id) && !hasRecentSession) {
                unscheduledDesires.push(desire);
            }
        });
    }

    // Group unscheduled tasks by skill for Languages, or by objective for other areas
    const isLanguagesArea = area?.name === 'Languages';
    const groupedUnscheduled = React.useMemo(() => {
        if (isLanguagesArea) {
            // Group by Skill for Languages
            const tasksBySkill = {};
            unscheduledTasks.forEach(task => {
                const objective = state.objectives[task.objectiveId];
                const skill = objective ? state.skills[objective.skillId] : null;
                if (skill) {
                    if (!tasksBySkill[skill.id]) tasksBySkill[skill.id] = { skill, tasks: [] };
                    tasksBySkill[skill.id].tasks.push({ task, objective });
                }
            });

            // Sort tasks within each skill: in-progress first
            Object.values(tasksBySkill).forEach(group => {
                group.tasks.sort((a, b) => {
                    const aInProgress = a.task.status === 'in-progress';
                    const bInProgress = b.task.status === 'in-progress';
                    if (aInProgress && !bInProgress) return -1;
                    if (!aInProgress && bInProgress) return 1;
                    return 0;
                });
            });

            return Object.values(tasksBySkill).sort((a, b) => a.skill.name.localeCompare(b.skill.name));
        } else {
            // Group by Objective for other areas
            const tasksByObjective = {};
            unscheduledTasks.forEach(task => {
                const objId = task.objectiveId || 'beliefs';
                if (objId === 'beliefs') return; // Skip beliefs
                const objective = state.objectives[objId];
                if (objective) {
                    if (!tasksByObjective[objId]) tasksByObjective[objId] = { objective, tasks: [] };
                    tasksByObjective[objId].tasks.push({ task, objective });
                }
            });

            // Sort tasks within each objective: in-progress first
            Object.values(tasksByObjective).forEach(group => {
                group.tasks.sort((a, b) => {
                    const aInProgress = a.task.status === 'in-progress';
                    const bInProgress = b.task.status === 'in-progress';
                    if (aInProgress && !bInProgress) return -1;
                    if (!aInProgress && bInProgress) return 1;
                    return 0;
                });
            });

            return Object.values(tasksByObjective).sort((a, b) => a.objective.title.localeCompare(b.objective.title));
        }
    }, [unscheduledTasks, state.objectives, state.skills, isLanguagesArea]);

    const handleSlotClick = (e, dateStr, timeStr) => {
        // Calculate 15m snap based on mouse offset within the hour slot
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const quarter = Math.floor((offsetY / rect.height) * 4);
        const minutes = quarter * 15;
        const [h] = timeStr.split(':');
        const snappedTime = `${h}:${minutes.toString().padStart(2, '0')}`;

        // Handle paste if we have a copied item
        if (copiedItem) {
            if (copiedItem.type === 'timeblock') {
                const originalTb = state.timeBlocks[copiedItem.id];
                if (originalTb) {
                    // Create a copy of the time block
                    const newTbId = addTimeBlock(finalAreaId, originalTb.title);
                    scheduleTimeBlock(newTbId, dateStr, snappedTime, originalTb.duration || 120);
                    setSelectedTimeBlockId(newTbId);
                    setSelectedTaskId(null);
                }
            } else if (copiedItem.type === 'task') {
                const originalTask = state.tasks[copiedItem.id];
                if (originalTask && originalTask.objectiveId) {
                    // Create a copy of the task
                    const newTaskId = addTask(originalTask.objectiveId, originalTask.title);
                    // Copy relevant properties
                    updateTask(newTaskId, {
                        difficulty: originalTask.difficulty,
                        growthType: originalTask.growthType,
                        skillId: originalTask.skillId,
                        activityTypes: originalTask.activityTypes,
                        isRecurring: originalTask.isRecurring
                    });
                    scheduleTask(newTaskId, dateStr, snappedTime, originalTask.duration || 60);
                    setSelectedTaskId(newTaskId);
                    setSelectedTimeBlockId(null);
                }
            }
            return;
        }

        if (selectedTaskId) {
            if (selectedTaskId.startsWith('belief-')) {
                const beliefId = selectedTaskId.replace('belief-', '');
                const belief = state.beliefs[beliefId];
                if (belief) {
                    const newId = addBeliefTask(beliefId, `SATS: ${belief.statement} `);
                    scheduleTask(newId, dateStr, snappedTime, 45);
                }
            } else if (selectedTaskId.startsWith('desire-')) {
                const desireId = selectedTaskId.replace('desire-', '');
                const desire = state.desires[desireId];
                if (desire) {
                    const newId = addDesireTask(desireId, `SATS: ${desire.targetDescription} `);
                    scheduleTask(newId, dateStr, snappedTime, 45);
                }
            } else {
                scheduleTask(selectedTaskId, dateStr, snappedTime, 60);
            }
            setSelectedTaskId(null);
        } else {
            // Clear selections if clicking empty space
            setSelectedTimeBlockId(null);
            setEditingTimeBlockId(null);
            setSelectedTaskId(null);
            setSelectedTaskDetail(null);

            // Direct Time Block Creation
            const newTbId = addTimeBlock(finalAreaId, "FOCUS");
            scheduleTimeBlock(newTbId, dateStr, snappedTime, 120); // 2 hours default
            setSelectedTimeBlockId(newTbId);
        }
    };

    const handleTaskClick = (taskId) => {
        setSelectedTimeBlockId(null);
        setEditingTimeBlockId(null);
        if (selectedTaskId === taskId) setSelectedTaskId(null);
        else setSelectedTaskId(taskId);
    };

    // Helper to get background URL for a task
    const getTaskBgUrl = (task) => {
        if (!task.objectiveId) return null;
        const objective = state.objectives[task.objectiveId];
        if (!objective?.skillId) return null;
        const skill = state.skills[objective.skillId];
        if (!skill?.areaId) return null;
        return state.backgrounds[`/area/${skill.areaId}`];
    };

    const getTaskBaseStyle = (task) => {
        if (!task.objectiveId) return { backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' };

        const objective = state.objectives[task.objectiveId];
        const skill = objective ? state.skills[objective.skillId] : null;
        const area = skill ? state.areas[skill.areaId] : null;

        if (!showAreaColor) {
            return {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${selectedTaskId === task.id ? '#fff' : 'rgba(255, 255, 255, 0.1)'}`,
            };
        }

        // Area-based Color Mapping (Synced with Calendar.jsx)
        const colors = {
            'Spiritual': { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(168, 85, 247, 0.4)' },
            'Finance': { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)' },
            'Wealth': { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)' },
            'Hot Body': { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgba(236, 72, 153, 0.4)' },
            'Languages': { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(255, 255, 255, 0.1)' },
            'Latte': { bg: 'rgba(231, 213, 201, 0.2)', border: 'rgba(231, 213, 201, 0.4)' },
            'Latte app': { bg: 'rgba(231, 213, 201, 0.2)', border: 'rgba(231, 213, 201, 0.4)' }
        };

        const config = area ? (colors[area.name] || { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.2)' }) : { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.3)' };

        return {
            backgroundColor: config.bg,
            border: `1px solid ${selectedTaskId === task.id ? '#fff' : config.border}`,
        };
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e, taskId) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, slotId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const subSlot = Math.floor((offsetY / rect.height) * 4);

        setDragOverSlot(prev => {
            if (prev?.slotId === slotId && prev?.subSlot === subSlot) return prev;
            return { slotId, subSlot };
        });
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, dateStr, timeStr) => {
        e.preventDefault();

        // Calculate 15m snap
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const quarter = Math.floor((offsetY / rect.height) * 4);
        const minutes = quarter * 15;
        const [h] = timeStr.split(':');
        const snappedTime = `${h}:${minutes.toString().padStart(2, '0')}`;

        const taskId = e.dataTransfer.getData('taskId');
        const timeBlockId = e.dataTransfer.getData('timeBlockId');

        if (taskId) {
            if (taskId.startsWith('belief-')) {
                const beliefId = taskId.replace('belief-', '');
                const belief = state.beliefs[beliefId];
                if (belief) {
                    const newId = addBeliefTask(beliefId, `SATS: ${belief.statement} `);
                    scheduleTask(newId, dateStr, snappedTime, 45);
                }
            } else if (taskId.startsWith('desire-')) {
                const desireId = taskId.replace('desire-', '');
                const desire = state.desires[desireId];
                if (desire) {
                    const newId = addDesireTask(desireId, `SATS: ${desire.targetDescription} `);
                    scheduleTask(newId, dateStr, snappedTime, 45);
                }
            } else {
                const task = state.tasks[taskId];
                scheduleTask(taskId, dateStr, snappedTime, task?.duration || 60);
            }
        } else if (timeBlockId) {
            const tb = state.timeBlocks[timeBlockId];
            scheduleTimeBlock(timeBlockId, dateStr, snappedTime, tb?.duration || 120);
        }
        setDragOverSlot(null);
    };



    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`sub-calendar ${glassClass}`}
            style={{
                height: '600px',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                position: 'relative',
                background: showBackgrounds ? 'rgba(0, 0, 0, 0.1)' : '#1e1e1e', // Medium Dark Glass or Solid 
                backdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                WebkitBackdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                boxShadow: !showBackgrounds
                    ? (isHovered
                        ? '0 30px 60px -12px rgba(0,0,0,0.7), 0 18px 36px -18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)'
                        : '0 20px 40px -12px rgba(0,0,0,0.5), 0 12px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)')
                    : (isHovered ? '0 40px 80px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.2)'),
                transform: isHovered ? 'translateY(-2px) scale(1.005)' : 'translateY(0) scale(1)',
                transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.4s ease',
                overflow: 'hidden', // Ensure content respects rounded corners
                isolation: 'isolate' // Force new stacking context
            }}>
            <style>
                {`
                    .calendar-grid::-webkit-scrollbar {
                        width: 8px;
                        height: 8px;
                    }
                    .calendar-grid::-webkit-scrollbar-track {
                        background: rgba(0, 0, 0, 0.2);
                    }
                    .calendar-grid::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 4px;
                    }
                    .calendar-grid::-webkit-scrollbar-thumb:hover {
                        background: rgba(255, 255, 255, 0.2);
                    }
                    .calendar-grid::-webkit-scrollbar-corner {
                        background: rgba(0, 0, 0, 0.2);
                    }
                    
                    @keyframes pulse {
                        0%, 100% {
                            opacity: 1;
                        }
                        50% {
                            opacity: 0.7;
                        }
                    }
                `}
            </style>

            {/* Copy-Paste Instruction Banner */}
            {copiedItem && (
                <div style={{
                    position: 'absolute',
                    top: '-42px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '99px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    📋 {copiedItem.type === 'task' ? 'Task' : 'Time Block'} Copied — Double-click to paste
                </div>
            )}

            <div style={{
                position: 'absolute',
                top: '-42px',
                right: '0',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '6px 16px',
                borderRadius: '99px',
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                userSelect: 'none'
            }}>
                {/* Cycle View */}
                <div
                    onClick={() => setShowCycle(!showCycle)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        cursor: 'pointer'
                    }}
                >
                    <span style={{ fontSize: '11px', color: showCycle ? '#ff6b4a' : '#60a5fa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {showCycle ? 'Cycle View' : 'Weekly View'}
                    </span>
                    <div style={{
                        width: '32px', height: '18px', borderRadius: '9px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        position: 'relative', transition: 'all 0.2s',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{
                            width: '14px', height: '14px', borderRadius: '50%',
                            backgroundColor: showCycle ? '#ff6b4a' : '#666',
                            position: 'absolute', top: '1px',
                            left: showCycle ? '15px' : '1px',
                            transition: 'all 0.2s',
                        }} />
                    </div>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

                {/* Color Toggle */}
                <div
                    onClick={() => setShowAreaColor(!showAreaColor)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        cursor: 'pointer'
                    }}
                >
                    <span style={{ fontSize: '11px', color: showAreaColor ? '#D4B07B' : '#999', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {showAreaColor ? 'Prism' : 'Glass'}
                    </span>
                    <div style={{
                        width: '32px', height: '18px', borderRadius: '9px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        position: 'relative', transition: 'all 0.2s',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{
                            width: '14px', height: '14px', borderRadius: '50%',
                            backgroundColor: showAreaColor ? '#D4B07B' : '#666',
                            position: 'absolute', top: '1px',
                            left: showAreaColor ? '15px' : '1px',
                            transition: 'all 0.2s',
                        }} />
                    </div>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

                {/* Jump Days */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setCurrentWeekStart(addDays(currentWeekStart, showCycle ? -3 : -7))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', padding: '4px', opacity: 0.6, transition: 'opacity 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Jump {showCycle ? 3 : 7} Days
                    </span>
                    <button
                        onClick={() => setCurrentWeekStart(addDays(currentWeekStart, showCycle ? 3 : 7))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', padding: '4px', opacity: 0.6, transition: 'opacity 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>


            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Unscheduled Sidebar */}
                <div style={{
                    width: '240px',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'transparent', // Unified Glass (removed darker bg)
                    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '24px',
                    overflowY: 'auto'
                }}>
                    <div style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        color: 'rgba(255,255,255,0.4)',
                        marginBottom: '16px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        paddingBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isSpiritual ? 'center' : 'space-between'
                    }}>
                        {!isSpiritual && <span>Unscheduled ({unscheduledTasks.length})</span>}
                        {isSpiritual && (
                            <div style={{
                                display: 'flex',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                padding: '2px',
                                backdropFilter: 'blur(5px)',
                                gap: '2px'
                            }}>
                                <button
                                    onClick={() => {
                                        if (sidebarSubTab !== 'beliefs') {
                                            setDirection(-1);
                                            setSidebarSubTab('beliefs');
                                            localStorage.setItem('calendarSidebarSubTab', 'beliefs');
                                        }
                                    }}
                                    style={{
                                        padding: '6px 14px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        border: 'none',
                                        background: sidebarSubTab === 'beliefs' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                        color: sidebarSubTab === 'beliefs' ? 'white' : 'rgba(255, 255, 255, 0.4)',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Brain size={14} />
                                    BELIEFS
                                </button>
                                <button
                                    onClick={() => {
                                        if (sidebarSubTab !== 'desires') {
                                            setDirection(1);
                                            setSidebarSubTab('desires');
                                            localStorage.setItem('calendarSidebarSubTab', 'desires');
                                        }
                                    }}
                                    style={{
                                        padding: '6px 14px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        border: 'none',
                                        background: sidebarSubTab === 'desires' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                        color: sidebarSubTab === 'desires' ? 'white' : 'rgba(255, 255, 255, 0.4)',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Target size={14} />
                                    DESIRES
                                </button>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {isSpiritual ? (
                            <div style={{ position: 'relative', overflow: 'hidden' }}>
                                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                                    <motion.div
                                        key={sidebarSubTab}
                                        custom={direction}
                                        variants={variants}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{
                                            x: { type: "spring", stiffness: 300, damping: 30 },
                                            opacity: { duration: 0 }
                                        }}
                                        style={{ width: '100%' }}
                                    >
                                        {sidebarSubTab === 'beliefs' ? (
                                            Object.entries(groupedUnscheduledBeliefs).map(([topicId, beliefs]) => {
                                                const topic = state.beliefTopics[topicId];
                                                return (
                                                    <div key={topicId} style={{ marginBottom: '12px' }}>
                                                        <div style={{
                                                            fontSize: '10px',
                                                            fontWeight: '700',
                                                            color: 'rgba(255,255,255,0.4)',
                                                            marginBottom: '10px',
                                                            paddingLeft: '4px',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.05em'
                                                        }}>
                                                            {topic?.name || 'Subconscious Beliefs'}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {beliefs.map(belief => (
                                                                <div
                                                                    key={belief.id}
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, `belief-${belief.id}`)}
                                                                    onClick={() => handleTaskClick(`belief-${belief.id}`)}
                                                                    style={{
                                                                        padding: '12px',
                                                                        backgroundColor: selectedTaskId === `belief-${belief.id}` ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                                        border: selectedTaskId === `belief-${belief.id}` ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                                        borderRadius: '12px',
                                                                        fontSize: '13px',
                                                                        color: 'rgba(255, 255, 255, 0.9)',
                                                                        cursor: 'grab',
                                                                        lineHeight: '1.4',
                                                                        transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                                                    }}
                                                                >
                                                                    {belief.statement}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {unscheduledDesires.map(desire => (
                                                    <div
                                                        key={desire.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, `desire-${desire.id}`)}
                                                        onClick={() => handleTaskClick(`desire-${desire.id}`)}
                                                        style={{
                                                            padding: '12px',
                                                            backgroundColor: selectedTaskId === `desire-${desire.id}` ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                            border: selectedTaskId === `desire-${desire.id}` ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                            borderRadius: '12px',
                                                            fontSize: '13px',
                                                            color: 'rgba(255, 255, 255, 0.9)',
                                                            cursor: 'grab',
                                                            lineHeight: '1.4',
                                                            transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                                        }}
                                                    >
                                                        {desire.targetDescription}
                                                    </div>
                                                ))}
                                                {unscheduledDesires.length === 0 && (
                                                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', padding: '20px 0' }}>All desires scheduled</div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        ) : (
                            <>
                                {groupedUnscheduled.map((group) => {
                                    const groupId = isLanguagesArea ? group.skill?.id : group.objective?.id;
                                    const groupTitle = isLanguagesArea ? group.skill?.name : group.objective?.title;
                                    const isExpanded = expandedGroups[groupId] !== false; // Default to expanded

                                    return (
                                        <div key={groupId} style={{ marginBottom: '12px' }}>
                                            {/* Group Header (Collapsible Toggle) */}
                                            <div
                                                onClick={() => setExpandedGroups(prev => ({ ...prev, [groupId]: !isExpanded }))}
                                                style={{
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    color: 'rgba(255,255,255,0.9)',
                                                    paddingBottom: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    paddingLeft: '4px',
                                                    cursor: 'pointer',
                                                    userSelect: 'none',
                                                    marginBottom: '8px'
                                                }}
                                            >
                                                <div style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', opacity: 0.6 }}>
                                                    <ChevronRight size={12} />
                                                </div>
                                                {groupTitle}
                                            </div>

                                            {/* Tasks for this Group */}
                                            {isExpanded && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {group.tasks.map(({ task, objective }) => {
                                                        const isSelected = selectedTaskId === task.id;
                                                        return (
                                                            <div
                                                                key={task.id}
                                                                draggable={true}
                                                                onDragStart={(e) => handleDragStart(e, task.id)}
                                                                onClick={() => handleTaskClick(task.id)}
                                                                style={{
                                                                    padding: '10px 12px',
                                                                    backgroundColor: isSelected ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.03)',
                                                                    borderRadius: '8px',
                                                                    cursor: 'grab',
                                                                    fontSize: '12px',
                                                                    transition: 'all 0.2s',
                                                                    border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                                                                    color: isSelected ? 'white' : 'rgba(255,255,255,0.8)',
                                                                    position: 'relative'
                                                                }}
                                                                className="premium-shadow"
                                                                onMouseEnter={e => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                                                                onMouseLeave={e => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    {task.status === 'in-progress' && (
                                                                        <div style={{
                                                                            width: '6px',
                                                                            height: '6px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: '#3b82f6',
                                                                            boxShadow: '0 0 8px #3b82f6',
                                                                            flexShrink: 0
                                                                        }} />
                                                                    )}
                                                                    <div style={{ fontWeight: '500', fontSize: '13px', color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                                                                </div>
                                                                {task.scheduledDate && (
                                                                    <div style={{
                                                                        fontSize: '9px',
                                                                        color: '#fbbf24',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        marginTop: '4px',
                                                                        fontWeight: '800'
                                                                    }}>
                                                                        <Calendar size={10} />
                                                                        {task.scheduledDate}
                                                                    </div>
                                                                )}
                                                                {isLanguagesArea && objective && (
                                                                    <div style={{
                                                                        fontSize: '10px',
                                                                        opacity: 0.5,
                                                                        display: 'flex', alignItems: 'flex-start', gap: '6px',
                                                                        whiteSpace: 'normal',
                                                                        lineHeight: '1.4',
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.05em',
                                                                        marginTop: '6px',
                                                                        color: 'rgba(255,255,255,0.5)'
                                                                    }}>
                                                                        • {objective.title}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {unscheduledTimeBlocks.length > 0 && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            color: 'rgba(255,255,255,0.4)',
                                            marginBottom: '8px',
                                            paddingLeft: '4px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Time Blocks
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {unscheduledTimeBlocks.map(tb => (
                                                <div
                                                    key={tb.id}
                                                    draggable={true}
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('timeBlockId', tb.id);
                                                        e.dataTransfer.effectAllowed = 'move';
                                                    }}
                                                    style={{
                                                        padding: '8px 12px',
                                                        backgroundColor: 'rgba(60, 60, 60, 0.4)',
                                                        borderRadius: '8px',
                                                        cursor: 'grab',
                                                        fontSize: '11px',
                                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                                        color: 'white',
                                                        fontWeight: '600'
                                                    }}
                                                    className="hover-trigger"
                                                >
                                                    {tb.title}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {unscheduledTasks.length === 0 && Object.keys(state.beliefs || {}).length === 0 && unscheduledTimeBlocks.length === 0 && (
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                                        No pending tasks
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Calendar Grid */}
                <div
                    className="calendar-grid"
                    style={{
                        flex: 1,
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>

                    {/* Day Headers */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${generatedDays.length}, 1fr)`,
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'rgba(255, 255, 255, 0.02)'
                    }}>
                        {generatedDays.map((day, index) => {
                            const isToday = formatDate(day) === formatDate(new Date());
                            const cycle = getCycleMode(day);
                            return (
                                <div key={formatDate(day)} style={{
                                    padding: '12px 8px',
                                    textAlign: 'left',
                                    borderRight: index < generatedDays.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: isToday ? '700' : '500',
                                        color: isToday ? cycle.color : 'rgba(255, 255, 255, 0.9)',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: isToday ? 'rgba(255,255,255,0.1)' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {day.getDate()}
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: '500', color: isToday ? cycle.color : 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Day Columns (Content) */}
                    <div style={{
                        flex: 1,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${generatedDays.length}, 1fr)`,
                        overflowY: 'auto'
                    }}>
                        {generatedDays.map((day, index) => {
                            const dateStr = formatDate(day);

                            // Get all items for this day
                            const dayTasks = scheduledTasks.filter(t => t.scheduledDate === dateStr);
                            const dayTimeBlocks = scheduledTimeBlocks.filter(tb => tb.scheduledDate === dateStr);

                            // Combine and sort by start time
                            const allDayItems = [
                                ...dayTasks.map(t => ({ ...t, type: 'task' })),
                                ...dayTimeBlocks.map(tb => ({ ...tb, type: 'timeblock' }))
                            ].sort((a, b) => {
                                if (!a.startTime) return 1;
                                if (!b.startTime) return -1;
                                return a.startTime.localeCompare(b.startTime);
                            });

                            return (
                                <div
                                    key={dateStr}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                                    }}
                                    onDragEnter={(e) => e.preventDefault()}
                                    onDragLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.style.backgroundColor = 'transparent';

                                        const taskId = e.dataTransfer.getData('taskId');
                                        const timeBlockId = e.dataTransfer.getData('timeBlockId');

                                        // Default time for drops without time grid is 9:00 AM or next available?
                                        // For now, let's just keep their existing time or default to 09:00 if strictly needed,
                                        // but usually we want to preserve the time if just moving days.
                                        // If dropping from unscheduled, maybe 09:00?
                                        const defaultTime = "09:00";

                                        if (taskId) {
                                            if (taskId.startsWith('belief-')) {
                                                const beliefId = taskId.replace('belief-', '');
                                                const belief = state.beliefs[beliefId];
                                                if (belief) {
                                                    const newId = addBeliefTask(beliefId, `SATS: ${belief.statement} `);
                                                    scheduleTask(newId, dateStr, defaultTime, 45);
                                                }
                                            } else if (taskId.startsWith('desire-')) {
                                                const desireId = taskId.replace('desire-', '');
                                                const desire = state.desires[desireId];
                                                if (desire) {
                                                    const newId = addDesireTask(desireId, `SATS: ${desire.targetDescription} `);
                                                    scheduleTask(newId, dateStr, defaultTime, 45);
                                                }
                                            } else {
                                                const task = state.tasks[taskId];
                                                // Preserve existing time if set, otherwise default
                                                const timeToUse = task.startTime || defaultTime;
                                                scheduleTask(taskId, dateStr, timeToUse, task?.duration || 60);
                                            }
                                        } else if (timeBlockId) {
                                            const tb = state.timeBlocks[timeBlockId];
                                            const timeToUse = tb.startTime || defaultTime;
                                            scheduleTimeBlock(timeBlockId, dateStr, timeToUse, tb?.duration || 120);
                                        }
                                    }}
                                    style={{
                                        borderRight: index < generatedDays.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                                        padding: '8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        minHeight: '100%',
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    {allDayItems.map(item => {
                                        if (item.type === 'timeblock') {
                                            const tb = item;
                                            const tbArea = state.areas[tb.areaId];
                                            const theme = getTheme(tbArea?.name || 'Neutral');

                                            return (
                                                <div
                                                    key={tb.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStartItem(e, tb.id, 'timeblock')}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedTimeBlockId(tb.id);
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setSelectedTimeBlockDetail({
                                                            timeBlock: tb,
                                                            x: rect.right + 10,
                                                            y: rect.top
                                                        });
                                                        setSelectedTaskId(null);
                                                        setSelectedTaskDetail(null);
                                                    }}
                                                    className={`${glassClass} premium-shadow`}
                                                    style={{
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        backgroundColor: showAreaColor ? `${theme.bg}` : 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${selectedTimeBlockId === tb.id ? 'white' : (showAreaColor ? theme.border || 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.1)')}`,
                                                        cursor: 'pointer',
                                                        position: 'relative',
                                                        marginBottom: '4px',
                                                        minHeight: `${Math.max(40, (resizingItem?.id === tb.id ? resizingItem.currentDuration : (tb.duration || 120)) * 1.5)}px`,
                                                        display: 'flex',
                                                        flexDirection: 'column'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>
                                                        {tb.title}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
                                                        <Clock size={10} />
                                                        {formatRange(tb.startTime, resizingItem?.id === tb.id ? resizingItem.currentDuration : tb.duration)}
                                                    </div>
                                                    <div
                                                        onMouseDown={(e) => handleResizeStart(e, tb, 'timeblock')}
                                                        style={{
                                                            position: 'absolute',
                                                            bottom: 0,
                                                            left: 0,
                                                            right: 0,
                                                            height: '10px',
                                                            cursor: 'ns-resize',
                                                            zIndex: 2
                                                        }}
                                                    />
                                                </div>
                                            );
                                        } else {
                                            const task = item;
                                            const bgUrl = getTaskBgUrl(task);
                                            const style = getTaskBaseStyle(task);

                                            return (
                                                <div
                                                    key={task.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStartItem(e, task.id, 'task')}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (selectedTaskId === task.id) {
                                                            setSelectedTaskId(null);
                                                            setSelectedTaskDetail(null);
                                                        } else {
                                                            setSelectedTaskId(task.id);
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setSelectedTaskDetail({
                                                                task: task,
                                                                x: rect.right + 10,
                                                                y: rect.top
                                                            });
                                                        }
                                                        setSelectedTimeBlockId(null);
                                                    }}
                                                    className="premium-shadow"
                                                    style={{
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        backgroundColor: style.backgroundColor,
                                                        border: style.border,
                                                        cursor: 'pointer',
                                                        position: 'relative',
                                                        minHeight: `${Math.max(40, (resizingItem?.id === task.id ? resizingItem.currentDuration : (task.duration || 60)) * 1.5)}px`,
                                                        transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease', // Ensure smooth transition matching hover-trigger
                                                        transform: 'translateZ(0)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        marginBottom: '4px'
                                                    }}
                                                >
                                                    {bgUrl && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            inset: 0,
                                                            backgroundImage: `url(${bgUrl})`,
                                                            backgroundSize: 'cover',
                                                            backgroundPosition: 'center',
                                                            opacity: 0.5,
                                                            filter: 'blur(20px)',
                                                            zIndex: 0
                                                        }} />
                                                    )}
                                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                                        <div style={{
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            color: 'white',
                                                            lineHeight: '1.3',
                                                            marginBottom: '4px',
                                                            textDecoration: task.isCompleted ? 'line-through' : 'none'
                                                        }}>
                                                            {task.title}
                                                        </div>
                                                        {isLanguagesArea && (() => {
                                                            const objective = state.objectives[task.objectiveId];
                                                            const skill = objective ? state.skills[objective.skillId] : null;
                                                            return skill ? (
                                                                <div style={{
                                                                    fontSize: '9px',
                                                                    opacity: 0.7,
                                                                    fontWeight: '500',
                                                                    marginBottom: '4px',
                                                                    color: 'rgba(255,255,255,0.8)'
                                                                }}>
                                                                    {skill.name}
                                                                    {task.scheduledDate && (
                                                                        <div style={{
                                                                            fontSize: '9px',
                                                                            color: '#fbbf24',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            marginTop: '4px',
                                                                            fontWeight: '800',
                                                                            opacity: 0.8
                                                                        }}>
                                                                            <Calendar size={10} />
                                                                            {task.scheduledDate}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                        <div style={{
                                                            fontSize: '10px',
                                                            color: 'rgba(255,255,255,0.5)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            marginTop: 'auto',
                                                            paddingTop: '4px'
                                                        }}>
                                                            <Clock size={10} />
                                                            {formatRange(task.startTime, resizingItem?.id === task.id ? resizingItem.currentDuration : (task.duration || 60))}
                                                        </div>
                                                    </div>
                                                    <div
                                                        onMouseDown={(e) => handleResizeStart(e, task, 'task')}
                                                        style={{
                                                            position: 'absolute',
                                                            bottom: 0,
                                                            left: 0,
                                                            right: 0,
                                                            height: '10px',
                                                            cursor: 'ns-resize',
                                                            zIndex: 2
                                                        }}
                                                    />
                                                </div>
                                            );
                                        }
                                    })}

                                    {/* Empty State / Add Button Area */}
                                    {allDayItems.length === 0 && (
                                        <div
                                            onClick={() => {
                                                const newTbId = addTimeBlock(finalAreaId, "FOCUS");
                                                scheduleTimeBlock(newTbId, dateStr, "09:00", 120);
                                                setSelectedTimeBlockId(newTbId);
                                            }}
                                            style={{
                                                flex: 1,
                                                borderRadius: '6px',
                                                border: '1px dashed rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: 0,
                                                cursor: 'pointer',
                                                transition: 'opacity 0.2s',
                                                transform: 'translateZ(0)'
                                            }}
                                            className="premium-shadow"
                                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                            onMouseLeave={e => e.currentTarget.style.opacity = 0}
                                        >
                                            <Plus size={14} color="rgba(255,255,255,0.3)" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div >
            <TaskDetailPopover
                detail={selectedTaskDetail}
                glassClass={glassClass}
                state={state}
                onClose={() => { setSelectedTaskDetail(null); setSelectedTaskId(null); }}
                onUnschedule={unscheduleTask}
                onToggleStatus={(id, status) => updateTask(id, { status })}
            />
            <TimeBlockDetailPopover
                detail={selectedTimeBlockDetail}
                glassClass={glassClass}
                state={state}
                dispatch={dispatch}
                onClose={() => setSelectedTimeBlockDetail(null)}
                onDelete={deleteTimeBlock}
                updateTimeBlock={updateTimeBlock}
                addTimeBlockToRoutine={addTimeBlockToRoutine}
            />
        </div >
    );
};



// --- Task Detail Popover (Copied for consistency, should be a shared component) ---
const TaskDetailPopover = ({ detail, onClose, onUnschedule, onToggleStatus, glassClass, state }) => {
    if (!detail) return null;
    const { x, y } = detail;
    const task = state.tasks[detail.task.id] || detail.task;

    const isRunning = task.status === 'in-progress';

    // Adjust position if close to screen edge
    const style = {
        position: 'fixed',
        top: Math.min(y, window.innerHeight - 250),
        left: Math.min(x, window.innerWidth - 320),
        zIndex: 1000,
        width: '300px',
    };

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={onClose} />
            <div className={glassClass} style={{
                ...style,
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: 'rgba(20, 20, 20, 0.8)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
                animation: 'fadeIn 0.2s ease-out'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'white', lineHeight: '1.4' }}>
                        {task.title}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                        <Clock size={14} />
                        <span>{task.startTime ? formatRange(task.startTime, task.duration) : `${task.duration || 60} minutes`}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                        <Target size={14} />
                        <span>{task.difficulty || 'Normal'} • +{task.rewardValue || 10} 🍅</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => { onToggleStatus(task.id, isRunning ? 'paused' : 'in-progress'); onClose(); }}
                        style={{
                            flex: 1,
                            backgroundColor: isRunning ? 'rgba(255, 165, 0, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: isRunning ? '#FFA500' : '#34d399',
                            border: `1px solid ${isRunning ? 'rgba(255, 165, 0, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                            padding: '8px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        {isRunning ? <PauseCircle size={14} /> : <Play size={14} />}
                        {isRunning ? 'Pause' : 'Start'}
                    </button>
                    <button
                        onClick={() => { onUnschedule(task.id); onClose(); }}
                        style={{
                            flex: 1,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            padding: '8px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <Trash2 size={14} /> Unschedule
                    </button>
                </div>
            </div>
        </>
    );
};

// --- TimeBlock Detail Popover (Added for consistency) ---
const TimeBlockDetailPopover = ({ detail, onClose, onDelete, addTimeBlockToRoutine, glassClass, state, dispatch }) => {
    const [savedStatus, setSavedStatus] = React.useState(false);

    if (!detail) return null;
    const { x, y } = detail;
    const timeBlock = state.timeBlocks[detail.timeBlock.id] || detail.timeBlock;


    const getAreaColor = (name) => {
        const colors = {
            'Finance': '#ef4444',
            'Wealth': '#ef4444',
            'Wealth Management': '#ef4444',
            'Languages': '#3b82f6',
            'Spiritual': '#a855f7',
            'Hot Body': '#ec4899',
            'Latte': '#D4B07B',
            'Latte app': '#D4B07B'
        };
        return colors[name] || '#ffffff';
    };


    const style = {
        position: 'fixed',
        top: Math.min(y, window.innerHeight - 350),
        left: Math.min(x, window.innerWidth - 320),
        zIndex: 1000,
        width: '300px',
    };

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={onClose} />
            <div className={glassClass} style={{
                ...style,
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: 'rgba(20, 20, 20, 0.9)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
                animation: 'fadeIn 0.2s ease-out'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>
                            {timeBlock.title}
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>
                                ({timeBlock.startTime})
                            </span>
                        </div>
                        <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                            <LayoutGrid size={12} color="rgba(255,255,255,0.4)" />
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {Object.values(state.areas).map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => dispatch({ type: 'UPDATE_TIME_BLOCK', payload: { id: timeBlock.id, updates: { areaId: a.id } } })}
                                        style={{
                                            background: timeBlock.areaId === a.id ? `${getAreaColor(a.name)}22` : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${timeBlock.areaId === a.id ? getAreaColor(a.name) : 'rgba(255,255,255,0.1)'}`,
                                            color: timeBlock.areaId === a.id ? getAreaColor(a.name) : 'rgba(255,255,255,0.3)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '9px',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {a.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '16px' }}>
                    <button
                        onClick={() => {
                            addTimeBlockToRoutine(timeBlock, null);
                            setSavedStatus('Daily');
                            setTimeout(() => setSavedStatus(false), 2000);
                        }}
                        style={{
                            gridColumn: 'span 2',
                            backgroundColor: savedStatus === 'Daily' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                            color: savedStatus === 'Daily' ? '#4ade80' : '#a855f7',
                            border: `1px solid ${savedStatus === 'Daily' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        {savedStatus === 'Daily' ? <Check size={14} /> : <Zap size={14} />}
                        {savedStatus === 'Daily' ? 'Added!' : 'Daily Routine'}
                    </button>
                    <button
                        onClick={() => {
                            addTimeBlockToRoutine(timeBlock, 'work1');
                            setSavedStatus('Work1');
                            setTimeout(() => setSavedStatus(false), 2000);
                        }}
                        style={{
                            backgroundColor: savedStatus === 'Work1' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                            color: savedStatus === 'Work1' ? '#4ade80' : '#3b82f6',
                            border: `1px solid ${savedStatus === 'Work1' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        {savedStatus === 'Work1' ? <Check size={14} /> : <Repeat size={14} />}
                        {savedStatus === 'Work1' ? 'Added!' : 'Work Day 1'}
                    </button>
                    <button
                        onClick={() => {
                            addTimeBlockToRoutine(timeBlock, 'work2');
                            setSavedStatus('Work2');
                            setTimeout(() => setSavedStatus(false), 2000);
                        }}
                        style={{
                            backgroundColor: savedStatus === 'Work2' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 146, 60, 0.15)',
                            color: savedStatus === 'Work2' ? '#4ade80' : '#fb923c',
                            border: `1px solid ${savedStatus === 'Work2' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 146, 60, 0.3)'}`,
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        {savedStatus === 'Work2' ? <Check size={14} /> : <Repeat size={14} />}
                        {savedStatus === 'Work2' ? 'Added!' : 'Work Day 2'}
                    </button>
                    <button
                        onClick={() => {
                            addTimeBlockToRoutine(timeBlock, 'light');
                            setSavedStatus('Light');
                            setTimeout(() => setSavedStatus(false), 2000);
                        }}
                        style={{
                            gridColumn: 'span 2',
                            backgroundColor: savedStatus === 'Light' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 113, 133, 0.15)',
                            color: savedStatus === 'Light' ? '#4ade80' : '#fb7185',
                            border: `1px solid ${savedStatus === 'Light' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 113, 133, 0.3)'}`,
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        {savedStatus === 'Light' ? <Check size={14} /> : <RotateCw size={14} />}
                        {savedStatus === 'Light' ? 'Added!' : 'Light Day'}
                    </button>
                    <button
                        onClick={() => { onDelete(timeBlock.id); onClose(); }}
                        style={{
                            gridColumn: 'span 2',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: '8px'
                        }}
                    >
                        <Trash2 size={14} style={{ marginRight: '8px' }} /> Delete Time Block
                    </button>
                </div>
            </div>
        </>
    );
};

export default SubCalendar;
