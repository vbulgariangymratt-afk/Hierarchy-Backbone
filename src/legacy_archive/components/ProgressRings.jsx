import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useGlassClass } from '../hooks/useGlassClass';
import { getTodayString, getDateString, getLogicalDate } from '../utils/dateUtils';

const ProgressRings = () => {
    const { state } = useStore();
    const glassClass = useGlassClass();
    const [animatedProgress, setAnimatedProgress] = useState(0);

    const progress = useMemo(() => {
        const today = getTodayString();

        // 1. Tasks: Core = Scheduled for today. Bonus = Completed today but not scheduled.
        const allTasks = Object.values(state.tasks || {});
        const scheduledTodayTasks = allTasks.filter(t => t.scheduledDate === today);
        const completedTodayTasks = allTasks.filter(t => t.completedAt && getLogicalDate(t.completedAt) === today);

        // Final task counts:
        // Numerator: All completed today
        const tasksDoneCount = completedTodayTasks.length;
        // Denominator: Scheduled for today + anything completed today that WASN'T scheduled for today
        const tasksGoalCount = scheduledTodayTasks.length + completedTodayTasks.filter(t => t.scheduledDate !== today).length;

        // 2. Habits & SATS:
        // We split habits into "SATS habits" and "Regular habits" to avoid double counting
        const activeHabits = Object.values(state.habits || {}).filter(h =>
            h.category === 'baseline' || h.category === 'integrating'
        );

        const satsHabits = activeHabits.filter(h => h.linkedSatsId);
        const regularHabits = activeHabits.filter(h => !h.linkedSatsId);

        // Regular Habit Counts
        const completedRegularHabits = regularHabits.filter(h => {
            const val = h.history?.[today];
            return val === true || (Number(val) || 0) >= (h.targetDailyCount || 1);
        }).length;
        const totalRegularHabits = regularHabits.length;

        // SATS Sessions (Actual logs)
        const satsSessionsCount = [...Object.values(state.manifestations || {}), ...Object.values(state.desires || {}), ...Object.values(state.beliefs || {})].reduce((count, item) => {
            return count + (item.sessions || []).filter(s => {
                if (!s.timestamp) return false;
                const sessionDateStr = getLogicalDate(s.timestamp);
                return sessionDateStr === today;
            }).length;
        }, 0);

        // SATS Goal: Based on habits or actual sessions if overachieving
        const programmedSatsGoal = satsHabits.reduce((acc, h) => acc + (h.targetDailyCount || 1), 0);
        // If they did something, or have something scheduled, show it. Otherwise goal is 0.
        const satsGoalCount = programmedSatsGoal > 0 || satsSessionsCount > 0
            ? Math.max(programmedSatsGoal, satsSessionsCount)
            : 0;

        // NOTE: User mentioned "I only had one, I dont see another one scheduled".
        // If programmedSatsGoal is 0, then satsGoalCount will be Math.max(0, 1, 1) = 1.
        // If they did 1, it matches.

        // Global Totals
        const completed = tasksDoneCount + completedRegularHabits + satsSessionsCount;
        const total = tasksGoalCount + totalRegularHabits + satsGoalCount;

        const percentage = total > 0 ? Math.min(100, (completed / total) * 100) : 0;

        return {
            percentage: Math.round(percentage),
            completed,
            total,
            tasks: tasksDoneCount,
            habits: completedRegularHabits,
            sats: satsSessionsCount,
            counts: {
                tasks: tasksGoalCount,
                habits: totalRegularHabits,
                sats: satsGoalCount
            }
        };
    }, [state]);

    // Animate progress ring
    useEffect(() => {
        const duration = 1500;
        const steps = 60;
        const increment = progress.percentage / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= progress.percentage) {
                setAnimatedProgress(progress.percentage);
                clearInterval(timer);
            } else {
                setAnimatedProgress(Math.floor(current));
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [progress.percentage]);

    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;

    const getProgressColor = () => {
        if (animatedProgress >= 80) return '#5eead4';
        if (animatedProgress >= 50) return '#fb923c';
        return '#fca5a5';
    };

    return (
        <div className={glassClass} style={{
            padding: '32px',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(255, 255, 255, 0.03)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>
            {/* Gradient overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 50%)',
                pointerEvents: 'none'
            }} />

            <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    marginBottom: '24px',
                    letterSpacing: '-0.01em',
                    textAlign: 'center'
                }}>
                    Daily Completion
                </h3>

                {/* Progress Ring */}
                <div style={{
                    position: 'relative',
                    width: '180px',
                    height: '180px',
                    margin: '0 auto 24px'
                }}>
                    <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
                        {/* Background circle */}
                        <circle
                            cx="90"
                            cy="90"
                            r={radius}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.05)"
                            strokeWidth="12"
                        />
                        {/* Progress circle */}
                        <circle
                            cx="90"
                            cy="90"
                            r={radius}
                            fill="none"
                            stroke={getProgressColor()}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{
                                transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease',
                                filter: `drop-shadow(0 0 8px ${getProgressColor()}40)`
                            }}
                        />
                    </svg>

                    {/* Center text */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            fontSize: '48px',
                            fontWeight: '800',
                            color: getProgressColor(),
                            letterSpacing: '-0.03em',
                            lineHeight: '1',
                            textShadow: `0 0 20px ${getProgressColor()}40`
                        }}>
                            {animatedProgress}%
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.5)',
                            marginTop: '4px',
                            fontWeight: '600'
                        }}>
                            {progress.completed} of {progress.total}
                        </div>
                    </div>
                </div>

                {/* Breakdown */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    marginTop: '16px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: '800',
                            color: '#fca5a5',
                            marginBottom: '4px'
                        }}>
                            {progress.tasks} <span style={{ fontSize: '12px', opacity: 0.5 }}>/ {progress.counts.tasks}</span>
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.5)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: '600'
                        }}>
                            Tasks
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: '800',
                            color: '#fb923c',
                            marginBottom: '4px'
                        }}>
                            {progress.habits} <span style={{ fontSize: '12px', opacity: 0.5 }}>/ {progress.counts.habits}</span>
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.5)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: '600'
                        }}>
                            Habits
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '20px',
                            fontWeight: '800',
                            color: '#5eead4',
                            marginBottom: '4px'
                        }}>
                            {progress.sats} <span style={{ fontSize: '12px', opacity: 0.5 }}>/ {Math.max(progress.sats, 2)}</span>
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.5)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: '600'
                        }}>
                            SATS
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgressRings;
