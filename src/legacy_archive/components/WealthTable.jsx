import React, { useState, useMemo } from 'react';
import { Plus, Trash2, CheckCircle, ChevronDown, ChevronUp, DollarSign, Briefcase, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';


const EditableMarkdownCell = ({ value, onChange, placeholder, style }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    // Update internal state if prop changes
    React.useEffect(() => {
        setEditValue(value);
    }, [value]);

    const handleBlur = () => {
        setIsEditing(false);
        onChange(editValue);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
    };

    if (isEditing) {
        return (
            <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder={placeholder}
                style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    color: 'white',
                    outline: 'none',
                    width: '100%',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    ...style
                }}
            />
        );
    }

    // Regex to match [Text](URL)
    const linkMatch = value && value.match(/^\[(.*?)\]\((.*?)\)$/);

    if (linkMatch) {
        return (
            <div
                onDoubleClick={() => setIsEditing(true)}
                title="Double-click to edit"
                style={{
                    ...style,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                <a
                    href={linkMatch[2]}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        color: 'rgba(255, 255, 255, 0.4)', // Grey as requested (faded white)
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}
                >
                    {linkMatch[1]}
                </a>
            </div>
        );
    }

    return (
        <div
            onDoubleClick={() => setIsEditing(true)}
            title="Double-click to edit"
            style={{
                ...style,
                cursor: 'text',
                minHeight: '20px',
                display: 'flex',
                alignItems: 'center',
                opacity: value ? 1 : 0.5
            }}
        >
            {value || placeholder}
        </div>
    );
};

