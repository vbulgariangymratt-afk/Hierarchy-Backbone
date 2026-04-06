import React, { useState, useEffect, useCallback } from 'react';
import { Droplets, Apple, Zap, Sun, Pill, HelpCircle, Plus, Trash2, Clock } from 'lucide-react';
import { journalService, backbone, repository, NodeTypes, TaskStatuses } from '../backbone-v2';
import { formatDuration } from '../utils/timeUtils';
import { useSettings } from '../context/SettingsContext';
import './JournalPage.css';

const ACTIVATION_LEVELS = ['VERY_LOW', 'LOW', 'NEUTRAL', 'GOOD', 'HIGH'];

const DEFAULT_ENTRY = {
    date: new Date().toISOString().split('T')[0],
    isLocked: false,
    activation: { morningActivationLevel: null },
    regulation: { rsdTrigger: false },
    biological: { sleepDurationMinutes: 0 },
    medication_taken: false,
    med_taken_at: null,
    hydration_level: 2,
    nutrition_level: 2,
    sugar_level: 2,
    morning_activity_done: false,
    morning_activity_at: null,
    medications: [], 
    notes: "",
    snapshots: {
        deepWorkMinutes: 0,
        totalFocusMinutes: 0,
        avgFriction: 'medium',
        pinchDrivers: 'Stable'
    }
};

