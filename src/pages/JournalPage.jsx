import React, { useState, useEffect, useCallback } from 'react';
import { journalService, backbone, repository, NodeTypes } from '../backbone-v2';
import './JournalPage.css';

const ACTIVATION_LEVELS = ['VERY_LOW', 'LOW', 'NEUTRAL', 'GOOD', 'HIGH'];

const DEFAULT_ENTRY = {
    date: new Date().toISOString().split('T')[0],
    isLocked: false,
    activation: { morningActivationLevel: null },
    regulation: { rsdTrigger: false },
    biological: { sleepDurationMinutes: 0 },
    notes: "",
    snapshots: {
        deepWorkMinutes: 0,
        totalFocusMinutes: 0,
        avgFriction: 'medium',
        pinchDrivers: 'Stable'
    }
};

const JournalPage = () => {
    const [entry, setEntry] = useState(DEFAULT_ENTRY);
    const [loading, setLoading] = useState(true);
    const [localNotes, setLocalNotes] = useState("");
    const [todayAreaLog, setTodayAreaLog] = useState({});
    const [todayRepLog, setTodayRepLog] = useState({});
    const [areas, setAreas] = useState({});
    const [sections, setSections] = useState({
        summary: false,
        reflection: false,
        notes: true // Open by default for notes within section 1 logic? User said "Free Notes textarea (collapsed inside this section initially)" previously, but now says "Notes (multiline text)" in point 3. I'll make it visible in Quick Check-In.
    });

    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const initJournal = async () => {
            try {
                await journalService.ensureTodayEntry();
                const [data, areaLog, repLog, allNodes] = await Promise.all([
                    journalService.getEntry(todayStr),
                    backbone.getTodayAreaReinforcement(),
                    backbone.getTodayRepetitionLog(),
                    repository.getAll()
                ]);

                setEntry(data);
                setLocalNotes(data.notes || "");
                setTodayAreaLog(areaLog);
                setTodayRepLog(repLog);

                const areaMap = {};
                allNodes.filter(n => n.type === NodeTypes.LIFE_AREA).forEach(a => {
                    areaMap[a.id] = a.name;
                });
                setAreas(areaMap);

            } catch (e) {
                console.error("JournalPage: Error initializing today's entry:", e);
            } finally {
                setLoading(false);
            }
        };
        initJournal();
    }, [todayStr]);

    // Debounce notes saving
    useEffect(() => {
        if (loading || entry.isLocked) return;
        if (localNotes === entry.notes) return;

        const timer = setTimeout(() => {
            handleUpdate({ notes: localNotes });
        }, 500);

        return () => clearTimeout(timer);
    }, [localNotes]);

    const handleUpdate = async (updates) => {
        if (loading || entry.isLocked) return;

        // Optimistic UI update
        const updatedEntry = {
            ...entry,
            ...updates,
            biological: { ...entry.biological, ...(updates.biological || {}) },
            activation: { ...entry.activation, ...(updates.activation || {}) },
            regulation: { ...entry.regulation, ...(updates.regulation || {}) },
        };
        setEntry(updatedEntry);

        try {
            await journalService.updateEntryMetrics(todayStr, updates);
        } catch (e) {
            console.error("JournalPage: Failed to update entry:", e);
            const freshData = await journalService.getEntry(todayStr);
            setEntry(freshData);
            if (updates.notes !== undefined) setLocalNotes(freshData.notes || "");
        }
    };

    const toggleSection = (section) => {
        setSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const isLocked = entry.isLocked;

    return (
        <div className={`journal-page ${loading ? 'is-loading' : ''}`}>
            <header className="journal-header">
                <h1>Daily Journal</h1>
                <p className="journal-date">
                    {entry.date} {isLocked && <span className="locked-tag">(Locked)</span>}
                </p>
            </header>

            <main className="journal-content">
                {/* SECTION 1: QUICK CHECK-IN */}
                <section className="journal-section liquid-glass open">
                    <div className="section-header">
                        <h2>Quick Check-In</h2>
                    </div>
                    <div className="section-body">
                        {/* Morning Activation */}
                        <div className="input-group">
                            <label>Morning Activation</label>
                            <div className="activation-selector">
                                {ACTIVATION_LEVELS.map(level => (
                                    <button
                                        key={level}
                                        disabled={isLocked || loading}
                                        className={`activation-btn ${entry.activation?.morningActivationLevel === level ? 'active' : ''}`}
                                        onClick={() => handleUpdate({ activation: { morningActivationLevel: level } })}
                                    >
                                        {level.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RSD Trigger */}
                        <div className="input-group row">
                            <label className="toggle-label">
                                <input
                                    type="checkbox"
                                    disabled={isLocked || loading}
                                    checked={entry.regulation?.rsdTrigger || false}
                                    onChange={(e) => handleUpdate({ regulation: { rsdTrigger: e.target.checked } })}
                                />
                                RSD Trigger Today
                            </label>
                        </div>

                        {/* Notes */}
                        <div className="input-group">
                            <label>Notes</label>
                            <textarea
                                className="notes-textarea"
                                disabled={isLocked || loading}
                                value={localNotes}
                                placeholder={loading ? "Loading..." : "Write your thoughts..."}
                                onChange={(e) => setLocalNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                {/* SECTION 2: TODAY'S SIGNALS (AUTO) */}
                <section className={`journal-section liquid-glass ${sections.summary ? 'open' : 'collapsed'}`}>
                    <div className="section-header" onClick={() => toggleSection('summary')}>
                        <h2>Today's Signals (Auto)</h2>
                        <span className="toggle-arrow">{sections.summary ? '▼' : '▶'}</span>
                    </div>
                    {sections.summary && (
                        <div className="section-body summary-grid">
                            <div className="metric">
                                <span className="label">Estimated Sleep</span>
                                <span className="value">
                                    {entry.biological?.sleepDurationMinutes
                                        ? `${Math.floor(entry.biological.sleepDurationMinutes / 60)}h ${entry.biological.sleepDurationMinutes % 60}m`
                                        : "Sleep data not available"}
                                </span>
                            </div>
                            <div className="metric">
                                <span className="label">Deep Work Duration</span>
                                <div className="value-group">
                                    <span className="value">{entry.snapshots?.totalFocusMinutes || 0}m</span>
                                    {entry.snapshots?.totalFocusMinutes >= 90 && (
                                        <span className="metric-tag">Deep focus detected</span>
                                    )}
                                </div>
                            </div>
                            <div className="metric">
                                <span className="label">Habit Friction Summary</span>
                                <div className="friction-counts">
                                    <span className="count-item">Light: {entry.snapshots?.frictionCounts?.light || 0}</span>
                                    <span className="count-item">Medium: {entry.snapshots?.frictionCounts?.medium || 0}</span>
                                    <span className="count-item">Heavy: {entry.snapshots?.frictionCounts?.heavy || 0}</span>
                                </div>
                            </div>
                            <div className="metric">
                                <span className="label">Dominant PINCH Driver</span>
                                <span className="value">{entry.snapshots?.dominantDriver || "Driver unclear"}</span>
                            </div>
                        </div>
                    )}
                </section>

                {/* IDENTITY REINFORCED TODAY */}
                <section className="journal-section liquid-glass open">
                    <div className="section-header">
                        <h2>Identity Reinforced Today</h2>
                    </div>
                    <div className="section-body">
                        {Object.keys(todayAreaLog).length > 0 || Object.keys(todayRepLog).length > 0 ? (
                            <div className="identity-log-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Object.entries(todayAreaLog).map(([areaId, count]) => {
                                    const areaName = areas[areaId] || areaId;
                                    return (
                                        <div key={areaId} className="identity-log-item liquid-glass" style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            fontSize: '14px'
                                        }}>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>• {areaName}</span>
                                            <span style={{ color: 'var(--color-primary)', fontWeight: '700' }}>× {count}</span>
                                        </div>
                                    );
                                })}
                                {Object.entries(todayRepLog).map(([taskId, { name, count }]) => (
                                    <div key={taskId} className="identity-log-item liquid-glass" style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        fontSize: '14px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>• {name}</span>
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                color: 'var(--color-primary)',
                                                background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                                                border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
                                                borderRadius: '4px',
                                                padding: '2px 6px',
                                                letterSpacing: '0.04em',
                                                textTransform: 'uppercase'
                                            }}>Rep</span>
                                        </div>
                                        <span style={{ color: 'var(--color-primary)', fontWeight: '700' }}>× {count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-data-message" style={{ color: 'var(--text-secondary)', fontSize: '14px', opacity: '0.6' }}>
                                No identities reinforced yet today. Focus on a skill to begin.
                            </div>
                        )}
                    </div>
                </section>


                {/* SECTION 3: AI REFLECTION */}
                <section className={`journal-section liquid-glass ${sections.reflection ? 'open' : 'collapsed'}`}>
                    <div className="section-header" onClick={() => toggleSection('reflection')}>
                        <h2>AI Reflection</h2>
                        <span className="toggle-arrow">{sections.reflection ? '▼' : '▶'}</span>
                    </div>
                    {sections.reflection && (
                        <div className="section-body">
                            <button className="ai-btn" disabled={true}>Generate Reflection (Soon)</button>
                            <div className="reflection-placeholder">
                                Reflection analysis will appear here. No sensitive data is sent.
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default JournalPage;
