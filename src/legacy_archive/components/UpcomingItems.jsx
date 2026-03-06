import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Calendar, Clock } from 'lucide-react';
import { useGlassClass } from '../hooks/useGlassClass';

const UpcomingItems = () => {
    const { state } = useStore();
    const glassClass = useGlassClass();

    const upcomingItems = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const items = [];

        // Get scheduled tasks
        Object.values(state.tasks || {}).forEach(task => {
            if (task.scheduledDate && task.scheduledDate >= today && !task.isCompleted) {
                items.push({
                    id: task.id,
                    title: task.title,
                    date: task.scheduledDate,
                    time: task.startTime,
                    type: 'task'
                });
            }
        });

        // Get time blocks
        Object.values(state.timeBlocks || {}).forEach(block => {
            if (block.scheduledDate && block.scheduledDate >= today) {
                items.push({
                    id: block.id,
                    title: block.title,
                    date: block.scheduledDate,
                    time: block.startTime,
                    type: 'block'
                });
            }
        });

        // Sort by date and time
        items.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.time && b.time) return a.time.localeCompare(b.time);
            return 0;
        });

        return items.slice(0, 5); // Show next 5
    }, [state]);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dateOnly = dateStr;
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        if (dateOnly === todayStr) return 'Today';
        if (dateOnly === tomorrowStr) return 'Tomorrow';

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (upcomingItems.length === 0) {
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
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 50%)',
                    pointerEvents: 'none'
                }} />
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                    <Calendar size={32} color="rgba(255,255,255,0.2)" style={{ margin: '0 auto 12px' }} />
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        marginBottom: '8px',
                        letterSpacing: '-0.01em'
                    }}>
                        No Upcoming Items
                    </h3>
                    <p style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.5)',
                        lineHeight: '1.5'
                    }}>
                        Schedule tasks to see them here
                    </p>
                </div>
            </div>
        );
    }

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
                    Coming Up
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {upcomingItems.map(item => (
                        <div
                            key={item.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.04)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'rgba(94, 234, 212, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Calendar size={16} color="#5eead4" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#fff',
                                    marginBottom: '2px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {item.title}
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    color: 'rgba(255,255,255,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>{formatDate(item.date)}</span>
                                    {item.time && (
                                        <>
                                            <span>•</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={10} />
                                                {item.time}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UpcomingItems;
