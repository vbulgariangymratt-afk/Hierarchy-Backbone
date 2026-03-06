import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, LayoutGrid, X, CheckCircle, Trash2, Target, Play, PauseCircle, Activity, Globe, DollarSign, Repeat, Zap, RotateCw, Coffee, BookOpen, Clipboard, Calendar as CalendarIcon } from 'lucide-react';
import { useStore } from '../context/StoreContext';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { useGlassClass } from '../hooks/useGlassClass';
import { getTodayString, getDateString, parseDateString, getCycleType as getSharedCycleType } from '../utils/dateUtils';

// Helpers
const to12h = (timeStr, showMinutes = false) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    if (!showMinutes && m === 0) return `${displayH} ${period}`;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
};

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
    const startPart = m1 === 0 ? `${dH1}` : `${dH1}:${m1.toString().padStart(2, '0')}`;
    const endPart = m2 === 0 ? `${dH2}` : `${dH2}:${m2.toString().padStart(2, '0')}`;
    if (p1 === p2) return `${startPart} - ${endPart} ${p2}`;
    return `${startPart} ${p1} - ${endPart} ${p2}`;
};

const formatDate = (date) => getDateString(date);
const isOverlapping = (itemStart, itemDuration, tbStart, tbDuration) => {
    if (!tbStart || !itemStart) return false;
    const [tbH, tbM] = tbStart.split(':').map(Number);
    const tbStartMin = tbH * 60 + tbM;
    const tbEndMin = tbStartMin + (tbDuration || 120);
    const [itemH, itemM] = itemStart.split(':').map(Number);
    const itemStartMin = itemH * 60 + itemM;
    const itemEndMin = itemStartMin + (itemDuration || 60);
    return itemStartMin < tbEndMin && itemEndMin > tbStartMin;
};
const addDays = (date, days) => { const result = new Date(date); result.setDate(result.getDate() + days); return result; };

const TaskTimer = ({ task }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const update = () => {
            const baseTime = task.totalInProgressTime || 0;
            if (task.status === 'in-progress' && task.lastStartedAt) {
                const live = (Date.now() - task.lastStartedAt) / 1000;
                setElapsed(baseTime + live);
            } else {
                setElapsed(baseTime);
            }
        };

        update();
        if (task.status === 'in-progress') {
            const interval = setInterval(update, 1000);
            return () => clearInterval(interval);
        }
    }, [task.status, task.lastStartedAt, task.totalInProgressTime]);

    const format = (sec) => {
        const hrs = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const secs = Math.floor(sec % 60);
        return [
            hrs.toString().padStart(2, '0'),
            mins.toString().padStart(2, '0'),
            secs.toString().padStart(2, '0')
        ].join(':');
    };

    return <span>{format(elapsed)}</span>;
};