const JournalPage = () => {
    const { energyLevel } = useSettings();
    const isSimplified = energyLevel === 1;
    
    const [entry, setEntry] = useState(DEFAULT_ENTRY);
    const [loading, setLoading] = useState(true);
    const [localNotes, setLocalNotes] = useState("");
    const [todayAreaLog, setTodayAreaLog] = useState({});
    const [todayRepLog, setTodayRepLog] = useState({});
    const [areas, setAreas] = useState({});
    const [sections, setSections] = useState({
        summary: false,
        reflection: false,
        notes: true
    });
    const [sleepTime, setSleepTime] = useState("");
    const [wakeTime, setWakeTime] = useState("");
    const [sleepSaved, setSleepSaved] = useState(false);
    const [preferManualSleep, setPreferManualSleep] = useState(localStorage.getItem('pref_manual_sleep') === 'true');
    const [expandedAreas, setExpandedAreas] = useState({});
    const [completedGroups, setCompletedGroups] = useState({});
    const [medications, setMedications] = useState([]);
    const [medAdding, setMedAdding] = useState(false);
    const getTodayDateStr = () => {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };

    const shiftDateStr = (dateStr, daysDelta) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + daysDelta);
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    };

    const todayStr = getTodayDateStr();
    const [selectedDateStr, setSelectedDateStr] = useState(todayStr);

    useEffect(() => {
        const handleStorageChange = () => {
            const val = localStorage.getItem('pref_manual_sleep') === 'true';
            setPreferManualSleep(val);
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [setPreferManualSleep]);

    const initJournal = useCallback(async () => {
        try {
            // Safe fetches with fallbacks to avoid crashing the whole page
            const fetchLogs = async () => {
                const logs = { areaLog: {}, repLog: {} };
                try {
                    if (backbone.getAreaReinforcement) {
                        logs.areaLog = await backbone.getAreaReinforcement(selectedDateStr);
                    } else if (backbone.getTodayAreaReinforcement && selectedDateStr === todayStr) {
                        logs.areaLog = await backbone.getTodayAreaReinforcement();
                    }
                } catch (e) { console.error("Failed to fetch area logs", e); }

                try {
                    if (backbone.getRepetitionLog) {
                        logs.repLog = await backbone.getRepetitionLog(selectedDateStr);
                    } else if (backbone.getTodayRepetitionLog && selectedDateStr === todayStr) {
                        logs.repLog = await backbone.getTodayRepetitionLog();
                    }
                } catch (e) { console.error("Failed to fetch rep logs", e); }

                return logs;
            };

            const [data, logs, allNodes] = await Promise.all([
                journalService.getEntry(selectedDateStr),
                fetchLogs(),
                repository.getAll()
            ]);

            setEntry(data);
            setLocalNotes(data.notes || "");
            setMedications(data.medications || []);
            
            // DYNAMIC MERGE: Combine backbone's static area logs (DONE tasks) 
            // with detected in-progress sessions from today's scan.
            const mergedAreas = {};
            
            // 1. Add DONE areas from backbone log
            Object.entries(logs.areaLog).forEach(([areaId, count]) => {
                mergedAreas[areaId] = { count, status: 'done' };
            });

            // 2. Compute completed task groups (Session Scan)
            const groups = {};
            allNodes.forEach(node => {
                if (node.type !== NodeTypes.TASK) return;
                
                let isDoneToday = false;
                let completionTime = 0;
                let hasActivityToday = false;

                // 1. Task done on selected date?
                if (node.metadata?.status === TaskStatuses.DONE && node.metadata?.completedAt) {
                    const ct = new Date(node.metadata.completedAt);
                    if (ct.toLocaleDateString('en-CA') === selectedDateStr) {
                        hasActivityToday = true;
                        isDoneToday = true;
                        completionTime = ct.getTime();
                    }
                }

                // 2. Sessions on selected date?
                const sessions = node.metadata?.sessions || [];
                const sessionSeconds = sessions.reduce((sum, s) => {
                    if (s.status === 'completed' && s.endTime) {
                        const st = new Date(s.endTime);
                        if (st.toLocaleDateString('en-CA') === selectedDateStr) {
                            hasActivityToday = true;
                            completionTime = Math.max(completionTime, st.getTime());
                            return sum + (s.actualDuration || 0);
                        }
                    }
                    return sum;
                }, 0);

                // 3. Fallback duration
                const fallbackSeconds = node.metadata?.totalFocusTime || node.metadata?.focusTime || 0;
                const totalMinutes = sessionSeconds > 0 
                    ? Math.round(sessionSeconds / 60)
                    : Math.round(fallbackSeconds / 60);

                if (hasActivityToday) {
                    console.log(`[Duration] Task: ${node.name} | sessions: ${sessionSeconds}s | fallback: ${fallbackSeconds}s | total: ${totalMinutes}m`);

                    // Find ancestors
                    let skillNode = null;
                    let areaNode = null;
                    let current = node;
                    const visited = new Set();
                    while (current && current.parentId && !visited.has(current.id)) {
                        visited.add(current.id);
                        const parent = allNodes.find(n => n.id === current.parentId);
                        if (!parent) break;
                        if (parent.type === NodeTypes.SKILL && !skillNode) skillNode = parent;
                        if (parent.type === NodeTypes.LIFE_AREA) {
                            areaNode = parent;
                            break;
                        }
                        current = parent;
                    }

                    if (areaNode) {
                        if (!groups[areaNode.id]) groups[areaNode.id] = {};
                        
                        // Track in-progress detection for the merged list
                        // An area is "done" if ANY task in it is done (existing logic)
                        // OR if it's already in the backbone areaLog.
                        if (!mergedAreas[areaNode.id]) {
                            mergedAreas[areaNode.id] = { count: 0, status: 'in_progress' };
                        }

                        const skillId = skillNode ? skillNode.id : 'OTHER';
                        if (!groups[areaNode.id][skillId]) {
                            groups[areaNode.id][skillId] = {
                                name: skillNode ? skillNode.name : 'Other',
                                tasks: []
                            };
                        }
                        groups[areaNode.id][skillId].tasks.push({
                            id: node.id,
                            name: node.name,
                            completionTime,
                            sessionMinutes: totalMinutes,
                            status: isDoneToday ? 'done' : 'in_progress'
                        });
                    }
                }
            });

            // Sort tasks within groups
            Object.values(groups).forEach(skills => {
                Object.values(skills).forEach(s => {
                    s.tasks.sort((a, b) => b.completionTime - a.completionTime);
                });
            });

            // 3. Update States
            setTodayAreaLog(mergedAreas);
            setTodayRepLog(logs.repLog);
            setCompletedGroups(groups);

            const root = allNodes.find(n => n.id === 'ROOT');
            console.log("[DEBUG Journal] Initialization Data:", { 
                todayStr,
                areaLog: logs.areaLog, 
                repLog: logs.repLog, 
                rootFound: !!root,
                rootMetadata: root?.metadata 
            });

            const nodeNames = {};
            allNodes.forEach(n => {
                nodeNames[n.id] = n.name;
            });
            setAreas(nodeNames);

        } catch (e) {
            console.error("JournalPage: Error initializing today's entry:", e);
        } finally {
            setLoading(false);
        }
    }, [selectedDateStr, todayStr]);

    useEffect(() => {
        initJournal();
        
        // REACIVITY FIX: Subscribe to repository changes to refresh journal
        const unsubscribe = repository.subscribe(() => {
            console.log("[Journal REACIVITY] Repository changed, refreshing journal metrics...");
            initJournal();
        });
        
        return () => unsubscribe();
    }, [initJournal, selectedDateStr]);

    // Unified helper to set sleep defaults or loaded values
    useEffect(() => {
        if (loading) return;
        
        const manual = entry.biological?.manualOverride;
        
        if (manual) {
            setSleepTime(manual.sleepTime || "00:00");
            setWakeTime(manual.wakeTime || "00:00");
            setSleepSaved(true);
        } else {
            // New day (or no record yet): Reset to 00:00 and enable button
            setSleepTime("00:00");
            setWakeTime("00:00");
            setSleepSaved(false);
        }
    }, [loading, entry.id, entry.biological?.manualOverride]); // Fixed dependency array length

    const handleSaveSleepManual = async () => {
        if (isLocked) return;
        console.log('[DEBUG SleepLog] handleSaveSleepManual called', { sleepTime, wakeTime });
        if (!sleepTime || !wakeTime) {
            console.warn('[DEBUG SleepLog] Missing sleepTime or wakeTime');
            return;
        }

        const [y, m, d] = selectedDateStr.split('-').map(Number);
        const [sleepH, sleepM] = sleepTime.split(':').map(Number);
        const [wakeH, wakeM] = wakeTime.split(':').map(Number);

        // Compute local timestamps for the specified date
        const wakeTS = new Date(y, m - 1, d, wakeH, wakeM).getTime();
        
        // If sleep hour is >= wake hour (e.g. 11pm vs 7am), then sleep was yesterday
        let sleepTS = new Date(y, m - 1, d, sleepH, sleepM).getTime();
        if (sleepTS >= wakeTS) {
            sleepTS -= 24 * 60 * 60 * 1000;
        }

        const durationMinutes = Math.round((wakeTS - sleepTS) / (60 * 1000));
        console.log('[DEBUG SleepLog] Computed timestamps:', { sleepTS, wakeTS, durationMinutes });

        const biological = {
            sleepStartTime: sleepTS,
            wakeTime: wakeTS,
            sleepDurationMinutes: durationMinutes,
            sleepDetectedAutomatically: false,
            manualOverride: { sleepTime, wakeTime }
        };

        console.log('[DEBUG SleepLog] Sending update:', biological);
        await handleUpdate({ biological });
        setSleepSaved(true);
    };

    // Debounce notes saving
    useEffect(() => {
        if (loading || isLocked) return;
        if (localNotes === entry.notes) return;

        const timer = setTimeout(() => {
            handleUpdate({ notes: localNotes });
        }, 500);

        return () => clearTimeout(timer);
    }, [localNotes, loading, entry.isLocked, entry.notes]);

    const handleUpdate = async (updates) => {
        if (loading || isLocked) return;

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
            await journalService.updateEntryMetrics(selectedDateStr, updates);
        } catch (e) {
            console.error("JournalPage: Failed to update entry:", e);
            const freshData = await journalService.getEntry(selectedDateStr);
            setEntry(freshData);
            if (updates.notes !== undefined) setLocalNotes(freshData.notes || "");
        }
    };

    const handleLogMedication = async (id) => {
        const now = new Date().toISOString();
        const med = medications.find(m => m.id === id);
        if (!med) return;

        // Update local state
        const updated = medications.map(m => m.id === id ? { ...m, last_taken: now } : m);
        setMedications(updated);
        
        // Persist to Supabase via Log table (REAL LOGGING)
        try {
            const userId = await backbone.getUserId?.() || (await repository.getUserId?.());
            if (userId) {
                const { error } = await backbone.supabase
                    .from('medication_logs')
                    .insert({ 
                        user_id: userId,
                        med_name: med.name,
                        taken_at: now 
                    });
                if (error) throw error;
                console.log(`[PULSE] ${med.name} successfully logged to Supabase.`);
            }
            
            // Also sync the medication list to the journal entry for the monospaced timestamp preview
            await handleUpdate({ medications: updated });
        } catch (e) {
            console.error("Failed to pulse medication to Supabase:", e);
        }
    };

    const handleAddMedication = () => {
        const newMed = {
            id: Math.random().toString(36).substr(2, 9),
            name: "New Pill",
            scheduled_time: "08:00",
            last_taken: null
        };
        const updated = [...medications, newMed];
        setMedications(updated);
        handleUpdate({ medications: updated });
    };

    const handleRemoveMedication = (id) => {
        const updated = medications.filter(m => m.id !== id);
        setMedications(updated);
        handleUpdate({ medications: updated });
    };

    const handleUpdateMedName = (id, newName) => {
        const updated = medications.map(m => m.id === id ? { ...m, name: newName } : m);
        setMedications(updated);
        // We debounced this in a real app, for now just local
    };

    const handleUpdateMedTime = (id, newTime) => {
        const updated = medications.map(m => m.id === id ? { ...m, scheduled_time: newTime } : m);
        setMedications(updated);
    };

    const toggleSection = (section) => {
        setSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const toggleAreaExpansion = (areaId) => {
        setExpandedAreas(prev => ({ ...prev, [areaId]: !prev[areaId] }));
    };

    const isPast = selectedDateStr !== todayStr;
    const isLocked = entry.isLocked || isPast;

    if (preferManualSleep) {
        console.log('[DEBUG SleepLog] Rendering Section:', { 
            sleepTime, 
            wakeTime, 
            isLocked, 
            loading, 
            disabled: !sleepTime || !wakeTime || isLocked || loading 
        });
    }

    return (
        <div className={`journal-page ${loading ? 'is-loading' : ''}`}>
            <header className="journal-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>Daily Journal</h1>
                        <p className="journal-date" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {entry.date} {isLocked && <span className="locked-tag">({isPast ? 'Read-only' : 'Locked'})</span>}
                        </p>
                    </div>
                    <div className="date-navigator">
                        <button 
                            className="nav-btn" 
                            onClick={() => setSelectedDateStr(shiftDateStr(selectedDateStr, -1))}
                        >
                            ← PrevDay
                        </button>
                        <input 
                            type="date" 
                            className="date-picker"
                            value={selectedDateStr}
                            onChange={(e) => setSelectedDateStr(e.target.value)}
                            max={todayStr}
                        />
                        <button 
                            className="nav-btn" 
                            disabled={selectedDateStr === todayStr}
                            onClick={() => setSelectedDateStr(shiftDateStr(selectedDateStr, 1))}
                        >
                            NextDay →
                        </button>
                    </div>
                </div>
            </header>

            <main className="journal-content">
                {/* SECTION 1: MORNING ACTIVATION RE-RESTORED */}
                <section className="journal-section liquid-glass open" style={{ marginBottom: '24px' }}>
                    <div className="section-header">
                        <h2>Morning Activation Check-in</h2>
                    </div>
                    <div className="section-body">
                        <div className="input-group">
                            <label style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px', display: 'block' }}>Initial Propulsion Level</label>
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
                    </div>
                </section>

                {/* SECTION: MORNING CHECK-IN (MERGED) */}
                <section className="journal-section liquid-glass morning-checkin-block" style={{ marginBottom: '24px', border: '1px solid rgba(var(--color-primary-rgb), 0.2)' }}>
                    <div className="section-header" style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', margin: 0 }}>
                            <Sun size={18} /> Morning Check-in
                        </h2>
                    </div>

                    <div className="morning-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', padding: '20px' }}>
                        
                        {/* MANUAL SLEEP LOG RESTORED */}
                        <div className="morning-activity-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <Clock size={16} /> <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9 }}>Manual Sleep Log</span>
                            </div>
                            
                            <div className="sleep-log-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                <div className="time-input-group">
                                    <label style={{ fontSize: '10px', opacity: 0.6, marginBottom: '4px', display: 'block' }}>Sleep</label>
                                    <input 
                                        type="time" 
                                        className="time-input"
                                        value={sleepTime}
                                        onChange={(e) => { setSleepTime(e.target.value); setSleepSaved(false); }}
                                        disabled={isLocked || loading}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px', borderRadius: '4px' }}
                                    />
                                </div>
                                <div className="time-input-group">
                                    <label style={{ fontSize: '10px', opacity: 0.6, marginBottom: '4px', display: 'block' }}>Wake</label>
                                    <input 
                                        type="time" 
                                        className="time-input"
                                        value={wakeTime}
                                        onChange={(e) => { setWakeTime(e.target.value); setSleepSaved(false); }}
                                        disabled={isLocked || loading}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px', borderRadius: '4px' }}
                                    />
                                </div>
                            </div>
                            
                            <button 
                                className="save-sleep-btn"
                                onClick={handleSaveSleepManual}
                                disabled={!sleepTime || !wakeTime || isLocked || loading || sleepSaved}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    background: sleepSaved ? 'rgba(255,255,255,0.05)' : 'var(--color-primary)',
                                    color: 'white',
                                    border: 'none',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    opacity: sleepSaved ? 0.6 : 1
                                }}
                            >
                                {sleepSaved ? 'Sleep Logged ✓' : 'Save Sleep Log'}
                            </button>
                        </div>

                        {/* BIO-TRIAD */}
                        <div className="bio-triad-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {[
                                { key: 'hydration_level', label: 'Hydration', icon: <Droplets size={14} />, color: '#60A5FA' },
                                { key: 'nutrition_level', label: 'Nutrition', icon: <Apple size={14} />, color: '#34D399' },
                                { key: 'sugar_level', label: 'Blood Sugar/Energy', icon: <Zap size={14} />, color: '#FBBF24' }
                            ].map(metric => (
                                <div key={metric.key} className="bio-metric-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: 500, opacity: 0.8 }}>
                                        {metric.icon} {metric.label}
                                    </div>
                                    <div className="segmented-toggle" style={{ display: 'flex', gap: '6px' }}>
                                        {['Low', 'Med', 'Full'].map((label, idx) => (
                                            <button
                                                key={label}
                                                className={`segment-btn ${entry[metric.key] === idx + 1 ? 'active' : ''}`}
                                                onClick={() => handleUpdate({ [metric.key]: idx + 1 })}
                                                style={{
                                                    flex: 1,
                                                    fontSize: '11px',
                                                    padding: '8px',
                                                    borderRadius: '6px',
                                                    background: entry[metric.key] === idx + 1 ? metric.color : 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    color: entry[metric.key] === idx + 1 ? '#000' : '#fff',
                                                    fontWeight: entry[metric.key] === idx + 1 ? 700 : 400,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* LIGHT MORNING ACTIVITY (MOVED TO GRID) */}
                        <div className="morning-activity-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9 }}>Light Morning Activity</span>
                                <div className="habit-tooltip-wrapper">
                                    <HelpCircle size={14} style={{ opacity: 0.4, cursor: 'help' }} />
                                    <span className="habit-custom-tooltip">10 mins of sunlight or a quick stretch/walk/workout.</span>
                                </div>
                            </div>
                            <button 
                                 className={`activity-pulse-btn ${entry.morning_activity_done ? 'active' : ''}`}
                                 onClick={() => handleUpdate({ 
                                     morning_activity_done: !entry.morning_activity_done,
                                     morning_activity_at: !entry.morning_activity_done ? new Date().toISOString() : null
                                 })}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '10px',
                                    background: entry.morning_activity_done ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: entry.morning_activity_done ? 'white' : 'var(--text-secondary)',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {entry.morning_activity_done ? 'Activity Completed' : 'Log Activity'}
                            </button>
                            {entry.morning_activity_at && (
                                <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '8px', textAlign: 'center', fontFamily: 'monospace' }}>
                                    Logged at: {new Date(entry.morning_activity_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* DYNAMIC MEDICATION TRACKER */}
                <section className="journal-section liquid-glass medication-tracker" style={{ marginBottom: '24px' }}>
                    <div className="section-header" style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', margin: 0 }}>
                            <Pill size={18} /> Medication Tracker
                        </h2>
                        <button 
                            className="add-med-btn" 
                            onClick={handleAddMedication}
                            style={{ background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        >
                            <Plus size={14} /> Add Med
                        </button>
                    </div>
                    <div className="medication-list" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {medications.map(med => (
                            <div key={med.id} className="med-row" style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '16px',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <div style={{ flex: 1, marginRight: '16px' }}>
                                    <input 
                                        type="text" 
                                        value={med.name} 
                                        onChange={(e) => handleUpdateMedName(med.id, e.target.value)}
                                        onBlur={() => handleUpdate({ medications })} // Sync on blur
                                        className="med-name-input"
                                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid transparent', color: 'white', fontSize: '14px', fontWeight: 600, width: '100%', outline: 'none' }}
                                        placeholder="Pill Name..."
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                        <Clock size={10} style={{ opacity: 0.5 }} />
                                        <input 
                                            type="time" 
                                            value={med.scheduled_time} 
                                            onChange={(e) => handleUpdateMedTime(med.id, e.target.value)}
                                            onBlur={() => handleUpdate({ medications })}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        {med.last_taken ? (
                                            <span style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.6, color: 'var(--color-primary)', display: 'block' }}>
                                                Taken: {new Date(med.last_taken).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '10px', opacity: 0.3, display: 'block' }}>Pending Pulse</span>
                                        )}
                                    </div>
                                    
                                    <button 
                                        onClick={() => handleLogMedication(med.id)}
                                        className="pulse-log-btn"
                                        style={{
                                            padding: '8px 16px',
                                            fontSize: '12px',
                                            borderRadius: '8px',
                                            background: 'var(--color-primary)',
                                            border: 'none',
                                            color: 'white',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 8px rgba(var(--color-primary-rgb), 0.3)'
                                        }}
                                    >
                                        Log Pulse
                                    </button>
                                    
                                    <button 
                                        onClick={() => handleRemoveMedication(med.id)}
                                        style={{ background: 'transparent', border: 'none', color: '#ff4d4d', opacity: 0.4, cursor: 'pointer', padding: '4px' }}
                                        title="Remove medication"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {medications.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px', opacity: 0.3, fontSize: '13px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                                No medications registered. Add one to start tracking.
                            </div>
                        )}
                    </div>
                </section>

                {/* SECTION 2: AUTO LOGS (FORMERLY TODAY'S SIGNALS) */}
                <section className={`journal-section liquid-glass ${sections.summary ? 'open' : 'collapsed'}`}>
                    <div className="section-header" onClick={() => toggleSection('summary')}>
                        <h2>Daily Metabolism (Auto)</h2>
                        <span className="toggle-arrow">{sections.summary ? '▼' : '▶'}</span>
                    </div>
                    {/* HIDE BY DEFAULT IN ENERGY 1 */}
                    {sections.summary && !isSimplified && (
                        <div className="section-body summary-grid">
                            <div className="metric">
                                <span className="label">Focus Efficiency</span>
                                <span className="value">{entry.snapshots?.avgFriction || "Calculating..."}</span>
                            </div>
                            <div className="metric">
                                <span className="label">Focus Volume</span>
                                <span className="value">{entry.snapshots?.totalFocusMinutes || 0} min</span>
                            </div>
                            <div className="metric">
                                <span className="label">Deep Work</span>
                                <span className="value">{entry.snapshots?.deepWorkMinutes || 0} min</span>
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
                    {/* HIDE BY DEFAULT IN ENERGY 1 */}
                    {!isSimplified && (
                        <div className="section-body">
                        {Object.keys(todayAreaLog).length > 0 || Object.keys(todayRepLog).length > 0 ? (
                            <div className="identity-log-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Object.entries(todayAreaLog).map(([areaId, entry]) => {
                                    const areaName = areas[areaId] || areaId;
                                    const isExpanded = expandedAreas[areaId];
                                    const areaGroups = completedGroups[areaId] || {};
                                    const isDone = entry.status === 'done';

                                    return (
                                        <div key={areaId} className="identity-log-container">
                                            <div 
                                                className={`identity-log-item liquid-glass ${isExpanded ? 'active' : ''}`} 
                                                onClick={() => toggleAreaExpansion(areaId)}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    fontSize: '14px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    opacity: isDone ? 1 : 0.85
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                                                        {isDone ? '✓' : '•'} {areaName}
                                                    </span>
                                                    <span style={{ 
                                                        fontSize: '10px', 
                                                        opacity: 0.5,
                                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.2s ease'
                                                    }}>▶</span>
                                                </div>
                                                <span style={{ color: 'var(--color-primary)', fontWeight: '700' }}>
                                                    {isDone ? `× ${entry.count}` : 'Activity'}
                                                </span>
                                            </div>

                                            {isExpanded && (
                                                <div className="area-details">
                                                    {Object.entries(areaGroups).map(([skillId, skillGroup]) => (
                                                        <div key={skillId} className="skill-group">
                                                            <div className="skill-group-header">
                                                                <span className="skill-group-name">{skillGroup.name}</span>
                                                            </div>
                                                            <div className="skill-task-list">
                                                                {skillGroup.tasks.map(task => (
                                                                    <div key={task.id} className="completed-task-item">
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span className="task-title">{task.name}</span>
                                                                            {task.status === 'in_progress' && (
                                                                                <span className="identity-badge-inprogress">In Progress</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="task-meta">
                                                                            {task.sessionMinutes > 0 && (
                                                                                <span className="task-session-minutes">
                                                                                    {(() => {
                                                                                        const mins = task.sessionMinutes;
                                                                                        if (mins >= 60) {
                                                                                            const h = Math.floor(mins / 60);
                                                                                            const m = mins % 60;
                                                                                            return `${h}h ${m}m`;
                                                                                        }
                                                                                        return `${mins}m`;
                                                                                    })()} focus
                                                                                </span>
                                                                            )}
                                                                            <span className="task-completion-time">
                                                                                {new Date(task.completionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {Object.keys(areaGroups).length === 0 && (
                                                        <div className="no-tasks-hint">No direct task completions detected for this area today.</div>
                                                    )}
                                                </div>
                                            )}
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
                    )}
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
