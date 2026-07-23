import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSettings, SLOT_ROLES } from '../context/SettingsContext';
import { backbone, NodeTypes } from '../backbone-v2';
import './FocusCenterPage.css';
import GlassPanel from '../components/ui/GlassPanel';
import {
    Target,
    TrendingUp,
    Settings,
    Compass,
    Layers,
    Plus,
    X,
    BookOpen,
    Terminal,
    Activity,
    Languages,
    Sparkles,
    Heart
} from 'lucide-react';

const getSkillIcon = (skill, allLifeAreas, size = 24) => {
    if (!skill) return <Plus size={size} strokeWidth={1.5} />;
    
    const parentArea = allLifeAreas.find(a => a.id === skill.parentId);
    const areaName = parentArea ? parentArea.name.toLowerCase() : '';
    const skillName = skill.name.toLowerCase();
    
    const combined = `${skillName} ${areaName}`;
    
    if (combined.includes('health') || combined.includes('fit') || combined.includes('gym') || combined.includes('sport') || combined.includes('body') || combined.includes('workout') || combined.includes('run')) {
        return <Activity size={size} strokeWidth={1.5} />;
    }
    if (combined.includes('code') || combined.includes('dev') || combined.includes('tech') || combined.includes('soft') || combined.includes('build') || combined.includes('saas') || combined.includes('system') || combined.includes('program')) {
        return <Terminal size={size} strokeWidth={1.5} />;
    }
    if (combined.includes('lang') || combined.includes('speak') || combined.includes('write') || combined.includes('read') || combined.includes('learn') || combined.includes('study') || combined.includes('chinese') || combined.includes('english') || combined.includes('spanish') || combined.includes('cantonese') || combined.includes('japanese') || combined.includes('french') || combined.includes('german') || combined.includes('廣東話')) {
        return <Languages size={size} strokeWidth={1.5} />;
    }
    if (combined.includes('mind') || combined.includes('medit') || combined.includes('spirit') || combined.includes('flow') || combined.includes('heart') || combined.includes('soul') || combined.includes('feel')) {
        return <Heart size={size} strokeWidth={1.5} />;
    }
    if (combined.includes('identity') || combined.includes('brand') || combined.includes('market') || combined.includes('media') || combined.includes('social') || combined.includes('x')) {
        return <Sparkles size={size} strokeWidth={1.5} />;
    }
    
    return <Target size={size} strokeWidth={1.5} />;
};

