import React, { useState, useEffect } from 'react';
import { Book, ChevronLeft, ChevronRight, Moon, Pill, HeartPulse, CheckSquare, ListChecks, Trophy, Plus, Sparkles, Activity, Brain } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import WarheadChat from '../components/WarheadChat';
import { getTodayString, formatDisplayDate, getDateString, parseDateString, getCycleType } from '../utils/dateUtils';
import { backbone, NodeTypes, TaskStatuses } from '../backbone-v2';

// Helper to format seconds into h m
const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

const Journal = () => {
    const { state, updateJournal, addAvailableMed } = useStore();
    const [backboneNodes, setBackboneNodes] = useState([]);

    // Load Backbone nodes
    useEffect(() => {
        const load = async () => {
            const nodes = await backbone.getAllNodes();
            setBackboneNodes(nodes);
        };
        load();
    }, [state.manualSavePing]); // Refresh when store thinks it saved or periodically

    // Cycle Logic (Mirrors dateUtils)
    const getCycleMode = (date) => {
        const type = getCycleType(date);
        if (type === 'work1') return { label: 'Work 1', color: 'rgba(255,255,255,0.7)', bg: 'rgba(64, 64, 64, 0.5)' };
        if (type === 'work2') return { label: 'Work 2', color: 'rgba(255,255,255,0.7)', bg: 'rgba(64, 64, 64, 0.5)' };
        return { label: 'Light Day', color: 'rgba(255,255,255,0.9)', bg: 'rgba(64, 64, 64, 0.5)' };
    };

    const [activeTab, setActiveTab] = useState('All');
    const [selectedDate, setSelectedDate] = useState(() => getTodayString());

    const handleDateChange = (days) => {
        const d = parseDateString(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(getDateString(d));
    };

    const [isMedsExpanded, setIsMedsExpanded] = useState(false);

    // Get entry for selected date or default
    const entry = state.journal?.[selectedDate] || {
        accomplishments: '',
        sleepStart: '',
        sleepEnd: '',
        meds: [],
        symptoms: '',
        moodOverview: '',
        anxietyLevel: 5,
        overthinkingLevel: 5,
        unusualEvents: [],
        journalText: ''
    };

    const AVAILABLE_MEDS = state.availableMeds || ['Sertralina', 'Olanzapina', 'Vita AO', 'Cormin', 'Atomoxetina'];

    const updateEntry = (updates) => {
        updateJournal(selectedDate, updates);
    };

    const toggleMed = (med) => {
        const currentMeds = entry.meds || [];
        const newMeds = currentMeds.includes(med)
            ? currentMeds.filter(m => m !== med)
            : [...currentMeds, med];
        updateEntry({ meds: newMeds });
    };

    // --- Harvesting from Backbone V2 ---

    // Helper to check if an ISO timestamp matches the selected logical date (4am shift)
    const matchesSelectedDate = (isoString) => {
        if (!isoString) return false;
        const date = new Date(isoString);
        // Apply 4am logical day shift
        date.setHours(date.getHours() - 4);
        return getDateString(date) === selectedDate;
    };

    // 1. Completed Tasks from Backbone
    const completedTasksV2 = backboneNodes
        .filter(n => n.type === NodeTypes.TASK && matchesSelectedDate(n.metadata?.completedAt))
        .map(n => ({
            id: n.id,
            title: n.name,
            type: 'Task',
            area: 'Backbone', // Area names currently hard to resolve perfectly without tree traversal
            icon: '✅',
            duration: (n.metadata?.sessions || []).reduce((acc, s) => acc + (s.actualDuration || 0), 0)
        }));

    // 2. Sessions from Backbone
    const sessionsV2 = [];
    backboneNodes.filter(n => n.type === NodeTypes.TASK).forEach(task => {
        (task.metadata?.sessions || []).forEach(sess => {
            // Check endedAt (ISO) or startTime (Timestamp) if not ended
            const sessionTime = sess.endedAt || (sess.startTime ? new Date(sess.startTime).toISOString() : null);
            if (matchesSelectedDate(sessionTime) && sess.status === 'completed') {
                sessionsV2.push({
                    id: task.id + '-' + sess.id,
                    title: `Session: ${task.name}`,
                    type: 'Session',
                    area: 'Focus',
                    icon: '🕒',
                    duration: sess.actualDuration || 0
                });
            }
        });
    });

    // Unified Activities (V2 only as requested)
    const filteredActivities = [
        ...completedTasksV2,
        ...sessionsV2
    ].filter((a, idx, self) => {
        if (activeTab !== 'All' && a.type !== activeTab) return false;
        // Avoid double counting task vs its session if showing 'All'
        return self.findIndex(t => t.id === a.id) === idx;
    });

    return (
        <div className="journal-page" style={{ padding: '0 40px', paddingTop: '40px', color: 'white' }}>
            {/* Top Navigation Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.4, fontSize: '13px' }}>
                    <div className="notion-breadcrumb-item" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <Book size={14} /> <span>Apps</span>
                    </div>
                    <span>/</span>
                    <div className="notion-breadcrumb-item" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <ListChecks size={14} /> <span>Trackers</span>
                    </div>
                    <span>/</span>
                    <span style={{ color: 'white', fontWeight: '400', opacity: 0.9 }}>Daily Log</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.4, fontSize: '12px' }}>
                        <span>Edited</span>
                        <span style={{ fontWeight: '500' }}>Dec 23, 2026</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.02)' }}>
                        <button onClick={() => handleDateChange(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', opacity: 0.4 }}><ChevronLeft size={16} /></button>
                        <span style={{ fontSize: '13px', fontWeight: '500', minWidth: '120px', textAlign: 'center' }}>
                            {formatDisplayDate(selectedDate)}
                        </span>
                        <button onClick={() => handleDateChange(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', opacity: 0.4 }}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
                <h1 className="premium-page-title text-gradient-white">
                    Daily Log
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', opacity: 0.6, marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckSquare size={16} color="#0f0" />
                        <span style={{ fontSize: '14px' }}><b>{completedTasksV2.length}</b> Tasks Done</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={16} color="#0cf" />
                        <span style={{ fontSize: '14px' }}><b>{sessionsV2.length}</b> Sessions</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Brain size={16} color="#f8f" />
                        <span style={{ fontSize: '14px' }}><b>{formatDuration([...completedTasksV2, ...sessionsV2].reduce((acc, i) => acc + i.duration, 0))}</b> Total Work</span>
                    </div>
                </div>
            </div>

            {/* Main Dashboard Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 360px',
                gap: '60px',
                alignItems: 'start'
            }}>

                {/* Column 1: Activity Table (Now much larger and primary) */}
                <section style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="notion-tabs">
                        <div className={`notion-tab-item ${activeTab === 'All' ? 'active' : ''}`} onClick={() => setActiveTab('All')}>All Activity</div>
                        <div className={`notion-tab-item ${activeTab === 'Task' ? 'active' : ''}`} onClick={() => setActiveTab('Task')}>Tasks</div>
                        <div className={`notion-tab-item ${activeTab === 'Session' ? 'active' : ''}`} onClick={() => setActiveTab('Session')}>Sessions</div>
                    </div>

                    <div style={{ overflow: 'visible' }}>
                        {filteredActivities.length > 0 ? (
                            <table className="premium-activity-list">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40%' }}>Object</th>
                                        <th style={{ width: '15%' }}>Time</th>
                                        <th style={{ width: '20%' }}>Type</th>
                                        <th style={{ width: '25%' }}>Area</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredActivities.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <div className="list-icon-wrapper">
                                                        {item.icon || '📄'}
                                                    </div>
                                                    <span style={{ fontWeight: '500', fontSize: '15px', letterSpacing: '-0.01em' }}>{item.title}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '13px', opacity: 0.4, fontWeight: '600' }}>
                                                    {item.type !== 'Habit' ? formatDuration(item.duration) : '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`notion-tag ${item.type === 'Habit' ? 'tag-purple' :
                                                    item.type === 'Task' ? 'tag-blue' :
                                                        item.type === 'Activity' ? 'tag-green' :
                                                            'tag-gold'
                                                    }`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td><span className="notion-tag tag-gray">{item.area}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '80px 20px', textAlign: 'center', opacity: 0.3 }}>
                                <p style={{ fontSize: '16px', letterSpacing: '0.01em' }}>No active objects for this cycle.</p>
                            </div>
                        )}
                        <div className="notion-new-row" style={{ marginTop: '12px', opacity: 0.2 }}>
                            <Plus size={14} /> New entry
                        </div>
                    </div>

                    {/* Journaling Section - Added below the table */}
                    <div className="liquid-glass" style={{
                        marginTop: '40px',
                        padding: '32px',
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.6)' }}>
                            <Book size={18} />
                            <h3 style={{ fontSize: '16px', fontWeight: '600', letterSpacing: '0.02em', color: 'white' }}>Daily Journal</h3>
                        </div>

                        <textarea
                            className="notion-input"
                            value={entry.journalText || ''}
                            onChange={(e) => updateEntry({ journalText: e.target.value })}
                            placeholder="What's on your mind? Capture your thoughts, feelings, or synchronicities for Warhead to analyze..."
                            style={{
                                width: '100%',
                                minHeight: '200px',
                                background: 'rgba(0,0,0,0.15)',
                                borderRadius: '12px',
                                padding: '20px',
                                border: '1px solid rgba(255,255,255,0.04)',
                                color: 'white',
                                fontSize: '15px',
                                lineHeight: '1.6',
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.3, fontSize: '11px' }}>
                            <Sparkles size={12} />
                            <span>Warhead has access to these entries to find patterns in your behavior and manifests.</span>
                        </div>
                    </div>
                </section>

                {/* Column 2: Side Panel (Properties, Accomplishments, Intelligence) */}
                <aside className="liquid-glass premium-sidebar-shadow" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0px',
                    borderRadius: '24px',
                    padding: '32px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                }}>

                    {/* Core Health Properties */}
                    <div style={{ paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.25)', marginBottom: '16px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Metrics</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.45)', fontSize: '13px', minWidth: '100px' }}>
                                    <Moon size={13} style={{ opacity: 0.6 }} /> <span>Sleep</span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', paddingRight: '8px' }}>
                                        <input
                                            className="notion-input"
                                            value={entry.sleepStart || ''}
                                            onChange={(e) => updateEntry({ sleepStart: e.target.value })}
                                            placeholder="11"
                                            style={{ width: '38px', fontSize: '13px', color: 'white', textAlign: 'center', padding: '4px 0' }}
                                        />
                                        <span style={{ fontSize: '9px', fontWeight: '800', opacity: 0.3, letterSpacing: '0.05em' }}>PM</span>
                                    </div>
                                    <span style={{ opacity: 0.2, fontSize: '12px' }}>→</span>
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', paddingRight: '8px' }}>
                                        <input
                                            className="notion-input"
                                            value={entry.sleepEnd || ''}
                                            onChange={(e) => updateEntry({ sleepEnd: e.target.value })}
                                            placeholder="7"
                                            style={{ width: '38px', fontSize: '13px', color: 'white', textAlign: 'center', padding: '4px 0' }}
                                        />
                                        <span style={{ fontSize: '9px', fontWeight: '800', opacity: 0.3, letterSpacing: '0.05em' }}>AM</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.45)', fontSize: '13px', minWidth: '100px' }}>
                                    <Activity size={13} style={{ opacity: 0.6 }} /> <span>Anxiety</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    className="range-liquid"
                                    value={entry.anxietyLevel || 5}
                                    onChange={(e) => updateEntry({ anxietyLevel: parseInt(e.target.value) })}
                                    style={{ flex: 1, height: '4px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.45)', fontSize: '13px', minWidth: '100px' }}>
                                    <Brain size={13} style={{ opacity: 0.6 }} /> <span>Overthinking</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    className="range-liquid"
                                    value={entry.overthinkingLevel || 5}
                                    onChange={(e) => updateEntry({ overthinkingLevel: parseInt(e.target.value) })}
                                    style={{ flex: 1, height: '4px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.45)', fontSize: '13px', minWidth: '100px', marginTop: '2px' }}>
                                    <Pill size={13} style={{ opacity: 0.6 }} /> <span>Meds</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                                    {AVAILABLE_MEDS.map(m => {
                                        const isTaken = (entry.meds || []).includes(m);
                                        return (
                                            <span
                                                key={m}
                                                className={`notion-tag ${isTaken ? 'tag-blue' : 'tag-gray'}`}
                                                style={{
                                                    fontSize: '11px',
                                                    padding: '2px 8px',
                                                    cursor: 'pointer',
                                                    opacity: isTaken ? 1 : 0.4,
                                                    border: isTaken ? '1px solid rgba(153, 204, 255, 0.2)' : '1px solid transparent',
                                                    transition: 'all 0.1s ease-out',
                                                    userSelect: 'none'
                                                }}
                                                onClick={() => toggleMed(m)}
                                            >
                                                {m}
                                            </span>
                                        );
                                    })}
                                    <span
                                        className="notion-tag tag-gray"
                                        style={{ fontSize: '11px', padding: '2px 8px', border: '1px dashed rgba(255,255,255,0.15)', cursor: 'pointer', opacity: 0.3 }}
                                        onClick={() => { const m = prompt("New Med:"); if (m && !AVAILABLE_MEDS.includes(m)) addAvailableMed(m); }}
                                    >
                                        +
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div style={{ paddingTop: '24px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Unusual events</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="+ New entry"
                                className="notion-input"
                                style={{
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: '13px',
                                    padding: '6px 8px',
                                    background: 'rgba(0,0,0,0.15)',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(255,255,255,0.04)'
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        updateEntry({ unusualEvents: [...(entry.unusualEvents || []), { id: Date.now().toString(), description: e.target.value.trim() }] });
                                        e.target.value = '';
                                    }
                                }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                {entry.unusualEvents?.map((event, idx) => (
                                    <div key={idx} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'flex', gap: '8px', paddingLeft: '4px' }}>
                                        <span style={{ opacity: 0.3 }}>•</span> {event.description}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

        </div>
    );
};

export default Journal;
