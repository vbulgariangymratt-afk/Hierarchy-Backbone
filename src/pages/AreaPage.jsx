import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { backbone, repository, NodeTypes, IdentityTiers } from '../backbone-v2/index';
import CreateSkillModal from '../components/CreateSkillModal';
import NodeIcon from '../components/NodeIcon';
import SkillCard from '../components/SkillCard';
import IconPickerModal from '../components/modals/IconPickerModal';
import './AreaPage.css';

const SVG_ICONS = {
    CHEVRON_DOWN: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E",
    CHEVRON_RIGHT: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 18 6-6-6-6'/%3E%3C/svg%3E",
    ROCKET: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpolyline points='9 22 9 12 15 12 15 22'/%3E%3C/svg%3E",
    ALERT: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgba(255, 255, 255, 0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='12'/%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'/%3E%3C/svg%3E"
};

const AreaPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [area, setArea] = useState(null);
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFocusMode, setIsFocusMode] = useState(false);

    const [isCreatingSkill, setIsCreatingSkill] = useState(false);
    const [newSkillName, setNewSkillName] = useState('');
    const [newSkillTier, setNewSkillTier] = useState(IdentityTiers?.OPTIONAL || 'OPTIONAL');
    const [newSkillPinch, setNewSkillPinch] = useState('');
    const [newSkillIconUrl, setNewSkillIconUrl] = useState('');

    const [allNodes, setAllNodes] = useState([]);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [skillToSleep, setSkillToSleep] = useState(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isSleepingSkillsCollapsed, setIsSleepingSkillsCollapsed] = useState(true);
    const [isEditingArea, setIsEditingArea] = useState(false);
    const [areaEditForm, setAreaEditForm] = useState({ name: '', identityAnchor: '', iconUrl: '' });
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
    
    // Inline rename state for skills and area title
    const [inlineEditingId, setInlineEditingId] = useState(null);
    const [inlineDraftName, setInlineDraftName] = useState('');
    const [editingTierSkillId, setEditingTierSkillId] = useState(null);
    const inlineInputRef = React.useRef(null);
    const tierSelectRef = React.useRef(null);

    // Open the tier dropdown immediately after it mounts (fixes two-click issue)
    useEffect(() => {
        if (editingTierSkillId && tierSelectRef.current) {
            tierSelectRef.current.focus();
            tierSelectRef.current.click();
        }
    }, [editingTierSkillId]);

    const fetchData = async () => {
        try {
            const nodes = await repository.getAll();
            setAllNodes(nodes);
            const currentArea = nodes.find(n => n.id === id);

            if (currentArea) {
                setArea(currentArea);
                const areaSkills = nodes.filter(n => n.parentId === id && n.type === NodeTypes.SKILL);

                // PASSION Reordering: Move skills with pinchState === 'PASSION' to the top
                const sortedSkills = [...areaSkills].sort((a, b) => {
                    const aPassion = a.metadata?.pinchState === 'PASSION';
                    const bPassion = b.metadata?.pinchState === 'PASSION';
                    if (aPassion && !bPassion) return -1;
                    if (!aPassion && bPassion) return 1;
                    return 0;
                });

                setSkills(sortedSkills);

                // Check Focus Mode
                const root = await repository.getById('ROOT');
                setIsFocusMode(!!root?.metadata?.focusModeEntryAt);
            }
        } catch (error) {
            console.error("Failed to fetch area data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    // Auto-refresh when a skill wakes up
    useEffect(() => {
        const soonToWake = skills.find(s => s.metadata?.sleepUntil && new Date(s.metadata.sleepUntil) > new Date());
        if (soonToWake) {
            const timers = skills
                .filter(s => s.metadata?.sleepUntil && new Date(s.metadata.sleepUntil) > new Date())
                .map(s => {
                    const delay = new Date(s.metadata.sleepUntil).getTime() - Date.now();
                    if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Only set timers for things within 24h for efficiency
                        return setTimeout(() => fetchData(), delay + 100);
                    }
                    return null;
                }).filter(Boolean);
            
            return () => timers.forEach(t => clearTimeout(t));
        }
    }, [skills]);

    const handleCreateSkill = async (e) => {
        if (e && e.key !== 'Enter' && e.type !== 'click') return;
        if (!newSkillName.trim()) return;

        try {
            await backbone.addNode({
                type: NodeTypes.SKILL,
                parentId: id,
                name: newSkillName.trim(),
                metadata: {
                    identityTier: newSkillTier,
                    pinchState: newSkillPinch.trim() || null,
                    status: 'SLEEPING',
                    auraLevel: 1,
                    auraTotal: 0,
                    iconUrl: newSkillIconUrl.trim() || null
                }
            });
            setNewSkillName('');
            setNewSkillPinch('');
            setNewSkillIconUrl('');
            setNewSkillTier(IdentityTiers?.OPTIONAL || 'OPTIONAL');
            setIsCreatingSkill(false);
            fetchData();
        } catch (error) {
            console.error("Failed to create skill:", error);
        }
    };

    const handleToggleSkill = useCallback(async (e, skill) => {
        e.preventDefault();
        e.stopPropagation();

        const isCurrentlySleeping = isSkillSleeping(skill);

        if (isCurrentlySleeping) {
            // Check global limit before waking
            const activeCount = allNodes.filter(n => n.type === NodeTypes.SKILL && !isSkillSleeping(n)).length;
            if (activeCount >= 100) {
                setIsLimitModalOpen(true);
                return;
            }
        }

        try {
            if (isCurrentlySleeping) {
                await backbone.wakeSkill(skill.id);
            } else {
                // Toggle from active to sleeping (indefinite)
                await backbone.sleepSkill(skill.id);
            }
            fetchData();
        } catch (error) {
            console.error("Failed to toggle skill:", error);
        }
    }, [allNodes, backbone, fetchData]);

    const handleSleepSkill = useCallback(async (e, skill) => {
        e.preventDefault();
        e.stopPropagation();
        setSkillToSleep(skill);
    }, []);

    const confirmSleepSkill = useCallback(async () => {
        if (!skillToSleep) return;
        try {
            await backbone.sleepSkill(skillToSleep.id, 5);
            fetchData();
        } catch (error) {
            console.error("Failed to sleep skill:", error);
        }
        setSkillToSleep(null);
    }, [skillToSleep, backbone, fetchData]);

    const getTierLabel = (tier) => {
        switch (tier) {
            case 'CORE': return 'Core Identity';
            case 'EXPLORATION': return 'Explorational';
            case 'OPTIONAL': return 'Optional';
            default: return tier || 'Optional';
        }
    };

    const handleStartEditArea = () => {
        setAreaEditForm({
            name: area.name,
            identityAnchor: area.metadata?.identityAnchor || '',
            iconUrl: area.metadata?.iconUrl || ''
        });
        setIsEditingArea(true);
    };

    const handleSaveAreaEdit = async () => {
        try {
            await backbone.updateNode(id, {
                name: areaEditForm.name,
                metadata: {
                    identityAnchor: areaEditForm.identityAnchor,
                    iconUrl: areaEditForm.iconUrl
                }
            });
            setIsEditingArea(false);
            fetchData();
        } catch (error) {
            console.error("Failed to save area edit:", error);
        }
    };

    const handleIconSelect = async (iconName) => {
        if (isEditingArea) {
            setAreaEditForm(prev => ({ ...prev, iconUrl: iconName }));
        } else {
            try {
                const updatedMetadata = {
                    ...area.metadata,
                    iconUrl: iconName
                };
                await backbone.updateNode(area.id, { metadata: updatedMetadata });
                setArea(prev => ({
                    ...prev,
                    metadata: updatedMetadata
                }));
            } catch (err) {
                console.error("Failed to update area icon directly:", err);
            }
        }
    };

    const handleDeleteArea = async () => {
        try {
            await backbone.deleteNode(id);
            navigate('/launchpad');
        } catch (error) {
            console.error("Failed to delete area:", error);
            setIsDeleteConfirmOpen(false);
        }
    };

    const handleDeleteSkill = async (skillId, skillName) => {
        try {
            await backbone.deleteNode(skillId);
            fetchData();
        } catch (error) {
            console.error("Failed to delete skill:", error);
        }
    };

    const handleTierChange = useCallback(async (skillId, newTier) => {
        try {
            const skill = allNodes.find(n => n.id === skillId);
            if (!skill) return;
            await backbone.updateNode(skillId, {
                metadata: {
                    identityTier: newTier
                }
            });
            setEditingTierSkillId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to update tier:", error);
        }
    }, [allNodes, backbone, fetchData]);

    const handleStartInlineEdit = useCallback((nodeId, currentName) => {
        setInlineEditingId(nodeId);
        setInlineDraftName(currentName);
    }, []);

    const handleSaveInlineEdit = useCallback(async (nodeId) => {
        if (!inlineEditingId) return;
        const trimmed = inlineDraftName.trim();
        if (trimmed && trimmed !== (nodeId === id ? area.name : skills.find(s => s.id === nodeId)?.name)) {
            try {
                await backbone.updateNode(nodeId, { name: trimmed });
                fetchData();
            } catch (err) {
                console.error("Failed to rename node:", err);
            }
        }
        setInlineEditingId(null);
    }, [inlineEditingId, inlineDraftName, id, area, skills, backbone, fetchData]);

    const handleInlineKeyDown = useCallback((e, nodeId) => {
        if (e.key === 'Enter') {
            handleSaveInlineEdit(nodeId);
        } else if (e.key === 'Escape') {
            setInlineEditingId(null);
        }
    }, [handleSaveInlineEdit]);

    useEffect(() => {
        if (inlineEditingId && inlineInputRef.current) {
            inlineInputRef.current.focus();
            inlineInputRef.current.select();
        }
    }, [inlineEditingId]);

    if (loading) return <div className="area-page-loading">Loading Area...</div>;
    if (!area) return <div className="area-page-error">Area not found.</div>;

    const isSkillSleeping = (skill) => {
        if (skill.metadata?.isSleeping) return true;
        if (skill.metadata?.sleepUntil) {
            return new Date(skill.metadata.sleepUntil) > new Date();
        }
        // If it was a timed sleep and we are past it, we consider it AWAKE
        // Only trust status if neither of the dynamic flags are set
        return skill.metadata?.status === 'SLEEPING';
    };

    const activeSkills = skills.filter(s => !isSkillSleeping(s));
    const sleepingSkills = skills.filter(s => isSkillSleeping(s));

    return (
        <div className="area-page">
            <header className="area-page-header">
                {isEditingArea ? (
                    <div className="area-edit-block">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                            <div className="edit-field">
                                <label>Area Name</label>
                                <input
                                    className="edit-input"
                                    value={areaEditForm.name}
                                    onChange={e => setAreaEditForm({ ...areaEditForm, name: e.target.value })}
                                />
                            </div>
                            <div className="edit-field">
                                <label>Identity Anchor</label>
                                <input
                                    className="edit-input"
                                    value={areaEditForm.identityAnchor}
                                    onChange={e => setAreaEditForm({ ...areaEditForm, identityAnchor: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="edit-field" style={{ marginBottom: '20px' }}>
                            <label>Area Icon</label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsIconPickerOpen(true)}
                                    className="icon-select-btn"
                                >
                                    <span style={{ opacity: areaEditForm.iconUrl ? 1 : 0.5 }}>
                                        {areaEditForm.iconUrl ? `Icon: ${areaEditForm.iconUrl}` : 'Select a Lucide icon...'}
                                    </span>
                                    <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Change</span>
                                </button>
                                <div 
                                    className="icon-preview" 
                                    onClick={() => setIsIconPickerOpen(true)}
                                >
                                    <NodeIcon iconUrl={areaEditForm.iconUrl} size={20} />
                                </div>
                            </div>
                        </div>
                        {/* Sleeping Skills — Delete Section */}
                        {sleepingSkills.length > 0 && (
                            <div style={{ marginBottom: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
                                <label style={{ marginBottom: '12px' }}>Sleeping Skills</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {sleepingSkills.map(skill => (
                                        <div key={skill.id} className="sleeping-skill-row">
                                            <span style={{ fontSize: '13px', color: 'var(--color-text)', opacity: 0.85 }}>{skill.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSkill(skill.id, skill.name)}
                                                className="btn btn-danger"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="edit-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={handleSaveAreaEdit} className="btn btn-primary">Save Changes</button>
                                <button onClick={() => setIsEditingArea(false)} className="btn btn-secondary">Cancel</button>
                            </div>
                             {isDeleteConfirmOpen ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(235, 94, 40, 0.08)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(235, 94, 40, 0.15)' }}>
                                    <span style={{ fontSize: '11px', color: '#EB5E28', fontWeight: 600 }}>Really delete?</span>
                                    <button 
                                        type="button"
                                        onClick={handleDeleteArea}
                                        className="btn btn-danger-solid"
                                        style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                                    >
                                        YES, DELETE
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setIsDeleteConfirmOpen(false)}
                                        className="btn btn-secondary"
                                        style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                                    >
                                        CANCEL
                                    </button>
                                </div>
                             ) : (
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDeleteConfirmOpen(true);
                                    }}
                                    className="btn btn-danger"
                                >
                                    Delete Area
                                </button>
                             )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <div 
                                        onClick={() => {
                                            setAreaEditForm({
                                                name: area.name,
                                                identityAnchor: area.metadata?.identityAnchor || '',
                                                iconUrl: area.metadata?.iconUrl || ''
                                            });
                                            setIsIconPickerOpen(true);
                                        }}
                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        title="Click to select Lucide icon"
                                    >
                                        <NodeIcon iconUrl={area.metadata?.iconUrl} emoji={area.icon} size={32} />
                                    </div>
                                    {inlineEditingId === area.id ? (
                                        <input
                                            ref={inlineInputRef}
                                            value={inlineDraftName}
                                            onChange={e => setInlineDraftName(e.target.value)}
                                            onBlur={() => handleSaveInlineEdit(area.id)}
                                            onKeyDown={e => handleInlineKeyDown(e, area.id)}
                                            style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--color-accent)', color: 'inherit', fontSize: '32px', fontWeight: 700, outline: 'none', width: 'auto' }}
                                        />
                                    ) : (
                                        <h1 className="area-title" style={{ margin: 0 }} onDoubleClick={() => handleStartInlineEdit(area.id, area.name)}>{area.name}</h1>
                                    )}
                                </div>
                                <p className="area-identity-anchor" style={{ opacity: 0.7, margin: 0 }}>{area.metadata?.identityAnchor}</p>
                            </div>
                            <button
                                onClick={handleStartEditArea}
                                className="edit-area-btn"
                            >
                                Edit Identity
                            </button>
                        </div>
                    </>
                )}
            </header>

            <section className="skills-section">
                <div className="section-header">
                    <h2 className="section-title">Active Skills</h2>
                </div>

                <div className="skills-grid active-grid">
                    {activeSkills.length === 0 && (
                        <div className="no-skills-message">No active skills. Select one from below to focus.</div>
                    )}
                    {activeSkills.map(skill => (
                        <SkillCard 
                            key={skill.id}
                            skill={skill}
                            allNodes={allNodes}
                            isSleeping={false}
                            inlineEditingId={inlineEditingId}
                            inlineDraftName={inlineDraftName}
                            editingTierSkillId={editingTierSkillId}
                            onStartInlineEdit={handleStartInlineEdit}
                            onSaveInlineEdit={handleSaveInlineEdit}
                            onInlineKeyDown={handleInlineKeyDown}
                            onSetInlineDraftName={setInlineDraftName}
                            onTierChange={handleTierChange}
                            onSetEditingTierSkillId={setEditingTierSkillId}
                            onToggleSkill={handleToggleSkill}
                            onSleepSkill={handleSleepSkill}
                            getTierLabel={getTierLabel}
                            inlineInputRef={inlineInputRef}
                            tierSelectRef={tierSelectRef}
                            SVG_ICONS={SVG_ICONS}
                        />
                    ))}
                </div>
            </section>

            <section className="skills-section sleeping-section">
                <div className="section-header" onClick={() => setIsSleepingSkillsCollapsed(!isSleepingSkillsCollapsed)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', marginBottom: '24px' }}>
                    <NodeIcon iconUrl={isSleepingSkillsCollapsed ? SVG_ICONS.CHEVRON_RIGHT : SVG_ICONS.CHEVRON_DOWN} size={14} />
                    <h2 className="section-title">Sleeping Skills</h2>
                    <span className="count-badge">{sleepingSkills.length}</span>
                </div>

                {!isSleepingSkillsCollapsed && (
                    <div className="skills-grid sleeping-grid">
                        {sleepingSkills.map(skill => (
                            <SkillCard 
                                key={skill.id}
                                skill={skill}
                                allNodes={allNodes}
                                isSleeping={true}
                                inlineEditingId={inlineEditingId}
                                inlineDraftName={inlineDraftName}
                                editingTierSkillId={editingTierSkillId}
                                onStartInlineEdit={handleStartInlineEdit}
                                onSaveInlineEdit={handleSaveInlineEdit}
                                onInlineKeyDown={handleInlineKeyDown}
                                onSetInlineDraftName={setInlineDraftName}
                                onTierChange={handleTierChange}
                                onSetEditingTierSkillId={setEditingTierSkillId}
                                onToggleSkill={handleToggleSkill}
                                onSleepSkill={handleSleepSkill}
                                getTierLabel={getTierLabel}
                                inlineInputRef={inlineInputRef}
                                tierSelectRef={tierSelectRef}
                                SVG_ICONS={SVG_ICONS}
                            />
                        ))}

                        {isCreatingSkill ? (
                            <div className="skill-card creation-card">
                                <div className="creation-form">
                                    <input
                                        autoFocus
                                        className="skill-input"
                                        placeholder="Skill Name..."
                                        value={newSkillName}
                                        onChange={(e) => setNewSkillName(e.target.value)}
                                        onKeyDown={handleCreateSkill}
                                    />
                                    <div className="creation-row">
                                        <select
                                            className="tier-select"
                                            value={newSkillTier}
                                            onChange={(e) => setNewSkillTier(e.target.value)}
                                        >
                                            {(IdentityTiers ? Object.values(IdentityTiers) : ['CORE', 'EXPLORATION', 'OPTIONAL']).map(tier => (
                                                <option key={tier} value={tier}>{getTierLabel(tier)}</option>
                                            ))}
                                        </select>
                                        <input
                                            className="pinch-input"
                                            placeholder="PINCH Tag (optional)"
                                            value={newSkillPinch}
                                            onChange={(e) => setNewSkillPinch(e.target.value)}
                                            onKeyDown={handleCreateSkill}
                                        />
                                    </div>
                                    <div className="creation-row">
                                        <input
                                            placeholder="Icon URL (e.g. notionicons.so)"
                                            value={newSkillIconUrl}
                                            onChange={e => setNewSkillIconUrl(e.target.value)}
                                            className="skill-form-input"
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                background: 'var(--alpha-low)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '8px',
                                                color: 'var(--color-text)',
                                                fontSize: '14px',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div className="skill-creation-actions">
                                        <button className="confirm-btn" onClick={handleCreateSkill}>Save Skill</button>
                                        <button className="cancel-btn" onClick={() => setIsCreatingSkill(false)}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button className="add-skill-card-btn" onClick={() => setIsCreatingSkill(true)}>
                                <span className="plus-icon">+</span>
                                <span className="btn-text">Add Skill</span>
                            </button>
                        )}
                    </div>
                )}
            </section>

            {/* Limit Modal */}
            {isLimitModalOpen && (
                <div className="modal-overlay" onClick={() => setIsLimitModalOpen(false)}>
                    <div className="limit-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="limit-modal-icon">
                            <NodeIcon iconUrl={SVG_ICONS.ALERT} size={40} />
                        </div>
                        <p className="limit-modal-message">
                            You can only have 100 Active Skills. Put one to sleep to activate this one.
                        </p>
                        <button className="limit-modal-btn" onClick={() => setIsLimitModalOpen(false)}>
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Sleep Confirm Modal */}
            {skillToSleep && (
                <div className="modal-overlay" onClick={() => setSkillToSleep(null)} style={{ zIndex: 10005 }}>
                    <div className="limit-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="limit-modal-icon">
                            <NodeIcon iconUrl={SVG_ICONS.ALERT} size={40} />
                        </div>
                        <p className="limit-modal-message">
                            Start 5-day rest period for <strong style={{ color: 'var(--color-accent)' }}>{skillToSleep.name}</strong>?
                        </p>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', width: '100%' }}>
                            <button 
                                className="limit-modal-btn" 
                                onClick={confirmSleepSkill} 
                                style={{ flex: 1, background: '#3b82f6', border: 'none', color: 'white' }}
                            >
                                Yes, Rest
                            </button>
                            <button 
                                className="limit-modal-btn" 
                                onClick={() => setSkillToSleep(null)} 
                                style={{ flex: 1, background: 'var(--alpha-medium)', border: 'none', color: 'var(--color-text)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Icon Picker Modal */}
            <IconPickerModal
                isOpen={isIconPickerOpen}
                onClose={() => setIsIconPickerOpen(false)}
                onSelect={handleIconSelect}
                currentIcon={isEditingArea ? areaEditForm.iconUrl : area.metadata?.iconUrl}
            />
        </div>
    );
};

export default AreaPage;
