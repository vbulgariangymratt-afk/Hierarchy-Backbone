import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { timelineService } from '../backbone-v2';
import { useSettings } from '../context/SettingsContext';
import { formatDuration } from '../utils/timeUtils';
import './TimelinePage.css';

const TimelinePage = () => {
    const [timelineData, setTimelineData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedDays, setExpandedDays] = useState({});
    const scrollContainerRef = useRef(null);
    const navigate = useNavigate();

    const [windowStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    });

    const [windowEnd] = useState(() => {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d.getTime();
    });

    useEffect(() => {
        const loadData = async () => {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 6);

            const data = await timelineService.getTimelineRange(start, end);
            setTimelineData(data);
            setLoading(false);
        };
        loadData();
    }, []);

    // Auto-focus on TODAY on load
    useEffect(() => {
        if (!loading && timelineData && scrollContainerRef.current) {
            requestAnimationFrame(() => {
                const scrollContainer = scrollContainerRef.current;
                const todayCard = scrollContainer.querySelector('.day-card.is-today');
                
                if (todayCard) {
                    const containerWidth = scrollContainer.offsetWidth;
                    const cardLeft = todayCard.offsetLeft;
                    const cardWidth = todayCard.offsetWidth;
                    
                    scrollContainer.scrollLeft = cardLeft - (containerWidth / 2) + (cardWidth / 2);
                }
            });
        }
    }, [loading, timelineData]);

    const toggleDay = (date) => {
        setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
    };

    if (loading) return <div className="timeline-loading">Syncing your path...</div>;

    return (
        <div className="timeline-page">
            <header className="timeline-header">
                <h1>Registry of Path</h1>
                <p>A strictly historical record of your journey.</p>
            </header>

            <div className="timeline-main-scroller" ref={scrollContainerRef}>
                <div className="timeline-unified-grid">
                    <div className="days-row">
                        {timelineData.days.map((day) => (
                            <DayCard 
                                key={day.date} 
                                day={day} 
                                isExpanded={!!expandedDays[day.date]} 
                                onToggle={() => toggleDay(day.date)} 
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const DayCard = ({ day, isExpanded, onToggle }) => {
    const totalTasks = day.tasksCompleted.length;
    const totalSessions = day.focusSessions.length;
    const totalHabits = day.habitCompletions.reduce((acc, h) => acc + h.count, 0);
    const totalReps = day.repetitionActivities.reduce((acc, h) => acc + h.count, 0);
    
    // Count unique skills (ignore 'no-skill')
    const uniqueSkillsCount = (day.skillGroups || []).filter(g => g.id !== 'no-skill').length;

    const isEmpty = totalTasks === 0 && totalSessions === 0 && totalHabits === 0 && totalReps === 0 && !day.journalEntry;

    const dateObj = new Date(day.date + 'T12:00:00');
    const isToday = day.date === new Date().toISOString().split('T')[0];

    return (
        <div className={`day-card liquid-glass ${isExpanded ? 'expanded' : ''} ${isToday ? 'is-today' : ''}`} onClick={onToggle}>
            <div className="day-header">
                <span className="day-date">
                    {isToday ? "Today" : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                
                <div className="day-summary-row">
                    {uniqueSkillsCount > 0 && <span className="summary-pill highlighted">Skills: {uniqueSkillsCount}</span>}
                    {totalTasks > 0 && <span className="summary-pill">Tasks: {totalTasks}</span>}
                    {totalSessions > 0 && <span className="summary-pill">Focus: {totalSessions}</span>}
                    {totalHabits > 0 && <span className="summary-pill">Habits: {totalHabits}</span>}
                </div>
                
                <span className="expand-hint">{isExpanded ? '▼' : '▶'}</span>
            </div>

            {isExpanded && (
                <div className="day-expanded-content" onClick={(e) => e.stopPropagation()}>
                    {isEmpty ? (
                        <div className="empty-day-state">
                            <p className="empty-day-msg">Quiet day — your path is resting.</p>
                        </div>
                    ) : (
                        <div className="day-details-list">
                            {/* Grouped by Skill */}
                            {(day.skillGroups || []).map(group => (
                                <SkillSection key={group.id} group={group} isToday={isToday} />
                            ))}

                            {/* Journal Pulse remains at the bottom of the day */}
                            {day.journalEntry && (
                                <Section title="Journal Pulse">
                                    {day.journalEntry.activation?.morningActivationLevel && (
                                        <div className="item-row">
                                            <span>Activation</span>
                                            <span className="duration-tag">{day.journalEntry.activation.morningActivationLevel.replace('_', ' ')}</span>
                                        </div>
                                    )}
                                    {day.journalEntry.notes && (
                                        <div className="journal-note-preview">
                                            "{day.journalEntry.notes.length > 80 ? `${day.journalEntry.notes.substring(0, 80)}...` : day.journalEntry.notes}"
                                        </div>
                                    )}
                                </Section>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const SkillSection = ({ group, isToday }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const totalTasks = group.tasksCompleted.length;
    const totalSessions = group.focusSessions.length;
    const totalHabits = group.habitCompletions.reduce((acc, h) => acc + h.count, 0);

    return (
        <div className={`skill-group-section ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="skill-group-header" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="skill-group-title">
                    <span className="skill-icon">⭐</span>
                    <h4>{group.name}</h4>
                    <span className="skill-stats-hint">
                        ({totalTasks > 0 && `tasks: ${totalTasks}`}{totalSessions > 0 && `${totalTasks > 0 ? ', ' : ''}focus: ${totalSessions}`}{totalHabits > 0 && `${(totalTasks > 0 || totalSessions > 0) ? ', ' : ''}habits: ${totalHabits}`})
                    </span>
                </div>
                <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
            </div>

            {!isCollapsed && (
                <div className="skill-group-content">
                    {group.tasksCompleted.length > 0 && (
                        <Section title="Accomplished">
                            {group.tasksCompleted.map(t => (
                                <div key={t.id} className="item-row">
                                    <span>✓ {t.name}</span>
                                </div>
                            ))}
                        </Section>
                    )}

                    {isToday && group.tasksUnfinished.length > 0 && (
                        <Section title="Resting (Deferred)">
                            {group.tasksUnfinished.map(t => (
                                <div key={t.id} className="item-row muted">
                                    <span>⟲ {t.name}</span>
                                </div>
                            ))}
                        </Section>
                    )}

                    {group.focusSessions.length > 0 && (
                        <Section 
                            title="Focus Sessions" 
                            subLabel={formatDuration(group.focusSessions.reduce((acc, s) => acc + (s.actualDuration || 0), 0), 'seconds')}
                        >
                            {group.focusSessions.map((s, i) => (
                                <div key={i} className="item-row">
                                    <span>⚡ {s.taskName}</span>
                                    <span className="duration-tag">{formatDuration(s.actualDuration, 'seconds')}</span>
                                </div>
                            ))}
                        </Section>
                    )}

                    {group.habitCompletions.length > 0 && (
                        <Section title="Habits Reinforced">
                            {group.habitCompletions.map(h => (
                                <div key={h.habitId} className="item-row">
                                    <span>◈ {h.name}</span>
                                    {h.count > 1 && <span className="duration-tag">×{h.count}</span>}
                                </div>
                            ))}
                        </Section>
                    )}

                    {group.repetitionActivities.length > 0 && (
                        <Section title="Repetitions">
                            {group.repetitionActivities.map(r => (
                                <div key={r.taskId} className="item-row">
                                    <span>↻ {r.name}</span>
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

const Section = ({ title, subLabel, children }) => (
    <div className="day-content-section">
        <div className="section-title-row">
            <h3>{title}</h3>
            {subLabel && <span className="section-sublabel">{subLabel}</span>}
        </div>
        <div className="section-items">{children}</div>
    </div>
);

export default TimelinePage;