const FocusCenterPage = () => {
    const {
        focusSlots,
        guidedSlotRoles,
        updateFocusSlot,
        loading: settingsLoading,
    } = useSettings();

    const [allSkills, setAllSkills] = useState([]);
    const [allLifeAreas, setAllLifeAreas] = useState([]);
    const [customIdentity, setCustomIdentity] = useState('');
    const [loadingSkills, setLoadingSkills] = useState(true);
    const [showPicker, setShowPicker] = useState(null); // index of slot being edited
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const searchRef = useRef(null);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 1000);

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery]);

    useEffect(() => {
        const loadSkills = async () => {
            try {
                setLoadingSkills(true);
                
                // Ensure backbone is initialized before asking for nodes
                await backbone.initialize();
                
                const nodes = await backbone.getAllNodes();
                
                const skills = nodes.filter(n => n.type === NodeTypes.SKILL);
                const areas = nodes.filter(n => n.type === NodeTypes.LIFE_AREA || n.type === 'LIFE_AREA');
                
                setAllSkills(skills);
                setAllLifeAreas(areas);
            } catch (err) {
                console.error('[FocusCenter] Failed to load skills:', err);
            } finally {
                setLoadingSkills(false);
            }
        };
        loadSkills();
    }, []);


    // Auto-focus search input when picker opens
    useEffect(() => {
        if (showPicker !== null && searchRef.current) {
            setTimeout(() => searchRef.current?.focus(), 50);
        }
    }, [showPicker]);

    const highestFilledIndex = useMemo(() => {
        let maxIdx = -1;
        (focusSlots || []).forEach((slot, idx) => {
            const skill = allSkills.find(s => s.id === slot);
            if (slot && skill) {
                maxIdx = idx;
            }
        });
        return maxIdx;
    }, [focusSlots, allSkills]);

    const visibleSlots = useMemo(() => {
        const count = Math.min(5, Math.max(1, highestFilledIndex + 2));
        return (focusSlots || []).map((slotId, index) => ({ slotId, index })).slice(0, count);
    }, [focusSlots, highestFilledIndex]);

    const filteredSkills = allSkills.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectSkill = (skillId) => {
        updateFocusSlot(showPicker, skillId);
        setShowPicker(null);
        setSearchQuery('');
    };

    const handleCreateSkillAndArea = async (skillName, areaName, existingAreaId = null) => {
        try {
            setLoadingSkills(true);
            let areaId = existingAreaId;
            if (!areaId) {
                const matchingArea = allLifeAreas.find(a => a.name.toLowerCase().trim() === areaName.toLowerCase().trim());
                if (matchingArea) {
                    areaId = matchingArea.id;
                } else {
                    areaId = Math.random().toString(36).substr(2, 9);
                    await backbone.addNode({
                        id: areaId,
                        name: areaName.trim(),
                        type: 'LIFE_AREA',
                        parentId: null,
                        metadata: {}
                    });
                }
            }

            const skillId = Math.random().toString(36).substr(2, 9);
            await backbone.addNode({
                id: skillId,
                name: skillName.trim(),
                type: 'SKILL',
                parentId: areaId,
                metadata: {
                    identityTier: 'CORE',
                    status: 'ACTIVE',
                    isActive: true,
                    activatedAt: Date.now(),
                    iconUrl: null
                }
            });

            // Re-fetch nodes to update UI list
            const nodes = await backbone.getAllNodes();
            setAllSkills(nodes.filter(n => n.type === NodeTypes.SKILL));
            setAllLifeAreas(nodes.filter(n => n.type === 'LIFE_AREA' || n.type === NodeTypes.LIFE_AREA));

            // Select this skill for the obsession slot
            updateFocusSlot(showPicker, skillId);
            
            // Clean up states
            setShowPicker(null);
            setSearchQuery('');
            setCustomIdentity('');
        } catch (err) {
            console.error('[FocusCenter] Failed to create skill and area:', err);
        } finally {
            setLoadingSkills(false);
        }
    };

    if (settingsLoading) {
        return (
            <div className="focus-center-loading">
                <div className="spinner"></div>
            </div>
        );
    }

    const activeSlot = showPicker !== null ? SLOT_ROLES[showPicker] : null;
    const isDebouncing = searchQuery !== debouncedSearchQuery;

    return (
        <div className="focus-center-container">
            <header className="focus-center-header">
                <h1>Obsession Center</h1>
                <p>
                    Choose the skills you're currently obsessed with, when you get tired of one you can just rotate it for a new one.
                </p>
            </header>

            <div className="slots-grid">
                {visibleSlots.map(({ slotId: slotSkillId, index }) => {
                    const skill = allSkills.find(s => s.id === slotSkillId);
                    const role = SLOT_ROLES[index];
                    return (
                        <GlassPanel
                            key={index}
                            className={`slot-card ${skill ? 'is-filled' : 'is-empty'}`}
                            onClick={() => setShowPicker(index)}
                        >


                            {skill ? (
                                <div className="slot-content filled">
                                    <div className="skill-icon">{getSkillIcon(skill, allLifeAreas, 24)}</div>
                                    <div className="skill-name">{skill.name}</div>

                                    <button
                                        className="clear-slot-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateFocusSlot(index, null);
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <div className="slot-content empty">
                                    <div className="empty-plus">{getSkillIcon(null, allLifeAreas, 24)}</div>
                                    <div className="empty-text">{index === 0 ? "Your first obsession goes here" : "Empty Slot"}</div>
                                </div>
                            )}
                        </GlassPanel>
                    );
                })}
            </div>

            {/* Skill Picker Modal */}
            {showPicker !== null && (
                <div className="skill-picker-overlay" onClick={() => { setShowPicker(null); setSearchQuery(''); }}>
                    <div className="skill-picker-modal" onClick={e => e.stopPropagation()}>
                        <header className="picker-header">
                            <div className="picker-title-group">
                                <h3>{allSkills.length === 0 ? "Define an Obsession" : "Select a Skill"}</h3>
                            </div>
                            <button
                                className="close-picker"
                                onClick={() => { setShowPicker(null); setSearchQuery(''); }}
                            >
                                <X size={24} strokeWidth={1.5} />
                            </button>
                        </header>

                        {allSkills.length === 0 && searchQuery.trim() === '' && (
                            <div style={{ padding: '20px 28px 0 28px', fontSize: '15px', color: 'var(--text-secondary)', fontFamily: "'Lexend', sans-serif", textAlign: 'left', lineHeight: '1.5' }}>
                                How would you title the page of the thing you're currently obsessed with?
                            </div>
                        )}

                        <div className="picker-search" style={allSkills.length === 0 && searchQuery.trim() === '' ? { borderBottom: 'none', padding: '16px 28px 28px 28px' } : {}}>
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder={allSkills.length === 0 ? "e.g. Russian, Calisthenics, SaaS..." : "Search skills..."}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {!(allSkills.length === 0 && searchQuery.trim() === '') && (
                            <div className="skills-list">
                                {/* Option to clear the slot */}
                                {focusSlots[showPicker] && allSkills.some(s => s.id === focusSlots[showPicker]) && (
                                    <div
                                        className="picker-skill-item clear-item"
                                        onClick={() => handleSelectSkill(null)}
                                    >
                                        <span className="item-icon"><X size={16} /></span>
                                        <span className="item-name">Clear this slot</span>
                                    </div>
                                )}

                            {loadingSkills ? (
                                <div className="picker-loading">Loading skills...</div>
                            ) : filteredSkills.length > 0 ? (
                                filteredSkills.map(s => (
                                    <div
                                        key={s.id}
                                        className={`picker-skill-item ${focusSlots[showPicker] === s.id ? 'is-active' : ''}`}
                                        onClick={() => handleSelectSkill(s.id)}
                                    >
                                        <span className="item-icon">{getSkillIcon(s, allLifeAreas, 16)}</span>
                                        <span className="item-name">{s.name}</span>
                                        {focusSlots[showPicker] === s.id && (
                                            <span className="item-check">Active</span>
                                        )}
                                    </div>
                                ))
                            ) : searchQuery.trim() === '' ? (
                                null
                            ) : isDebouncing ? (
                                <div className="no-skills-found" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: "'Lexend', sans-serif", fontSize: '15px' }}>
                                    Searching...
                                </div>
                            ) : (
                                <div className="become-flow-container" style={{ padding: '24px 0 0 0', fontFamily: "'Lexend', sans-serif" }}>
                                    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.6', textAlign: 'left', fontFamily: "'Lexend', sans-serif" }}>
                                            <strong>"Obsessions"</strong> is a status for skills, which live inside an identity.
                                        </p>
                                        <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.6', textAlign: 'left', fontFamily: "'Lexend', sans-serif" }}>
                                            For example if you were obsessed with language learning, you'd be <strong>"bilingual"</strong> or <strong>"a polyglot"</strong>. If you're obsessed with building and selling apps, you'd be a <strong>"software developer"</strong> or <strong>"an entrepreneur"</strong>.
                                        </p>
                                        <h4 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '8px 0 0 0', textAlign: 'left', lineHeight: '1.5', fontFamily: "'Lexend', sans-serif" }}>
                                            Who do you wanna become in relation to this obsession?
                                        </h4>
                                    </div>

                                    {allLifeAreas.length > 0 && (
                                        <div className="identity-options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '16px' }}>
                                            {allLifeAreas.map(area => (
                                                <button
                                                    key={area.id}
                                                    type="button"
                                                    className="identity-option-btn"
                                                    onClick={() => handleCreateSkillAndArea(searchQuery, area.name, area.id)}
                                                    style={{
                                                        padding: '12px 16px',
                                                        borderRadius: '8px',
                                                        background: 'var(--alpha-low)',
                                                        border: '1px solid var(--color-border)',
                                                        color: 'var(--text-primary)',
                                                        textAlign: 'left',
                                                        fontFamily: "'Lexend', sans-serif",
                                                        fontSize: '16px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    I am becoming a <strong>{area.name}</strong>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                value={customIdentity}
                                                onChange={e => setCustomIdentity(e.target.value)}
                                                placeholder={allLifeAreas.length === 0 ? "e.g. Bilingual, Athlete, Entrepreneur..." : "Or write your own identity..."}
                                                style={{
                                                    flex: 1,
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    background: 'var(--alpha-low)',
                                                    border: '1px solid var(--color-border)',
                                                    color: 'var(--text-primary)',
                                                    fontFamily: "'Lexend', sans-serif",
                                                    fontSize: '16px'
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && customIdentity.trim()) {
                                                        handleCreateSkillAndArea(searchQuery, customIdentity.trim());
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => customIdentity.trim() && handleCreateSkillAndArea(searchQuery, customIdentity.trim())}
                                                style={{
                                                    padding: '0 20px',
                                                    borderRadius: '8px',
                                                    background: 'var(--color-accent, #7c3aed)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    fontFamily: "'Lexend', sans-serif",
                                                    fontSize: '16px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Create
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </div>
            )}
        </div>
    );
};


export default FocusCenterPage;
