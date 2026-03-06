import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle, Zap, Wallet } from 'lucide-react';
import { useGlassClass } from '../hooks/useGlassClass';
import { getTodayString, getDateString, getAdjustedNow, getLogicalDate } from '../utils/dateUtils';

const DashboardStats = () => {
    const { state } = useStore();
    const glassClass = useGlassClass();
    const [showBreakdown, setShowBreakdown] = useState(false);

    const stats = useMemo(() => {
        const todayStr = getTodayString();
        // For yesterday, we need to subtract 1 day from "Logical Today"
        // FIXED: Use local date math via dateUtils helpers
        const yesterdayDate = new Date(todayStr);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1); // JS Date handles month/year rollbacks correctly on setDate
        const yesterdayStr = getDateString(yesterdayDate);

        // Calculate total time spent on a specific date (in seconds)
        const getBreakdownForDate = (dateStr) => {
            const breakdownEntries = [];
            const isToday = dateStr === todayStr;

            // 1. Add time from Task Logs
            (state.logs || []).forEach(log => {
                if (log.timestamp && (log.duration || log.sessionDuration)) {
                    const logDateStr = getLogicalDate(log.timestamp);
                    if (logDateStr === dateStr) {
                        if (['TASK_COMPLETED_SESSION', 'TASK_TIMER_SESSION', 'TASK_TOGGLED'].includes(log.type)) {
                            breakdownEntries.push({
                                title: log.taskTitle || 'Untitled Task',
                                duration: (parseFloat(log.duration || log.sessionDuration) || 0)
                            });
                        }
                    }
                }
            });

            // 2. Add currently active tasks (Real-time progress)
            if (isToday) {
                const now = new Date();
                const dayStart = getAdjustedNow();
                dayStart.setHours(4, 0, 0, 0); // Logical start of today

                Object.values(state.tasks || {}).forEach(task => {
                    if (task.status === 'in-progress' && task.lastStartedAt) {
                        const startTime = Number(task.lastStartedAt);
                        if (startTime >= dayStart.getTime()) {
                            const sessionTime = (now.getTime() - startTime) / 1000;
                            if (sessionTime > 0) {
                                breakdownEntries.push({
                                    title: task.title,
                                    duration: sessionTime
                                });
                            }
                        }
                    }
                });
            }

            // 3. Add SATS Sessions
            const seenTS = new Set();
            [...Object.values(state.manifestations || {}), ...Object.values(state.desires || {}), ...Object.values(state.beliefs || {})].forEach(item => {
                (item.sessions || []).forEach(session => {
                    if (session.timestamp) {
                        const sessionDateStr = getLogicalDate(session.timestamp);
                        if (sessionDateStr === dateStr && !seenTS.has(session.timestamp)) {
                            breakdownEntries.push({
                                title: item.name || item.title || 'SATS',
                                duration: (parseFloat(session.duration) || 0) * 60
                            });
                            seenTS.add(session.timestamp);
                        }
                    }
                });
            });

            // Group by title
            const grouped = breakdownEntries.reduce((acc, curr) => {
                const title = curr.title;
                if (!acc[title]) acc[title] = 0;
                acc[title] += curr.duration;
                return acc;
            }, {});

            return Object.entries(grouped)
                .map(([title, duration]) => ({ title, duration }))
                .sort((a, b) => b.duration - a.duration);
        };

        const todayBreakdown = getBreakdownForDate(todayStr);
        const yesterdayBreakdown = getBreakdownForDate(yesterdayStr);

        const todayTime = todayBreakdown.reduce((sum, item) => sum + item.duration, 0);
        const yesterdayTime = yesterdayBreakdown.reduce((sum, item) => sum + item.duration, 0);

        const diff = todayTime - yesterdayTime;
        const percentChange = yesterdayTime > 0 ? ((diff / yesterdayTime) * 100) : 0;

        // Completed tasks today (using correct todayStr)
        const tasksCompleted = Object.values(state.tasks || {}).filter(t =>
            t.completedAt && getLogicalDate(t.completedAt) === todayStr
        ).length;

        // Completed habits today (using correct todayStr) - Skip Sleeping Habits
        const habitsCompleted = Object.values(state.habits || {}).filter(h => {
            if (h.category === 'sleeping') return false;
            // Habits already store keys as YYYY-MM-DD
            const val = h.history?.[todayStr];
            return val === true || (Number(val) || 0) >= (h.targetDailyCount || 1);
        }).length;

        return {
            todayTime,
            todayBreakdown,
            yesterdayTime,
            diff,
            percentChange,
            tasksCompleted,
            habitsCompleted
        };
    }, [state]);

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const getTrendIcon = () => {
        if (stats.diff > 300) return <TrendingUp size={16} color="#5eead4" />;
        if (stats.diff < -300) return <TrendingDown size={16} color="#fca5a5" />;
        return <Minus size={16} color="rgba(255,255,255,0.4)" />;
    };

    const getTrendColor = () => {
        if (stats.diff > 300) return '#5eead4';
        if (stats.diff < -300) return '#fca5a5';
        return 'rgba(255,255,255,0.4)';
    };

    return (
        <div className="dashboard-stats-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {/* Today's Progress / Time */}
            <div
                className={`stat-card ${glassClass}`}
                onClick={() => setShowBreakdown(!showBreakdown)}
                style={{
                    padding: '20px',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: showBreakdown ? 'flex-start' : 'space-between',
                    position: 'relative',
                    overflow: showBreakdown ? 'auto' : 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    gridColumn: showBreakdown ? 'span 2' : 'span 1',
                    maxHeight: showBreakdown ? '400px' : 'none'
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', zIndex: 2 }}>
                        <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                            <Clock size={20} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>Today's Focus</span>
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#fff', zIndex: 2 }}>
                        {formatTime(stats.todayTime)}
                    </div>
                </div>

                {/* Breakdown with Horizontal Bar Charts */}
                {showBreakdown && stats.todayBreakdown && stats.todayBreakdown.length > 0 && (
                    <div style={{
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        marginTop: '16px',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <style>{`
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(-5px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                        `}</style>
                        {stats.todayBreakdown.map((item, idx) => {
                            const percentage = (item.duration / stats.todayTime) * 100;
                            return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                                        <span style={{ fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '70%' }}>{item.title}</span>
                                        <span style={{ fontWeight: '700', color: '#60a5fa', fontSize: '11px' }}>{formatTime(item.duration)}</span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: '6px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}>
                                        <div style={{
                                            width: `${percentage}%`,
                                            height: '100%',
                                            background: `linear-gradient(90deg, rgba(59, 130, 246, 0.8) 0%, rgba(96, 165, 250, 0.6) 100%)`,
                                            borderRadius: '4px',
                                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)'
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!showBreakdown && (
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                        Click to view breakdown
                    </div>
                )}
                {/* Background Decor */}
                <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
            </div>

            {/* Total Tasks Done */}
            <div className={`stat-card ${glassClass}`} style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>
                        <CheckCircle size={20} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>Tasks Done</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#fff' }}>
                    {stats.tasksCompleted}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    Completed today
                </div>
            </div>

            {/* Habits Streak / Count */}
            <div className={`stat-card ${glassClass}`} style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                        <Zap size={20} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>Habits</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#fff' }}>
                    {stats.habitsCompleted}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    Completed today
                </div>
            </div>

            {/* Currency / Points */}
            <div className={`stat-card ${glassClass}`} style={{ padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>
                        <Wallet size={20} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>Balance</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#fff' }}>
                    {state.currency || 0}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    Available Credits
                </div>
            </div>
        </div>
    );
};

export default DashboardStats;
