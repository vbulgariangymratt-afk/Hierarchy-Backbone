import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Trash2, Plus, X, Check, Zap, Brain, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import HabitCard from '../components/HabitCard';
import { getTodayString, getAdjustedNow, getDateString } from '../utils/dateUtils';

const CATEGORIES = {
    baseline: { label: 'Baseline', description: 'Deeply integrated habits', color: 'var(--color-primary)' },
    integrating: { label: 'Integrating', description: 'Building consistency & momentum', color: '#ff9d00' },
    sleeping: { label: 'Sleeping Habits', description: 'On hold', color: 'var(--color-text-secondary)' }
};

const Habits = () => {
    const { state, toggleHabit, updateHabit, deleteHabit, addHabit, reorderHabits } = useStore();
    const [cardWidth, setCardWidth] = useState(() => {
        const saved = localStorage.getItem('habit-card-width');
        return saved ? parseInt(saved) : 280;
    });

    // Split View State
    const [horizontalSplitRatio, setHorizontalSplitRatio] = useState(() => {
        const saved = localStorage.getItem('habit-horizontal-split-ratio');
        return saved ? parseFloat(saved) : 50; // Percentage for left column
    });

    const [verticalSplitRatio, setVerticalSplitRatio] = useState(() => {
        const saved = localStorage.getItem('habit-vertical-split-ratio');
        return saved ? parseFloat(saved) : 20; // Default 20% for sleeping
    });

    // Modal state for adding habits
    const [showAddModal, setShowAddModal] = useState(false);
    const [addCategory, setAddCategory] = useState('integrating');
    const [newHabitName, setNewHabitName] = useState('');
    const [selectedSkillIds, setSelectedSkillIds] = useState([]);
    const [showCompleted, setShowCompleted] = useState(false);

    const horizontalContainerRef = useRef(null);
    const pageRef = useRef(null);
    const isResizingHorizontal = useRef(false);
    const isResizingVertical = useRef(false);
    const scrollInterval = useRef(null);

    // Auto-Scroll Logic for Drag & Drop
    useEffect(() => {
        const handleDragOver = (e) => {
            const threshold = 100; // px from edge
            const speed = 15; // scroll speed

            // Clear existing interval to prevent stacking
            if (scrollInterval.current) {
                clearInterval(scrollInterval.current);
                scrollInterval.current = null;
            }

            if (e.clientY < threshold) {
                // Scroll Up
                scrollInterval.current = setInterval(() => {
                    window.scrollBy(0, -speed);
                }, 16);
            } else if (e.clientY > window.innerHeight - threshold) {
                // Scroll Down
                scrollInterval.current = setInterval(() => {
                    window.scrollBy(0, speed);
                }, 16);
            }
        };

        const handleDragEnd = () => {
            if (scrollInterval.current) {
                clearInterval(scrollInterval.current);
                scrollInterval.current = null;
            }
        };

        // We listen on window to catch drags anywhere
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('dragend', handleDragEnd);
        window.addEventListener('drop', handleDragEnd);

        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragend', handleDragEnd);
            window.removeEventListener('drop', handleDragEnd);
            if (scrollInterval.current) clearInterval(scrollInterval.current);
        };
    }, []);

    const allHabits = Object.values(state.habits || {});
    const allSkills = Object.values(state.skills || {});

    useEffect(() => {
        localStorage.setItem('habit-card-width', cardWidth.toString());
    }, [cardWidth]);

    useEffect(() => {
        localStorage.setItem('habit-horizontal-split-ratio', horizontalSplitRatio.toString());
    }, [horizontalSplitRatio]);

    useEffect(() => {
        localStorage.setItem('habit-vertical-split-ratio', verticalSplitRatio.toString());
    }, [verticalSplitRatio]);

    // Resizing Logic
    const handleMouseDownHorizontal = (e) => {
        e.preventDefault();
        isResizingHorizontal.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        // eslint-disable-next-line react-hooks/immutability
        document.body.style.cursor = 'col-resize';
    };

    const handleMouseMove = (e) => {
        if (isResizingHorizontal.current && horizontalContainerRef.current) {
            const containerRect = horizontalContainerRef.current.getBoundingClientRect();
            const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            // Clamp between 20% and 80%
            if (newRatio >= 20 && newRatio <= 80) {
                setHorizontalSplitRatio(newRatio);
            }
        }
    };

    const handleMouseUp = () => {
        isResizingHorizontal.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // eslint-disable-next-line react-hooks/immutability
        document.body.style.cursor = 'default';
    };

    const adjustedNow = getAdjustedNow();
    const currentYear = adjustedNow.getFullYear();
    const currentMonth = adjustedNow.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(currentYear, currentMonth, i);
        days.push(getDateString(d));
    }

    const todayString = getTodayString();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey)) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    setCardWidth(prev => Math.min(prev + 20, 600));
                } else if (e.key === '-') {
                    e.preventDefault();
                    setCardWidth(prev => Math.max(prev - 20, 160));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const openAddModal = (category) => {
        if (allSkills.length === 0) {
            alert("Create a Skill first!");
            return;
        }
        setAddCategory(category);
        setSelectedSkillIds([]);
        setNewHabitName('');
        setShowAddModal(true);
    };

    const toggleSkillSelection = (skillId) => {
        setSelectedSkillIds(prev =>
            prev.includes(skillId)
                ? prev.filter(id => id !== skillId)
                : [...prev, skillId]
        );
    };

    const handleAddHabit = () => {
        if (newHabitName.trim() && selectedSkillIds.length > 0) {
            addHabit(selectedSkillIds, newHabitName.trim(), addCategory);
            setShowAddModal(false);
        }
    };

    // Group and Memoize habits by category
    const categorizedHabits = React.useMemo(() => {
        const categories = { baseline: [], integrating: [], sleeping: [] };
        allHabits.forEach(habit => {
            const cat = habit.category || 'integrating';

            // Completion Check for "Disappear" mechanic
            const target = habit.targetDailyCount || 1;
            const currentVal = habit.history?.[todayString];
            const currentCount = currentVal === true ? 1 : (Number(currentVal) || 0);
            const isCompleted = currentCount >= target;

            if (isCompleted && !showCompleted && cat !== 'sleeping') {
                return; // Hide completed habits unless specifically in "Sleeping" or toggle is on
            }

            const habitSkillIds = habit.skillIds || (habit.skillId ? [habit.skillId] : []);
            const currentSkills = habitSkillIds.map(id => state.skills[id]).filter(Boolean);

            if (categories[cat]) {
                categories[cat].push({ habit, skills: currentSkills });
            }
        });

        // Sort habits in each category by order
        Object.keys(categories).forEach(key => {
            categories[key].sort((a, b) => (a.habit.order ?? 0) - (b.habit.order ?? 0) || a.habit.id.localeCompare(b.habit.id));
        });

        return categories;
    }, [allHabits, todayString, showCompleted, state.skills]);

    const renderCategoryColumn = (key) => {
        const { label, description, color } = CATEGORIES[key];
        const items = categorizedHabits[key];
        const isIncubator = key === 'integrating';

        // Use 2 columns for baseline, 3 for integrating, 4 for others
        let numColumns = 4;
        if (key === 'baseline') numColumns = 2;
        if (key === 'integrating') numColumns = 3;

        const columnIndices = Array.from({ length: numColumns }, (_, i) => i);

        return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h2 style={{
                    color: 'white', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px',
                    paddingBottom: '4px', fontSize: '14px', letterSpacing: '0.05em', fontWeight: '600',
                    textTransform: 'uppercase', opacity: 0.9
                }}>
                    <span style={{
                        width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color,
                        boxShadow: `0 0 12px ${color}`
                    }} />
                    {label}
                    <button
                        onClick={() => openAddModal(key)}
                        className="liquid-glass"
                        style={{
                            marginLeft: 'auto',
                            border: '1px solid var(--color-border)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'white',
                            borderRadius: '50%',
                            width: '28px', height: '28px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: state.showBackgrounds ? 'blur(10px)' : 'none',
                            transition: 'background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                            boxShadow: !state.showBackgrounds
                                ? '0 4px 8px -2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)'
                                : 'none'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    ><Plus size={16} /></button>
                </h2>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '16px', marginTop: '0', opacity: 0.7 }}>{description}</p>

                <div
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDragLeave={(e) => { }}
                    onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('habitId');
                        if (!id) return;

                        // Check if dropping on the container (move to end)
                        if (e.target === e.currentTarget) {
                            updateHabit(id, { category: key });
                            // Move to end of current items
                            const currentIds = items.map(i => i.habit.id).filter(hId => hId !== id);
                            reorderHabits([...currentIds, id]);
                        }
                    }}
                    style={{
                        borderRadius: '12px', flex: 1,
                        backgroundColor: 'transparent',
                        padding: '12px',
                        border: 'none',
                        boxShadow: 'none',
                        transition: 'all 0.3s'
                    }}
                >
                    {items.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            color: 'var(--color-text-secondary)',
                            fontSize: '11px',
                            padding: '32px 20px',
                            border: '1px dashed rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: !state.showBackgrounds
                                ? '0 8px 16px -4px rgba(0,0,0,0.5), 0 4px 8px -2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)'
                                : 'none'
                        }}>
                            <div style={{ opacity: 0.3 }}><Brain size={24} /></div>
                            <span style={{ opacity: 0.5 }}>Drop habits here to start {label.toLowerCase()}</span>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'start',
                            paddingTop: '10px'
                        }}>
                            {columnIndices.map(colIndex => (
                                <div key={colIndex} style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px'
                                }}>
                                    {items.filter((_, idx) => idx % numColumns === colIndex).map(({ habit, skills }) => (
                                        <div
                                            key={habit.id}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const draggedId = e.dataTransfer.getData('habitId');
                                                if (!draggedId || draggedId === habit.id) return;

                                                const currentIds = items.map(i => i.habit.id);
                                                const draggedIdx = currentIds.indexOf(draggedId);
                                                const targetIdx = currentIds.indexOf(habit.id);

                                                let newOrder = [...currentIds];
                                                if (draggedIdx !== -1) {
                                                    newOrder.splice(draggedIdx, 1);
                                                    const adjustedTargetIdx = newOrder.indexOf(habit.id);
                                                    newOrder.splice(adjustedTargetIdx, 0, draggedId);
                                                } else {
                                                    updateHabit(draggedId, { category: key });
                                                    newOrder.splice(targetIdx, 0, draggedId);
                                                }
                                                reorderHabits(newOrder);
                                            }}
                                            style={{ transform: 'translateY(0)' }}
                                        >
                                            <HabitCard
                                                habit={habit}
                                                skills={skills}
                                                days={days}
                                                todayString={todayString}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('habitId', habit.id);
                                                    e.currentTarget.style.opacity = '0.5';
                                                }}
                                                onDragEnd={(e) => {
                                                    e.currentTarget.style.opacity = '1';
                                                }}
                                                gridCols={16}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div ref={pageRef} className="habits-page" style={{ minHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>

            {/* Page Header with Toggle */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="liquid-glass"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: '20px',
                        border: '1px solid var(--color-border)',
                        background: showCompleted ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                        color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                        transition: 'background-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease',
                        boxShadow: !state.showBackgrounds
                            ? '0 4px 8px -2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)'
                            : 'none'
                    }}
                >
                    {showCompleted ? <Eye size={14} /> : <EyeOff size={14} />}
                    {showCompleted ? 'Showing All' : 'Hiding Completed'}
                </button>
            </div>

            {/* Top Section (Natural Fluid Height) */}
            <div ref={horizontalContainerRef} style={{ display: 'flex', alignItems: 'stretch', gap: '6px', marginBottom: '40px', flex: 1 }}>
                {/* Left Panel: Baseline */}
                <div style={{ width: `${horizontalSplitRatio}%` }}>
                    {renderCategoryColumn('baseline')}
                </div>

                {/* Horizontal Resizer Handle */}
                <div
                    onMouseDown={handleMouseDownHorizontal}
                    style={{
                        width: '24px',
                        cursor: 'col-resize',
                        background: 'transparent',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                        zIndex: 10
                    }}
                    className="resize-handle"
                    onMouseOver={(e) => e.target.style.background = 'linear-gradient(to right, transparent 11px, var(--color-primary) 11px, var(--color-primary) 13px, transparent 13px)'}
                    onMouseOut={(e) => e.target.style.background = 'transparent'}
                />

                {/* Right Panel: Integrating */}
                <div style={{ width: `${100 - horizontalSplitRatio}%` }}>
                    {renderCategoryColumn('integrating')}
                </div>
            </div>

            {/* Bottom Section: Sleeping (Natural Flow) */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px', paddingBottom: '40px' }}>
                {renderCategoryColumn('sleeping')}
            </div>

            {/* Add Habit Modal */}
            {showAddModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setShowAddModal(false)}>
                    <div style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '400px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Add Habit to {CATEGORIES[addCategory].label}</h3>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Skill Selector */}
                        <div style={{ marginBottom: '16px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>Select Skills (Multi-select)</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                {allSkills.map(skill => {
                                    const isSelected = selectedSkillIds.includes(skill.id);
                                    return (
                                        <button
                                            key={skill.id}
                                            onClick={() => toggleSkillSelection(skill.id)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                                backgroundColor: isSelected ? 'rgba(var(--color-primary-rgb), 0.1)' : 'var(--color-bg-secondary)',
                                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '13px',
                                                transition: 'all 0.2s',
                                                fontWeight: isSelected ? '600' : 'normal'
                                            }}
                                        >
                                            <span>{skill.icon || '🎯'}</span>
                                            {skill.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Habit Name Input */}
                        <label style={{ display: 'block', marginBottom: '20px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>Habit Name</span>
                            <input
                                type="text"
                                value={newHabitName}
                                onChange={(e) => setNewHabitName(e.target.value)}
                                placeholder="e.g., Drink 8 glasses of water"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    color: 'var(--color-text-main)',
                                    fontSize: '14px',
                                    outline: 'none'
                                }}
                            />
                        </label>

                        {/* Submit Button */}
                        <button
                            onClick={handleAddHabit}
                            disabled={!newHabitName.trim() || selectedSkillIds.length === 0}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: CATEGORIES[addCategory].color,
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: (newHabitName.trim() && selectedSkillIds.length > 0) ? 'pointer' : 'not-allowed',
                                opacity: (newHabitName.trim() && selectedSkillIds.length > 0) ? 1 : 0.5
                            }}
                        >
                            Add Habit
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Habits;