const getTaskBaseStyle = (state, task, selectedTaskId, showAreaColor = true) => {
    // Handle Spiritual Tasks (Beliefs/Desires) which lack objectiveId
    if (task.beliefId || task.desireId) {
        if (!showAreaColor) {
            return {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${selectedTaskId === task.id ? '#fff' : 'rgba(255, 255, 255, 0.1)'}`,
            };
        }
        // Spiritual Colors (Purple)
        return {
            backgroundColor: 'rgba(168, 85, 247, 0.2)',
            border: `1px solid ${selectedTaskId === task.id ? '#fff' : 'rgba(168, 85, 247, 0.4)'}`
        };
    }

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

    const colors = {
        'Spiritual': { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(168, 85, 247, 0.4)' },
        'Wealth': { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.4)' },
        'Finance': { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)' }, // Changed to Red
        'Hot Body': { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)' },
        'Languages': { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(255, 255, 255, 0.15)' },
        'Latte': { bg: 'rgba(231, 213, 201, 0.2)', border: 'rgba(231, 213, 201, 0.4)' }, // Added Latte
        'Latte app': { bg: 'rgba(231, 213, 201, 0.2)', border: 'rgba(231, 213, 201, 0.4)' } // Added Latte app
    };
    const config = area ? (colors[area.name] || { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.2)' }) : { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.3)' };
    return {
        backgroundColor: config.bg,
        border: `1px solid ${selectedTaskId === task.id ? '#fff' : config.border}`,
    };
};

const sidebarContainerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.03,
            delayChildren: 0
        }
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.01
        }
    }
};

const sidebarItemVariants = {
    hidden: { opacity: 1, y: 0, scale: 1 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 350, damping: 25 }
    }
};

// Lightweight fade animation for appearing/disappearing days

const CalendarSlot = React.memo(({
    slotId, dateStr, time,
    isDragOver, dragOverSubSlot, isDraggedItem,
    timeBlocks, tasks, habits, blockStats,
    state,
    onSlotClick, onDragOver, onDragEnter, onDrop, onDragLeave,
    onDragStartItem, onSelectTimeBlock, onEditTimeBlock,
    onTaskClick, onHabitClick, onResizeStart,
    selectedTimeBlockId, editingTimeBlockId, showAreaColor, showBackgrounds,
    updateTimeBlock,
    selectedTaskId, selectedHabitId,
    resizingItem
}) => {
    const getTheme = (name) => {
        const colors = {
            'Finance': { bg: 'rgba(239, 68, 68, 0.15)', accent: '#ef4444' },
            'Wealth': { bg: 'rgba(239, 68, 68, 0.15)', accent: '#ef4444' },
            'Languages': { bg: 'rgba(59, 130, 246, 0.15)', accent: '#3b82f6' },
            'Spiritual': { bg: 'rgba(168, 85, 247, 0.15)', accent: '#a855f7' },
            'Hot Body': { bg: 'rgba(236, 72, 153, 0.15)', accent: '#ec4899' }
        };
        return colors[name] || { bg: 'rgba(255, 255, 255, 0.08)', accent: 'rgba(255,255,255,0.4)' };
    };

    return (
        <div
            data-calendar-slot="true"
            onDoubleClick={(e) => onSlotClick(e, dateStr, time)}
            onClick={(e) => {
                if (e.target === e.currentTarget) onSlotClick(e, dateStr, time);
            }}
            onDragOver={(e) => onDragOver(e, slotId)}
            onDragEnter={(e) => onDragEnter(e, slotId)}
            onDrop={(e) => onDrop(e, dateStr, time)}
            onDragLeave={onDragLeave}
            style={{
                height: '70px',
                flexShrink: 0,
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                position: 'relative',
                backgroundColor: isDragOver ? 'rgba(59, 130, 246, 0.1)' : (isDraggedItem ? 'rgba(59, 130, 246, 0.02)' : 'transparent'),
                transition: 'background 0.2s',
            }}
        >
            {isDragOver && (
                <div style={{
                    position: 'absolute',
                    top: `${dragOverSubSlot * (70 / 4)}px`,
                    left: 0, right: 0,
                    height: `${70 / 4}px`,
                    background: 'rgba(59, 130, 246, 0.2)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                    pointerEvents: 'none',
                    zIndex: 1
                }} />
            )}

            {timeBlocks.map(tb => {
                const startMinutes = parseInt(tb.startTime.split(':')[1]) || 0;
                const topOffset = (startMinutes / 60) * 70;
                const theme = getTheme(state.areas[tb.areaId]?.name || 'Neutral');
                const stats = blockStats[tb.id] || { tasks: [], habits: [] };

                // Pre-count items inside
                const allTbHabits = [...(tb.habitIds || []).map(id => state.habits[id]).filter(Boolean), ...stats.habits];
                const allTbTasks = [...(tb.taskIds || []).map(id => state.tasks[id]).filter(Boolean), ...stats.tasks];
                const totalItems = allTbHabits.length + allTbTasks.length;

                // Completion logic
                const completedCount = allTbHabits.filter(h => (h.history?.[dateStr] === true ? 1 : (Number(h.history?.[dateStr]) || 0)) >= (h.targetDailyCount || 1)).length +
                    allTbTasks.filter(t => t.isCompleted).length;
                const percentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

                return (
                    <motion.div
                        key={tb.id}
                        layout draggable
                        onDragStart={(e) => onDragStartItem(e, tb.id, 'timeblock')}
                        onClick={(e) => { e.stopPropagation(); onSelectTimeBlock(tb, e); }}
                        onDoubleClick={(e) => { e.stopPropagation(); onEditTimeBlock(tb.id); }}
                        style={{
                            position: 'absolute', top: `${topOffset}px`, left: '4px', right: '8px',
                            height: `${(resizingItem?.id === tb.id ? resizingItem.currentDuration : (tb.duration || 120)) / 60 * 70}px`,
                            zIndex: selectedTimeBlockId === tb.id ? 20 : 10,
                            background: showAreaColor ? `linear-gradient(135deg, ${theme.bg}, rgba(0,0,0,0.1))` : 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: showBackgrounds ? 'blur(10px)' : 'none',
                            borderRadius: '10px',
                            border: selectedTimeBlockId === tb.id ? '1px solid white' : '1px solid rgba(255,255,255,0.1)',
                            padding: '6px 12px',
                            color: 'white',
                            cursor: 'grab', display: 'flex', flexDirection: 'column', gap: '2px',
                            transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease, background 0.2s'
                        }}
                        className="premium-shadow"
                    >
                        {percentage > 0 && (
                            <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600' }}>
                                <span>{percentage}%</span>
                            </div>
                        )}
                        <div style={{ fontWeight: '700', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {editingTimeBlockId === tb.id ? (
                                <input autoFocus defaultValue={tb.title} style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }} onBlur={(e) => { updateTimeBlock(tb.id, { title: e.target.value }); onEditTimeBlock(null); }} />
                            ) : (tb.title || "UNTITLED")}
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.6 }}>{formatRange(tb.startTime, resizingItem?.id === tb.id ? resizingItem.currentDuration : tb.duration)}</div>

                        {/* TASK LIST RENDER */}
                        {totalItems > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', marginTop: '4px', overflow: 'hidden' }}>
                                {[...allTbHabits, ...allTbTasks].slice(0, 3).map((item, i) => (
                                    <div key={item.id || i} style={{
                                        fontSize: '10px',
                                        color: 'rgba(255,255,255,0.8)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        textDecoration: (() => {
                                            if (item.isCompleted) return 'line-through';
                                            // Check habit completion
                                            const isHabitCompleted = item.history && (item.history?.[dateStr] === true || (Number(item.history?.[dateStr]) || 0) >= (item.targetDailyCount || 1));
                                            return isHabitCompleted ? 'line-through' : 'none';
                                        })(),
                                        opacity: (() => {
                                            if (item.isCompleted) return 0.6;
                                            const isHabitCompleted = item.history && (item.history?.[dateStr] === true || (Number(item.history?.[dateStr]) || 0) >= (item.targetDailyCount || 1));
                                            return isHabitCompleted ? 0.6 : 1;
                                        })()
                                    }}>
                                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                                        {item.title || item.name}
                                    </div>
                                ))}
                                {totalItems > 3 && (
                                    <div style={{ fontSize: '9px', opacity: 0.6, paddingLeft: '8px' }}>
                                        + {totalItems - 3} more
                                    </div>
                                )}
                            </div>
                        )}
                        <div onMouseDown={(e) => onResizeStart(e, tb, 'timeblock')} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10px', cursor: 'ns-resize' }} />
                    </motion.div>
                );
            })}

            {tasks.map(task => {
                const startMinutes = parseInt(task.startTime.split(':')[1]) || 0;
                const topOffset = (startMinutes / 60) * 70;
                const isSelected = selectedTaskId === task.id;

                // Get language info for language tasks
                const objective = task.objectiveId ? state.objectives[task.objectiveId] : null;
                const skill = objective?.skillId ? state.skills[objective.skillId] : null;
                const area = skill?.areaId ? state.areas[skill.areaId] : null;
                const isLanguageTask = area?.name?.toLowerCase() === 'languages';

                return (
                    <motion.div
                        key={task.id}
                        layout draggable
                        onDragStart={(e) => onDragStartItem(e, task.id, 'task')}
                        onClick={(e) => onTaskClick(e, task)}
                        style={{
                            position: 'absolute', top: `${topOffset + 4}px`, left: '8px', right: '12px',
                            height: `${(resizingItem?.id === task.id ? resizingItem.currentDuration : (task.duration || 60)) / 60 * 70 - 8}px`,
                            zIndex: isSelected ? 100 : 50,
                            ...getTaskBaseStyle(state, task, selectedTaskId, showAreaColor),
                            borderRadius: '8px', padding: '6px 8px', cursor: 'pointer',
                            opacity: task.isCompleted ? 0.6 : 1,
                            transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease',
                            transform: 'translateZ(0)'
                        }}
                        className="premium-shadow"
                    >
                        <div style={{
                            fontWeight: '700',
                            fontSize: '12px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textDecoration: task.isCompleted ? 'line-through' : 'none'
                        }}>{task.title}</div>
                        {isLanguageTask && skill && (
                            <div style={{ fontSize: '9px', opacity: 0.7, color: '#3b82f6', fontWeight: '600' }}>{skill.name}</div>
                        )}
                        <div style={{ fontSize: '10px', opacity: 0.6 }}>{formatRange(task.startTime, resizingItem?.id === task.id ? resizingItem.currentDuration : task.duration)}</div>
                        <div
                            onMouseDown={(e) => onResizeStart(e, task, 'task')}
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '10px',
                                cursor: 'ns-resize',
                                zIndex: 10
                            }}
                        />
                    </motion.div>
                );
            })}

            {habits.map(habit => {
                const startMinutes = parseInt(habit.startTime.split(':')[1]) || 0;
                const topOffset = (startMinutes / 60) * 70;
                const isSelected = selectedHabitId === habit.id;
                return (
                    <motion.div
                        key={habit.id}
                        layout draggable
                        onDragStart={(e) => onDragStartItem(e, habit.id, 'habit')}
                        onClick={(e) => onHabitClick(e, habit)}
                        style={{
                            position: 'absolute', top: `${topOffset + 4}px`, left: '8px', right: '12px',
                            height: `${(habit.duration || 30) / 60 * 70 - 8}px`,
                            zIndex: isSelected ? 100 : 50,
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px', padding: '6px 8px', cursor: 'pointer',
                            border: isSelected ? '1px solid white' : '1px solid rgba(255, 255, 255, 0.1)',
                            transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease'
                        }}
                        className="premium-shadow"
                    >
                        <div style={{
                            fontWeight: '700',
                            fontSize: '12px',
                            textDecoration: (() => {
                                const isCompleted = habit.history && (habit.history?.[dateStr] === true || (Number(habit.history?.[dateStr]) || 0) >= (habit.targetDailyCount || 1));
                                return isCompleted ? 'line-through' : 'none';
                            })()
                        }}>{habit.name}</div>
                        <div style={{ fontSize: '10px', opacity: 0.6 }}>{formatRange(habit.startTime, habit.duration)}</div>
                    </motion.div>
                );
            })}
        </div>
    );
});

const Calendar = () => {
    const { state, dispatch, scheduleTask, unscheduleTask, updateTask, updateHabit, toggleHabit, addTimeBlock, scheduleTimeBlock, deleteTimeBlock, updateTimeBlock, addTimeBlockToRoutine, getCycleType } = useStore();
    const glassClass = useGlassClass();
    const [currentWeekStart, setCurrentWeekStart] = useState(() => parseDateString(getTodayString()));
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [selectedTimeBlockId, setSelectedTimeBlockId] = useState(null);
    const [selectedHabitId, setSelectedHabitId] = useState(null);
    const [selectedTaskDetail, setSelectedTaskDetail] = useState(null); // { task, x, y }
    const [selectedTimeBlockDetail, setSelectedTimeBlockDetail] = useState(null); // { timeBlock, x, y }
    const [selectedHabitDetail, setSelectedHabitDetail] = useState(null); // { habit, x, y }
    const [editingTimeBlockId, setEditingTimeBlockId] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showCycle, setShowCycle] = useState(true);
    const [showAreaColor, setShowAreaColor] = useState(true);
    const [dragOverSlot, setDragOverSlot] = useState(null); // { slotId: string, subSlot: number }
    const [resizingItem, setResizingItem] = useState(null); // { id, type, startY, initialDuration, currentDuration }
    const [draggedItem, setDraggedItem] = useState(null); // { type: 'task'|'timeblock'|'habit', id: string }
    const [sidebarTab, setSidebarTab] = useState(() => localStorage.getItem('calendarSidebarTab') || 'habits'); // 'habits', 'languages', 'wealth', 'latte'
    const [expandedSkills, setExpandedSkills] = useState({}); // { skillId: boolean }
    const [copiedItem, setCopiedItem] = useState(null); // { id, type: 'task' | 'timeblock' }
    const mousePositionRef = React.useRef({ x: 0, y: 0 });
    const [isUnscheduleOver, setIsUnscheduleOver] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const showBackgrounds = state.showBackgrounds !== false;

    // Track mouse position
    useEffect(() => {
        const handleMouseMove = (e) => {
            mousePositionRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60 * 1000);

        const handleKeyDown = (e) => {

            // Don't handle shortcuts if we are typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Copy (Cmd+C or Ctrl+C)
            if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
                e.preventDefault();
                if (selectedTimeBlockId) {
                    setCopiedItem({ id: selectedTimeBlockId, type: 'timeblock' });
                } else if (selectedTaskId) {
                    setCopiedItem({ id: selectedTaskId, type: 'task' });
                }
                return;
            }

            // Paste (Cmd+V or Ctrl+V)
            if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                e.preventDefault();

                if (!copiedItem) {
                    return;
                }

                // Find the element at the mouse position
                const elementAtMouse = document.elementFromPoint(mousePositionRef.current.x, mousePositionRef.current.y);

                // Find the closest calendar slot (the div with onDoubleClick handler)
                let slotElement = elementAtMouse;
                while (slotElement && !slotElement.hasAttribute('data-calendar-slot')) {
                    slotElement = slotElement.parentElement;
                }

                if (slotElement) {
                    // Trigger a double-click event on the slot
                    const dblClickEvent = new MouseEvent('dblclick', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: mousePositionRef.current.x,
                        clientY: mousePositionRef.current.y
                    });
                    slotElement.dispatchEvent(dblClickEvent);
                }
                return;
            }

            // Delete
            if (e.key === '\\' || e.key === 'Backspace' || e.key === 'Delete') {
                if (selectedTimeBlockId) {
                    deleteTimeBlock(selectedTimeBlockId);
                    setSelectedTimeBlockId(null);
                    // Clear copied item if we deleted it
                    if (copiedItem?.id === selectedTimeBlockId) setCopiedItem(null);
                } else if (selectedTaskId) {
                    unscheduleTask(selectedTaskId);
                    setSelectedTaskId(null);
                    setSelectedTaskDetail(null);
                    // Clear copied item if we deleted it
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
    useEffect(() => {
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

    // Cycle Logic
    const getCycleMode = (date) => {
        const type = getSharedCycleType(getDateString(date));
        if (type === 'work1') return { label: 'Work 1', color: '#D4B07B' };
        if (type === 'work2') return { label: 'Work 2', color: '#fb923c' };
        return { label: 'Light Day', color: '#ffffff' };
    };

    // Generate Scrollable Days Range
    // Weekly view = 7 days, Cycle view = 3 days
    const generatedDays = [];
    const daysToShow = showCycle ? 3 : 7;

    for (let i = 0; i < daysToShow; i++) {
        generatedDays.push(addDays(currentWeekStart, i));
    }

    // Time Slots (6 AM to 11 PM)
    const hours = [];
    for (let i = 6; i <= 23; i++) {
        hours.push(`${i.toString().padStart(2, '0')}:00`);
    }

    // Filter Tasks
    const allTasks = Object.values(state.tasks || {});
    const unscheduledTasks = allTasks.filter(t => (!t.scheduledDate || !t.startTime) && !t.isCompleted);

    // --- OPTIMIZATION START: Pre-calculate grouped items ---
    const { groups, blockStats } = React.useMemo(() => {
        const scheduledTimeBlocks = Object.values(state.timeBlocks || {}).filter(tb => tb.scheduledDate);
        const scheduledTasks = Object.values(state.tasks || {}).filter(t => t.scheduledDate && t.startTime);
        const scheduledHabits = Object.values(state.habits || {}).filter(h => h.scheduledDate && h.startTime);

        console.log('📊 Main Calendar - Scheduled tasks:', scheduledTasks.length, scheduledTasks.map(t => ({ id: t.id, title: t.title, date: t.scheduledDate, time: t.startTime })));

        const groups = {};
        const blockStats = {};

        const getGroup = (date, time) => {
            if (!date || !time) return null;
            const [h] = time.split(':');
            const key = `${date}-${h}:00`;
            if (!groups[key]) groups[key] = { timeBlocks: [], tasks: [], habits: [] };
            return groups[key];
        };

        // Group timeblocks
        scheduledTimeBlocks.forEach(tb => {
            const g = getGroup(tb.scheduledDate, tb.startTime);
            if (g) g.timeBlocks.push(tb);
        });

        // Map timeblocks by date for overlap checks
        const blocksByDate = scheduledTimeBlocks.reduce((acc, tb) => {
            acc[tb.scheduledDate] = acc[tb.scheduledDate] || [];
            acc[tb.scheduledDate].push(tb);
            return acc;
        }, {});

        // Process tasks
        scheduledTasks.forEach(task => {
            const dateBlocks = blocksByDate[task.scheduledDate] || [];
            const containingBlock = dateBlocks.find(tb =>
                isOverlapping(task.startTime, task.duration || 60, tb.startTime, tb.duration || 120)
            );

            if (containingBlock) {
                if (!blockStats[containingBlock.id]) blockStats[containingBlock.id] = { tasks: [], habits: [] };
                blockStats[containingBlock.id].tasks.push(task);
            } else {
                const g = getGroup(task.scheduledDate, task.startTime);
                if (g) g.tasks.push(task);
            }
        });

        // Process habits
        scheduledHabits.forEach(habit => {
            const dateBlocks = blocksByDate[habit.scheduledDate] || [];
            const containingBlock = dateBlocks.find(tb =>
                isOverlapping(habit.startTime, habit.duration || 30, tb.startTime, tb.duration || 120)
            );

            if (containingBlock) {
                if (!blockStats[containingBlock.id]) blockStats[containingBlock.id] = { tasks: [], habits: [] };
                blockStats[containingBlock.id].habits.push(habit);
            } else {
                const g = getGroup(habit.scheduledDate, habit.startTime);
                if (g) g.habits.push(habit);
            }
        });

        return { groups, blockStats };
    }, [state.timeBlocks, state.tasks, state.habits]);
    // --- OPTIMIZATION END ---

    const handleSlotClick = (e, dateStr, timeStr) => {
        console.log('🖱️ Slot Clicked:', { dateStr, timeStr, target: e.target, currentTarget: e.currentTarget });

        // Calculate 15m snap based on mouse offset within the hour slot
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const quarter = Math.floor((offsetY / rect.height) * 4);
        const minutes = quarter * 15;
        const [h] = timeStr.split(':');
        const snappedTime = `${h}:${minutes.toString().padStart(2, '0')}`;

        console.log('⏰ Snapped Time:', snappedTime);

        // Handle paste if we have a copied item
        if (copiedItem) {

            if (copiedItem.type === 'timeblock') {
                const originalTb = state.timeBlocks[copiedItem.id];

                if (originalTb) {
                    // Create a copy of the time block
                    const areaId = originalTb.areaId || Object.keys(state.areas || {})[0];
                    const newTbId = addTimeBlock(areaId, originalTb.title);
                    scheduleTimeBlock(newTbId, dateStr, snappedTime, originalTb.duration || 120);
                    setSelectedTimeBlockId(newTbId);
                    setSelectedTaskId(null);
                    setSelectedTaskDetail(null);
                } else {
                    console.error('❌ Original timeblock not found!');
                }
            } else if (copiedItem.type === 'task') {
                const originalTask = state.tasks[copiedItem.id];

                if (originalTask && originalTask.objectiveId) {
                    // Create a copy of the task using dispatch
                    const newTaskId = crypto.randomUUID();
                    dispatch({
                        type: 'ADD_TASK',
                        payload: {
                            id: newTaskId,
                            objectiveId: originalTask.objectiveId,
                            title: originalTask.title,
                            scheduledDate: dateStr,
                            startTime: snappedTime,
                            duration: originalTask.duration || 60,
                            difficulty: originalTask.difficulty,
                            growthType: originalTask.growthType,
                            skillId: originalTask.skillId,
                            activityTypes: originalTask.activityTypes,
                            isRecurring: originalTask.isRecurring,
                            status: 'todo'
                        }
                    });
                    setSelectedTaskId(newTaskId);
                    setSelectedTimeBlockId(null);
                    setSelectedTaskDetail(null);
                } else {
                    // console.error('❌ Original task not found or has no objectiveId!');
                }
            }
            return;
        }


        if (selectedTaskId) {
            scheduleTask(selectedTaskId, dateStr, snappedTime, 60);
            setSelectedTaskId(null);
        } else {
            // Clear selections if clicking empty space
            setSelectedTimeBlockId(null);
            setEditingTimeBlockId(null);
            setSelectedTaskId(null);
            setSelectedTaskDetail(null);
            setSelectedTimeBlockDetail(null);

            // Fluid Time Block Creation: Smart Area Assignment
            const areaIds = Object.keys(state.areas || {});
            console.log('🌍 Available Areas:', areaIds);

            if (areaIds.length === 0) {
                alert("Please create a Life Area first!");
                return;
            }

            // Smart Guess: Check if there are tasks already in this slot
            const overlappingTasks = Object.values(state.tasks).filter(t =>
                t.scheduledDate === dateStr &&
                t.startTime &&
                (() => {
                    const [h] = t.startTime.split(':');
                    const [clickH] = snappedTime.split(':');
                    return h === clickH; // Simple hour-level match for initial guess
                })()
            );

            let smartAreaId = areaIds[0];
            if (overlappingTasks.length > 0) {
                const areaCounts = {};
                overlappingTasks.forEach(t => {
                    const obj = state.objectives[t.objectiveId];
                    if (obj?.skillId) {
                        const skill = state.skills[obj.skillId];
                        if (skill?.areaId) {
                            areaCounts[skill.areaId] = (areaCounts[skill.areaId] || 0) + 1;
                        }
                    }
                });
                const sortedAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);
                if (sortedAreas.length > 0) smartAreaId = sortedAreas[0][0];
            }

            console.log('🏗️ Creating Time Block:', { smartAreaId, dateStr, snappedTime });
            const newId = addTimeBlock(smartAreaId, "FOCUS");
            scheduleTimeBlock(newId, dateStr, snappedTime, 120); // 2 hours default
            setSelectedTimeBlockId(newId);
        }
    };

    const handleHabitClick = (e, habit) => {
        e.stopPropagation();
        setSelectedTimeBlockId(null);
        setSelectedTaskId(null);
        setEditingTimeBlockId(null);
        const rect = e.currentTarget.getBoundingClientRect();
        setSelectedHabitDetail({
            habit,
            x: rect.right + 10,
            y: rect.top,
            rect: rect // Pass full rect for better positioning
        });
        setSelectedHabitId(habit.id);
    };

    const handleTaskClick = (e, task) => {
        e.stopPropagation();
        setSelectedTimeBlockId(null);
        setEditingTimeBlockId(null);
        const rect = e.currentTarget.getBoundingClientRect();
        setSelectedTaskDetail({
            task,
            x: rect.right + 10,
            y: rect.top,
            rect: rect // Pass full rect for better positioning
        });
        setSelectedTaskId(task.id);
    };

    const closePopover = () => {
        setSelectedTaskDetail(null);
        setSelectedTaskId(null);
        setSelectedTimeBlockDetail(null);
        setSelectedHabitDetail(null);
        setSelectedHabitId(null);
    };

    // --- Drag and Drop Handlers ---
    const handleDragStartItem = (e, id, type) => {
        if (resizingItem) {
            e.preventDefault();
            return;
        }
        const itemType = type === 'task' ? 'task' : 'timeblock';
        setDraggedItem({ type: itemType, id });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id); // Ensure dataTransfer is set
    };

    const handleDragStartHabit = (e, habitId) => {
        setDraggedItem({ type: 'habit', id: habitId });
        e.dataTransfer.effectAllowed = 'all';
        e.dataTransfer.setData('text/plain', habitId);
    };

    const handleDragOver = (e, slotId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = draggedItem?.type === 'habit' ? 'copy' : 'move';

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

        if (!draggedItem) {
            return;
        }


        // Calculate 15m snap
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const quarter = Math.floor((offsetY / rect.height) * 4);
        const minutes = quarter * 15;
        const [h] = timeStr.split(':');
        const snappedTime = `${h}:${minutes.toString().padStart(2, '0')}`;

        if (draggedItem.type === 'task') {
            const task = state.tasks[draggedItem.id];
            scheduleTask(draggedItem.id, dateStr, snappedTime, task?.duration || 60);
        } else if (draggedItem.type === 'habit') {
            const habit = state.habits[draggedItem.id];
            if (habit) {
                // Schedule the habit directly instead of creating a task
                updateHabit(draggedItem.id, {
                    scheduledDate: dateStr,
                    startTime: snappedTime,
                    duration: 30
                });
            }
        } else if (draggedItem.type === 'timeblock') {
            const tb = state.timeBlocks[draggedItem.id];
            scheduleTimeBlock(draggedItem.id, dateStr, snappedTime, tb?.duration || 120);
        }

        setDragOverSlot(null);
        setDraggedItem(null);
    };

    const handleUnscheduleDrop = (e) => {
        e.preventDefault();
        setIsUnscheduleOver(false);
        if (!draggedItem) return;

        if (draggedItem.type === 'task') {
            unscheduleTask(draggedItem.id);
        } else if (draggedItem.type === 'timeblock') {
            deleteTimeBlock(draggedItem.id);
        } else if (draggedItem.type === 'habit') {
            updateHabit(draggedItem.id, {
                scheduledDate: null,
                startTime: null,
                duration: null
            });
        }
        setDraggedItem(null);
    };

    const handleDragLeave = React.useCallback(() => {
        setDragOverSlot(null);
    }, []);

    const handleSelectTimeBlock = React.useCallback((timeBlock, e) => {
        setSelectedTimeBlockId(timeBlock.id);
        const rect = e.currentTarget.getBoundingClientRect();
        setSelectedTimeBlockDetail({
            timeBlock,
            x: rect.right + 10,
            y: rect.top,
            rect: rect
        });
        setSelectedTaskDetail(null);
    }, []);

    const handleEditTimeBlock = React.useCallback((id) => {
        setEditingTimeBlockId(id);
        setSelectedTimeBlockDetail(null);
    }, []);

    const handleUnscheduleTroubles = () => {
        if (!confirm("Unschedule all Finance and Language tasks? This will move them to the sidebar.")) return;

        const targetAreas = Object.values(state.areas || {}).filter(a =>
            a.name === 'Languages' || a.name === 'Finance' || a.name === 'Wealth'
        );
        const targetAreaIds = targetAreas.map(a => a.id);

        let count = 0;
        Object.values(state.tasks || {}).forEach(t => {
            const obj = state.objectives[t.objectiveId];
            if (!obj) return;
            const skill = state.skills[obj.skillId];
            if (!skill) return;

            if (targetAreaIds.includes(skill.areaId) && t.scheduledDate) {
                unscheduleTask(t.id);
                count++;
            }
        });
        alert(`${count} tasks moved to sidebar!`);
    };

    /**
     * Inserted at the end of the file main Component
     */
    return (
        <div className="calendar-page" style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                <h1 style={{ fontSize: 'var(--font-size-xl)', display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
                    <LayoutGrid size={24} /> Calendar
                </h1>

                <div className={glassClass} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: !state.showBackgrounds
                        ? '0 4px 12px -2px rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.03)'
                        : 'none'
                }}>
                    <button
                        onClick={handleUnscheduleTroubles}
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <Trash2 size={12} /> Reset Finance/Lang
                    </button>

                    {/* View Toggle */}
                    <div
                        onClick={() => setShowCycle(!showCycle)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer', paddingRight: '12px', borderRight: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        <span style={{ fontSize: '13px', color: showCycle ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: '500' }}>
                            {showCycle ? 'Cycle View' : 'Regular View'}
                        </span>
                        <div style={{
                            width: '32px', height: '18px', borderRadius: '10px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            position: 'relative', transition: 'all 0.2s',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{
                                width: '14px', height: '14px', borderRadius: '50%',
                                backgroundColor: showCycle ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                position: 'absolute', top: '1px',
                                left: showCycle ? '15px' : '1px',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }} />
                        </div>
                    </div>

                    {/* Color Toggle */}
                    <div
                        onClick={() => setShowAreaColor(!showAreaColor)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer', marginRight: '12px',
                            paddingRight: '12px', borderRight: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        <span style={{ fontSize: '13px', color: showAreaColor ? '#D4B07B' : 'var(--color-text-secondary)', fontWeight: '500' }}>
                            {showAreaColor ? 'Prism' : 'Glass'}
                        </span>
                        <div style={{
                            width: '32px', height: '18px', borderRadius: '10px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            position: 'relative', transition: 'all 0.2s',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{
                                width: '14px', height: '14px', borderRadius: '50%',
                                backgroundColor: showAreaColor ? '#D4B07B' : 'var(--color-text-secondary)',
                                position: 'absolute', top: '1px',
                                left: showAreaColor ? '15px' : '1px',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }} />
                        </div>
                    </div>

                    {/* Clean FOCUS Blocks Button */}
                    <button
                        onClick={() => {
                            const focusBlocks = Object.values(state.timeBlocks || {}).filter(tb => tb.title === 'FOCUS');
                            if (focusBlocks.length === 0) {
                                alert('No FOCUS timeblocks found!');
                                return;
                            }
                            if (window.confirm(`Delete all ${focusBlocks.length} FOCUS timeblocks?`)) {
                                focusBlocks.forEach(tb => deleteTimeBlock(tb.id));
                            }
                        }}
                        style={{
                            padding: '6px 12px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            color: '#f87171',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginRight: '12px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        }}
                    >
                        🧹 Clean FOCUS
                    </button>

                    <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, showCycle ? -3 : -7))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                        <ChevronLeft size={18} />
                    </button>
                    <span style={{ fontWeight: '600', minWidth: '120px', textAlign: 'center', fontSize: '13px' }}>
                        Jump {showCycle ? 3 : 7} Days
                    </span>
                    <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, showCycle ? 3 : 7))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Unified Glass Container */}
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="calendar-container"
                style={{
                    display: 'flex',
                    flex: 1,
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    outline: 'none',
                    position: 'relative',
                    background: showBackgrounds ? 'rgba(0, 0, 0, 0.1)' : '#1e1e1e', // Medium Dark Glass or Solid 
                    backdropFilter: showBackgrounds ? 'blur(30px)' : 'none',
                    WebkitBackdropFilter: showBackgrounds ? 'blur(30px)' : 'none',
                    boxShadow: !showBackgrounds
                        ? (isHovered
                            ? '0 30px 60px -12px rgba(0,0,0,0.7), 0 18px 36px -18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)'
                            : '0 20px 40px -12px rgba(0,0,0,0.5), 0 12px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)')
                        : (isHovered ? '0 40px 80px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.2)'),
                    transform: isHovered ? 'translateY(-2px) scale(1.002)' : 'translateY(0) scale(1)',
                    transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.4s ease',

                    overflow: 'hidden'
                }}>
                <style>
                    {`
                        .calendar-grid::-webkit-scrollbar {
                            display: none; /* Hide scrollbar for Chrome, Safari and Opera */
                        }
                        
                        .calendar-grid {
                            -ms-overflow-style: none;  /* IE and Edge */
                            scrollbar-width: none;  /* Firefox */
                        }

                        .sidebar-toggle-btn {
                            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                        }

                        .sidebar-toggle-btn:active {
                            transform: scale(0.95) translateY(1px);
                            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                        }
                        
                        @keyframes pulse {
                            0%, 100% {
                                opacity: 1;
                            }
                            50% {
                                opacity: 0.7;
                            }
                        }

                        .timeblock-card {
                            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
                        }

                        .timeblock-card:hover {
                            transform: scale(1.015);
                            filter: brightness(1.1);
                        }

                        .dragging-item {
                            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
                            transform: rotate(2deg) scale(1.05);
                            cursor: grabbing !important;
                        }
                    `}
                </style>

                {/* Copy-Paste Instruction Banner */}
                {copiedItem && (
                    <div style={{
                        position: 'absolute',
                        top: '-50px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        borderRadius: '99px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'rgba(255, 255, 255, 0.9)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        📋 {copiedItem.type === 'task' ? 'Task' : 'Time Block'} Copied — Cmd+V to paste
                    </div>
                )}

                {/* Unscheduled Sidebar */}
                <div
                    onDragOver={(e) => {
                        if (draggedItem) {
                            e.preventDefault();
                            setIsUnscheduleOver(true);
                        }
                    }}
                    onDragLeave={() => setIsUnscheduleOver(false)}
                    onDrop={handleUnscheduleDrop}
                    style={{
                        width: '240px',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: isUnscheduleOver
                            ? 'rgba(239, 68, 68, 0.05)'
                            : (!state.showBackgrounds ? '#202020' : 'transparent'),
                        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: 0,
                        borderRadius: '24px 0 0 24px',
                        overflow: 'hidden',
                        position: 'relative',
                        transition: 'background-color 0.2s ease'
                    }}
                >
                    {/* Unschedule Overlay */}
                    <AnimatePresence>
                        {isUnscheduleOver && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 100,
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    backdropFilter: 'blur(4px)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    color: '#f87171',
                                    pointerEvents: 'none'
                                }}
                            >
                                <Trash2 size={32} />
                                <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.1em' }}>DROP TO UNSCHEDULE</div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Sidebar View Toggle */}
                    <div style={{ margin: '24px 24px 0 24px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <motion.button
                            onClick={() => {
                                const cycle = ['habits', 'languages', 'wealth', 'latte', 'spiritual'];
                                const next = cycle[(cycle.indexOf(sidebarTab) + 1) % cycle.length];
                                setSidebarTab(next);
                                localStorage.setItem('calendarSidebarTab', next);
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.95, y: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            style={{
                                width: 'auto',
                                minWidth: '140px',
                                padding: '10px 20px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'rgba(255,255,255,0.8)',
                                borderRadius: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: '600',
                                cursor: 'pointer',
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                backdropFilter: 'blur(5px)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                        >
                            {sidebarTab === 'habits' && <><Activity size={14} style={{ marginRight: '8px' }} /> HABITS</>}
                            {sidebarTab === 'languages' && <><Globe size={14} style={{ marginRight: '8px' }} /> LANGUAGES ACTIVITIES</>}
                            {sidebarTab === 'wealth' && <><DollarSign size={14} style={{ marginRight: '8px' }} /> MONEY TASKS</>}
                            {sidebarTab === 'latte' && <><Coffee size={14} style={{ marginRight: '8px' }} /> LATTE APP TASKS</>}
                            {sidebarTab === 'spiritual' && <><BookOpen size={14} style={{ marginRight: '8px' }} /> SPIRITUAL & GROWTH</>}
                            {sidebarTab === 'hot body' && <><Activity size={14} style={{ marginRight: '8px' }} /> PHYSICAL & HEALTH</>}
                        </motion.button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        <div
                            key={sidebarTab}
                            style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}
                        >

                            {/* HABITS TAB */}
                            {sidebarTab === 'habits' && (
                                <motion.div
                                    variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                                    style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                                >
                                    <div
                                        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                                    >
                                        {/* Static Group Header for Habits */}
                                        <div
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: 'rgba(255,255,255,0.9)',
                                                paddingBottom: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                paddingLeft: '4px',
                                                cursor: 'default',
                                                userSelect: 'none',
                                                marginTop: '8px'
                                            }}
                                        >
                                            <div style={{ transition: 'transform 0.2s', transform: 'rotate(90deg)', opacity: 0.6 }}>
                                                <ChevronRight size={12} />
                                            </div>
                                            DAILY ROUTINE
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {(() => {
                                                const displayedHabits = [];
                                                const seenNames = new Set();

                                                // Helper to check if a habit is a Language Island
                                                const isIsland = (habit) => {
                                                    const sIds = habit.skillIds || (habit.skillId ? [habit.skillId] : []);
                                                    if (!sIds || sIds.length === 0) return false;
                                                    return sIds.some(sId => {
                                                        const skill = state.skills[sId];
                                                        if (!skill) return false;
                                                        const area = state.areas[skill.areaId];
                                                        return area && area.name === 'Languages';
                                                    });
                                                };

                                                Object.values(state.habits).forEach(habit => {
                                                    if (habit.name === 'Frequent mistakes at work') return;
                                                    if (habit.name === 'ewr') return;
                                                    if (isIsland(habit)) return; // Filter out islands from Habits tab
                                                    if (seenNames.has(habit.name)) return;
                                                    seenNames.add(habit.name);
                                                    displayedHabits.push(habit);
                                                });

                                                return displayedHabits.map(habit => (
                                                    <div
                                                        key={habit.id}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            handleDragStartHabit(e, habit.id);
                                                            e.currentTarget.classList.add('dragging-item');
                                                        }}
                                                        onDragEnd={(e) => {
                                                            e.currentTarget.classList.remove('dragging-item');
                                                        }}
                                                        style={{
                                                            padding: '10px 12px',
                                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                            color: 'rgba(255, 255, 255, 0.9)',
                                                            borderRadius: '16px',
                                                            cursor: 'grab',
                                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                                            fontSize: '13px',
                                                            fontWeight: '500',
                                                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                                                            height: 'auto',
                                                            transition: 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.2s ease, background-color 0.2s ease',

                                                            boxShadow: !state.showBackgrounds
                                                                ? '0 4px 12px -2px rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.03)'
                                                                : 'none'
                                                        }}
                                                        whileHover={{
                                                            scale: 1.02,
                                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                            x: 4,
                                                            boxShadow: !state.showBackgrounds
                                                                ? '0 12px 24px -6px rgba(0,0,0,0.6), 0 8px 12px -4px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08)'
                                                                : '0 8px 24px rgba(0, 0, 0, 0.2)'
                                                        }}
                                                        whileTap={{ scale: 0.98 }}
                                                    >
                                                        <div style={{ whiteSpace: 'normal', lineHeight: '1.4', width: '100%' }}>{habit.name}</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                                                            {habit.skillIds?.map(skillId => {
                                                                const skill = state.skills[skillId];
                                                                if (!skill) return null;
                                                                return (
                                                                    <div key={skillId} style={{
                                                                        fontSize: '10px',
                                                                        opacity: 0.5,
                                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                                        whiteSpace: 'nowrap',
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.05em'
                                                                    }}>
                                                                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.4)' }} />
                                                                        {skill.name}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                        {Object.values(state.habits).length === 0 && (
                                            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '13px' }}>
                                                No habits found.
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* LANGUAGES & WEALTH TABS (Filtered Tasks) */}
                            {sidebarTab !== 'habits' && (() => {
                                const isLanguageView = sidebarTab === 'languages';
                                let targetAreaNames = [];
                                if (isLanguageView) targetAreaNames = ['Languages'];
                                else if (sidebarTab === 'wealth') targetAreaNames = ['Wealth', 'Finance'];
                                else if (sidebarTab === 'latte') targetAreaNames = ['Latte', 'Latte app'];
                                else if (sidebarTab === 'spiritual') targetAreaNames = ['Spiritual'];
                                else if (sidebarTab === 'hot body') targetAreaNames = ['Hot Body', 'Physical'];

                                // Filter Unscheduled Tasks first
                                const filteredTasks = unscheduledTasks.filter(task => {
                                    const objective = state.objectives[task.objectiveId];
                                    if (!objective) return false;
                                    const skill = state.skills[objective.skillId];
                                    if (!skill) return false;
                                    const area = state.areas[skill.areaId];
                                    return area && targetAreaNames.some(name => area.name?.toLowerCase().includes(name.toLowerCase()));
                                });

                                let sortedGroups = [];

                                if (isLanguageView) {
                                    // Group by Skill for Languages
                                    const tasksBySkill = {};

                                    // 1. Add Tasks
                                    filteredTasks.forEach(task => {
                                        const objective = state.objectives[task.objectiveId];
                                        const skill = state.skills[objective.skillId];
                                        if (!tasksBySkill[skill.id]) tasksBySkill[skill.id] = { skill, tasks: [], islands: [] };
                                        tasksBySkill[skill.id].tasks.push({ task, objective });
                                    });

                                    // Sort tasks: in-progress first
                                    Object.values(tasksBySkill).forEach(group => {
                                        group.tasks.sort((a, b) => {
                                            const aRunning = a.task.status === 'in-progress';
                                            const bRunning = b.task.status === 'in-progress';
                                            if (aRunning && !bRunning) return -1;
                                            if (!aRunning && bRunning) return 1;
                                            return 0;
                                        });
                                    });

                                    sortedGroups = Object.values(tasksBySkill).sort((a, b) => a.skill.name.localeCompare(b.skill.name));

                                } else if (sidebarTab === 'spiritual') {
                                    // Group by Type for Spiritual
                                    const beliefs = Object.values(state.beliefs || {});
                                    const desires = Object.values(state.desires || {}).filter(d => d.status !== 'materialized');

                                    if (beliefs.length > 0) {
                                        sortedGroups.push({
                                            id: 'beliefs',
                                            title: 'Beliefs',
                                            beliefs: beliefs,
                                            tasks: []
                                        });
                                    }
                                    if (desires.length > 0) {
                                        sortedGroups.push({
                                            id: 'desires',
                                            title: 'Desires',
                                            desires: desires,
                                            tasks: []
                                        });
                                    }
                                    // Also include any tasks tagged strictly as Spiritual if any exist in the filter
                                    // (The filter above might catch some if they are linked to Spiritual Area -> Skill)
                                    const tasksByObj = {};
                                    filteredTasks.forEach(task => {
                                        const objective = state.objectives[task.objectiveId];
                                        if (!tasksByObj[objective.id]) tasksByObj[objective.id] = { objective, tasks: [] };
                                        tasksByObj[objective.id].tasks.push({ task, objective });
                                    });
                                    Object.values(tasksByObj).forEach(g => {
                                        sortedGroups.push({
                                            id: g.objective.id,
                                            title: g.objective.title,
                                            tasks: g.tasks
                                        });
                                    });

                                } else {
                                    // Group by Objective for Wealth/Money
                                    const tasksByObjective = {};
                                    filteredTasks.forEach(task => {
                                        const objective = state.objectives[task.objectiveId];
                                        if (!tasksByObjective[objective.id]) tasksByObjective[objective.id] = { objective, tasks: [] };
                                        tasksByObjective[objective.id].tasks.push({ task, objective });
                                    });

                                    // Sort tasks: in-progress first
                                    Object.values(tasksByObjective).forEach(group => {
                                        group.tasks.sort((a, b) => {
                                            const aRunning = a.task.status === 'in-progress';
                                            const bRunning = b.task.status === 'in-progress';
                                            if (aRunning && !bRunning) return -1;
                                            if (!aRunning && bRunning) return 1;
                                            return 0;
                                        });
                                    });

                                    sortedGroups = Object.values(tasksByObjective).sort((a, b) => a.objective.title.localeCompare(b.objective.title));
                                }

                                if (sortedGroups.length === 0) {
                                    return (
                                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '20px', fontSize: '13px' }}>
                                            No unscheduled tasks for {sidebarTab === 'languages' ? 'Languages' : (sidebarTab === 'wealth' ? 'Money' : (sidebarTab === 'spiritual' ? 'Spiritual' : 'Latte app'))}.
                                        </div>
                                    );
                                }

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {sortedGroups.map(group => {
                                            // Handle custom groups (Beliefs/Desires) which have direct id/title
                                            // validation: group.id/title take precedence if present
                                            const groupId = group.id || (isLanguageView ? group.skill.id : group.objective.id);
                                            const groupTitle = group.title || (isLanguageView ? group.skill.name : group.objective.title);
                                            const isExpanded = expandedSkills[groupId] !== false; // Reuse state name

                                            return (
                                                <div
                                                    key={groupId}
                                                    style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                                                >
                                                    {/* Group Header (Toggle) */}
                                                    <div
                                                        onClick={() => setExpandedSkills(prev => ({ ...prev, [groupId]: !isExpanded }))}
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
                                                            marginTop: '8px'
                                                        }}
                                                    >
                                                        <div style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', opacity: 0.6 }}>
                                                            <ChevronRight size={12} />
                                                        </div>
                                                        {groupTitle}
                                                    </div>

                                                    {/* Tasks for this Group */}
                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                                                            >
                                                                {/* Render Islands First */}
                                                                {group.islands && group.islands.map(habit => (
                                                                    <div
                                                                        key={habit.id}
                                                                        draggable
                                                                        onDragStart={(e) => {
                                                                            handleDragStartHabit(e, habit.id);
                                                                            e.currentTarget.classList.add('dragging-item');
                                                                        }}
                                                                        onDragEnd={(e) => {
                                                                            e.currentTarget.classList.remove('dragging-item');
                                                                        }}
                                                                        style={{
                                                                            padding: '10px 12px',
                                                                            backgroundColor: 'rgba(59, 130, 246, 0.15)', // Blue tint for Language Islands
                                                                            color: 'rgba(255, 255, 255, 0.95)',
                                                                            borderRadius: '16px',
                                                                            cursor: 'grab',
                                                                            border: '1px solid rgba(59, 130, 246, 0.4)',
                                                                            fontSize: '13px',
                                                                            fontWeight: '500',
                                                                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                                                                            height: 'auto',
                                                                            transition: 'all 0.2s',
                                                                            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.2)'
                                                                        }}
                                                                        whileHover={{ scale: 1.02, x: 2 }}
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                                                            <BookOpen size={12} color="#60a5fa" />
                                                                            <div style={{ whiteSpace: 'normal', lineHeight: '1.4', flex: 1 }}>{habit.name}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {/* Render Beliefs */}
                                                                {group.beliefs && group.beliefs.map(belief => (
                                                                    <motion.div
                                                                        key={belief.id}
                                                                        style={{
                                                                            padding: '12px 14px',
                                                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                                            color: 'rgba(255, 255, 255, 0.95)',
                                                                            borderRadius: '16px',
                                                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                            fontSize: '14px',
                                                                            fontWeight: '500',
                                                                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px',
                                                                            height: 'auto',
                                                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                            cursor: 'default',
                                                                            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.02)'
                                                                        }}
                                                                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                                                                    >
                                                                        <div style={{ whiteSpace: 'normal', lineHeight: '1.4', width: '100%' }}>{belief.statement || 'Untitled Belief'}</div>
                                                                        <div style={{
                                                                            fontSize: '9px',
                                                                            opacity: 0.4,
                                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.05em',
                                                                            fontWeight: '700'
                                                                        }}>
                                                                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#a78bfa' }} />
                                                                            Empowerment Statement
                                                                        </div>
                                                                    </motion.div>
                                                                ))}

                                                                {/* Render Desires */}
                                                                {group.desires && group.desires.map(desire => (
                                                                    <motion.div
                                                                        key={desire.id}
                                                                        style={{
                                                                            padding: '12px 14px',
                                                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                                            color: 'rgba(255, 255, 255, 0.95)',
                                                                            borderRadius: '16px',
                                                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                            fontSize: '14px',
                                                                            fontWeight: '500',
                                                                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px',
                                                                            height: 'auto',
                                                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                            cursor: 'default',
                                                                            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.02)'
                                                                        }}
                                                                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                                                                    >
                                                                        <div style={{ whiteSpace: 'normal', lineHeight: '1.4', width: '100%' }}>{desire.description || desire.targetDescription || 'Untitled Desire'}</div>
                                                                        <div style={{
                                                                            fontSize: '9px',
                                                                            opacity: 0.4,
                                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.05em',
                                                                            fontWeight: '700'
                                                                        }}>
                                                                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#f472b6' }} />
                                                                            Bridge to Reality
                                                                        </div>
                                                                    </motion.div>
                                                                ))}

                                                                {group.tasks.map(({ task, objective }, index) => {
                                                                    const isSelected = selectedTaskId === task.id;
                                                                    return (
                                                                        <motion.div
                                                                            key={task.id}
                                                                            whileHover={{ scale: 1.02, x: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                                                                            whileTap={{ scale: 0.98 }}
                                                                            draggable={true}
                                                                            onDragStart={(e) => handleDragStartItem(e, task.id, 'task')}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedTaskId(task.id);
                                                                            }}

                                                                            style={{
                                                                                padding: '12px 14px',
                                                                                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                                                borderRadius: '16px',
                                                                                border: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                                                                                cursor: 'grab',
                                                                                fontSize: '12px',
                                                                                color: 'white',
                                                                                position: 'relative',
                                                                                transition: 'all 0.2s',
                                                                                transform: 'translateZ(0)',
                                                                                boxShadow: '0 4px 12px -2px rgba(0,0,0,0.3)'
                                                                            }}
                                                                            className="premium-shadow"
                                                                            onMouseEnter={e => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                                                                        >
                                                                            <div style={{ fontWeight: '500', fontSize: '13px', color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                {task.status === 'in-progress' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }} />}
                                                                                {task.title}
                                                                            </div>
                                                                            <div style={{
                                                                                fontSize: '10px',
                                                                                opacity: 0.5,
                                                                                display: 'flex', alignItems: 'flex-start', gap: '6px',
                                                                                whiteSpace: 'normal',
                                                                                lineHeight: '1.4',
                                                                                textTransform: 'uppercase',
                                                                                letterSpacing: '0.05em',
                                                                                marginTop: '6px',
                                                                                color: 'rgba(255, 255, 255, 0.9)'
                                                                            }}>
                                                                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.4)', marginTop: '5px', flexShrink: 0 }} />
                                                                                <div style={{ flex: 1 }}>{objective.title}</div>
                                                                            </div>
                                                                            {task.scheduledDate && (
                                                                                <div style={{
                                                                                    fontSize: '9px',
                                                                                    color: '#fbbf24',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '4px',
                                                                                    marginTop: '4px',
                                                                                    fontWeight: '800',
                                                                                    textTransform: 'uppercase',
                                                                                    letterSpacing: '0.05em'
                                                                                }}>
                                                                                    <CalendarIcon size={10} />
                                                                                    Planned for {task.scheduledDate}
                                                                                </div>
                                                                            )}
                                                                        </motion.div>
                                                                    );
                                                                })}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="calendar-grid" style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto',
                    position: 'relative',
                    borderRadius: '0 24px 24px 0'
                }}>
                    <div style={{ display: 'flex', minHeight: '100%' }}>
                        {/* Sticky Time Labels Column */}
                        <div style={{
                            width: '50px',
                            flexShrink: 0,
                            position: 'sticky',
                            left: 0,
                            zIndex: 350,
                            background: 'transparent',
                            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Header Spacer - Perfectly synced with day header height */}
                            <div style={{ height: '110px', flexShrink: 0, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }} />
                            {hours.map(time => (
                                <div key={time} style={{
                                    height: '70px',
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                    color: 'rgba(255, 255, 255, 0.4)',
                                    fontWeight: '500',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                                }}>
                                    {to12h(time)}
                                </div>
                            ))}
                        </div>

                        {/* Days Columns Container */}
                        <div style={{
                            display: 'flex',
                            flex: 1,
                            position: 'relative',
                        }}>
                            {/* Now Line Indicator */}
                            {(() => {
                                const now = currentTime;
                                const h = now.getHours();
                                const m = now.getMinutes();
                                if (h >= 6 && h <= 23) {
                                    const topOffset = 110 + (h - 6 + m / 60) * 70;
                                    return (
                                        <div style={{
                                            position: 'absolute',
                                            top: `${topOffset}px`,
                                            left: 0,
                                            right: 0,
                                            zIndex: 200,
                                            pointerEvents: 'none',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                            <div style={{
                                                position: 'sticky',
                                                left: '50px', // Right after the time column
                                                background: '#ef4444',
                                                color: 'white',
                                                fontSize: '10px',
                                                fontWeight: '700',
                                                padding: '2px 6px',
                                                borderRadius: '6px',
                                                zIndex: 201,
                                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                                                whiteSpace: 'nowrap',
                                                transform: 'translateX(-50%)'
                                            }}>
                                                {to12h(`${h}:${m}`, true).replace(' ', '')}
                                            </div>
                                            <div style={{ flex: 1, height: '2px', background: '#ef4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }} />
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                                {generatedDays.map((day) => {
                                    const dateStr = formatDate(day);
                                    const isToday = dateStr === formatDate(new Date());
                                    const cycle = getCycleMode(day);

                                    return (
                                        <div
                                            key={dateStr}
                                            style={{
                                                flex: 1,
                                                minWidth: showCycle ? '450px' : 'unset',
                                                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                position: 'relative'
                                            }}
                                        >
                                            {/* Day Header */}
                                            <div
                                                style={{
                                                    height: '110px',
                                                    padding: '20px 10px',
                                                    textAlign: 'center',
                                                    position: 'sticky',
                                                    top: 0,
                                                    zIndex: 300,
                                                    background: 'transparent',
                                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                <div style={{ fontSize: '10px', color: isToday ? cycle.color : 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600' }}>
                                                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: '22px',
                                                        fontWeight: isToday ? '800' : '500',
                                                        color: isToday ? cycle.color : 'rgba(255, 255, 255, 0.95)',
                                                        marginTop: '2px'
                                                    }}
                                                >
                                                    {day.getDate()}
                                                </div>
                                                <div style={{
                                                    marginTop: '6px',
                                                    padding: '3px 10px',
                                                    borderRadius: '99px',
                                                    fontSize: '9px',
                                                    fontWeight: '800',
                                                    color: cycle.color,
                                                    background: `rgba(${cycle.color === '#ffffff' ? '255, 255, 255' : '212, 176, 123'}, 0.12)`,
                                                    border: `1px solid ${cycle.color}40`,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    {cycle.label}
                                                </div>
                                            </div>

                                            {/* Day Slots */}
                                            {hours.map(time => {
                                                const slotId = `${dateStr}-${time}`;
                                                const slotData = groups[slotId] || { timeBlocks: [], tasks: [], habits: [] };

                                                return (
                                                    <CalendarSlot
                                                        key={slotId}
                                                        slotId={slotId}
                                                        dateStr={dateStr}
                                                        time={time}
                                                        isDragOver={dragOverSlot?.slotId === slotId}
                                                        dragOverSubSlot={dragOverSlot?.subSlot}
                                                        isDraggedItem={draggedItem?.id === slotId}
                                                        timeBlocks={slotData.timeBlocks}
                                                        tasks={slotData.tasks}
                                                        habits={slotData.habits}
                                                        blockStats={blockStats}
                                                        state={state}
                                                        onSlotClick={handleSlotClick}
                                                        onDragOver={handleDragOver}
                                                        onDragEnter={handleDragEnter}
                                                        onDrop={handleDrop}
                                                        onDragLeave={handleDragLeave}
                                                        onDragStartItem={handleDragStartItem}
                                                        onSelectTimeBlock={handleSelectTimeBlock}
                                                        onEditTimeBlock={handleEditTimeBlock}
                                                        onTaskClick={handleTaskClick}
                                                        onHabitClick={handleHabitClick}
                                                        onResizeStart={handleResizeStart}
                                                        selectedTimeBlockId={selectedTimeBlockId}
                                                        editingTimeBlockId={editingTimeBlockId}
                                                        showAreaColor={showAreaColor}
                                                        showBackgrounds={showBackgrounds}
                                                        updateTimeBlock={updateTimeBlock}
                                                        selectedTaskId={selectedTaskId}
                                                        selectedHabitId={selectedHabitId}
                                                        resizingItem={resizingItem}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Popover */}
            < AnimatePresence >
                {selectedTaskDetail && (
                    <TaskDetailPopover
                        detail={selectedTaskDetail}
                        state={state}
                        onClose={closePopover}
                        onUnschedule={unscheduleTask}
                        onToggleStatus={(id, status) => updateTask(id, { status })}
                    />
                )}
            </AnimatePresence >
            <AnimatePresence>
                {selectedTimeBlockDetail && (
                    <TimeBlockDetailPopover
                        detail={selectedTimeBlockDetail}
                        onClose={() => { setSelectedTimeBlockDetail(null); setSelectedTimeBlockId(null); }}
                        onDelete={deleteTimeBlock}
                        onEdit={(id) => { setEditingTimeBlockId(id); setSelectedTimeBlockDetail(null); }}
                        onAddToRoutine={addTimeBlockToRoutine}
                        getCycleType={getCycleType}
                        state={state}
                        dispatch={dispatch}
                        unscheduleTask={unscheduleTask}
                        updateHabit={updateHabit}
                        updateTimeBlock={updateTimeBlock}
                        toggleHabit={toggleHabit}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {selectedHabitDetail && (
                    <HabitDetailPopover
                        detail={selectedHabitDetail}
                        state={state}
                        onClose={closePopover}
                        onUnschedule={(id) => { updateHabit(id, { scheduledDate: null, startTime: null, duration: null }); closePopover(); }}
                        onToggle={(id, date) => { toggleHabit(id, date); closePopover(); }}
                    />
                )}
            </AnimatePresence>
        </div >
    );
};

export default Calendar;

// --- Habit Detail Popover ---
const HabitDetailPopover = ({ detail, onClose, onUnschedule, onToggle, state }) => {
    if (!detail) return null;
    const { x, y } = detail;
    const habit = state.habits[detail.habit.id] || detail.habit;

    // Smarter positioning logic
    const popoverWidth = 300;
    const popoverHeight = 250;

    const containerRect = document.querySelector('.calendar-page')?.getBoundingClientRect();
    const itemRect = detail.rect;

    let finalX = x;
    let finalY = y;

    if (containerRect && itemRect) {
        // Position relative to .calendar-page container
        finalX = itemRect.right - containerRect.left + 10;
        finalY = itemRect.top - containerRect.top;

        // If too far right, show on the left side of the block
        if (finalX + popoverWidth > containerRect.width - 20) {
            finalX = itemRect.left - containerRect.left - popoverWidth - 10;
        }

        // Safety bounds for top/bottom
        finalY = Math.max(10, Math.min(finalY, containerRect.height - popoverHeight - 20));
        finalX = Math.max(10, Math.min(finalX, containerRect.width - popoverWidth - 10));
    }

    const style = {
        position: 'absolute',
        top: finalY,
        left: finalX,
        zIndex: 1000,
        width: `${popoverWidth}px`,
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                    ...style,
                    padding: '16px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'white', lineHeight: '1.4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={16} />
                        {habit.name}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                        <Clock size={14} />
                        <span>{habit.startTime ? formatRange(habit.startTime, habit.duration) : `${habit.duration || 30} minutes`}</span>
                    </div>
                    {(() => {
                        const target = habit.targetDailyCount || 1;
                        const historyVal = habit.history?.[habit.scheduledDate];
                        const count = historyVal === true ? 1 : (Number(historyVal) || 0);
                        const isCompleted = count >= target;

                        if (target > 1) {
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                                    <Target size={14} />
                                    <span>{count}/{target} completed today</span>
                                    {isCompleted && <CheckCircle size={14} color="#34d399" />}
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => { onToggle(habit.id, habit.scheduledDate); }}
                        style={{
                            flex: 1,
                            backgroundColor: 'rgba(52, 211, 153, 0.1)',
                            color: '#34d399',
                            border: '1px solid rgba(52, 211, 153, 0.2)',
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <CheckCircle size={14} />
                        {(() => {
                            const target = habit.targetDailyCount || 1;
                            const historyVal = habit.history?.[habit.scheduledDate];
                            const count = historyVal === true ? 1 : (Number(historyVal) || 0);
                            const isCompleted = count >= target;

                            if (target > 1) {
                                return isCompleted ? 'Reset' : `+1 (${count}/${target})`;
                            }
                            return 'Complete';
                        })()}
                    </button>
                    <button
                        onClick={() => { onUnschedule(habit.id); }}
                        style={{
                            flex: 1,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <Trash2 size={14} />
                        Unschedule
                    </button>
                </div>
            </motion.div>
        </>
    );
};

// --- Task Detail Popover ---
const TaskDetailPopover = ({ detail, onClose, onUnschedule, onToggleStatus, state }) => {
    if (!detail) return null;
    const { x, y } = detail;
    const task = state.tasks[detail.task.id] || detail.task;

    const isRunning = task.status === 'in-progress';

    // Smarter positioning logic
    const popoverWidth = 300;
    const popoverHeight = 300;

    const containerRect = document.querySelector('.calendar-page')?.getBoundingClientRect();
    const itemRect = detail.rect;

    let finalX = x;
    let finalY = y;

    if (containerRect && itemRect) {
        // Position relative to .calendar-page container
        finalX = itemRect.right - containerRect.left + 10;
        finalY = itemRect.top - containerRect.top;

        // If too far right, show on the left side of the block
        if (finalX + popoverWidth > containerRect.width - 20) {
            finalX = itemRect.left - containerRect.left - popoverWidth - 10;
        }

        // Safety bounds for top/bottom
        finalY = Math.max(10, Math.min(finalY, containerRect.height - popoverHeight - 20));
        finalX = Math.max(10, Math.min(finalX, containerRect.width - popoverWidth - 10));
    }

    const style = {
        position: 'absolute',
        top: finalY,
        left: finalX,
        zIndex: 1000,
        width: `${popoverWidth}px`,
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                    ...style,
                    padding: '16px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(20, 20, 20, 0.8)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
                }}
            >
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
                        <Clock size={14} />
                        <TaskTimer task={task} />
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
            </motion.div>
        </>
    );
};

// --- Save Routine Button Component ---
const SaveBtn = ({ label, targetType, color, icon, isFullWidth = false, timeBlock, onAddToRoutine, savedStatus, setSavedStatus }) => {
    const IconComponent = icon;
    return (
        <button
            onClick={() => {
                onAddToRoutine(timeBlock, targetType);
                setSavedStatus(label);
                setTimeout(() => setSavedStatus(false), 2000);
            }}
            style={{
                gridColumn: isFullWidth ? 'span 2' : 'auto',
                backgroundColor: savedStatus === label ? 'rgba(34, 197, 94, 0.2)' : `rgba(${color}, 0.15)`,
                color: savedStatus === label ? '#4ade80' : `rgb(${color})`,
                border: `1px solid ${savedStatus === label ? 'rgba(34, 197, 94, 0.3)' : `rgba(${color}, 0.3)`}`,
                padding: '10px 8px',
                borderRadius: '10px',
                fontSize: '10.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {savedStatus === label ? <CheckCircle size={14} /> : <IconComponent size={14} />}
            {savedStatus === label ? 'Added!' : label}
        </button>
    );
};

// --- Time Block Detail Popover ---
const TimeBlockDetailPopover = ({ detail, onClose, onEdit, onAddToRoutine, state, dispatch, unscheduleTask, updateHabit, updateTimeBlock, toggleHabit }) => {
    const [hoveredTaskId, setHoveredTaskId] = React.useState(null);
    const [savedStatus, setSavedStatus] = React.useState(false);

    if (!detail) return null;
    const { x, y } = detail;
    const timeBlock = state.timeBlocks[detail.timeBlock.id] || detail.timeBlock;


    // Link explicitly assigned habits and tasks using shared helper
    const explicitHabits = (timeBlock.habitIds || []).map(id => state.habits[id]).filter(Boolean);
    const explicitTasks = (timeBlock.taskIds || []).map(id => state.tasks[id]).filter(Boolean);

    // Filter items using central isOverlapping helper
    const allScheduledTasks = Object.values(state.tasks).filter(task =>
        task.scheduledDate === timeBlock.scheduledDate &&
        task.startTime &&
        isOverlapping(task.startTime, task.duration || 60, timeBlock.startTime, timeBlock.duration || 120)
    );

    const allScheduledHabits = Object.values(state.habits).filter(habit =>
        habit.scheduledDate === timeBlock.scheduledDate &&
        habit.startTime &&
        isOverlapping(habit.startTime, habit.duration || 30, timeBlock.startTime, timeBlock.duration || 120)
    );

    // Combine explicit and overlapping items (remove duplicates)
    const explicitHabitIds = new Set(timeBlock.habitIds || []);
    const explicitTaskIds = new Set(timeBlock.taskIds || []);

    const habits = [
        ...explicitHabits,
        ...allScheduledHabits.filter(h => !explicitHabitIds.has(h.id))
    ];

    const allTasks = [
        ...explicitTasks,
        ...allScheduledTasks.filter(t => !explicitTaskIds.has(t.id))
    ];

    // Categorize everything into user-friendly groups
    const languageActivities = allTasks.filter(task => {
        const objective = task.objectiveId ? state.objectives[task.objectiveId] : null;
        const skill = objective?.skillId ? state.skills[objective.skillId] : null;
        const area = skill?.areaId ? state.areas[skill.areaId] : null;
        return area?.name?.toLowerCase() === 'languages';
    });

    const moneyTasks = allTasks.filter(task => {
        const objective = task.objectiveId ? state.objectives[task.objectiveId] : null;
        const skill = objective?.skillId ? state.skills[objective.skillId] : null;
        const area = skill?.areaId ? state.areas[skill.areaId] : null;
        const areaNameLower = (area?.name || "").toLowerCase();
        return areaNameLower === 'finance' || areaNameLower === 'wealth' || (!area && task.rewardValue > 0);
    });

    const extraHabitsFromTasks = allTasks.filter(task => {
        const objective = task.objectiveId ? state.objectives[task.objectiveId] : null;
        const skill = objective?.skillId ? state.skills[objective.skillId] : null;
        const area = skill?.areaId ? state.areas[skill.areaId] : null;
        const areaNameLower = (area?.name || "").toLowerCase();
        // If it's not Language or Money, and belongs to a "Habit" area, or has no area but matches habit pattern
        return areaNameLower === 'hot body' || areaNameLower === 'spiritual' || (areaNameLower !== 'languages' && areaNameLower !== 'finance' && areaNameLower !== 'wealth' && areaNameLower !== '');
    });

    const combinedHabits = [...habits, ...extraHabitsFromTasks];
    const totalActivities = combinedHabits.length + moneyTasks.length + languageActivities.length;

    // Smarter positioning logic
    const popoverWidth = 330;
    const popoverHeight = 450; // Estimated max height

    const containerRect = document.querySelector('.calendar-page')?.getBoundingClientRect();
    const itemRect = detail.rect;

    let finalX = x;
    let finalY = y;

    if (containerRect && itemRect) {
        // Position relative to .calendar-page container
        finalX = itemRect.right - containerRect.left + 10;
        finalY = itemRect.top - containerRect.top;

        // If too far right, show on the left side of the block
        if (finalX + popoverWidth > containerRect.width - 20) {
            finalX = itemRect.left - containerRect.left - popoverWidth - 10;
        }

        // Safety bounds for top/bottom
        finalY = Math.max(10, Math.min(finalY, containerRect.height - popoverHeight - 20));
        finalX = Math.max(10, Math.min(finalX, containerRect.width - popoverWidth - 10));
    }

    const style = {
        position: 'absolute',
        top: finalY,
        left: finalX,
        zIndex: 1000,
        width: `${popoverWidth}px`,
        maxHeight: 'min(520px, 90vh)',
        overflowY: 'auto'
    };

    // Get area color
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


    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                    ...style,
                    padding: '16px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
                }}
            >
                {/* Header (Sticky) */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    position: 'sticky',
                    top: '-16px', // Match parent padding
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    padding: '16px',
                    margin: '-16px -16px 12px',
                    zIndex: 20,
                    borderRadius: '16px 16px 0 0',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                }}>
                    <div style={{ flex: 1 }}>
                        <div
                            onDoubleClick={() => onEdit(timeBlock.id)}
                            title="Double-click to edit name"
                            style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: 'white',
                                lineHeight: '1.4',
                                marginBottom: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                userSelect: 'none'
                            }}
                        >
                            {timeBlock.title}
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>({timeBlock.startTime ? formatRange(timeBlock.startTime, timeBlock.duration) : `${timeBlock.duration || 120} min`})</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <LayoutGrid size={12} />
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {Object.values(state.areas).map(a => (
                                    <button
                                        key={a.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            dispatch({ type: 'UPDATE_TIME_BLOCK', payload: { id: timeBlock.id, updates: { areaId: a.id } } });
                                        }}
                                        style={{
                                            background: timeBlock.areaId === a.id ? `${getAreaColor(a.name)}22` : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${timeBlock.areaId === a.id ? getAreaColor(a.name) : 'rgba(255,255,255,0.1)'}`,
                                            color: timeBlock.areaId === a.id ? getAreaColor(a.name) : 'rgba(255,255,255,0.3)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {a.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginTop: '8px', fontWeight: '500' }}>
                            Double-click title to edit • Select area to sync
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Activities List */}
                {totalActivities > 0 ? (
                    <div style={{ marginBottom: '16px' }}>

                        {/* Habits Section */}
                        {combinedHabits.length > 0 && (
                            <div style={{ marginBottom: (moneyTasks.length > 0 || languageActivities.length > 0) ? '16px' : '0' }}>
                                <div style={{ fontSize: '9px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Activity size={12} />
                                    <span>Habits ({combinedHabits.length})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {combinedHabits.map(item => {
                                        const isHabit = !!item.history;
                                        const title = isHabit ? item.name : item.title;
                                        let isCompleted = false;

                                        if (!isHabit) {
                                            isCompleted = item.isCompleted;
                                        } else {
                                            // Habit object: check history for the timeblock's date
                                            const historyVal = item.history?.[timeBlock.scheduledDate];
                                            const count = historyVal === true ? 1 : (Number(historyVal) || 0);
                                            isCompleted = count >= (item.targetDailyCount || 1);
                                        }

                                        const isHovered = hoveredTaskId === item.id;

                                        // For habits with multi-count, show progress
                                        let countDisplay = null;
                                        if (isHabit) {
                                            const target = item.targetDailyCount || 1;
                                            const historyVal = item.history?.[timeBlock.scheduledDate];
                                            const count = historyVal === true ? 1 : (Number(historyVal) || 0);
                                            if (target > 1) {
                                                countDisplay = `${count}/${target}`;
                                            }
                                        }

                                        return (
                                            <div
                                                key={item.id}
                                                onMouseEnter={() => setHoveredTaskId(item.id)}
                                                onMouseLeave={() => setHoveredTaskId(null)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isHabit) {
                                                        toggleHabit(item.id, timeBlock.scheduledDate);
                                                    } else {
                                                        dispatch({ type: 'UPDATE_TASK', payload: { id: item.id, updates: { isCompleted: !item.isCompleted } } });
                                                    }
                                                }}
                                                style={{
                                                    padding: '8px 10px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '12px',
                                                    transition: 'all 0.2s',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                                    <div style={{
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '4px',
                                                        border: `2px solid ${isCompleted ? '#34d399' : 'rgba(255,255,255,0.2)'}`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: isCompleted ? 'rgba(52, 211, 153, 0.2)' : (countDisplay ? 'rgba(195, 154, 107, 0.15)' : 'transparent'),
                                                        transition: 'all 0.2s',
                                                        fontSize: '9px',
                                                        fontWeight: 'bold',
                                                        color: countDisplay && !isCompleted ? '#c39a6b' : '#34d399'
                                                    }}>
                                                        {isCompleted ? <CheckCircle size={12} color="#34d399" /> : (countDisplay ? countDisplay.split('/')[0] : null)}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: 'white',
                                                        textDecoration: isCompleted ? 'line-through' : 'none',
                                                        opacity: isCompleted ? 0.6 : 1,
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        <span>{title}</span>
                                                        {countDisplay && (
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: '500',
                                                                color: 'rgba(255,255,255,0.5)',
                                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px'
                                                            }}>
                                                                {countDisplay}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isHovered && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!isHabit) {
                                                                unscheduleTask(item.id);
                                                            } else {
                                                                // Check if it's an explicit habit or an overlapping one
                                                                const isExplicit = (timeBlock.habitIds || []).includes(item.id);
                                                                if (isExplicit) {
                                                                    updateTimeBlock(timeBlock.id, {
                                                                        habitIds: (timeBlock.habitIds || []).filter(hId => hId !== item.id)
                                                                    });
                                                                } else {
                                                                    updateHabit(item.id, { scheduledDate: null, startTime: null, duration: null });
                                                                }
                                                            }
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'rgba(255, 255, 255, 0.4)',
                                                            cursor: 'pointer',
                                                            padding: '4px 8px',
                                                            fontSize: '10px',
                                                            fontWeight: '600',
                                                            borderRadius: '4px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                                                        }}
                                                    >
                                                        Unschedule
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Money Tasks Section */}
                        {moneyTasks.length > 0 && (
                            <div style={{ marginBottom: languageActivities.length > 0 ? '16px' : '0' }}>
                                <div style={{ fontSize: '9px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <DollarSign size={12} />
                                    <span>Tasks ({moneyTasks.length})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {moneyTasks.map(task => {
                                        const objective = task.objectiveId ? state.objectives[task.objectiveId] : null;
                                        const isHovered = hoveredTaskId === task.id;

                                        return (
                                            <div
                                                key={task.id}
                                                onMouseEnter={() => setHoveredTaskId(task.id)}
                                                onMouseLeave={() => setHoveredTaskId(null)}
                                                style={{
                                                    padding: '8px 10px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: 'white',
                                                        textDecoration: task.isCompleted ? 'line-through' : 'none',
                                                        opacity: task.isCompleted ? 0.6 : 1
                                                    }}>
                                                        {task.title}
                                                    </div>
                                                    {objective && (
                                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                                                            {objective.title}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                        <TaskTimer task={task} />
                                                    </div>
                                                </div>
                                                {isHovered && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            unscheduleTask(task.id);
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'rgba(255, 255, 255, 0.4)',
                                                            cursor: 'pointer',
                                                            padding: '4px 8px',
                                                            fontSize: '10px',
                                                            fontWeight: '600',
                                                            borderRadius: '4px',
                                                            transition: 'all 0.2s',
                                                            alignSelf: 'flex-start'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                                                        }}
                                                    >
                                                        Unschedule
                                                    </button>
                                                )}

                                                {/* Status Menu Below Content */}
                                                <AnimatePresence>
                                                    {isHovered && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                                            style={{
                                                                display: 'flex',
                                                                gap: '4px',
                                                                marginTop: '4px',
                                                                paddingTop: '8px',
                                                                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                                                                overflow: 'hidden'
                                                            }}>
                                                            <motion.button
                                                                initial={{ scale: 0.8, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                transition={{ delay: 0.05, duration: 0.15 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, updates: { status: 'in-progress', isCompleted: false } } });
                                                                }}
                                                                style={{
                                                                    background: task.status === 'in-progress' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                    color: '#3b82f6',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    transition: 'all 0.2s',
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = task.status === 'in-progress' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'}
                                                            >
                                                                {task.status === 'in-progress' ? 'In Progress' : 'Resume'}
                                                            </motion.button>
                                                            <motion.button
                                                                initial={{ scale: 0.8, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                transition={{ delay: 0.1, duration: 0.15 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, updates: { status: 'paused', isCompleted: false } } });
                                                                }}
                                                                style={{
                                                                    background: task.status === 'paused' ? 'rgba(156, 163, 175, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                    color: '#9ca3af',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    transition: 'all 0.2s',
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(156, 163, 175, 0.3)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = task.status === 'paused' ? 'rgba(156, 163, 175, 0.3)' : 'rgba(255, 255, 255, 0.05)'}
                                                            >
                                                                Pause
                                                            </motion.button>
                                                            <motion.button
                                                                initial={{ scale: 0.8, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                transition={{ delay: 0.15, duration: 0.15 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, updates: { status: 'completed', isCompleted: true } } });
                                                                }}
                                                                style={{
                                                                    background: task.isCompleted ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                    color: '#a855f7',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    transition: 'all 0.2s',
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.3)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = task.isCompleted ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)'}
                                                            >
                                                                Done
                                                            </motion.button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Language Activities Section */}
                        {languageActivities.length > 0 && (
                            <div>
                                <div style={{ fontSize: '9px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Globe size={12} />
                                    <span>Activities ({languageActivities.length})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {languageActivities.map(task => {
                                        const objective = task.objectiveId ? state.objectives[task.objectiveId] : null;
                                        const isHovered = hoveredTaskId === task.id;

                                        return (
                                            <div
                                                key={task.id}
                                                onMouseEnter={() => setHoveredTaskId(task.id)}
                                                onMouseLeave={() => setHoveredTaskId(null)}
                                                style={{
                                                    padding: '8px 10px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: 'white',
                                                        textDecoration: task.isCompleted ? 'line-through' : 'none',
                                                        opacity: task.isCompleted ? 0.6 : 1
                                                    }}>
                                                        {task.title}
                                                    </div>
                                                    {objective && (
                                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                                                            {objective.title}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                        <TaskTimer task={task} />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        unscheduleTask(task.id);
                                                    }}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'rgba(239, 68, 68, 0.4)',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        borderRadius: '4px',
                                                        transition: 'all 0.2s',
                                                        marginTop: '-8px' // Align with title
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                                                        e.currentTarget.style.color = '#f87171';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                        e.currentTarget.style.color = 'rgba(239, 68, 68, 0.4)';
                                                    }}
                                                    title="Unschedule"
                                                >
                                                    <Trash2 size={14} />
                                                </button>

                                                {/* Status Menu Below Content */}
                                                <AnimatePresence>
                                                    {isHovered && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                                            style={{
                                                                display: 'flex',
                                                                gap: '4px',
                                                                marginTop: '4px',
                                                                paddingTop: '8px',
                                                                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                                                                overflow: 'hidden'
                                                            }}>
                                                            <motion.button
                                                                initial={{ scale: 0.8, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                transition={{ delay: 0.05, duration: 0.15 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, updates: { status: 'in-progress', isCompleted: false } } });
                                                                }}
                                                                style={{
                                                                    background: task.status === 'in-progress' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                    color: '#3b82f6',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    transition: 'all 0.2s',
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = task.status === 'in-progress' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'}
                                                            >
                                                                {task.status === 'in-progress' ? 'In Progress' : 'Resume'}
                                                            </motion.button>
                                                            <motion.button
                                                                initial={{ scale: 0.8, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                transition={{ delay: 0.1, duration: 0.15 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, updates: { status: 'paused', isCompleted: false } } });
                                                                }}
                                                                style={{
                                                                    background: task.status === 'paused' ? 'rgba(156, 163, 175, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                    color: '#9ca3af',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    transition: 'all 0.2s',
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(156, 163, 175, 0.3)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = task.status === 'paused' ? 'rgba(156, 163, 175, 0.3)' : 'rgba(255, 255, 255, 0.05)'}
                                                            >
                                                                Pause
                                                            </motion.button>
                                                            <motion.button
                                                                initial={{ scale: 0.8, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                transition={{ delay: 0.15, duration: 0.15 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, updates: { status: 'completed', isCompleted: true } } });
                                                                }}
                                                                style={{
                                                                    background: task.isCompleted ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                    color: '#a855f7',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    transition: 'all 0.2s',
                                                                    flex: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.3)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = task.isCompleted ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)'}
                                                            >
                                                                Done
                                                            </motion.button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontStyle: 'italic' }}>
                        No activities in this timeblock
                    </div>
                )}



                {/* Save Routine Options */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
                    <>
                        <SaveBtn label="Daily Routine" targetType={null} color="168, 85, 247" icon={Zap} isFullWidth timeBlock={timeBlock} onAddToRoutine={onAddToRoutine} savedStatus={savedStatus} setSavedStatus={setSavedStatus} />
                        <SaveBtn label="Work Day 1" targetType="work1" color="59, 130, 246" icon={Repeat} timeBlock={timeBlock} onAddToRoutine={onAddToRoutine} savedStatus={savedStatus} setSavedStatus={setSavedStatus} />
                        <SaveBtn label="Work Day 2" targetType="work2" color="251, 146, 60" icon={Repeat} timeBlock={timeBlock} onAddToRoutine={onAddToRoutine} savedStatus={savedStatus} setSavedStatus={setSavedStatus} />
                        <SaveBtn label="Light Day" targetType="light" color="251, 113, 133" icon={RotateCw} isFullWidth timeBlock={timeBlock} onAddToRoutine={onAddToRoutine} savedStatus={savedStatus} setSavedStatus={setSavedStatus} />
                    </>
                </div>
            </motion.div>
        </>
    );
};
