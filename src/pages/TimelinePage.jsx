import React, { useState, useEffect } from 'react';
import { timelineService, journalRepo } from '../backbone-v2';
import { formatDuration } from '../utils/timeUtils';
import { ChevronRight, ChevronDown, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BorderGlow from '../components/ui/BorderGlow';
import SideRays from '../components/ui/SideRays';
import './TimelinePage.css';

const streamContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const cardVariants = {
    hidden: { 
        opacity: 0, 
        y: 20, 
        scale: 0.95 
    },
    visible: { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 260,
            damping: 22
        }
    }
};

const headerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: {
            type: "spring",
            stiffness: 260,
            damping: 22,
            delay: 0.05
        }
    }
};

const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayVal = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayVal}`;
};
const getWakeUpLabel = (val) => {
    if (val === 1) return 'Refreshed';
    if (val === 2) return 'Light Sleep / Mostly Ok';
    if (val === 3) return 'Neutral';
    if (val === 4) return 'Grogginess / Tired';
    if (val === 5) return 'Exhausted';
    return null;
};

const getShutDownLabel = (val) => {
    if (val === 1) return 'Easy Sleep';
    if (val === 2) return 'A bit restless';
    if (val === 3) return 'Neutral';
    if (val === 4) return 'Delayed shutdown';
    if (val === 5) return 'Avoided sleep (revenge bedtime procrastination)';
    return null;
};

const TimelinePage = () => {
    const [timelineData, setTimelineData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedDays, setExpandedDays] = useState({});
    
    // Check if it is daytime (Always true for now so you can see them)
    const [showRays] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 6);

            const data = await timelineService.getTimelineRange(start, end);
            if (isMounted) {
                setTimelineData(data);
                setLoading(false);
            }
        };
        loadData();

        // Expand today by default on initial mount
        const todayStr = getLocalDateString();
        setExpandedDays(prev => ({ [todayStr]: true, ...prev }));

        // Subscribe to real-time updates in the journal database
        const unsubscribe = journalRepo.subscribe(() => {
            loadData();
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    const toggleDay = (date) => {
        setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
    };

    if (loading) return <div className="timeline-loading">Syncing your path...</div>;

    // Show newest days at the top (descending chronological order)
    const sortedDays = [...timelineData.days].reverse();

    return (
        <div className="timeline-page">
            {showRays && (
                <SideRays
                    className="timeline-side-rays"
                    speed={0.8}
                    rayColor1="#EAB308"
                    rayColor2="#96c8ff"
                    intensity={1.25}
                    spread={1.7}
                    opacity={0.15}
                    origin="top-left"
                />
            )}
            <motion.header 
                className="timeline-header"
                variants={headerVariants}
                initial="hidden"
                animate="visible"
            >
                <h1>This is your timeline</h1>
                <p>Come here when your brain is calling you lazy</p>
            </motion.header>

            <div className="timeline-main-scroller">
                <div className="timeline-container">
                    <div className="timeline-thread" />
                    <motion.div 
                        variants={streamContainerVariants}
                        initial="hidden"
                        animate="visible"
                        className="timeline-stream"
                    >
                        {sortedDays.map((day) => (
                            <DayNode 
                                key={day.date} 
                                day={day} 
                                isExpanded={!!expandedDays[day.date]} 
                                onToggle={() => toggleDay(day.date)} 
                            />
                        ))}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

const DayNode = ({ day, isExpanded, onToggle }) => {
    const [activeFilter, setActiveFilter] = useState(null);
    console.log("DayNode day data:", day.date, "hasJournal:", !!day.journalEntry, "journalEntry:", day.journalEntry);

    const totalTasks = day.tasksCompleted.length;
    const totalSessions = day.focusSessions.length;
    const totalHabits = day.habitCompletions.reduce((acc, h) => acc + h.count, 0);
    const totalReps = day.repetitionActivities.reduce((acc, h) => acc + h.count, 0);
    const totalLevelUps = day.levelUps?.length || 0;
    const totalSubTasks = day.subStepsCompleted?.length || 0;
    
    // Get list of active skills (ignore 'no-skill')
    const activeSkills = (day.skillGroups || []).filter(g => g.id !== 'no-skill');

    const isEmpty = totalTasks === 0 && totalSessions === 0 && totalHabits === 0 && totalReps === 0 && !day.journalEntry;

    const dateObj = new Date(day.date + 'T12:00:00');
    const isToday = day.date === getLocalDateString();
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterdayDate);
    const isYesterday = day.date === yesterdayStr;

    const handlePillClick = (e, filterType) => {
        e.stopPropagation();
        if (activeFilter === filterType) {
            setActiveFilter(null);
        } else {
            setActiveFilter(filterType);
            if (!isExpanded) {
                onToggle();
            }
        }
    };

    const cardContent = (
        <>
            <div className="card-shine" />
            <div className="node-card-header">
                <div className="node-summary-info">
                    <h3 className="node-title">
                        {isToday ? "Today" : isYesterday ? "Yesterday" : dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
                    </h3>
                    {activeSkills.length > 0 && (
                        <div className={`skills-preview-accordion ${isExpanded ? 'is-collapsed' : ''}`}>
                            <div className="node-card-skills-list">
                                {activeSkills.map(skill => (
                                    <span key={skill.id} className="node-card-skill-item">
                                        {skill.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="node-pills">
                        {totalTasks > 0 && (
                            <span 
                                className={`summary-pill ${activeFilter === 'tasks' ? 'selected' : ''}`}
                                onClick={(e) => handlePillClick(e, 'tasks')}
                            >
                                Tasks: {totalTasks}
                            </span>
                        )}
                        {totalSubTasks > 0 && (
                            <span 
                                className={`summary-pill ${activeFilter === 'subtasks' ? 'selected' : ''}`}
                                onClick={(e) => handlePillClick(e, 'subtasks')}
                            >
                                Subtasks: {totalSubTasks}
                            </span>
                        )}
                        {totalSessions > 0 && (
                            <span 
                                className={`summary-pill ${activeFilter === 'focus' ? 'selected' : ''}`}
                                onClick={(e) => handlePillClick(e, 'focus')}
                            >
                                Focus: {totalSessions}
                            </span>
                        )}
                        {totalReps > 0 && (
                            <span 
                                className={`summary-pill ${activeFilter === 'activities' ? 'selected' : ''}`}
                                onClick={(e) => handlePillClick(e, 'activities')}
                            >
                                Activities: {totalReps}
                            </span>
                        )}
                        {totalHabits > 0 && (
                            <span 
                                className={`summary-pill ${activeFilter === 'habits' ? 'selected' : ''}`}
                                onClick={(e) => handlePillClick(e, 'habits')}
                            >
                                Habits: {totalHabits}
                            </span>
                        )}
                        {totalLevelUps > 0 && (
                            <span 
                                className={`summary-pill level-up-pill ${activeFilter === 'levels' ? 'selected' : ''}`}
                                onClick={(e) => handlePillClick(e, 'levels')}
                            >
                                Levels: {totalLevelUps}
                            </span>
                        )}
                    </div>
                </div>
                
                <span className={`expand-chevron-wrapper ${isExpanded ? 'is-expanded' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 6.5L8 10.5L12 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            </div>

            <div className={`node-card-accordion ${isExpanded ? 'is-open' : ''}`}>
                <div 
                    className="node-card-expanded-content"
                    onClick={(e) => e.stopPropagation()}
                >
                    {isEmpty ? (
                        <div className="empty-day-state">
                            <p className="empty-day-msg">Quiet day — your path is resting.</p>
                        </div>
                    ) : (
                        <div className="day-details-list">
                            {/* Grouped by Skill */}
                            {(day.skillGroups || []).map(group => (
                                <SkillSection 
                                    key={group.id} 
                                    group={group} 
                                    isToday={isToday} 
                                    activeFilter={activeFilter}
                                />
                            ))}

                             {/* Journal Pulse */}
                             {day.journalEntry && (
                                 day.journalEntry.activation?.morningActivationLevel || 
                                 day.journalEntry.notes ||
                                 day.journalEntry.wake_up_ease ||
                                 day.journalEntry.shut_down_ease ||
                                 day.journalEntry.hydration_total > 0 ||
                                 (day.journalEntry.meds_taken && day.journalEntry.meds_taken.length > 0)
                             ) && (
                                 <Section title="Daily Log Pulse">
                                     {day.journalEntry.activation?.morningActivationLevel && (
                                         <div className="item-row">
                                             <span>Morning Activation</span>
                                             <span className="duration-tag">{day.journalEntry.activation.morningActivationLevel.replace('_', ' ')}</span>
                                         </div>
                                     )}
                                     {day.journalEntry.wake_up_ease && getWakeUpLabel(day.journalEntry.wake_up_ease) && (
                                         <div className="item-row">
                                             <span>Wake Up quality</span>
                                             <span className="duration-tag">{getWakeUpLabel(day.journalEntry.wake_up_ease)}</span>
                                         </div>
                                     )}
                                     {day.journalEntry.shut_down_ease && getShutDownLabel(day.journalEntry.shut_down_ease) && (
                                         <div className="item-row">
                                             <span>Sleep quality</span>
                                             <span className="duration-tag">{getShutDownLabel(day.journalEntry.shut_down_ease)}</span>
                                         </div>
                                     )}
                                     {day.journalEntry.hydration_total > 0 && (
                                         <div className="item-row">
                                             <span>Hydration</span>
                                             <span className="duration-tag">{day.journalEntry.hydration_total} ml</span>
                                         </div>
                                     )}
                                     {day.journalEntry.meds_taken && day.journalEntry.meds_taken.length > 0 && (
                                         <div className="item-row">
                                             <span>Medication taken</span>
                                             <span className="duration-tag">{day.journalEntry.meds_taken.join(', ')}</span>
                                         </div>
                                     )}
                                     {day.journalEntry.notes && (
                                         <div className="journal-note-preview">
                                             "{day.journalEntry.notes}"
                                         </div>
                                     )}
                                 </Section>
                             )}

                        </div>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <motion.div 
            variants={cardVariants}
            className={`timeline-node ${isToday ? 'is-today' : ''} ${isEmpty ? 'is-empty' : ''}`}
        >
            {/* Left Sidebar: Date & Dot Node */}
            <div className="node-sidebar" onClick={onToggle}>
                <div className="node-dot-container">
                    <div className="node-dot" />
                </div>
                <div className="node-date-sticky">
                    <span className="node-date-num">{dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
            </div>

            {/* Right Side: The Content Card */}
            <div
                className={`node-card liquid-glass ${isExpanded ? 'expanded' : ''}`} 
                onClick={onToggle}
            >
                <BorderGlow
                    className="timeline-card-glow-wrapper"
                    borderRadius={20}
                    backgroundColor="transparent"
                    glowColor="235 60 65"
                    glowIntensity={0.65}
                >
                    {cardContent}
                </BorderGlow>
            </div>
        </motion.div>
    );
};

const SkillSection = ({ group, isToday, activeFilter }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Aggregate tasks, subtasks, and focus sessions into a single tree
    const tasksMap = {};
    const getTaskEntry = (id, name) => {
        const cleanedId = id || name;
        if (!tasksMap[cleanedId]) {
            tasksMap[cleanedId] = {
                id: cleanedId,
                name: name,
                completed: false,
                focusDuration: 0,
                subtasks: []
            };
        }
        return tasksMap[cleanedId];
    };

    // 1. Process completed tasks
    group.tasksCompleted.forEach(t => {
        const entry = getTaskEntry(t.id, t.name);
        entry.completed = true;
    });

    // 2. Process focus sessions
    group.focusSessions.forEach(s => {
        const entry = getTaskEntry(s.taskId, s.taskName);
        entry.focusDuration += (s.actualDuration || 0);
    });

    // 3. Process subtasks completed
    (group.subStepsCompleted || []).forEach(s => {
        const entry = getTaskEntry(s.taskId, s.taskName);
        if (!entry.subtasks.includes(s.text)) {
            entry.subtasks.push(s.text);
        }
    });

    const tasksList = Object.values(tasksMap);

    // Filter tasks based on activeFilter
    const filteredTasks = tasksList.map(task => {
        if (activeFilter === 'tasks') {
            return task.completed ? { ...task, subtasks: [] } : null;
        }
        if (activeFilter === 'focus') {
            return task.focusDuration > 0 ? { ...task, subtasks: [] } : null;
        }
        if (activeFilter === 'subtasks') {
            return task.subtasks.length > 0 ? { ...task, completed: false, focusDuration: 0 } : null;
        }
        if (activeFilter) {
            return null; // hide tasks if filter is on habits/levels/activities
        }
        return task;
    }).filter(Boolean);

    const showTasksSection = filteredTasks.length > 0;
    const showHabitsSection = (!activeFilter || activeFilter === 'habits') && group.habitCompletions.length > 0;
    const showActivitiesSection = (!activeFilter || activeFilter === 'activities') && group.repetitionActivities.length > 0;

    const hasContent = showTasksSection || showHabitsSection || showActivitiesSection || (activeFilter === 'levels' && group.levelUps.length > 0);

    if (activeFilter && !hasContent) {
        return null; // hide the entire skill group if no content matches the filter
    }

    return (
        <div className={`skill-group-section ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="skill-group-header" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="skill-group-title">
                    <h4>{group.name}</h4>
                </div>
                <div className="skill-group-meta">
                    {group.levelUps.map((lu, i) => (
                        <span key={i} className="level-up-badge-header" onClick={(e) => e.stopPropagation()}>
                            ★ Lvl {lu.newLevel} (+20 ₴)
                        </span>
                    ))}
                    <span className="collapse-arrow">{isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span>
                </div>
            </div>

            {!isCollapsed && (
                <div className="skill-group-content">
                    {showTasksSection && (
                        <Section title="Tasks & Focus">
                            {filteredTasks.map(task => (
                                <div key={task.id} className="task-ledger-group">
                                    <div className={`item-row task-row ${task.completed ? 'completed' : 'worked-on'}`}>
                                        <span>{task.name}</span>
                                        {task.focusDuration > 0 && (
                                            <span className="duration-tag">
                                                {formatDuration(task.focusDuration, 'seconds')}
                                            </span>
                                        )}
                                    </div>
                                    {task.subtasks.map((sub, sIdx) => (
                                        <div key={sIdx} className="item-row subtask-row">
                                            <span>{sub}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </Section>
                    )}

                    {showHabitsSection && (
                        <Section title="Habits Reinforced">
                            {group.habitCompletions.map(h => (
                                <div key={h.habitId} className="item-row">
                                    <span>
                                        <Repeat size={14} className="habit-icon-bullet" strokeWidth={2.75} />
                                        {h.name}
                                    </span>
                                    {h.count > 1 && <span className="duration-tag">×{h.count}</span>}
                                </div>
                            ))}
                        </Section>
                    )}

                    {showActivitiesSection && (
                        <Section title="Activities">
                            {group.repetitionActivities.map(r => (
                                <div key={r.taskId} className="item-row">
                                    <span>{r.name}</span>
                                    <span className="duration-tag">× {r.count}</span>
                                </div>
                            ))}
                        </Section>
                    )}
                </div>
            )}
        </div>
    );
};

const Section = ({ title, subLabel, children }) => {
    const sectionClass = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return (
        <div className={`day-content-section section-${sectionClass}`}>
            <div className="section-title-row">
                <h3>{title}</h3>
                {subLabel && <span className="section-sublabel">{subLabel}</span>}
            </div>
            <div className="section-items">{children}</div>
        </div>
    );
};

export default TimelinePage;
