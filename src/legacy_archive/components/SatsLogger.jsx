import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Activity, XCircle, Play } from 'lucide-react';
import { getTodayString } from '../utils/dateUtils';

const SatsLogger = () => {
    const { state, setLoggingSats, addManifestationSession, addDesireSession, toggleHabit } = useStore();
    const isLightMode = state.themeMode === 'light';
    const active = state.activeLoggingSats;

    const [sessionData, setSessionData] = useState({
        method: 'visualizing',
        vividness: 5,
        resistance: 5,
        duration: 15,
        notes: ''
    });

    useEffect(() => {
        if (active) {
            // Reset to defaults when opened
            setSessionData({
                method: 'visualizing',
                vividness: 5,
                resistance: 5,
                duration: 15,
                notes: ''
            });
        }
    }, [active]);

    if (!active) return null;

    const ACCENT_COLOR = isLightMode ? '#f43f5e' : '#fb7185';
    const getAccentBg = (opacity) => isLightMode
        ? `rgba(244, 63, 94, ${opacity})`
        : `rgba(251, 113, 133, ${opacity})`;

    const handleCommit = () => {
        const payload = {
            ...sessionData,
            timestamp: new Date().toISOString()
        };

        if (active.type === 'manifestations') {
            addManifestationSession(active.id, payload);
        } else if (active.type === 'desires') {
            addDesireSession(active.id, payload);
        }

        if (active.habitId) {
            toggleHabit(active.habitId, getTodayString());
        }

        setLoggingSats(null);
    };

    const MANIFESTATION_METHODS = [
        { id: 'visualizing', label: 'Visualizing (Scene)' },
        { id: 'sats-lullaby', label: 'SATS (Lullaby Method)' },
        { id: 'affirmations', label: 'Affirmations / Inner Speech' },
        { id: 'assumption', label: 'Simple Assumption / Knowing' },
        { id: 'isnt-it-wonderful', label: '"Isn\'t it Wonderful?"' },
        { id: 'void-state', label: 'Void State' },
        { id: 'scripting', label: 'Scripting' }
    ];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)'
        }}>
            <div style={{
                width: '440px',
                padding: '32px',
                background: isLightMode ? '#fff' : 'rgba(18, 18, 18, 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '32px',
                boxShadow: '0 24px 50px rgba(0,0,0,0.5)',
                color: isLightMode ? '#000' : '#fff'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '700' }}>
                        <Activity size={22} color={ACCENT_COLOR} />
                        Log SATS Data
                    </h3>
                    <button
                        onClick={() => setLoggingSats(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}
                    >
                        <XCircle size={24} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Method */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Methodology</label>
                        <select
                            value={sessionData.method}
                            onChange={(e) => setSessionData({ ...sessionData, method: e.target.value })}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '12px',
                                background: isLightMode ? '#f5f5f5' : 'rgba(255,255,255,0.05)',
                                color: isLightMode ? '#000' : 'white',
                                border: '1px solid rgba(255,255,255,0.1)', outline: 'none'
                            }}
                        >
                            {MANIFESTATION_METHODS.map(m => <option key={m.id} value={m.id} style={{ background: isLightMode ? '#fff' : '#121212' }}>{m.label}</option>)}
                        </select>
                    </div>

                    {/* Vividness Slider */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Sensory Vividness</label>
                            <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '800' }}>{sessionData.vividness}/10</span>
                        </div>
                        <input
                            type="range" min="1" max="10"
                            value={sessionData.vividness}
                            onChange={(e) => setSessionData({ ...sessionData, vividness: parseInt(e.target.value) })}
                            style={{ width: '100%', accentColor: '#ef4444' }}
                        />
                    </div>

                    {/* Resistance Slider */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Inner Resistance</label>
                            <span style={{ fontSize: '14px', color: '#991b1b', fontWeight: '800' }}>{sessionData.resistance}/10</span>
                        </div>
                        <input
                            type="range" min="1" max="10"
                            value={sessionData.resistance}
                            onChange={(e) => setSessionData({ ...sessionData, resistance: parseInt(e.target.value) })}
                            style={{ width: '100%', accentColor: '#991b1b' }}
                        />
                    </div>

                    {/* Duration Slider */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Session Duration</label>
                            <span style={{ fontSize: '14px', color: ACCENT_COLOR, fontWeight: '800' }}>{sessionData.duration || 0} min</span>
                        </div>
                        <input
                            type="range" min="0" max="120" step="5"
                            value={sessionData.duration || 0}
                            onChange={(e) => setSessionData({ ...sessionData, duration: parseInt(e.target.value) })}
                            style={{ width: '100%', accentColor: ACCENT_COLOR }}
                        />
                    </div>

                    {/* Session Notes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Session Notes</label>
                        <textarea
                            value={sessionData.notes}
                            onChange={(e) => setSessionData({ ...sessionData, notes: e.target.value })}
                            placeholder="Describe your session experience..."
                            style={{
                                width: '100%',
                                height: '80px',
                                padding: '12px',
                                borderRadius: '12px',
                                background: isLightMode ? '#f5f5f5' : 'rgba(255,255,255,0.05)',
                                color: isLightMode ? '#000' : 'white',
                                border: '1px solid rgba(255,255,255,0.1)',
                                resize: 'none',
                                outline: 'none',
                                fontFamily: 'inherit',
                                fontSize: '13px'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button
                            onClick={() => setLoggingSats(null)}
                            style={{
                                flex: 1, padding: '14px', borderRadius: '14px',
                                background: isLightMode ? '#eee' : 'rgba(255,255,255,0.05)',
                                color: isLightMode ? '#000' : 'white',
                                border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCommit}
                            style={{
                                flex: 2, padding: '14px', borderRadius: '14px',
                                background: ACCENT_COLOR, color: 'white',
                                border: 'none', fontWeight: '800', fontSize: '13px',
                                cursor: 'pointer', boxShadow: `0 8px 20px ${getAccentBg(0.3)}`
                            }}
                        >
                            Commit Session Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SatsLogger;
