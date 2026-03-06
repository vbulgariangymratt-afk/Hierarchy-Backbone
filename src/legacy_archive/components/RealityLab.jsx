import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import * as LucideIcons from 'lucide-react';
import { Sparkles, Play, CheckCircle, XCircle, Clock, Target, Zap, AlertTriangle, ArrowRight, Camera, BarChart2, Hash, BookOpen, Atom, Activity, Anchor, Heart, Brain } from 'lucide-react';

const RealityLab = ({
    title: initialTitle,
    description,
    icon: FallbackIcon,
    stateKey, // 'manifestations' or 'desires'
    actions, // { add, update, delete, addSession }
    enableOracle = false,
    warheadContext = 'desires' // 'experiments' or 'desires'
}) => {
    const { state } = useStore();
    const isLightMode = state.themeMode === 'light';

    // Theme System
    const ACCENT_COLOR = isLightMode ? '#f43f5e' : '#fb7185'; // Rose-500 (Light) / Rose-400 (Dark)
    const ACCENT_TEXT_LIGHT = isLightMode ? '#fb7185' : '#fda4af'; // Rose-400 / Rose-300
    const getAccentBg = (opacity) => isLightMode
        ? `rgba(244, 63, 94, ${opacity})`
        : `rgba(251, 113, 133, ${opacity})`;

    // Map stateKey to tracker ID
    const trackerId = stateKey === 'manifestations' ? 'manifesting' : stateKey;
    const tracker = state.trackers?.[trackerId] ||
        Object.values(state.trackers || {}).find(t => t.name.toLowerCase().includes(trackerId));

    const displayTitle = tracker?.name || initialTitle;

    const renderIcon = (size = 56) => {
        const iconInput = tracker?.icon;
        if (!iconInput) return FallbackIcon ? <FallbackIcon size={size} /> : null;

        const LucideComponent = LucideIcons[iconInput];
        if (LucideComponent) return <LucideComponent size={size} />;

        if (iconInput.startsWith('http') || iconInput.startsWith('data:')) {
            return <img src={iconInput} alt="icon" style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }} />;
        }
        return <span style={{ fontSize: size === 36 ? '2.5rem' : '3.5rem' }}>{iconInput}</span>;
    };
    const [activeTab, setActiveTab] = useState('active'); // 'active', 'waiting', 'archive'

    // Oracle State
    const [showOracle, setShowOracle] = useState(false);
    const [generatedTarget, setGeneratedTarget] = useState(null);
    const [difficultyRating, setDifficultyRating] = useState(5);

    // Custom Target State
    const [showCustomTarget, setShowCustomTarget] = useState(false);
    const [customTargetText, setCustomTargetText] = useState('');

    const [viewingHistoryFor, setViewingHistoryFor] = useState(null); // ID of exp to view history

    // Session Logging Modal State
    const [loggingSessionFor, setLoggingSessionFor] = useState(null); // ID of exp
    const [sessionData, setSessionData] = useState({
        method: 'visualizing',
        repetition: 'single-act', // single-act, loop, periodic
        vividness: 5,
        resistance: 5,
        importance: 5,
        duration: 15,
        notes: ''
    });

    // Materialization Report State
    const [concludingExperimentId, setConcludingExperimentId] = useState(null);
    const [successReport, setSuccessReport] = useState({
        bridgeOfIncidents: '',
        bridgeMarkers: [],
        photoProof: ''
    });

    const MANIFESTATION_METHODS = [
        { id: 'visualizing', label: 'Visualizing (Scene)' },
        { id: 'sats-lullaby', label: 'SATS (Lullaby Method)' },
        { id: 'affirmations', label: 'Affirmations / Inner Speech' },
        { id: 'assumption', label: 'Simple Assumption / Knowing' },
        { id: 'isnt-it-wonderful', label: '"Isn\'t it Wonderful?"' },
        { id: 'void-state', label: 'Void State' },
        { id: 'scripting', label: 'Scripting' }
    ];

    const REPETITION_TYPES = [
        { id: 'single-act', label: 'Single Act (Done once)' },
        { id: 'loop', label: 'Looped (Repeated in session)' },
        { id: 'periodic', label: 'Periodic (Throughout the day)' }
    ];

    const BRIDGE_MARKERS = [
        { id: 'logical', label: 'Logical / Natural' },
        { id: 'miracle', label: 'Sudden / Miracle' },
        { id: 'partial', label: 'Partial Materialization' },
        { id: 'chaos', label: 'Pre-manifestation Chaos' },
        { id: 'external', label: 'External Conformity (Signs)' }
    ];

    // "The Oracle" - Random Target Generator
    const ORACLE_TARGETS = [
        { text: "A bright purple rubber duck", rarity: 3 },
        { text: "Finding a coin from the year 1998", rarity: 7 },
        { text: "Hearing the song 'Bohemian Rhapsody' in a public place", rarity: 4 },
        { text: "Seeing someone wear a neon green top hat", rarity: 9 },
        { text: "A stranger giving you a compliment about your shoes", rarity: 5 },
        { text: "Seeing a license plate with '777'", rarity: 6 },
        { text: "Finding a feather on your doorstep", rarity: 3 },
        { text: "Receiving a free coffee unexpectedly", rarity: 5 },
        { text: "Seeing a double rainbow", rarity: 8 },
        { text: "A specific friend texting you out of the blue", rarity: 4 }
    ];

    const generateTarget = () => {
        const random = ORACLE_TARGETS[Math.floor(Math.random() * ORACLE_TARGETS.length)];
        setGeneratedTarget(random.text);
        setDifficultyRating(random.rarity);
        setShowOracle(true);
    };

    const acceptTarget = () => {
        actions.add({
            description: generatedTarget,
            rarity: difficultyRating
        });
        setShowOracle(false);
        setGeneratedTarget(null);
    };

    const handleAddCustomTarget = () => {
        if (!customTargetText.trim()) return;
        actions.add({
            description: customTargetText,
            rarity: 5 // Default rarity for custom
        });
        setCustomTargetText('');
        setShowCustomTarget(false);
    };

    const handleLogSession = () => {
        if (!loggingSessionFor) return;

        actions.addSession(loggingSessionFor, {
            ...sessionData,
            timestamp: new Date().toISOString()
        });

        // Reset and close
        setLoggingSessionFor(null);
        setSessionData({
            method: 'visualizing',
            repetition: 'single-act',
            vividness: 5,
            resistance: 5,
            importance: 5,
            duration: 15,
            notes: ''
        });
    };

    const handleConcludeExperiment = () => {
        if (!concludingExperimentId) return;

        actions.update(concludingExperimentId, {
            status: 'materialized',
            completedAt: new Date().toISOString(),
            bridgeOfIncidents: successReport.bridgeOfIncidents,
            bridgeMarkers: successReport.bridgeMarkers,
            photoProof: successReport.photoProof
        });

        setConcludingExperimentId(null);
        setSuccessReport({
            bridgeOfIncidents: '',
            bridgeMarkers: [],
            photoProof: ''
        });
    };

    const activeExperiments = Object.values(state[stateKey] || {})
        .filter(m => m.status === 'active' || m.status === 'stalled')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const waitingExperiments = Object.values(state[stateKey] || {})
        .filter(m => m.status === 'waiting')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const archivedExperiments = Object.values(state[stateKey] || {})
        .filter(m => m.status === 'materialized' || m.status === 'failed')
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

    // Probability Engine Logic
    const calculateMiracleMetric = (exp) => {
        // Base Rarity (1-10) -> Odds
        const rarityOdds = {
            1: 10, 2: 50, 3: 100, 4: 500, 5: 1000,
            6: 5000, 7: 10000, 8: 100000, 9: 1000000, 10: 10000000
        };
        const base = rarityOdds[exp.rarity || 5];
        return `1 in ${base.toLocaleString()}`;
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '30px', paddingBottom: '40px' }}>

            {/* Premium Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                paddingTop: '10px'
            }}>
                <div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '42px',
                        fontWeight: '800',
                        letterSpacing: '-0.04em',
                        background: 'linear-gradient(to right, #fff 40%, rgba(255,255,255,0.4) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.2))' }}>
                            {renderIcon(36)}
                        </div>
                        {displayTitle}
                    </h1>
                    <p style={{
                        margin: '12px 0 0 0',
                        opacity: 0.5,
                        fontSize: '15px',
                        letterSpacing: '0.02em',
                        maxWidth: '500px',
                        lineHeight: '1.6'
                    }}>
                        {description}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    {enableOracle ? (
                        <button
                            onClick={generateTarget}
                            style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(15px)',
                                padding: '14px 28px',
                                fontSize: '12px',
                                fontWeight: '700',
                                color: 'rgba(255,255,255,0.8)',
                                borderRadius: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                        >
                            <Sparkles size={14} />
                            Consult The Oracle
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowCustomTarget(true)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(10px)',
                                padding: '14px 28px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: 'white',
                                borderRadius: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                        >
                            <Target size={16} />
                            Define New Target
                        </button>
                    )}
                </div>
            </div>

            {/* Warhead Advice / Status Placeholder */}
            {!enableOracle && (
                <div style={{ background: getAccentBg(0.05), borderRadius: '12px', padding: '16px', border: `1px solid ${getAccentBg(0.1)}`, display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ background: getAccentBg(0.2), padding: '10px', borderRadius: '50%', color: ACCENT_COLOR }}>
                        <Brain size={24} />
                    </div>
                    <div>
                        <h4 style={{ margin: '0 0 4px 0', color: '#fff' }}>Warhead Insight</h4>
                        <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>
                            Based on your {archivedExperiments.length + activeExperiments.length} experiments, you manifest best when <strong>Vividness is {'>'} 8</strong> and <strong>Importance is {'<'} 4</strong>.
                        </p>
                    </div>
                </div>
            )}

            {/* Custom Target Modal */}
            {showCustomTarget && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="glass-panel" style={{ width: '400px', padding: '24px', background: '#121212', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: '0 0 15px 0', color: '#fff' }}>Define Your Desire</h3>
                        <textarea
                            value={customTargetText}
                            onChange={(e) => setCustomTargetText(e.target.value)}
                            placeholder="What do you want to experience? (e.g. 'Receiving a check for $5,000')"
                            style={{
                                width: '100%', height: '100px', padding: '12px', marginBottom: '20px',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px', color: 'white', resize: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button onClick={() => setShowCustomTarget(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleAddCustomTarget} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: ACCENT_COLOR, color: isLightMode ? 'white' : 'black', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Initiate Protocol</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Oracle Modal */}
            {showOracle && (
                <div style={{
                    marginBottom: '20px', padding: '24px',
                    background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px', textAlign: 'center',
                    backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ margin: '0 0 10px 0', color: ACCENT_COLOR, fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>New Random Target Generated</h3>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>"{generatedTarget}"</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px', opacity: 0.7, marginBottom: '20px' }}>
                        <span>Rarity: {difficultyRating}/10</span>
                        <span>Est. Odds: 1 in {(difficultyRating * 1000).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button onClick={() => setShowOracle(false)} style={{ padding: '8px 20px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}>Discard</button>
                        <button onClick={acceptTarget} style={{ padding: '8px 24px', borderRadius: '12px', background: ACCENT_COLOR, color: isLightMode ? 'white' : 'black', border: 'none', fontWeight: '800', fontSize: '12px', cursor: 'pointer', boxShadow: `0 4px 15px ${getAccentBg(0.3)}` }}>Accept Experiment</button>
                    </div>
                </div>
            )}

            {/* Log Session Modal (Premium Redesign) */}
            {loggingSessionFor && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        width: '440px',
                        padding: '32px',
                        background: 'rgba(18, 18, 18, 0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '32px',
                        boxShadow: '0 24px 50px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '700' }}>
                            <Activity size={22} color={ACCENT_COLOR} />
                            Log Session Data
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Method */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Methodology</label>
                                <select
                                    value={sessionData.method}
                                    onChange={(e) => setSessionData({ ...sessionData, method: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                                >
                                    {MANIFESTATION_METHODS.map(m => <option key={m.id} value={m.id} style={{ background: '#121212' }}>{m.label}</option>)}
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
                                        background: 'rgba(255,255,255,0.05)',
                                        color: 'white',
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
                                    onClick={() => setLoggingSessionFor(null)}
                                    style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
                                >
                                    Abort
                                </button>
                                <button
                                    onClick={handleLogSession}
                                    style={{ flex: 1, padding: '14px', borderRadius: '14px', background: ACCENT_COLOR, color: isLightMode ? 'white' : 'black', border: 'none', fontWeight: '800', fontSize: '13px', cursor: 'pointer', boxShadow: `0 8px 20px ${getAccentBg(0.3)}` }}
                                >
                                    Commit Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Session History Modal */}
            {viewingHistoryFor && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ width: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'rgba(18, 18, 18, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', boxShadow: '0 24px 50px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                        <div style={{ padding: '32px 32px 20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '700' }}>
                                <BookOpen size={22} color={ACCENT_COLOR} />
                                Evolution Log
                            </h3>
                            <button onClick={() => setViewingHistoryFor(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}><XCircle size={24} /></button>
                        </div>

                        <div style={{ padding: '0 32px 32px 32px', overflowY: 'auto' }}>
                            {(() => {
                                const exp = state[stateKey][viewingHistoryFor];
                                const sessions = exp?.sessions || [];

                                if (sessions.length === 0) {
                                    return <div style={{ opacity: 0.3, textAlign: 'center', padding: '40px', fontSize: '14px' }}>No session data recorded yet.</div>;
                                }

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {[...sessions].reverse().map((session, idx) => (
                                            <div key={idx} style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                padding: '20px',
                                                borderRadius: '20px',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '16px'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.3, letterSpacing: '0.05em', marginBottom: '4px' }}>
                                                            {new Date(session.timestamp).toLocaleDateString()} @ {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '15px' }}>
                                                            {MANIFESTATION_METHODS.find(m => m.id === session.method)?.label || session.method}
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '16px' }}>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.3, marginBottom: '2px' }}>VIV</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444' }}>{session.vividness}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.3, marginBottom: '2px' }}>RES</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#991b1b' }}>{session.resistance}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {session.notes && (
                                                    <div style={{
                                                        fontSize: '13px',
                                                        lineHeight: '1.5',
                                                        color: 'rgba(255,255,255,0.7)',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        padding: '12px',
                                                        borderRadius: '12px',
                                                        borderLeft: `2px solid ${ACCENT_COLOR}`
                                                    }}>
                                                        {session.notes}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Success Report Modal (Premium Redesign) */}
            {concludingExperimentId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        width: '500px',
                        padding: '32px',
                        background: 'rgba(18, 18, 18, 0.8)',
                        border: `1px solid ${getAccentBg(0.3)}`,
                        borderRadius: '32px',
                        boxShadow: '0 24px 50px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px', color: ACCENT_COLOR, fontSize: '20px', fontWeight: '700' }}>
                            <CheckCircle size={22} />
                            Success Protocol Initiated
                        </h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '14px', opacity: 0.5 }}>Materialization confirmed. Document the path taken.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Bridge of Incidents */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>The Bridge of Incidents</label>
                                <textarea
                                    value={successReport.bridgeOfIncidents}
                                    onChange={(e) => setSuccessReport({ ...successReport, bridgeOfIncidents: e.target.value })}
                                    placeholder="Describe the natural sequence of events that led to the realization..."
                                    style={{ width: '100%', height: '100px', padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '14px', resize: 'none', outline: 'none' }}
                                />
                            </div>

                            {/* Bridge Markers */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>Pattern Classifiers</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {BRIDGE_MARKERS.map(marker => {
                                        const isSelected = successReport.bridgeMarkers.includes(marker.id);
                                        return (
                                            <button
                                                key={marker.id}
                                                onClick={() => {
                                                    const newMarkers = isSelected
                                                        ? successReport.bridgeMarkers.filter(id => id !== marker.id)
                                                        : [...successReport.bridgeMarkers, marker.id];
                                                    setSuccessReport({ ...successReport, bridgeMarkers: newMarkers });
                                                }}
                                                style={{
                                                    fontSize: '11px', padding: '8px 14px', borderRadius: '12px',
                                                    background: isSelected ? getAccentBg(0.2) : 'rgba(255,255,255,0.05)',
                                                    color: isSelected ? ACCENT_COLOR : 'rgba(255,255,255,0.5)',
                                                    border: `1px solid ${isSelected ? getAccentBg(0.3) : 'rgba(255,255,255,0.05)'}`,
                                                    cursor: 'pointer',
                                                    fontWeight: '700',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {marker.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <button
                                    onClick={() => setConcludingExperimentId(null)}
                                    style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConcludeExperiment}
                                    style={{ flex: 1, padding: '14px', borderRadius: '14px', background: ACCENT_COLOR, color: isLightMode ? '#fff' : 'black', border: 'none', fontWeight: '800', cursor: 'pointer', boxShadow: `0 8px 20px ${getAccentBg(0.3)}` }}
                                >
                                    Confirm Victory
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '4px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                width: 'fit-content',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <button
                    onClick={() => setActiveTab('active')}
                    style={{
                        background: activeTab === 'active' ? getAccentBg(0.15) : 'transparent',
                        border: 'none',
                        color: activeTab === 'active' ? ACCENT_TEXT_LIGHT : 'rgba(255,255,255,0.4)',
                        padding: '10px 24px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Zap size={14} />
                    Active ({activeExperiments.length})
                </button>
                <button
                    onClick={() => setActiveTab('waiting')}
                    style={{
                        background: activeTab === 'waiting' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        border: 'none',
                        color: activeTab === 'waiting' ? '#fff' : 'rgba(255,255,255,0.4)',
                        padding: '10px 24px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Clock size={14} />
                    Waiting ({waitingExperiments.length})
                </button>
                <button
                    onClick={() => setActiveTab('archive')}
                    style={{
                        background: activeTab === 'archive' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        border: 'none',
                        color: activeTab === 'archive' ? '#fff' : 'rgba(255,255,255,0.4)',
                        padding: '10px 24px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <CheckCircle size={14} />
                    History ({archivedExperiments.length})
                </button>
            </div>

            {/* Experiment Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                {(activeTab === 'active' ? activeExperiments : (activeTab === 'waiting' ? waitingExperiments : archivedExperiments)).map(exp => (
                    <div
                        key={exp.id}
                        style={{
                            padding: '30px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '24px',
                            position: 'relative',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.transform = 'translateY(-4px)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {/* Header Section */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '20px',
                                fontWeight: '700',
                                color: '#fff',
                                lineHeight: '1.4',
                                flex: 1,
                                paddingRight: '40px'
                            }}>
                                {exp.target?.description || exp.description || exp.targetDescription || exp.target}
                            </h3>
                            <div style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                fontWeight: '800',
                                letterSpacing: '0.05em',
                                background: exp.status === 'materialized' ? getAccentBg(0.1) : (exp.status === 'active' ? getAccentBg(0.2) : 'rgba(255,255,255,0.05)'),
                                color: exp.status === 'materialized' ? ACCENT_COLOR : (exp.status === 'active' ? ACCENT_TEXT_LIGHT : 'rgba(255,255,255,0.4)'),
                                border: `1px solid ${exp.status === 'materialized' ? getAccentBg(0.3) : (exp.status === 'active' ? getAccentBg(0.3) : 'rgba(255,255,255,0.1)')}`
                            }}>
                                {exp.status}
                            </div>
                        </div>

                        {/* Visual Metrics Engine */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Vividness Metric */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>
                                    <span>Sensory Vividness</span>
                                    <span>{exp.vividness}/10</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${exp.vividness * 10}%`,
                                        background: 'linear-gradient(to right, #ef4444, #fca5a5)',
                                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)'
                                    }} />
                                </div>
                            </div>

                            {/* Resistance Metric */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>
                                    <span>Inner Resistance</span>
                                    <span>{exp.resistance}/10</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${exp.resistance * 10}%`,
                                        background: 'linear-gradient(to right, #7f1d1d, #ef4444)',
                                        boxShadow: '0 0 10px rgba(127, 29, 29, 0.3)'
                                    }} />
                                </div>
                            </div>

                            {/* Secondary Data Strip */}
                            <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Hash size={12} color={ACCENT_COLOR} />
                                    <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.8 }}>{exp.frequency} Sessions</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={12} color={ACCENT_COLOR} />
                                    <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.8 }}>{new Date(exp.startDate || exp.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Premium Action Row */}
                        {activeTab === 'active' && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button
                                    onClick={() => setLoggingSessionFor(exp.id)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 14px',
                                        background: getAccentBg(0.1),
                                        border: `1px solid ${getAccentBg(0.2)}`,
                                        color: ACCENT_TEXT_LIGHT,
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = getAccentBg(0.2);
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = getAccentBg(0.1);
                                        e.currentTarget.style.color = ACCENT_TEXT_LIGHT;
                                    }}
                                >
                                    <Play size={14} /> Log Data
                                </button>
                                <button
                                    onClick={() => setViewingHistoryFor(exp.id)}
                                    style={{
                                        padding: '10px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#fff',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    title="View Evolution Log"
                                >
                                    <BookOpen size={16} />
                                </button>
                                <button
                                    onClick={() => actions.update(exp.id, { status: 'waiting' })}
                                    style={{
                                        padding: '10px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#fff',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    title="Move to Waiting"
                                >
                                    <Clock size={16} />
                                </button>
                                <button
                                    onClick={() => setConcludingExperimentId(exp.id)}
                                    style={{
                                        padding: '10px 20px',
                                        background: exp.status === 'materialized' ? getAccentBg(0.1) : 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${exp.status === 'materialized' ? getAccentBg(0.2) : 'rgba(255, 255, 255, 0.1)'}`,
                                        color: exp.status === 'materialized' ? ACCENT_COLOR : 'rgba(255, 255, 255, 0.8)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        if (exp.status !== 'materialized') {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.color = '#fff';
                                        } else {
                                            e.currentTarget.style.background = getAccentBg(0.2);
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (exp.status !== 'materialized') {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                                        } else {
                                            e.currentTarget.style.background = getAccentBg(0.1);
                                        }
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        )}

                        {activeTab === 'waiting' && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button
                                    onClick={() => actions.update(exp.id, { status: 'active' })}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: getAccentBg(0.1),
                                        border: `1px solid ${getAccentBg(0.2)}`,
                                        color: ACCENT_TEXT_LIGHT,
                                        borderRadius: '14px',
                                        fontSize: '13px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = getAccentBg(0.2);
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = `0 4px 15px ${getAccentBg(0.3)}`;
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = getAccentBg(0.1);
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <Zap size={14} /> Start Experiment
                                </button>
                            </div>
                        )}

                        {/* Archive Stats */}
                        {activeTab === 'archive' && exp.status === 'materialized' && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
                                <div style={{ color: '#10b981', marginBottom: '8px' }}>
                                    <Sparkles size={12} style={{ marginRight: '5px', display: 'inline' }} />
                                    <strong>Miracle Metric:</strong> The odds of this naturally occurring were approx.
                                    <span style={{ marginLeft: '4px', color: '#fff' }}>{calculateMiracleMetric(exp)}</span>.
                                </div>

                                {/* Bridge Story */}
                                {exp.bridgeOfIncidents && (
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', marginBottom: '8px' }}>
                                        <div style={{ fontWeight: 'bold', opacity: 0.7, marginBottom: '4px' }}>Bridge of Incidents:</div>
                                        <div style={{ fontStyle: 'italic', opacity: 0.9 }}>"{exp.bridgeOfIncidents}"</div>
                                    </div>
                                )}

                                {/* Tags */}
                                {exp.bridgeMarkers && exp.bridgeMarkers.length > 0 && (
                                    <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                                        {exp.bridgeMarkers.map(mId => (
                                            <span key={mId} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', opacity: 0.7 }}>
                                                {BRIDGE_MARKERS.find(m => m.id === mId)?.label || mId}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Photo Proof */}
                                {exp.photoProof && (
                                    <div style={{ marginTop: '10px' }}>
                                        <a href={exp.photoProof} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: ACCENT_COLOR, textDecoration: 'none' }}>
                                            <Camera size={12} /> View Photo Evidence
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {activeExperiments.length === 0 && activeTab === 'active' && (
                    <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                        <Atom size={48} style={{ marginBottom: '10px' }} />
                        <p>{enableOracle ? 'No active experiments. Consult the Oracle to begin.' : 'No active desires. Define a target to begin.'}</p>
                    </div>
                )}
            </div>
        </div >
    )
}

export default RealityLab;