const WealthTable = () => {
    const { state, addWealthItem, deleteWealthItem, updateWealthItem } = useStore();
    const [isHovered, setIsHovered] = useState(false);
    const showBackgrounds = state.showBackgrounds !== false;
    const isLight = state.themeMode === 'light';
    const WEALTH_CATEGORIES = [
        { id: 'Essential', label: 'Essential', color: '#ef4444' },
        { id: 'I want these', label: 'I want these', color: '#a855f7' },
        { id: 'One-time wants', label: 'One-time wants', color: '#3b82f6' },
        { id: 'Future investments', label: 'Future investments', color: isLight ? '#9a7b4f' : '#E6D5B8' },
        { id: 'Everything', label: 'Everything', color: '#8b5cf6' }
    ];
    const navigate = useNavigate();
    const [newItem, setNewItem] = useState({ category: 'Essential', name: '', monthlyPayment: '', skillId: '' });

    // ... (This content is just context, I need to match the specific lines)

    // Group items by category for potential future grouping, though screenshot shows flat list or filtered tabs?
    // Screenshot shows tabs at top: "Essentials", "I want these", etc.
    // Let's implement Tabs to filter the view.
    const [activeTab, setActiveTabState] = useState(() => {
        return localStorage.getItem('wealth_active_tab') || 'Essential';
    });

    const setActiveTab = (tab) => {
        setActiveTabState(tab);
        localStorage.setItem('wealth_active_tab', tab);
    };

    const wealthItems = Object.values(state.wealthItems || {});

    // Filter items based on active tab
    const filteredItems = useMemo(() => {
        if (activeTab === 'Everything') return wealthItems;
        return wealthItems.filter(item => item.category === activeTab);
    }, [wealthItems, activeTab]);

    const handleAddItem = () => {
        // Allow adding empty item to be edited in-place
        addWealthItem(activeTab === 'Everything' ? 'Essential' : activeTab, '', 0, '');
    };

    const getSkillName = (skillId) => {
        const skill = state.skills[skillId];
        return skill ? skill.name : 'Select Skill...';
    };

    const getAreaName = (skillId) => {
        const skill = state.skills[skillId];
        if (!skill) return 'Select Area...';
        const area = state.areas[skill.areaId];
        return area ? `Area = ${area.name}` : 'Unknown Area';
    };

    // Calculate totals
    const totalMonthly = filteredItems.reduce((acc, item) => acc + (item.monthlyPayment || 0), 0);
    const totalWeekly = totalMonthly / 4;
    const totalDaily = totalMonthly / 30;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                color: 'var(--color-text-main)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                padding: '32px',
                background: showBackgrounds ? 'rgba(0, 0, 0, 0.1)' : '#1e1e1e', // Medium Dark Glass or Solid 
                backdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                WebkitBackdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                boxShadow: !showBackgrounds
                    ? (isHovered
                        ? '0 30px 60px -12px rgba(0,0,0,0.7), 0 18px 36px -18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)'
                        : '0 20px 40px -12px rgba(0,0,0,0.5), 0 12px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)')
                    : (isHovered ? '0 40px 80px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.2)'),
                transform: isHovered ? 'translateY(-2px) scale(1.002)' : 'translateY(0) scale(1)',
                transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.4s ease',
                willChange: 'transform, box-shadow',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
            }}>
            <style>
                {`
                    .status-tab { 
                        padding: 6px 16px; 
                        border-radius: 99px; 
                        cursor: pointer; 
                        display: flex; 
                        align-items: center; 
                        gap: 8px; 
                        font-size: 13px; 
                        font-weight: 600; 
                        line-height: 1; 
                        transition: all 0.2s; 
                        color: rgba(255,255,255,0.4); 
                        border: 1px solid transparent;
                        background: transparent;
                        white-space: nowrap;
                    }
                    .status-tab:hover { 
                        background: rgba(255, 255, 255, 0.05); 
                        color: white; 
                    }
                    .status-tab.active { 
                        background: rgba(255, 255, 255, 0.08); 
                        color: white; 
                        border-color: rgba(255,255,255,0.1);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }
                    .wealth-row:hover {
                        background: rgba(255, 255, 255, 0.03) !important;
                    }
                `}
            </style>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                    {WEALTH_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={`status-tab ${activeTab === cat.id ? 'active' : ''}`}
                        >
                            {cat.label.toUpperCase()}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleAddItem}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        border: '1px solid rgba(231, 213, 201, 0.2)',
                        background: 'rgba(231, 213, 201, 0.08)',
                        color: '#e7d5c9',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(231, 213, 201, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(231, 213, 201, 0.4)';
                        e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(231, 213, 201, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(231, 213, 201, 0.2)';
                        e.currentTarget.style.color = '#e7d5c9';
                    }}
                >
                    <Plus size={14} /> NEW {activeTab === 'Everything' ? 'ITEM' : activeTab.toUpperCase().replace(/S$/, '')}
                </button>
            </div>

            {/* Table Header */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, auto) 2fr 100px 100px 100px 1.5fr 1.5fr 40px 40px',
                gap: '12px',
                padding: '0 16px 12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.3)',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
            }}>
                <div>Category</div>
                <div>Object</div>
                <div style={{ textAlign: 'right' }}>Monthly</div>
                <div style={{ textAlign: 'right' }}>Weekly</div>
                <div style={{ textAlign: 'right' }}>Daily</div>
                <div style={{ textAlign: 'center' }}>Skill</div>
                <div style={{ textAlign: 'center' }}>Area</div>
                <div></div>
                <div></div>
            </div>

            {/* Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                {filteredItems.map(item => {
                    const cat = WEALTH_CATEGORIES.find(c => c.id === item.category) || WEALTH_CATEGORIES[0];
                    const skill = state.skills?.[item.skillId];
                    const area = (skill && state.areas) ? state.areas[skill.areaId] : null;

                    const safeAreaColor = (area?.color && area.color.startsWith('#')) ? area.color : '#3b82f6';

                    return (
                        <div
                            key={item.id}
                            className="wealth-row"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(120px, auto) 2fr 100px 100px 100px 1.5fr 1.5fr 40px 40px',
                                gap: '12px',
                                padding: '12px 16px',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                alignItems: 'center',
                                fontSize: '13px',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            {/* Category Label */}
                            <div>
                                <span style={{
                                    background: cat.color + (isLight ? '15' : '30'),
                                    color: cat.color,
                                    padding: '2px 10px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    whiteSpace: 'nowrap',
                                    border: `1px solid ${cat.color}25`
                                }}>
                                    {item.category}
                                </span>
                            </div>

                            {/* Object Name */}
                            <EditableMarkdownCell
                                value={item.name}
                                onChange={(newValue) => updateWealthItem(item.id, { name: newValue })}
                                placeholder="Item Name"
                                style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: 'rgba(255,255,255,0.9)',
                                    width: '100%'
                                }}
                            />

                            {/* Monthly Payment */}
                            <div style={{ textAlign: 'right' }}>
                                <input
                                    type="number"
                                    value={item.monthlyPayment}
                                    onChange={(e) => updateWealthItem(item.id, { monthlyPayment: Number(e.target.value) })}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#fff',
                                        textAlign: 'right',
                                        width: '100%',
                                        outline: 'none',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        fontFamily: 'monospace'
                                    }}
                                />
                            </div>

                            {/* Computed Weekly */}
                            <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                                {item.monthlyPayment ? (item.monthlyPayment / 4).toFixed(1) : '-'}
                            </div>

                            {/* Computed Daily */}
                            <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                                {item.monthlyPayment ? (item.monthlyPayment / 30).toFixed(1) : '-'}
                            </div>

                            {/* Skill Selector */}
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <select
                                    value={item.skillId || ''}
                                    onChange={(e) => updateWealthItem(item.id, { skillId: e.target.value })}
                                    style={{
                                        background: skill ? 'rgba(231, 213, 201, 0.15)' : 'rgba(255,255,255,0.03)',
                                        color: skill ? '#e7d5c9' : 'rgba(255,255,255,0.3)',
                                        border: 'none',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        width: 'fit-content',
                                        minWidth: '80px',
                                        outline: 'none',
                                        appearance: 'none',
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    <option value="" style={{ background: '#1e1e1e' }}>SELECT SKILL</option>
                                    {Object.values(state.skills).map(s => (
                                        <option key={s.id} value={s.id} style={{ background: '#1e1e1e' }}>{(s.name || 'Unnamed').toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Area Display */}
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {skill ? (
                                    <span style={{
                                        background: (area?.color || '#3b82f6') + (isLight ? '15' : '30'),
                                        color: area?.color || '#3b82f6',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        border: `1px solid ${(area?.color || '#3b82f6')}25`
                                    }}>
                                        {area?.name}
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontWeight: '700' }}>-</span>
                                )}
                            </div>

                            {/* Delete Button */}
                            <button
                                onClick={() => deleteWealthItem(item.id)}
                                className="delete-btn"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    justifyContent: 'center'
                                }}
                            >
                                <Trash2 size={14} />
                            </button>

                            {/* Details Button */}
                            <button
                                onClick={() => navigate(`/wealth/${item.id}`)}
                                className="open-btn"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#3b82f6',
                                    cursor: 'pointer',
                                    opacity: (item.notes && item.notes.trim().length > 0) ? 1 : 0,
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    justifyContent: 'center'
                                }}
                            >
                                <ExternalLink size={14} />
                            </button>
                        </div>
                    );
                })}

                {/* New Item Input Row */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '138px 3fr 1fr 1fr 1fr 2fr 2fr 40px 40px',
                        gap: '8px',
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        opacity: 0.6
                    }}
                >
                    <div /> {/* Category placeholder (auto-set based on tab) */}
                    <div
                        onClick={handleAddItem}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            color: 'var(--color-text-secondary)',
                            gridColumn: '2 / -1' // Span rest
                        }}
                    >
                        <Plus size={16} /> New {activeTab === 'Everything' ? 'item' : activeTab.toLowerCase().replace(/s$/, '')}
                    </div>
                </div>

                {/* Footer / Totals Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, auto) 2fr 100px 100px 100px 1.5fr 1.5fr 40px 40px',
                    gap: '12px',
                    padding: '16px',
                    marginTop: '20px',
                    borderTop: '2px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: '800',
                    color: '#fff',
                    fontSize: '14px',
                    letterSpacing: '0.05em'
                }}>
                    <div style={{ gridColumn: '1 / span 2', textAlign: 'right', color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>TOTAL MONTHLY BURN</div>
                    <div style={{ textAlign: 'right', color: '#3b82f6' }}>{totalMonthly.toFixed(0)}</div>
                    <div style={{ textAlign: 'right', opacity: 0.5 }}>{totalWeekly.toFixed(1)}</div>
                    <div style={{ textAlign: 'right', opacity: 0.5 }}>{totalDaily.toFixed(1)}</div>
                </div>
            </div>

            <style>{`
                .wealth-row:hover .delete-btn,
                .wealth-row:hover .open-btn {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    );
};

export default WealthTable;
