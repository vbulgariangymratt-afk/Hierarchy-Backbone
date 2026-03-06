import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { getLogicalDate, getTodayString } from '../utils/dateUtils';
import { X, Search } from 'lucide-react';

const DebugView = ({ onClose }) => {
    const { state, dispatch } = useStore();
    const [search, setSearch] = useState('');
    const todayStr = getTodayString();
    const [repairCount, setRepairCount] = useState(0);

    const completedTasks = useMemo(() => {
        return Object.values(state.tasks || {})
            .filter(t => t.isCompleted)
            .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    }, [state.tasks]);

    const logs = useMemo(() => {
        return (state.logs || [])
            .filter(l => l.type === 'TASK_TOGGLED' || l.type === 'TASK_COMPLETED_SESSION')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [state.logs]);

    const filteredTasks = completedTasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

    const runRepair = () => {
        const missing = [];
        completedTasks.forEach(task => {
            const hasLog = logs.some(l => l.taskId === task.id);
            if (!hasLog) {
                missing.push({
                    id: crypto.randomUUID(), // Use native randomUUID 
                    type: 'TASK_TOGGLED',
                    taskId: task.id,
                    taskTitle: task.title,
                    isCompleted: true,
                    timestamp: task.completedAt && task.completedAt.includes('T') ? task.completedAt : `${task.completedAt}T12:00:00.000Z`,
                    sessionDuration: 0
                });
            }
        });

        if (missing.length > 0) {
            dispatch({
                type: 'SYSTEM_ADD_LOGS',
                payload: missing
            });
            // Also force a save via a dummy action or just rely on the state change
            // We can trigger a manual save ping if we had access to it, but state change should suffice.
            setRepairCount(missing.length);
        } else {
            alert("No missing logs found!");
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 9999,
            padding: '2rem',
            overflow: 'auto',
            color: '#fff',
            fontFamily: 'monospace'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
                    <div>
                        <h2 className="text-2xl font-bold text-red-500">🐞 Data Diagnosis</h2>
                        <p className="text-gray-400">Total Completed Tasks: {completedTasks.length}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={runRepair}
                            style={{
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            🛠 FIX MISSING DATA ({completedTasks.filter(t => !logs.some(l => l.taskId === t.id)).length})
                        </button>
                        <button onClick={onClose}><X /></button>
                    </div>
                </div>

                {repairCount > 0 && (
                    <div style={{ padding: '1rem', background: '#4CAF50', color: 'white', marginBottom: '1rem', borderRadius: '8px' }}>
                        ✅ Successfully restored {repairCount} missing logs! Check the list below (it should turn green).
                    </div>
                )}


                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
                    <Search color="#999" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search for missing task title..."
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', width: '100%' }}
                        autoFocus
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* LEFT: COMPLETED TASKS (The Source of Truth) */}
                    <div>
                        <h3 style={{ color: '#888', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                            Completed Tasks (Raw Data)
                        </h3>
                        {filteredTasks.map(task => {
                            const logicalDate = getLogicalDate(task.completedAt);
                            const isToday = logicalDate === todayStr;

                            // Find matching log
                            const matchingLog = logs.find(l => l.taskId === task.id);

                            return (
                                <div key={task.id} style={{
                                    padding: '1rem',
                                    background: isToday ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    marginBottom: '0.5rem',
                                    borderRadius: '8px',
                                    border: matchingLog ? '1px solid #333' : '1px solid red' // Highlight missing logs
                                }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{task.title}</div>
                                    <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                        ID: {task.id.slice(0, 8)}...<br />
                                        CompletedAt: <span style={{ color: '#fff' }}>{task.completedAt}</span><br />
                                        Logical Day: {logicalDate} {isToday ? '(Today)' : `(Expect: ${todayStr})`}<br />
                                        Match Log: {matchingLog ? '✅ Found' : '❌ MISSING'}
                                    </div>
                                    {!matchingLog && (
                                        <div style={{ color: 'red', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                            ⚠ This task has no log entry! It will NOT show in history.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* RIGHT: LOGS (What DashboardStats sees) */}
                    <div>
                        <h3 style={{ color: '#888', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                            Task Logs (DashboardStats Source)
                        </h3>
                        {logs.slice(0, 50).map(log => (
                            <div key={log.id} style={{
                                padding: '0.5rem',
                                borderBottom: '1px solid #333',
                                fontSize: '0.85rem'
                            }}>
                                <span style={{ color: '#888' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>{' '}
                                <span style={{ color: '#4CAF50' }}>{log.type}</span><br />
                                TaskID: {log.taskId}<br />
                                Title: {log.taskTitle || '(No Title Cached)'}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugView;
