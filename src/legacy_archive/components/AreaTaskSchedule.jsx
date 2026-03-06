import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash2, CheckCircle, Circle, ChevronDown, ChevronRight, LayoutList, Clock, PauseCircle, CheckCircle2, RotateCw, CheckSquare, Calendar, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import TaskDetailModal from './TaskDetailModal';
import { useGlassClass } from '../hooks/useGlassClass';

const GROWTH_TYPES = [
    { label: 'Regular life task', color: '#cbd5e1' },      // Light Grey (Readable)
    { label: 'Booster', color: '#e7d5c9' },                // Light Beige (Readable)
    { label: 'Learned something new', color: '#94a3b8' },  // Soft Blue-Grey (Lighter Slate)
    { label: 'New & outside comfort zone', color: '#f87171' }, // Soft Red (Lighter than ef4444)
    { label: 'Important progress', color: '#c4a484' },      // Light Brown/Tan (Readable)
    { label: 'This really drives results', color: '#818cf8' } // Soft Indigo/Blue (Readable "Dark Blue")
];

const STATUSES = [
    { id: 'not-started', label: 'Not Started', color: '#ef4444' }, // Red
    { id: 'in-progress', label: 'In Progress', color: '#3b82f6' }, // Blue
    { id: 'done', label: 'Done', color: '#9065b0' }, // Purple
    { id: 'waiting', label: 'Paused', color: '#9ca3af' }, // Grey
    { id: 'blocked', label: 'Blocked', color: '#f59e0b' } // Keep orange
];

