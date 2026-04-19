import React, { useState, useEffect, useRef } from 'react';
import { useSettings, SLOT_ROLES } from '../context/SettingsContext';
import { backbone, NodeTypes } from '../backbone-v2';
import './FocusCenterPage.css';
import GlassPanel from '../components/ui/GlassPanel';
import { Target, TrendingUp, Settings, Compass, Layers, Plus, X, BookOpen } from 'lucide-react';

const FocusCenterPage = () => {
    const {
        focusSlots,
        guidedSlotRoles,
        updateFocusSlot,
        loading: settingsLoading,
    } = useSettings();

    const [allSkills, setAllSkills] = useState([]);
    const [loadingSkills, setLoadingSkills] = useState(true);
    const [showPicker, setShowPicker] = useState(null); // index of slot being edited
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef(null);

    useEffect(() => {
        const loadSkills = async () => {
            try {
                setLoadingSkills(true);
                
                // Ensure backbone is initialized before asking for nodes
                await backbone.initialize();
                
                const nodes = await backbone.getAllNodes();
                {};
                
                const skills = nodes.filter(n => n.type === NodeTypes.SKILL);
                
                if (skills.length === 0) {
                }
                
                setAllSkills(skills);
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

    const filteredSkills = allSkills.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectSkill = (skillId) => {
        updateFocusSlot(showPicker, skillId);
        setShowPicker(null);
        setSearchQuery('');
    };

    if (settingsLoading) {
        return (
            <div className="focus-center-loading">
                <div className="spinner"></div>
            </div>
        );
    }

    const activeSlot = showPicker !== null ? SLOT_ROLES[showPicker] : null;

    return (
        <div className="focus-center-container">
            <header className="focus-center-header">
                <h1>Focus Center</h1>
                <p>
                    {guidedSlotRoles
                        ? 'Assign skills to guided roles. Your Launchpad will prioritize tasks from these skills.'
                        : 'Assign skills to your 5 focus slots. Your Launchpad will prioritize tasks from these skills.'}
                </p>
            </header>

            <div className="slots-grid">
                {focusSlots.map((slotSkillId, index) => {
                    const skill = allSkills.find(s => s.id === slotSkillId);
                    const role = SLOT_ROLES[index];
                    return (
                        <GlassPanel
                            key={index}
                            className={`slot-card ${skill ? 'is-filled' : 'is-empty'}`}
                            onClick={() => setShowPicker(index)}
                        >
                            {/* Slot label / role */}
                            <div className="slot-role-header">
                                {guidedSlotRoles ? (
                                    <>
                                        <span className="slot-role-icon">
                                            {index === 0 && <Target size={14} />}
                                            {index === 1 && <TrendingUp size={14} />}
                                            {index === 2 && <Settings size={14} />}
                                            {index === 3 && <Compass size={14} />}
                                            {index === 4 && <Layers size={14} />}
                                        </span>
                                        <span className="slot-role-label">{role.label}</span>
                                    </>
                                ) : (
                                    <span className="slot-role-label">Slot {index + 1}</span>
                                )}
                            </div>

                            {skill ? (
                                <div className="slot-content filled">
                                    <div className="skill-icon"><BookOpen size={24} strokeWidth={1.5} /></div>
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
                                    <div className="empty-plus"><Plus size={32} strokeWidth={1} /></div>
                                    <div className="empty-text">Empty Slot</div>
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
                                {guidedSlotRoles && activeSlot && (
                                    <span className="picker-role-badge">
                                        {activeSlot.label}
                                    </span>
                                )}
                                <h3>Select a Skill</h3>
                            </div>
                            <button
                                className="close-picker"
                                onClick={() => { setShowPicker(null); setSearchQuery(''); }}
                            >
                                <X size={24} strokeWidth={1.5} />
                            </button>
                        </header>

                        <div className="picker-search">
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search skills..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="skills-list">
                            {/* Option to clear the slot */}
                            {focusSlots[showPicker] && (
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
                                        <span className="item-icon"><BookOpen size={16} /></span>
                                        <span className="item-name">{s.name}</span>
                                        {focusSlots[showPicker] === s.id && (
                                            <span className="item-check">Active</span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="no-skills-found">No skills found matching "{searchQuery}"</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default FocusCenterPage;
