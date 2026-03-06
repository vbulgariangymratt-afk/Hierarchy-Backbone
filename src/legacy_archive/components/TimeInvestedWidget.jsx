import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Clock, Globe, DollarSign, Zap, Target } from 'lucide-react';
import { useGlassClass } from '../hooks/useGlassClass';

// 1. Reusable Animated Number Component
const AnimatedNumber = ({ value, formatTime, suffix = '' }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const duration = 1200;
        const steps = 60;
        const increment = value / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(current));
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value]);

    return <span>{formatTime(displayValue)}{suffix}</span>;
};

// 2. Individual Stat Card Component
const StatCard = ({ section, formatTime }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: isHovered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '18px',
                border: `1px solid ${isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)'}`,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered
                    ? `0 12px 28px rgba(0, 0, 0, 0.3), 0 0 20px ${section.accentColor}, inset 0 1px 0 rgba(255, 255, 255, 0.08)`
                    : '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
            }}
        >
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(135deg, ${section.accentColor} 0%, transparent 60%)`,
                opacity: isHovered ? 1 : 0.5,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none'
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{
                        padding: '6px',
                        borderRadius: '8px',
                        background: section.accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {section.icon}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '600', opacity: 0.9, letterSpacing: '-0.01em' }}>{section.title}</span>
                </div>
                <div style={{
                    fontSize: '28px',
                    fontWeight: '800',
                    marginBottom: '14px',
                    color: section.color,
                    letterSpacing: '-0.02em',
                    textShadow: `0 0 20px ${section.accentColor}`
                }}>
                    <AnimatedNumber value={section.total} formatTime={formatTime} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {section.breakdown.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ opacity: 0.55 }}>
                                {item.count ? `${item.count} ${item.name}` : item.name}
                            </span>
                            <span style={{ fontWeight: '600', opacity: 0.85 }}>{formatTime(item.time)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// 3. Other Skills Card Component
const OtherSkillsCard = ({ stats, formatTime }) => {
    const [isHovered, setIsHovered] = useState(false);
    if (!stats.otherAreas || stats.otherAreas.length === 0) return null;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: isHovered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: '18px',
                border: `1px solid ${isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)'}`,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered
                    ? '0 12px 28px rgba(0, 0, 0, 0.3), 0 0 20px rgba(236, 72, 153, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                    : '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
            }}
        >
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, transparent 60%)',
                opacity: isHovered ? 1 : 0.5,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none'
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{
                        padding: '6px',
                        borderRadius: '8px',
                        background: 'rgba(236, 72, 153, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Target size={20} color="#ec4899" />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '600', opacity: 0.9, letterSpacing: '-0.01em' }}>Other Skills</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {stats.otherAreas.slice(0, 4).map((area, idx) => (
                        <div key={idx}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                <span style={{ fontWeight: '600', opacity: 0.9 }}>{area.name}</span>
                                <span style={{ opacity: 0.7 }}>{formatTime(area.time)}</span>
                            </div>
                            <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (area.time / (stats.languageTime || 3600)) * 100)}%`,
                                    background: 'linear-gradient(90deg, #f9a8d4 0%, #ec4899 100%)',
                                    borderRadius: '3px',
                                    boxShadow: '0 0 10px rgba(236, 72, 153, 0.4)',
                                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// 4. Main Widget Component
const TimeInvestedWidget = () => {
    const { state } = useStore();
    const glassClass = useGlassClass();

    const formatTime = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const stats = useMemo(() => {
        const { areas, skills, objectives, tasks, manifestations, desires, beliefs } = state;

        const getTaskTime = (task) => {
            if (!task) return 0;
            let time = (task.lifetimeTime || 0) + (task.totalInProgressTime || 0);
            if (task.status === 'in-progress' && task.lastStartedAt) {
                time += (Date.now() - task.lastStartedAt) / 1000;
            }
            return time;
        };

        const skillTimeAggregation = {};
        const areaTimeAggregation = {};

        Object.values(tasks || {}).forEach(task => {
            const time = getTaskTime(task);
            if (time <= 0) return;

            let skillId = task.skillId;
            if (!skillId && task.objectiveId) {
                skillId = objectives[task.objectiveId]?.skillId;
            }

            if (skillId) {
                skillTimeAggregation[skillId] = (skillTimeAggregation[skillId] || 0) + time;
                const areaId = skills[skillId]?.areaId;
                if (areaId) {
                    areaTimeAggregation[areaId] = (areaTimeAggregation[areaId] || 0) + time;
                }
            }
        });

        const getAreaTime = (areaId) => areaTimeAggregation[areaId] || 0;
        const getSkillTime = (skillId) => skillTimeAggregation[skillId] || 0;

        const langArea = Object.values(areas).find(a => a.name === 'Languages');
        const languageTime = langArea ? getAreaTime(langArea.id) : 0;
        const languageBreakdown = langArea ? (langArea.skillIds || []).map(sid => ({
            name: skills[sid]?.name,
            time: getSkillTime(sid)
        })).filter(s => s.time > 0) : [];

        const financeArea = Object.values(areas).find(a => a.name === 'Finance' || a.name === 'Finances');
        const financeTimeFiltered = financeArea ? (financeArea.skillIds || []).reduce((acc, sid) => {
            const skillName = skills[sid]?.name;
            if (skillName && skillName.toLowerCase().includes('latte')) return acc;
            return acc + getSkillTime(sid);
        }, 0) : 0;

        const financeBreakdown = financeArea ? (financeArea.skillIds || []).map(sid => ({
            name: skills[sid]?.name,
            time: getSkillTime(sid)
        })).filter(s => s.time > 0 && !s.name?.toLowerCase().includes('latte')) : [];

        let totalManifestingTime = 0;
        let totalSessionsCount = 0;
        const processSessions = (items) => {
            Object.values(items || {}).forEach(item => {
                const sessions = item.sessions || [];
                totalSessionsCount += sessions.length;
                sessions.forEach(s => {
                    totalManifestingTime += (parseFloat(s.duration) || 0) * 60;
                });
            });
        };

        processSessions(manifestations);
        processSessions(desires);
        processSessions(beliefs);

        return {
            languageTime,
            languageBreakdown,
            financeTime: financeTimeFiltered,
            financeBreakdown,
            totalManifestingTime,
            totalSessionsCount,
            otherAreas: Object.values(areas)
                .filter(a => a.name !== 'Languages' && a.name !== 'Finance' && a.name !== 'Finances')
                .map(a => ({ name: a.name, time: getAreaTime(a.id) }))
                .filter(a => a.time > 60)
                .sort((a, b) => b.time - a.time)
        };
    }, [state]);

    const sections = [
        {
            title: 'Languages',
            icon: <Globe size={20} color="#fca5a5" />,
            total: stats.languageTime,
            breakdown: stats.languageBreakdown,
            color: '#fca5a5',
            accentColor: 'rgba(252, 165, 165, 0.15)'
        },
        {
            title: 'Finances',
            icon: <DollarSign size={20} color="#5eead4" />,
            total: stats.financeTime,
            breakdown: stats.financeBreakdown,
            color: '#5eead4',
            accentColor: 'rgba(94, 234, 212, 0.15)'
        },
        {
            title: 'SATS Sessions',
            icon: <Zap size={20} color="#fb923c" />,
            total: stats.totalManifestingTime,
            breakdown: [{ name: 'Sessions', time: stats.totalManifestingTime, count: stats.totalSessionsCount }],
            color: '#fb923c',
            accentColor: 'rgba(251, 146, 60, 0.15)'
        }
    ];

    return (
        <div className={glassClass} style={{
            padding: '28px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(255, 255, 255, 0.03)', display: 'flex', flexDirection: 'column',
            gap: '28px', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 1px 0 rgba(255, 255, 255, 0.03) inset'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 1 }}>
                <div style={{
                    width: '44px', height: '44px', borderRadius: '14px',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                }}>
                    <Clock size={22} color="#5eead4" />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '700', letterSpacing: '-0.01em' }}>Time Invested</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.45)', letterSpacing: '-0.005em' }}>Effort across all dimensions</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', position: 'relative', zIndex: 1 }}>
                {sections.map(section => (
                    <StatCard key={section.title} section={section} formatTime={formatTime} />
                ))}
                <OtherSkillsCard stats={stats} formatTime={formatTime} />
            </div>
        </div>
    );
};

export default TimeInvestedWidget;
