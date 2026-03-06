import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Trophy, Zap, Target, TrendingUp } from 'lucide-react';
import { useGlassClass } from '../hooks/useGlassClass';

const RecentAchievements = () => {
    const { state } = useStore();
    const glassClass = useGlassClass();

    const achievements = useMemo(() => {
        const results = [];
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];

        // Check for task completions this week
        const tasksThisWeek = Object.values(state.tasks || {}).filter(t =>
            t.completedAt && t.completedAt >= weekAgoStr
        ).length;

        if (tasksThisWeek >= 10) {
            results.push({
                id: 'tasks-10',
                icon: <Target size={18} color="#fca5a5" />,
                title: 'Task Master',
                description: `Completed ${tasksThisWeek} tasks this week!`,
                color: '#fca5a5'
            });
        } else if (tasksThisWeek >= 5) {
            results.push({
                id: 'tasks-5',
                icon: <Target size={18} color="#fca5a5" />,
                title: 'Getting Things Done',
                description: `Completed ${tasksThisWeek} tasks this week`,
                color: '#fca5a5'
            });
        }

        // Check for SATS sessions this week
        const satsThisWeek = [...Object.values(state.manifestations || {}), ...Object.values(state.desires || {}), ...Object.values(state.beliefs || {})].reduce((count, item) => {
            return count + (item.sessions || []).filter(s => s.timestamp && s.timestamp >= weekAgoStr).length;
        }, 0);

        if (satsThisWeek >= 5) {
            results.push({
                id: 'sats-5',
                icon: <Zap size={18} color="#fb923c" />,
                title: 'Manifestation Streak',
                description: `${satsThisWeek} SATS sessions this week!`,
                color: '#fb923c'
            });
        }

        // Check for habit streaks
        const longestStreak = Object.values(state.habits || {}).reduce((max, habit) => {
            const streak = habit.currentStreak || 0;
            return Math.max(max, streak);
        }, 0);

        if (longestStreak >= 7) {
            results.push({
                id: 'streak-7',
                icon: <TrendingUp size={18} color="#5eead4" />,
                title: 'Consistency King',
                description: `${longestStreak} day streak on a habit!`,
                color: '#5eead4'
            });
        } else if (longestStreak >= 3) {
            results.push({
                id: 'streak-3',
                icon: <TrendingUp size={18} color="#5eead4" />,
                title: 'Building Momentum',
                description: `${longestStreak} day streak going strong`,
                color: '#5eead4'
            });
        }

        // Check total time invested this week
        let totalTimeThisWeek = 0;
        Object.values(state.tasks || {}).forEach(task => {
            if (task.completedAt && task.completedAt >= weekAgoStr) {
                totalTimeThisWeek += (task.lifetimeTime || 0) + (task.totalInProgressTime || 0);
            }
        });

        const hoursThisWeek = totalTimeThisWeek / 3600;
        if (hoursThisWeek >= 20) {
            results.push({
                id: 'time-20',
                icon: <Trophy size={18} color="#ec4899" />,
                title: 'Time Champion',
                description: `${Math.round(hoursThisWeek)} hours invested this week!`,
                color: '#ec4899'
            });
        } else if (hoursThisWeek >= 10) {
            results.push({
                id: 'time-10',
                icon: <Trophy size={18} color="#ec4899" />,
                title: 'Dedicated Effort',
                description: `${Math.round(hoursThisWeek)} hours invested this week`,
                color: '#ec4899'
            });
        }

        // If no achievements, show encouragement
        if (results.length === 0) {
            results.push({
                id: 'keep-going',
                icon: <Trophy size={18} color="rgba(255,255,255,0.4)" />,
                title: 'Keep Going!',
                description: 'Your achievements will appear here',
                color: 'rgba(255,255,255,0.4)'
            });
        }

        return results.slice(0, 3); // Show max 3
    }, [state]);

    return (
        <div className={glassClass} style={{
            padding: '24px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(255, 255, 255, 0.03)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
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

            <div style={{ position: 'relative', zIndex: 1 }}>
                <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    marginBottom: '16px',
                    letterSpacing: '-0.01em'
                }}>
                    Recent Achievements
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {achievements.map(achievement => (
                        <div
                            key={achievement.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                borderRadius: '12px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.04)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                e.currentTarget.style.transform = 'translateX(4px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                e.currentTarget.style.transform = 'translateX(0)';
                            }}
                        >
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: `${achievement.color}15`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {achievement.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    color: '#fff',
                                    marginBottom: '2px',
                                    letterSpacing: '-0.01em'
                                }}>
                                    {achievement.title}
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: 'rgba(255,255,255,0.5)',
                                    lineHeight: '1.4'
                                }}>
                                    {achievement.description}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecentAchievements;
