import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ArrowLeft, ExternalLink, Save, Trash2, Globe, DollarSign, Calendar } from 'lucide-react';

const WealthItemDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { state, updateWealthItem, deleteWealthItem } = useStore();

    // Find item from store
    const item = state.wealthItems?.[id];

    // Local state for notes to handle editing smoothly
    const [notes, setNotes] = useState('');
    const [isEditingNotes, setIsEditingNotes] = useState(false);

    useEffect(() => {
        if (item) {
            setNotes(item.notes || '');
        }
    }, [item]);

    if (!item) {
        return (
            <div style={{ padding: '2rem', color: 'white' }}>
                <h2>Item not found</h2>
                <button onClick={() => navigate('/trackers/wealth')} style={{ marginTop: '1rem', background: 'var(--color-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                    Return to Wealth Tracker
                </button>
            </div>
        );
    }

    const handleSaveNotes = () => {
        updateWealthItem(id, { notes });
        setIsEditingNotes(false);
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this item?')) {
            deleteWealthItem(id);
            navigate('/trackers/wealth');
        }
    };

    // Helper to render notes with clickable links
    const renderNotes = (text) => {
        if (!text) return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No notes or links yet. Click to add...</span>;

        // Split by lines
        return text.split('\n').map((line, i) => {
            // Regex for URLs
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const parts = line.split(urlRegex);

            return (
                <div key={i} style={{ minHeight: '1.2em' }}>
                    {parts.map((part, j) => {
                        if (part.match(urlRegex)) {
                            return (
                                <a
                                    key={j}
                                    href={part}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ color: '#60a5fa', textDecoration: 'underline' }}
                                >
                                    {part}
                                </a>
                            );
                        }
                        return part;
                    })}
                </div>
            );
        });
    };

    const color = {
        'Essential': '#ef4444',
        'I want these': '#a855f7',
        'One-time wants': '#3b82f6',
        'Future investments': '#E6D5B8',
        'Everything': '#8b5cf6'
    }[item.category] || '#ffffff';

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'var(--color-text-main)' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, flex: 1 }}>
                    {item.name}
                </h1>
                <div style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: color + '22',
                    color: color,
                    fontSize: '12px',
                    fontWeight: '600'
                }}>
                    {item.category}
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>

                {/* Left Col: Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                        <h3 style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Details
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <DollarSign size={18} color={color} />
                            <div>
                                <div style={{ fontSize: '11px', opacity: 0.7 }}>Monthly Cost</div>
                                <div style={{ fontSize: '18px', fontWeight: '600' }}>{item.monthlyPayment}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <Calendar size={18} color={color} />
                            <div>
                                <div style={{ fontSize: '11px', opacity: 0.7 }}>Frequency</div>
                                <div style={{ fontSize: '14px' }}>{item.oneTime ? 'One-time Purchase' : 'Recurring Monthly'}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Globe size={18} color={color} />
                            <div>
                                <div style={{ fontSize: '11px', opacity: 0.7 }}>Source</div>
                                <div style={{ fontSize: '14px' }}>
                                    {/* Could eventually be a dedicated field, for now just static or from notes */}
                                    -
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleDelete}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '12px', width: '100%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: 'none', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: '500'
                        }}
                    >
                        <Trash2 size={16} /> Delete Item
                    </button>
                </div>

                {/* Right Col: Notes & Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Purchase Links & Notes
                        </h3>
                        {isEditingNotes && (
                            <button
                                onClick={handleSaveNotes}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    background: 'var(--color-primary)', color: 'white',
                                    border: 'none', padding: '6px 12px', borderRadius: '6px',
                                    cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                                }}
                            >
                                <Save size={14} /> Save
                            </button>
                        )}
                    </div>

                    {isEditingNotes ? (
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onBlur={handleSaveNotes}
                            placeholder="Paste links (e.g., Amazon, Apple) here..."
                            style={{
                                width: '100%', minHeight: '400px',
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '1rem',
                                color: 'var(--color-text-main)',
                                fontSize: '14px',
                                lineHeight: '1.6',
                                outline: 'none',
                                resize: 'vertical'
                            }}
                            autoFocus
                        />
                    ) : (
                        <div
                            onClick={() => setIsEditingNotes(true)}
                            title="Click to edit"
                            style={{
                                width: '100%', minHeight: '400px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid transparent',
                                borderRadius: '8px',
                                padding: '1rem',
                                color: 'var(--color-text-main)',
                                fontSize: '14px',
                                lineHeight: '1.6',
                                cursor: 'text',
                                whiteSpace: 'pre-wrap'
                            }}
                        >
                            {renderNotes(notes)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WealthItemDetail;
