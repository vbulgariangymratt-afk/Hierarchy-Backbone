import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ArrowLeft, Plus, Save } from 'lucide-react';

const BeliefDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { state, updateBelief, addSatsSession } = useStore();
    const belief = state.beliefs?.[id];

    const [newSession, setNewSession] = useState({
        date: new Date().toISOString().slice(0, 10),
        duration: '',
        stateDescription: '',
        naturalness: '',
        lettingGoStatus: 'letting-go',
        sensesActive: [], // Array of active senses
        satisfactionReached: false, // Did you reach "impotence" (it is done)
        naturalThoughts: '' // Automatic thoughts during the day
    });

    if (!belief) return <div style={{ padding: '2rem', color: 'white' }}>Belief not found</div>;

    const handleAddSession = () => {
        // Validate all required fields (including at least one sense)
        if (!newSession.duration || !newSession.stateDescription || !newSession.naturalness || newSession.sensesActive.length === 0) return;
        addSatsSession(belief.id, { ...newSession, id: crypto.randomUUID() });
        setNewSession({
            ...newSession,
            duration: '',
            stateDescription: '',
            naturalness: '',
            lettingGoStatus: 'letting-go',
            sensesActive: [],
            satisfactionReached: false,
            naturalThoughts: ''
        });
    };

    // Check if all required fields are filled
    const isFormValid = newSession.duration && newSession.stateDescription && newSession.naturalness && newSession.sensesActive.length > 0;

    // Toggle sense selection
    const toggleSense = (sense) => {
        setNewSession(prev => ({
            ...prev,
            sensesActive: prev.sensesActive.includes(sense)
                ? prev.sensesActive.filter(s => s !== sense)
                : [...prev.sensesActive, sense]
        }));
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: 'var(--color-text-main)' }}>
            <button
                onClick={() => {
                    const spiritualArea = Object.values(state.areas || {}).find(a => a.name === 'Spiritual');
                    if (spiritualArea) {
                        navigate(`/area/${spiritualArea.id}`);
                    } else {
                        navigate(-1);
                    }
                }}
                style={{
                    background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px'
                }}
            >
                <ArrowLeft size={16} /> Back to Spiritual
            </button>

            {/* Header / Core Belief Info */}
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Core Belief Statement
                </label>
                <input
                    value={belief.statement}
                    onChange={(e) => updateBelief(belief.id, { statement: e.target.value })}
                    style={{
                        background: 'transparent', border: 'none', width: '100%', fontSize: '24px', fontWeight: 'bold', color: 'white', outline: 'none',
                        marginBottom: '24px'
                    }}
                    placeholder="Enter your new belief here..."
                />

                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Imaginal Scene
                </label>
                <textarea
                    value={belief.scene}
                    onChange={(e) => updateBelief(belief.id, { scene: e.target.value })}
                    style={{
                        background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                        width: '100%', minHeight: '80px', padding: '12px', color: 'white', resize: 'vertical'
                    }}
                    placeholder="Describe the scene that implies your wish is fulfilled..."
                />

                {/* Topic Selector */}
                <div style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Topic Category
                    </label>
                    <select
                        value={belief.topic || 'General / Other'}
                        onChange={(e) => updateBelief(belief.id, { topic: e.target.value })}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            color: 'white',
                            fontFamily: 'inherit',
                            cursor: 'pointer'
                        }}
                    >
                        {Object.values(state.beliefTopics || {}).map(topic => (
                            <option key={topic.id} value={topic.name}>
                                {topic.emoji || '🏷️'} {topic.name}
                            </option>
                        ))}
                        <option value="General / Other">🌟 General / Other</option>
                    </select>
                </div>

                {/* Mental Diet Approach Selector (A/B Testing) */}
                <div style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Mental Diet Approach (A/B Testing)
                    </label>
                    <select
                        value={belief.mentalDietApproach || 'subconscious-guide'}
                        onChange={(e) => updateBelief(belief.id, { mentalDietApproach: e.target.value })}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            color: 'white',
                            fontFamily: 'inherit',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="conscious-shift">🧠 Conscious Shift (actively redirect thoughts)</option>
                        <option value="subconscious-guide">🌊 Subconscious Guide (no conscious effort)</option>
                    </select>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                        Test which approach works better for you. Warhead AI will analyze the results.
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left Column: SATS Log */}
                <div>
                    <h2 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🌙</span> SATS Sessions
                    </h2>

                    {/* Add Session Form */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                            <input
                                type="date"
                                value={newSession.date}
                                onChange={e => setNewSession({ ...newSession, date: e.target.value })}
                                style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', padding: '8px', borderRadius: '4px' }}
                            />
                            <input
                                type="text"
                                placeholder="Duration (e.g. 15m) *"
                                value={newSession.duration}
                                onChange={e => setNewSession({ ...newSession, duration: e.target.value })}
                                style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', padding: '8px', borderRadius: '4px' }}
                            />
                        </div>
                        <textarea
                            placeholder="State reached / Notes... *"
                            value={newSession.stateDescription}
                            onChange={e => setNewSession({ ...newSession, stateDescription: e.target.value })}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', padding: '8px', borderRadius: '4px', marginBottom: '8px', minHeight: '60px' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '110px' }}>Letting Go Status:</label>
                            <select
                                value={newSession.lettingGoStatus}
                                onChange={e => setNewSession({ ...newSession, lettingGoStatus: e.target.value })}
                                style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="detached">🌊 Completely Detached</option>
                                <option value="letting-go">✨ Letting Go</option>
                                <option value="slight-obsession">😬 Slight Obsession</option>
                                <option value="very-obsessed">🔴 Very Obsessed</option>
                            </select>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>How Natural Did It Feel? *</label>
                            <textarea
                                placeholder="Describe how natural the scene felt - was it effortless, did you feel it real, any resistance... *"
                                value={newSession.naturalness}
                                onChange={e => setNewSession({ ...newSession, naturalness: e.target.value })}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', padding: '8px', borderRadius: '4px', minHeight: '60px' }}
                            />
                        </div>

                        {/* Sensory Vividness Checkboxes */}
                        <div style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                                Which Senses Were Active? * (Select at least one)
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '8px',
                                padding: '8px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '6px'
                            }}>
                                {[
                                    { id: 'touch', label: '✋ Touch', emoji: '✋' },
                                    { id: 'sound', label: '🔊 Sound', emoji: '🔊' },
                                    { id: 'smell', label: '👃 Smell', emoji: '👃' },
                                    { id: 'taste', label: '👅 Taste', emoji: '👅' },
                                    { id: 'visual', label: '👁️ Visual', emoji: '👁️' },
                                    { id: 'emotional', label: '❤️ Feeling', emoji: '❤️' }
                                ].map(sense => (
                                    <label
                                        key={sense.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            cursor: 'pointer',
                                            padding: '6px 8px',
                                            background: newSession.sensesActive.includes(sense.id) ? 'rgba(255,255,255,0.15)' : 'transparent',
                                            borderRadius: '4px',
                                            border: `1px solid ${newSession.sensesActive.includes(sense.id) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                            transition: 'all 0.2s',
                                            fontSize: '12px'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={newSession.sensesActive.includes(sense.id)}
                                            onChange={() => toggleSense(sense.id)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <span>{sense.label}</span>
                                    </label>
                                ))}
                            </div>
                            {newSession.sensesActive.length === 0 && (
                                <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px', fontStyle: 'italic' }}>
                                    Please select at least one sense
                                </div>
                            )}
                        </div>

                        {/* Satisfaction/Impotence Toggle */}
                        <div style={{ marginBottom: '8px', padding: '10px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '6px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={newSession.satisfactionReached}
                                    onChange={e => setNewSession({ ...newSession, satisfactionReached: e.target.checked })}
                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-main)' }}>
                                        ✨ Reached Satisfaction / Impotence
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                        The feeling that it's already done—no desire left to repeat the act
                                    </div>
                                </div>
                            </label>
                        </div>

                        {/* Natural Thoughts Field */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                Natural/Automatic Thoughts Today
                            </label>
                            <textarea
                                placeholder="What thoughts naturally arose during the day without conscious redirection? (Optional)"
                                value={newSession.naturalThoughts}
                                onChange={e => setNewSession({ ...newSession, naturalThoughts: e.target.value })}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', padding: '8px', borderRadius: '4px', minHeight: '50px', fontSize: '12px' }}
                            />
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                                Track your "former conversation" to see if it aligns with or contradicts your wish fulfilled
                            </div>
                        </div>
                        <button
                            onClick={handleAddSession}
                            disabled={!isFormValid}
                            style={{
                                width: '100%',
                                background: isFormValid ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                border: 'none',
                                color: isFormValid ? 'white' : 'rgba(255,255,255,0.3)',
                                padding: '10px 16px',
                                borderRadius: '4px',
                                cursor: isFormValid ? 'pointer' : 'not-allowed',
                                fontWeight: '600',
                                opacity: isFormValid ? 1 : 0.5
                            }}
                        >
                            Log Session {!isFormValid && '(Complete all fields)'}
                        </button>
                    </div>

                    {/* Session List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(belief.sessions || []).slice().reverse().map((session, idx) => {
                            // Helper function to get letting go display
                            const getLettingGoDisplay = (status) => {
                                const statusMap = {
                                    'detached': { emoji: '🌊', label: 'Detached', color: '#34d399' },
                                    'letting-go': { emoji: '✨', label: 'Letting Go', color: '#22d3ee' },
                                    'slight-obsession': { emoji: '😬', label: 'Slight Obsession', color: '#fbbf24' },
                                    'very-obsessed': { emoji: '🔴', label: 'Very Obsessed', color: '#ef4444' }
                                };
                                return statusMap[status] || statusMap['letting-go'];
                            };

                            const lgDisplay = getLettingGoDisplay(session.lettingGoStatus);

                            return (
                                <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '14px', borderRadius: '6px', borderLeft: '3px solid ' + lgDisplay.color }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-main)' }}>{session.date}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '16px' }}>{lgDisplay.emoji}</span>
                                            <span style={{ fontSize: '11px', color: lgDisplay.color, fontWeight: '600' }}>{lgDisplay.label}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Duration: {session.duration}</div>
                                    <div style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--color-text-main)' }}>{session.stateDescription}</div>

                                    {/* Sensory Vividness Badges */}
                                    {session.sensesActive && session.sensesActive.length > 0 && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: '600' }}>SENSES ACTIVE:</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {session.sensesActive.map(sense => {
                                                    const senseMap = {
                                                        'touch': '✋ Touch',
                                                        'sound': '🔊 Sound',
                                                        'smell': '👃 Smell',
                                                        'taste': '👅 Taste',
                                                        'visual': '👁️ Visual',
                                                        'emotional': '❤️ Feeling'
                                                    };
                                                    return (
                                                        <span
                                                            key={sense}
                                                            style={{
                                                                fontSize: '11px',
                                                                background: 'rgba(139, 92, 246, 0.2)',
                                                                padding: '3px 8px',
                                                                borderRadius: '12px',
                                                                border: '1px solid rgba(139, 92, 246, 0.4)',
                                                                color: '#c4b5fd'
                                                            }}
                                                        >
                                                            {senseMap[sense] || sense}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Satisfaction Indicator */}
                                    {session.satisfactionReached && (
                                        <div style={{
                                            fontSize: '12px',
                                            padding: '6px 10px',
                                            background: 'rgba(52, 211, 153, 0.15)',
                                            borderRadius: '4px',
                                            marginBottom: '8px',
                                            border: '1px solid rgba(52, 211, 153, 0.3)',
                                            color: '#34d399',
                                            fontWeight: '600'
                                        }}>
                                            ✨ Satisfaction Reached (It Is Done)
                                        </div>
                                    )}

                                    {/* Naturalness Description */}
                                    <div style={{ fontSize: '13px', padding: '8px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '4px', fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '4px' }}>How it felt:</span>
                                        {session.naturalness}
                                    </div>

                                    {/* Natural Thoughts */}
                                    {session.naturalThoughts && (
                                        <div style={{ fontSize: '12px', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', marginTop: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Natural Thoughts:</span>
                                            <span style={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>{session.naturalThoughts}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {(!belief.sessions || belief.sessions.length === 0) && (
                            <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', fontStyle: 'italic', padding: '20px' }}>
                                No sessions logged yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Mental Diet & Uncommon Events */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Mental Diet */}
                    <div>
                        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>🧠 Mental Diet / Inner Speech</h2>
                        <textarea
                            value={belief.mentalDiet}
                            onChange={(e) => updateBelief(belief.id, { mentalDiet: e.target.value })}
                            placeholder="Log your predominant thoughts during the day. Do they align with your wish fulfilled?"
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                                width: '100%', minHeight: '150px', padding: '12px', color: 'white', resize: 'vertical'
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BeliefDetail;