const variants = {
    enter: (direction) => ({
        x: direction > 0 ? '100%' : direction < 0 ? '-100%' : 0,
        opacity: 1 // Explicitly no fading
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


const TimerDisplay = ({ task }) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (task.status === 'in-progress') {
            const interval = setInterval(() => setNow(Date.now()), 1000);

            const handleVisibilityChange = () => {
                if (document.visibilityState === 'visible') {
                    setNow(Date.now());
                }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                clearInterval(interval);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }
    }, [task.status]);

    let totalSeconds = task.totalInProgressTime || 0;
    if (task.status === 'in-progress' && task.lastStartedAt) {
        totalSeconds += (now - task.lastStartedAt) / 1000;
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return (
        <span style={{ fontFamily: 'monospace', color: task.status === 'in-progress' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
    );
};

const AreaTaskSchedule = ({ areaId, filterSkillId, targetSkillIds }) => {
    const { state, addObjective, deleteObjective, addTask, deleteTask, updateTask, updateObjective, addSkill } = useStore();
    const glassClass = useGlassClass();
    const [isHovered, setIsHovered] = useState(false);

    const [editingItem, setEditingItem] = useState(null); // { type: 'objective' | 'task', id: string, tempValue: string }

    const startEditing = (type, item, e) => {
        e.stopPropagation();
        setEditingItem({ type, id: item.id, tempValue: item.title });
    };

    const handleEditChange = (e) => {
        setEditingItem(prev => ({ ...prev, tempValue: e.target.value }));
    };

    const saveEdit = () => {
        if (!editingItem) return;
        const trimmedTitle = editingItem.tempValue.trim();

        if (editingItem.type === 'objective') {
            // Keep it even if empty - "Save every single thing"
            updateObjective(editingItem.id, { title: trimmedTitle || 'No Title' });
        } else if (editingItem.type === 'task') {
            // Keep it even if empty
            updateTask(editingItem.id, { title: trimmedTitle || 'Untitled Task' });
        }
        setEditingItem(null);
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            setEditingItem(null);
        }
    };

    const area = state.areas[areaId];
    // Get all skills for this area
    const skillIds = React.useMemo(() => area ? (area.skillIds || []) : [], [area]);

    // If targetSkillIds is provided, filter the area skills to only those.
    // Otherwise use all area skills.
    const relevantSkills = React.useMemo(() => {
        return targetSkillIds
            ? targetSkillIds.map(id => (state.skills || {})[id]).filter(Boolean)
            : skillIds.map(skillId => (state.skills || {})[skillId]).filter(Boolean);
    }, [targetSkillIds, state.skills, skillIds]);

    const allAreaSkills = React.useMemo(() => {
        return skillIds.map(skillId => state.skills[skillId]).filter(Boolean);
    }, [skillIds, state.skills]);

    const [expandedObjectives, setExpandedObjectives] = useState({});
    const [selectedTask, setSelectedTask] = useState(null);

    // Initialize viewMode
    // If targetSkillIds is provided OR area is Languages, default to first relevant skill
    const [viewMode, setViewMode] = useState(() => {
        // Try to get from localStorage first (area-specific tab persistence)
        const saved = localStorage.getItem(`task_tab_${areaId}`);
        if (saved) return saved;

        if (targetSkillIds && relevantSkills.length > 0) return relevantSkills[0].id;
        if (area && area.name === 'Languages' && allAreaSkills.length > 0) return allAreaSkills[0].id;
        return 'all';
    });
    const [direction, setDirection] = useState(0);

    const handleTabChange = (newId) => {
        const currentIndex = STATUS_TABS.findIndex(t => t.id === viewMode);
        const newIndex = STATUS_TABS.findIndex(t => t.id === newId);
        setDirection(newIndex > currentIndex ? 1 : -1);
        setViewMode(newId);
        localStorage.setItem(`task_tab_${areaId}`, newId);
    };

    // Ensure viewMode is valid
    useEffect(() => {
        if (targetSkillIds && relevantSkills.length > 0) {
            // accessible check
            const ids = relevantSkills.map(s => s.id);
            if (!ids.includes(viewMode)) {
                setViewMode(relevantSkills[0].id);
            }
        } else if (area && area.name === 'Languages' && viewMode === 'all' && allAreaSkills.length > 0) {
            setViewMode(allAreaSkills[0].id);
        }
    }, [viewMode, targetSkillIds, relevantSkills, allAreaSkills, area?.name]);

    const STATUS_TABS = React.useMemo(() => {
        if (!area) return [];

        // If we have specific target skills (or Languages/Hot body which effectively works the same), create tabs for them
        if (targetSkillIds || area.name === 'Languages') {
            // For Languages, relevantSkills is just allAreaSkills (unless we passed targetSkillIds separately? but logic above handles it)
            // Wait, logic above: if targetSkillIds is NOT passed, relevantSkills is allAreaSkills.
            // So this works for both cases.
            return relevantSkills.map(s => ({ id: s.id, label: s.name, icon: null, color: '#3b82f6' }));
        }

        return [
            { id: 'all', label: 'All Tasks', icon: <Circle size={16} />, color: '#ffffff' },
            { id: 'not-started', label: 'Not Started', icon: <LayoutList size={16} />, color: '#ef4444' },
            { id: 'active', label: 'In Progress', icon: <Clock size={16} />, color: '#3b82f6' },
            { id: 'done', label: 'Completed', icon: <CheckCircle2 size={16} />, color: '#9065b0' }
        ];
    }, [area, relevantSkills, targetSkillIds]);

    // Language Activities
    const LANGUAGE_ACTIVITIES = ['Speaking', 'Listening', 'Writing', 'Reading', 'Vocab', 'Grammar'];

    const getActivityColor = (type) => {
        switch (type) {
            case 'Speaking': return { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' }; // Red
            case 'Reading':
            case 'Listening':
            case 'Vocab': return { bg: 'rgba(249, 115, 22, 0.2)', text: '#f97316' }; // Orange
            case 'Grammar': return { bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308' }; // Yellow
            default: return { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' }; // Blue (Writing)
        }
    };

    if (!area) return null;

    // Get all objectives for these skills

    // Get all objectives for these skills
    const objectives = Object.values(state.objectives).filter(obj => {
        if (filterSkillId && obj.skillId !== filterSkillId) return false;

        // If targetSkillIds is set, only show objectives for those skills
        if (targetSkillIds) {
            return targetSkillIds.includes(obj.skillId);
        }

        return skillIds.includes(obj.skillId);
    });

    const toggleExpand = (id) => {
        setExpandedObjectives(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddObjective = () => {
        // Determine skill ID
        let skillId = null;
        if (area.name === 'Languages' || targetSkillIds) {
            // If viewing a specific language or filtered skill tab, add to that skill
            skillId = (viewMode !== 'all' && viewMode) ? viewMode : (relevantSkills[0]?.id || null);
        } else {
            // For other areas, pick first skill
            skillId = filterSkillId || skillIds[0] || null;
        }

        // AUTO-FIX: If no skill exists for this area, create a default one
        if (!skillId) {
            // console.log("📝 No skill found for area, creating default...");
            const defaultSkillName = area.name === 'Finance' ? 'General Finance' :
                area.name === 'Latte app' ? 'Latte' :
                    `${area.name} Tasks`;
            skillId = addSkill(areaId, defaultSkillName);
        }

        if (!skillId) {
            console.error("❌ Failed to resolve or create skillId for objective");
            return;
        }

        const id = addObjective(skillId, '');
        setEditingItem({ type: 'objective', id, tempValue: '' });
    };

    const handleAddSubTask = (objectiveId) => {
        const id = addTask(objectiveId, '');
        setEditingItem({ type: 'task', id, tempValue: '' });
    };

    const DIFFICULTIES = ['Trivial', 'Easy', 'Medium', 'Hard', 'Very Hard', 'Boss'];

    // Notion-like colors from screenshot
    // Trivial: Dark Gray, Easy: Light Gray, Medium: Brown, Hard: Orange, Very Hard: Red, Boss: Purple
    const getDifficultyColor = (diff) => {
        switch (diff) {
            case 'Trivial': return 'rgba(55, 53, 47, 0.3)'; // Dark Gray with transparency
            case 'Easy': return 'rgba(90, 90, 90, 0.3)';    // Lighter Gray with transparency
            case 'Medium': return 'rgba(143, 107, 78, 0.3)';  // Brown with transparency
            case 'Hard': return 'rgba(217, 115, 13, 0.3)';    // Orange with transparency
            case 'Very Hard': return 'rgba(212, 76, 71, 0.3)'; // Red with transparency
            case 'Boss': return 'rgba(144, 101, 176, 0.3)';    // Purple with transparency
            default: return 'rgba(55, 53, 47, 0.3)';
        }
    };

    const getSkillColor = (skillId) => {
        if (!skillId) return { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af' };

        const skill = state.skills[skillId];
        if (!skill) return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' };

        const name = skill.name.toLowerCase();

        if (name.includes('warhead') || name.includes('due diligence')) {
            return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' }; // Red
        }
        if (name.includes('crypto') || name.includes('latte')) {
            return { bg: 'rgba(231, 213, 201, 0.15)', text: '#e7d5c9' }; // Beige
        }
        if (name.includes('stocks')) {
            return { bg: 'rgba(161, 102, 94, 0.15)', text: '#a1665e' }; // Muted Clay (Red-Brown)
        }

        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' }; // Default blue
    };


    const showBackgrounds = state.showBackgrounds !== false;

    return (
        <motion.div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            transition={{
                layout: { type: "spring", stiffness: 300, damping: 30 },
                transform: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] },
                boxShadow: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }
            }}
            style={{
                isolation: 'isolate', // Force new stacking context for Safari fix
                marginTop: '0',
                marginBottom: 'var(--spacing-xl)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                padding: '32px',
                background: showBackgrounds ? 'rgba(0, 0, 0, 0.1)' : '#1e1e1e', // Medium Dark Glass or Solid 
                backdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                WebkitBackdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                boxShadow: !showBackgrounds
                    ? (isHovered
                        ? '0 30px 60px -12px rgba(0,0,0,0.7), 0 18px 36px -18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)'
                        : '0 20px 40px -12px rgba(0,0,0,0.5), 0 12px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)')
                    : (isHovered ? '0 40px 80px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.15)'),
                transform: isHovered ? 'translateY(-2px) scale(1.002)' : 'translateY(0) scale(1)',
                color: 'var(--color-text-main)',
                // Removed aggressive GPU acceleration properties that cause Safari/Webkit rendering issues
            }}>
            <style>
                {`
                    .finance-task-row button { opacity: 0; transition: opacity 0.2s; }
                    .finance-task-row:hover button { opacity: 1 !important; }
                    .objective-row .objective-delete-btn { opacity: 0; transition: opacity 0.2s; }
                    .objective-row:hover .objective-delete-btn { opacity: 1 !important; }
                    .status-tab { 
                        padding: 6px 12px; 
                        border-radius: 99px; 
                        cursor: pointer; 
                        display: flex; 
                        alignItems: center; 
                        gap: 6px; 
                        font-size: 13px; 
                        font-weight: 600; 
                        line-height: 1; 
                        transition: all 0.2s; 
                        color: rgba(255,255,255,0.5); 
                        border: 1px solid transparent;
                    }
                    .status-tab:hover { 
                        background: rgba(255, 255, 255, 0.05); 
                        color: white; 
                    }
                    .status-tab.active { 
                        background: rgba(255, 255, 255, 0.1); 
                        color: white; 
                        border-color: rgba(255,255,255,0.1);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }
                    .finance-task-row:hover {
                        background-color: rgba(255, 255, 255, 0.03) !important;
                    }
                    select:hover {
                        background-color: rgba(255, 255, 255, 0.08) !important;
                    }
                `}
            </style>
            <motion.div layout style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                {/* Tabs at the top */}
                {!filterSkillId && (
                    <div style={{ display: 'flex', gap: '8px', background: 'none', flexWrap: 'wrap' }}>
                        {/* Re-using the STATUS_TABS logic from before */}
                        {STATUS_TABS.map(tab => (
                            <div
                                key={tab.id}
                                className={`status-tab ${viewMode === tab.id ? 'active' : ''}`}
                                onClick={() => handleTabChange(tab.id)}
                                style={{
                                    color: viewMode === tab.id ? '#fff' : 'rgba(255,255,255,0.4)',
                                    background: viewMode === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent'
                                }}
                            >
                                {tab.icon}
                                {tab.label.toUpperCase()}
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Objective button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleAddObjective}
                        className={glassClass}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                            e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                        }}
                    >
                        <Plus size={14} /> ADD OBJECTIVE
                    </button>
                </div>
            </motion.div>

            <div style={{ position: 'relative', overflow: 'hidden' }}>
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={viewMode}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0 } // Ensure no fading
                        }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                    >
                        {objectives.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '13px' }}>
                                No objectives found. Add one to start your schedule!
                            </div>
                        )}




                        {objectives.map(obj => {
                            const isExpanded = expandedObjectives[obj.id] !== false; // Default expanded
                            const tasks = (obj.taskIds || [])
                                .map(tid => state.tasks[tid])
                                .filter(task => {
                                    if (!task) return false;

                                    // For Languages area: show ALL tasks regardless of skillId
                                    // (tasks might have activityTypes but no skillId yet)
                                    if (area.name === 'Languages' || targetSkillIds) {
                                        return true; // Show all tasks - filtering by objective already scopes to the right area
                                    }

                                    // Otherwise viewMode is a status string ('all', 'not-started', etc)
                                    if (viewMode === 'all') return true;
                                    if (viewMode === 'active') return task.status === 'in-progress' || task.status === 'waiting';
                                    return (task.status || 'not-started') === viewMode;
                                });

                            // Filter Objectives for Language View OR Target Skills View
                            if ((area.name === 'Languages' || area.name === 'Hot body' || targetSkillIds) && viewMode !== 'all' && obj.skillId !== viewMode) return null;

                            return (
                                <div key={obj.id} style={{ marginBottom: '16px' }}>
                                    {/* Objective Row */}
                                    <div
                                        onClick={() => toggleExpand(obj.id)}
                                        className="objective-row"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '140px 1fr 120px 100px 120px 160px 40px',
                                            gap: '12px',
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            marginBottom: '4px',
                                            alignItems: 'center',
                                            borderRadius: '12px',
                                            transition: 'background 0.2s',
                                            background: 'transparent'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'transparent'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gridColumn: '1 / span 2', gap: '8px' }}>
                                            {isExpanded ? <ChevronDown size={14} color="rgba(255,255,255,0.5)" /> : <ChevronRight size={14} color="rgba(255,255,255,0.5)" />}
                                            <Target size={14} style={{ color: '#fbbf24' }} /> {/* Amber for Objective */}
                                            {editingItem?.type === 'objective' && editingItem.id === obj.id ? (
                                                <input
                                                    autoFocus
                                                    value={editingItem.tempValue}
                                                    onChange={handleEditChange}
                                                    onBlur={saveEdit}
                                                    onKeyDown={handleEditKeyDown}
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#fff',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        outline: 'none',
                                                        width: '100%',
                                                        fontFamily: 'inherit'
                                                    }}
                                                />
                                            ) : (
                                                <span
                                                    onClick={(e) => startEditing('objective', obj, e)}
                                                    style={{ fontWeight: '600', fontSize: '14px', color: '#fff', cursor: 'text' }}
                                                >
                                                    {obj.title}
                                                </span>
                                            )}
                                        </div>

                                        {/* Property Titles inline with Objective */}
                                        <div style={{ fontSize: '9px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>STATUS</div>
                                        <div style={{ fontSize: '9px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>SKILL</div>
                                        <div style={{ fontSize: '9px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>DIFFICULTY</div>
                                        <div style={{ fontSize: '9px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>GROWTH</div>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteObjective(obj.id, obj.skillId); }}
                                            style={{ color: '#ef4444', opacity: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                                            className="objective-delete-btn"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Task Rows */}
                                    {isExpanded && (
                                        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                            {/* Vertical line connecting tasks */}
                                            <div style={{ position: 'absolute', left: '23px', top: '0', bottom: '10px', width: '1px', background: 'rgba(255,255,255,0.05)', zIndex: 0 }}></div>

                                            {tasks.map((task, index) => {
                                                const currentStatus = STATUSES.find(s => s.id === (task.status || 'not-started')) || STATUSES[0];

                                                return (
                                                    <div
                                                        key={task.id}
                                                        className="finance-task-row"
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '140px 1fr 120px 100px 120px 160px 40px',
                                                            gap: '12px',
                                                            alignItems: 'center',
                                                            padding: '8px 16px',
                                                            backgroundColor: 'transparent',
                                                            borderTop: 'none',
                                                            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                                            transition: 'background-color 0.2s',
                                                            position: 'relative',
                                                            zIndex: 1
                                                        }}
                                                    >
                                                        {/* Status Select */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const isCompleted = task.status === 'done';
                                                                    if (isCompleted) {
                                                                        updateTask(task.id, { status: 'not-started' });
                                                                    } else {
                                                                        // Language/Latte activities or recurring tasks always go back to not-started and increment count
                                                                        if (task.isRecurring || area.name === 'Languages' || area.name === 'Latte app') {
                                                                            updateTask(task.id, {
                                                                                status: 'not-started',
                                                                                timesCompleted: (task.timesCompleted || 0) + 1,
                                                                                isCompleted: false
                                                                            });
                                                                        } else {
                                                                            updateTask(task.id, { status: 'done' });
                                                                        }
                                                                    }
                                                                }}
                                                                className={glassClass}
                                                                style={{
                                                                    width: '18px', height: '18px', borderRadius: '6px', padding: 0,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    border: task.status === 'done' ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                                                    color: task.status === 'done' ? '#fff' : 'transparent',
                                                                    background: task.status === 'done' ? '#10b981' : 'rgba(255,255,255,0.02)',
                                                                    transition: 'all 0.2s',
                                                                    boxShadow: task.status === 'done' ? '0 2px 4px rgba(16, 185, 129, 0.4)' : 'none',
                                                                    flexShrink: 0,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <Check size={12} strokeWidth={4} />
                                                            </button>

                                                            <select
                                                                value={task.status || 'not-started'}
                                                                onChange={(e) => {
                                                                    const newVal = e.target.value;
                                                                    if (newVal === 'done' && (task.isRecurring || area.name === 'Languages' || area.name === 'Latte app')) {
                                                                        // Language/Latte activities or recurring tasks always go back to not-started and increment count
                                                                        updateTask(task.id, {
                                                                            status: 'not-started',
                                                                            timesCompleted: (task.timesCompleted || 0) + 1,
                                                                            isCompleted: false
                                                                        });
                                                                    } else {
                                                                        updateTask(task.id, { status: newVal });
                                                                    }
                                                                }}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: currentStatus.color,
                                                                    fontSize: '11px',
                                                                    fontWeight: '600',
                                                                    padding: '0',
                                                                    cursor: 'pointer',
                                                                    outline: 'none',
                                                                    appearance: 'none',
                                                                    textAlign: 'left',
                                                                    opacity: 0.8
                                                                }}
                                                            >
                                                                {STATUSES.map(s => (
                                                                    <option key={s.id} value={s.id} style={{ background: '#1e1e1e', color: s.color }}>{s.label.toUpperCase()}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div
                                                            onClick={() => setSelectedTask(task)}
                                                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.color = task.status === 'done' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)'}
                                                            style={{
                                                                marginLeft: '0px',
                                                                color: task.status === 'done' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)',
                                                                fontSize: '13px',
                                                                cursor: 'pointer',
                                                                transition: 'color 0.2s',
                                                                display: 'flex',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            {area.name === 'Languages' && (
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newRecur = !task.isRecurring;
                                                                        updateTask(task.id, { isRecurring: newRecur });
                                                                    }}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        color: task.isRecurring ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255,255,255,0.2)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        marginRight: '12px',
                                                                        marginLeft: '-10px'
                                                                    }}
                                                                    title={task.isRecurring ? "Recurring Task" : "One-time Task"}
                                                                >
                                                                    {task.isRecurring ? <RotateCw size={12} /> : <CheckSquare size={12} />}
                                                                </div>
                                                            )}
                                                            {task.scheduledDate && (
                                                                <Calendar size={12} style={{ marginRight: '6px', opacity: 0.5, flexShrink: 0, color: '#fbbf24' }} />
                                                            )}
                                                            {editingItem?.type === 'task' && editingItem.id === task.id ? (
                                                                <input
                                                                    autoFocus
                                                                    value={editingItem.tempValue}
                                                                    onChange={handleEditChange}
                                                                    onBlur={saveEdit}
                                                                    onKeyDown={handleEditKeyDown}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    style={{
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        color: 'inherit',
                                                                        fontSize: 'inherit',
                                                                        textDecoration: 'none',
                                                                        outline: 'none',
                                                                        width: '100%',
                                                                        fontFamily: 'inherit'
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span
                                                                    onClick={(e) => startEditing('task', task, e)}
                                                                    style={{
                                                                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                                                                        cursor: 'text'
                                                                    }}
                                                                >
                                                                    {task.title}
                                                                </span>
                                                            )}
                                                            {area.name === 'Languages' && (
                                                                <span style={{ fontSize: '9px', marginLeft: '6px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                    x{task.timesCompleted || 0}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div
                                                            style={{
                                                                fontSize: '12px',
                                                                textAlign: 'center',
                                                                fontFamily: 'monospace',
                                                                opacity: 0.7
                                                            }}
                                                        >
                                                            <TimerDisplay task={task} />
                                                        </div>

                                                        {/* Skill/Activity Selector */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                                                            {/* Activity Selector (Languages only) */}
                                                            {area.name === 'Languages' && (
                                                                <div
                                                                    style={{
                                                                        position: 'relative',
                                                                        width: '100%',
                                                                        minHeight: '24px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        background: 'rgba(255,255,255,0.03)',
                                                                        borderRadius: '4px'
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            fontSize: '10px',
                                                                            color: 'rgba(255,255,255,0.5)',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        onClick={(e) => {
                                                                            const menu = e.currentTarget.nextElementSibling;
                                                                            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                                                                        }}
                                                                    >
                                                                        {(task.activityTypes && task.activityTypes.length > 0)
                                                                            ? (
                                                                                <div style={{ display: 'flex', gap: '4px', overflow: 'hidden', maxWidth: '100%', justifyContent: 'center' }}>
                                                                                    {task.activityTypes.map(type => (
                                                                                        <span key={type} style={{ color: getActivityColor(type).text }}>
                                                                                            {type.slice(0, 3)}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )
                                                                            : 'Activity'}
                                                                    </div>

                                                                    <div style={{
                                                                        display: 'none',
                                                                        position: 'absolute', bottom: '100%', left: 0, width: '120px',
                                                                        background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)',
                                                                        borderRadius: '8px', zIndex: 100, padding: '4px', backdropFilter: 'blur(10px)'
                                                                    }}
                                                                        onMouseLeave={(e) => e.currentTarget.style.display = 'none'}
                                                                    >
                                                                        {LANGUAGE_ACTIVITIES.map(act => (
                                                                            <div
                                                                                key={act}
                                                                                onClick={() => {
                                                                                    const current = task.activityTypes || [];
                                                                                    const newTypes = current.includes(act) ? current.filter(t => t !== act) : [...current, act];
                                                                                    updateTask(task.id, { activityTypes: newTypes });
                                                                                }}
                                                                                style={{
                                                                                    padding: '6px 8px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px',
                                                                                    color: (task.activityTypes || []).includes(act) ? getActivityColor(act).text : 'rgba(255,255,255,0.5)',
                                                                                    background: (task.activityTypes || []).includes(act) ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                                                    display: 'flex', justifyContent: 'space-between', marginBottom: '2px'
                                                                                }}
                                                                            >
                                                                                {act}
                                                                                {(task.activityTypes || []).includes(act) && <div style={{ width: 6, height: 6, borderRadius: '50%', background: getActivityColor(act).text }}></div>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Skill Selector (Always show if area has skills, EXCEPT for Languages which uses Activity Selector) */}
                                                            {allAreaSkills.length > 0 && area.name !== 'Languages' && (
                                                                <select
                                                                    value={task.skillId || ''}
                                                                    onChange={(e) => updateTask(task.id, { skillId: e.target.value })}
                                                                    style={{
                                                                        background: task.skillId ? getSkillColor(task.skillId).bg : 'rgba(255,255,255,0.03)',
                                                                        border: 'none',
                                                                        color: task.skillId ? getSkillColor(task.skillId).text : 'rgba(255,255,255,0.3)',
                                                                        fontSize: '10px',
                                                                        fontWeight: '600',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer',
                                                                        width: '100%',
                                                                        outline: 'none',
                                                                        appearance: 'none',
                                                                        textAlign: 'center',
                                                                        height: '24px'
                                                                    }}
                                                                >

                                                                    {allAreaSkills.map(skill => (
                                                                        <option key={skill.id} value={skill.id} style={{ background: '#1e1e1e', color: '#3b82f6' }}>
                                                                            {skill.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>

                                                        {/* Difficulty Select */}
                                                        <select
                                                            value={task.difficulty || 'Trivial'}
                                                            onChange={(e) => updateTask(task.id, { difficulty: e.target.value })}
                                                            style={{
                                                                background: getDifficultyColor(task.difficulty),
                                                                border: 'none',
                                                                color: 'rgba(255,255,255,0.9)',
                                                                fontSize: '10px',
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                width: '100%',
                                                                outline: 'none',
                                                                height: '24px',
                                                                textAlign: 'center'
                                                            }}
                                                        >
                                                            {DIFFICULTIES.map(d => (
                                                                <option key={d} value={d} style={{ background: '#1e1e1e', color: 'white' }}>{d}</option>
                                                            ))}
                                                        </select>

                                                        {/* Growth Type Select */}
                                                        <select
                                                            value={task.growthType || 'Regular life task'}
                                                            onChange={(e) => updateTask(task.id, { growthType: e.target.value })}
                                                            style={{
                                                                background: `${(GROWTH_TYPES.find(g => g.label === (task.growthType || 'Regular life task')) || GROWTH_TYPES[0]).color}15`,
                                                                border: 'none',
                                                                color: (GROWTH_TYPES.find(g => g.label === (task.growthType || 'Regular life task')) || GROWTH_TYPES[0]).color,
                                                                fontSize: '10px',
                                                                fontWeight: '600',
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                width: '100%',
                                                                outline: 'none',
                                                                appearance: 'none',
                                                                textAlign: 'center',
                                                                height: '24px',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}
                                                        >
                                                            {GROWTH_TYPES.map(g => (
                                                                <option key={g.label} value={g.label} style={{ background: '#1e1e1e', color: g.color }}>{g.label}</option>
                                                            ))}
                                                        </select>

                                                        <button
                                                            onClick={() => deleteTask(task.id, obj.id)}
                                                            style={{ color: '#ef4444', opacity: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            <div
                                                onClick={() => handleAddSubTask(obj.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '8px 16px',
                                                    marginLeft: '24px',
                                                    cursor: 'pointer',
                                                    color: 'rgba(255,255,255,0.3)',
                                                    fontSize: '12px',
                                                    gap: '6px',
                                                    borderTop: tasks.length > 0 ? 'none' : 'none',
                                                    transition: 'color 0.2s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                            >
                                                <Plus size={12} /> Add new task
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Task Detail Modal */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                />
            )}
        </motion.div>
    );
};

export default AreaTaskSchedule;
