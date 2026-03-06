import React, { useState, useEffect } from 'react';
import backbone from '../backbone-v2';

const ScheduledRestWidget = () => {
    const [rest, setRest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editText, setEditText] = useState('');
    const [saveToLibrary, setSaveToLibrary] = useState(true);

    const refresh = async () => {
        let todayRest = await backbone.getTodayRest();
        if (!todayRest) {
            console.log("ScheduledRestWidget: No suggestion found, creating...");
            await backbone.createDailyRestSuggestion();
            todayRest = await backbone.getTodayRest();
        }
        setRest(todayRest);
        if (todayRest) {
            setEditText(todayRest.metadata.activityText || '');
        }
        setLoading(false);
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !rest) return null;

    const { name, durationMinutes, approved, completedAt } = rest.metadata;

    const handleApprove = async () => {
        await backbone.approveRest(rest.id, editText, saveToLibrary);
        await refresh();
    };

    const handleReplace = async () => {
        await backbone.deleteNode(rest.id);
        await backbone.createDailyRestSuggestion();
        await refresh();
    };

    const handleComplete = async () => {
        await backbone.completeRest(rest.id);
        await refresh();
    };

    return (
        <div className="glass-panel" style={{
            padding: '24px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderRadius: '16px'
        }}>
            <div style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <span style={{ fontSize: '14px' }}>🛠</span>
                <span>Maintenance / Self-Care</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '4px' }}>{name}</div>
                        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: '500' }}>Duration: {durationMinutes} minutes</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        {completedAt ? (
                            <div style={{
                                padding: '8px 16px',
                                borderRadius: '30px',
                                background: 'var(--alpha-high)',
                                color: 'var(--color-success)',
                                fontSize: '14px',
                                fontWeight: '700',
                                border: '1px solid var(--color-success)'
                            }}>
                                Completed ✔
                            </div>
                        ) : !approved ? (
                            <>
                                <button onClick={handleApprove} style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    background: 'var(--color-bg-secondary)',
                                    color: 'var(--color-text-main)',
                                    border: '1px solid var(--color-border)',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    transition: 'all 0.2s ease'
                                }}>Approve</button>
                                <button onClick={handleReplace} style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    background: 'transparent',
                                    color: 'var(--color-text-secondary)',
                                    border: '1px solid var(--color-border)',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    transition: 'all 0.2s ease'
                                }}>Replace</button>
                            </>
                        ) : (
                            <button onClick={handleComplete} style={{
                                padding: '10px 20px',
                                borderRadius: '10px',
                                background: 'var(--color-success)',
                                color: 'var(--color-text-inverse)',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '14px',
                                boxShadow: '0 4px 12px var(--alpha-high)',
                                transition: 'all 0.2s ease'
                            }}>Mark Done</button>
                        )}
                    </div>
                </div>

                <div style={{
                    marginTop: '4px',
                    padding: '12px',
                    background: 'var(--alpha-low)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)'
                }}>
                    {!approved ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Planned activity:</label>
                                <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    placeholder="What will you do?"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid var(--color-border)',
                                        color: 'var(--color-text-main)',
                                        fontSize: '16px',
                                        padding: '4px 0',
                                        outline: 'none',
                                        width: '100%'
                                    }}
                                />
                            </div>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                color: 'var(--color-text-secondary)'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={saveToLibrary}
                                    onChange={(e) => setSaveToLibrary(e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                />
                                Save to Library
                            </label>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Activity:</label>
                            <div style={{
                                fontSize: '16px',
                                color: completedAt ? 'var(--color-text-secondary)' : 'var(--color-text-main)',
                                textDecoration: completedAt ? 'line-through' : 'none'
                            }}>
                                {rest.metadata.activityText}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScheduledRestWidget;
