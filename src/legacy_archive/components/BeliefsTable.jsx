import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash2, CheckCircle, Circle, ChevronDown, ChevronRight, LayoutList, Clock, PauseCircle, CheckCircle2, RotateCw, CheckSquare, Calendar, Check, Brain, Sparkles, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

// Define options for headers/selects to match the visual style
const METHODS = [
    { label: 'Subconscious Guide', color: '#818cf8' }, // Indigo
    { label: 'Conscious Shift', color: '#f87171' }     // Red
];

const STATUSES = [
    { id: 'active', label: 'Active', color: '#ef4444' }, // Red
    { id: 'done', label: 'Done', color: '#10b981' }      // Green
];

const BeliefsTable = () => {
    const { state, addBelief, deleteBelief, updateBelief, addBeliefTopic, deleteBeliefTopic, updateBeliefTopic } = useStore();
    const navigate = useNavigate();

    const [editingItem, setEditingItem] = useState(null); // { type: 'topic' | 'belief', id: string, tempValue: string }
    const [expandedTopics, setExpandedTopics] = useState({});

    // --- MIGRATION LOGIC (Preserved) ---
    const customTopics = Object.values(state.beliefTopics || {});
    const beliefs = Object.values(state.beliefs || {});

    useEffect(() => {
        const uniqueStringTopics = new Set();
        beliefs.forEach(b => {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.topic);
            const topicMeta = customTopics.find(t => t.id === b.topic);
            if ((!isUUID || !topicMeta) && b.topic) {
                uniqueStringTopics.add(b.topic);
            }
        });

        uniqueStringTopics.forEach(topicName => {
            const existingTopic = customTopics.find(t => t.name === topicName);
            let targetId = existingTopic ? existingTopic.id : addBeliefTopic(topicName, '🏷️', '#ffffff');
            beliefs.filter(b => b.topic === topicName).forEach(b => {
                updateBelief(b.id, { topic: targetId });
            });
        });
    }, [beliefs.length, customTopics.length]);

    // Initialize expanded state
    useEffect(() => {
        const initial = {};
        customTopics.forEach(t => initial[t.id] = true);
        initial['uncategorized'] = true;
        setExpandedTopics(prev => ({ ...prev, ...initial }));
    }, [state.beliefTopics]);

    const toggleExpand = (id) => {
        setExpandedTopics(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Editing Logic
    const startEditing = (type, item, e) => {
        e.stopPropagation();
        setEditingItem({ type, id: item.id, tempValue: type === 'topic' ? item.name : item.statement });
    };

    const handleEditChange = (e) => {
        setEditingItem(prev => ({ ...prev, tempValue: e.target.value }));
    };

    const saveEdit = () => {
        if (!editingItem) return;
        const trimmed = editingItem.tempValue.trim();

        if (editingItem.type === 'topic') {
            updateBeliefTopic(editingItem.id, { name: trimmed || 'Untitled Topic' });
        } else if (editingItem.type === 'belief') {
            updateBelief(editingItem.id, { statement: trimmed || 'Untitled Belief' });
        }
        setEditingItem(null);
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') saveEdit();
        else if (e.key === 'Escape') setEditingItem(null);
    };

    // Creation Logic
    const handleAddTopic = () => {
        const id = addBeliefTopic('', '🏷️', '#ffffff');
        setEditingItem({ type: 'topic', id, tempValue: '' });
        setExpandedTopics(prev => ({ ...prev, [id]: true }));
    };

    const handleAddBelief = (topicId) => {
        const id = addBelief();
        // If topicId is 'uncategorized', use legacy string or create a default topic? 
        // For now, if 'uncategorized' (which shouldn't happen often if we just created a topic), use '' or handle in migration.
        // Actually, let's just set it to the topicId if it's a real UUID, else default.
        const safeTopic = topicId === 'uncategorized' ? 'General' : topicId;
        updateBelief(id, { topic: safeTopic, statement: '' });
        setEditingItem({ type: 'belief', id, tempValue: '' });
    };

    const handleRenameUncategorized = (newName) => {
        if (!newName.trim()) return;
        const existingTopic = customTopics.find(t => t.name.toLowerCase() === newName.trim().toLowerCase());
        let targetId = existingTopic ? existingTopic.id : addBeliefTopic(newName.trim(), '🏷️', '#ffffff');

        const uncategorizedBeliefs = beliefsByTopic['uncategorized'] || [];
        uncategorizedBeliefs.forEach(b => updateBelief(b.id, { topic: targetId }));

        setExpandedTopics(prev => ({ ...prev, [targetId]: true }));
    };

    // Grouping
    const beliefsByTopic = beliefs.reduce((acc, belief) => {
        const matchedTopic = customTopics.find(t => t.id === belief.topic);
        const resolvedId = matchedTopic ? matchedTopic.id : 'uncategorized';
        if (!acc[resolvedId]) acc[resolvedId] = [];
        acc[resolvedId].push(belief);
        return acc;
    }, {});


    const renderTopicSection = (topic) => {
        const topicBeliefs = beliefsByTopic[topic.id] || [];
        const isExpanded = expandedTopics[topic.id] !== false;
        const isUncategorized = topic.id === 'uncategorized';

        if (isUncategorized && topicBeliefs.length === 0) return null;

        return (
            <div key={topic.id} style={{ marginBottom: '12px' }}>
                {/* Objective/Topic Row */}
                <div
                    onClick={() => toggleExpand(topic.id)}
                    className="objective-row"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 1fr 100px 140px 140px 40px', // Adjusted to match similar width distribution
                        gap: '12px',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        marginBottom: '4px',
                        alignItems: 'center',
                        borderRadius: '12px',
                        background: 'transparent'
                    }}
                >
                    {/* Expand + Title Column (spanning 2 columns in grid) */}
                    <div style={{ display: 'flex', alignItems: 'center', gridColumn: '1 / span 2', gap: '8px' }}>
                        {isExpanded ? <ChevronDown size={14} color="rgba(255,255,255,0.5)" /> : <ChevronRight size={14} color="rgba(255,255,255,0.5)" />}
                        <Target size={14} style={{ color: '#be123c' }} />

                        {isUncategorized ? (
                            <input
                                value="Uncategorized"
                                placeholder="Rename to create category..."
                                onChange={(e) => handleRenameUncategorized(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
                                    fontSize: '14px', fontWeight: '600', outline: 'none', width: '100%', fontStyle: 'italic'
                                }}
                            />
                        ) : (
                            editingItem?.type === 'topic' && editingItem.id === topic.id ? (
                                <input
                                    autoFocus
                                    value={editingItem.tempValue}
                                    onChange={handleEditChange}
                                    onBlur={saveEdit}
                                    onKeyDown={handleEditKeyDown}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        background: 'transparent', border: 'none', color: '#fff',
                                        fontSize: '14px', fontWeight: '600', outline: 'none', width: '100%', fontFamily: 'inherit'
                                    }}
                                />
                            ) : (
                                <span
                                    onClick={(e) => startEditing('topic', topic, e)}
                                    style={{ fontWeight: '600', fontSize: '14px', color: '#fff', cursor: 'text', width: '100%' }}
                                >
                                    {topic.name || 'Untitled'}
                                </span>
                            )
                        )}
                    </div>

                    {/* Headers mirroring the screenshot content but for Beliefs */}
                    <div style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', textAlign: 'center', fontWeight: '600' }}>SESSIONS</div>
                    <div style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', textAlign: 'center', fontWeight: '600' }}>SCENE</div>
                    <div style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', textAlign: 'center', fontWeight: '600' }}>METHOD</div>

                    {!isUncategorized && (
                        <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete topic?')) deleteBeliefTopic(topic.id); }}
                            className="objective-delete-btn"
                            style={{ color: 'rgba(255,255,255,0.4)', opacity: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>

                {/* Belief Rows */}
                {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {topicBeliefs.map((belief, index) => (
                            <div
                                key={belief.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '140px 1fr 100px 140px 140px 40px', // Matches Topic Row
                                    gap: '12px',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    backgroundColor: 'transparent', // Transparent by default
                                    borderRadius: '12px',
                                    border: '1px solid transparent', // No border by default
                                    transition: 'all 0.2s',
                                    marginBottom: '2px', // Tight vertical spacing
                                    cursor: 'pointer'
                                }}
                                onClick={() => navigate('/beliefs/' + belief.id)}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.border = '1px solid transparent';
                                    e.currentTarget.style.transform = 'none';
                                }}
                            >
                                {/* Column 1: Status Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const nextStatus = {
                                                'not-started': 'active',
                                                'active': 'paused',
                                                'paused': 'not-started'
                                            }[belief.status || 'not-started'] || 'active';
                                            updateBelief(belief.id, { status: nextStatus });
                                        }}
                                        style={{
                                            background: {
                                                'active': 'rgba(59, 130, 246, 0.15)', // Blue
                                                'paused': 'rgba(148, 163, 184, 0.15)', // Grey
                                                'not-started': 'rgba(239, 68, 68, 0.15)' // Red
                                            }[belief.status || 'not-started'],
                                            border: '1px solid ' + {
                                                'active': 'rgba(59, 130, 246, 0.2)',
                                                'paused': 'rgba(148, 163, 184, 0.2)',
                                                'not-started': 'rgba(239, 68, 68, 0.2)'
                                            }[belief.status || 'not-started'],
                                            color: {
                                                'active': '#60a5fa', // Blue
                                                'paused': '#94a3b8', // Grey
                                                'not-started': '#f87171' // Red
                                            }[belief.status || 'not-started'],
                                            fontSize: '9px',
                                            fontWeight: '700',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            width: '100px',
                                            whiteSpace: 'nowrap',
                                            textAlign: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {(belief.status || 'not-started').replace('-', ' ')}
                                    </button>
                                </div>

                                {/* Column 2: Statement (Title) */}
                                <div style={{
                                    color: 'rgba(255,255,255,0.9)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                    <RotateCw size={12} style={{ color: 'rgba(255,255,255,0.3)', minWidth: '12px' }} />
                                    {editingItem?.type === 'belief' && editingItem.id === belief.id ? (
                                        <input
                                            autoFocus
                                            value={editingItem.tempValue}
                                            onChange={handleEditChange}
                                            onBlur={saveEdit}
                                            onKeyDown={handleEditKeyDown}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                                                fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'inherit',
                                                padding: '4px 8px', borderRadius: '4px'
                                            }}
                                        />
                                    ) : (
                                        <span
                                            onClick={(e) => startEditing('belief', belief, e)}
                                            style={{ cursor: 'text', width: '100%' }}
                                        >
                                            {belief.statement || 'Empowerment Statement...'}
                                        </span>
                                    )}
                                </div>

                                {/* Column 3: Sessions (Count) */}
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: '13px', textAlign: 'center', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}
                                >
                                    {(belief.sessions || []).length} sess
                                </div>

                                <div
                                    style={{ display: 'flex', justifyContent: 'center' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        value={belief.scene || ''}
                                        onChange={(e) => updateBelief(belief.id, { scene: e.target.value })}
                                        placeholder="Scene..."
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: 'none',
                                            color: 'rgba(255,255,255,0.8)',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                            padding: '6px 10px',
                                            borderRadius: '6px',
                                            width: '100%',
                                            textAlign: 'center',
                                            outline: 'none',
                                            transition: 'background 0.2s'
                                        }}
                                        onFocus={e => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                                        onBlur={e => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                                    />
                                </div>

                                {/* Column 5: Method */}
                                <div onClick={(e) => e.stopPropagation()}>
                                    <select
                                        value={belief.mentalDietApproach || 'subconscious-guide'}
                                        onChange={(e) => updateBelief(belief.id, { mentalDietApproach: e.target.value })}
                                        style={{
                                            background: METHODS.find(m => m.label === (belief.mentalDietApproach === 'conscious-shift' ? 'Conscious Shift' : 'Subconscious Guide'))?.color + '26',
                                            border: 'none',
                                            color: METHODS.find(m => m.label === (belief.mentalDietApproach === 'conscious-shift' ? 'Conscious Shift' : 'Subconscious Guide'))?.color || '#fff',
                                            fontSize: '11px',
                                            padding: '6px 10px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            width: '100%',
                                            outline: 'none',
                                            textAlign: 'center',
                                            appearance: 'none',
                                            fontWeight: '600'
                                        }}
                                    >
                                        <option value="subconscious-guide" style={{ background: '#1e1e1e', color: '#fff' }}>Subconscious Guide</option>
                                        <option value="conscious-shift" style={{ background: '#1e1e1e', color: '#fff' }}>Conscious Shift</option>
                                    </select>
                                </div>

                                {/* Column 6: Actions */}
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete belief?')) deleteBelief(belief.id); }}
                                        className="objective-delete-btn"
                                        style={{ color: '#ef4444', opacity: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Add Task Row */}
                        <div
                            onClick={() => handleAddBelief(topic.id)}
                            style={{
                                display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer',
                                color: 'rgba(255,255,255,0.4)', fontSize: '12px', gap: '8px',
                                borderTop: 'none',
                                background: 'transparent',
                                transition: 'color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                        >
                            <Plus size={14} /> Add new belief
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ marginTop: '0', color: 'var(--color-text-main)' }}>
            <style>{`
                .finance-task-row button { opacity: 0; transition: opacity 0.2s; }
                .finance-task-row:hover button { opacity: 1 !important; }
                .objective-row .objective-delete-btn { opacity: 0; transition: opacity 0.2s; }
                .objective-row:hover .objective-delete-btn { opacity: 1 !important; }
                .finance-task-row:hover { background-color: rgba(255, 255, 255, 0.05) !important; }
                select:hover, input:hover { background-color: rgba(255, 255, 255, 0.08) !important; }
            `}</style>

            {/* Button moved to parent Layout (AreaDetail.jsx) */}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {customTopics.map(renderTopicSection)}
                {renderTopicSection({ id: 'uncategorized', name: 'Uncategorized' })}
            </div>
        </div>
    );
};

export default BeliefsTable;
