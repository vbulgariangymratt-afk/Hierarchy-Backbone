import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { backbone, repository, NodeTypes, IdentityTiers } from '../backbone-v2/index';
import CreateSkillModal from '../components/CreateSkillModal';
import NodeIcon from '../components/NodeIcon';
import './AreaPage.css';

const SVG_ICONS = {
    CHEVRON_DOWN: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E",
    CHEVRON_RIGHT: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 18 6-6-6-6'/%3E%3C/svg%3E",
    ROCKET: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpolyline points='9 22 9 12 15 12 15 22'/%3E%3C/svg%3E"
};

const AreaPage = () => {
    const { id } = useParams();
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
    const [isSleepingSkillsCollapsed, setIsSleepingSkillsCollapsed] = useState(true);
    const [isEditingArea, setIsEditingArea] = useState(false);
    const [areaEditForm, setAreaEditForm] = useState({ name: '', identityAnchor: '', iconUrl: '' });

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

    const handleToggleSkill = async (e, skill) => {
        e.preventDefault();
        e.stopPropagation();

        const currentStatus = skill.metadata?.status || (skill.metadata?.isActive ? 'ACTIVE' : 'SLEEPING');
        const isCurrentlyActive = currentStatus === 'ACTIVE';

        if (!isCurrentlyActive) {
            // Check global limit
            const totalActive = allNodes.filter(n => n.type === NodeTypes.SKILL && (n.metadata?.status === 'ACTIVE' || (n.metadata?.isActive && n.metadata?.status !== 'SLEEPING'))).length;
            if (totalActive >= 3) {
                setIsLimitModalOpen(true);
                return;
            }
        }

        const nextStatus = isCurrentlyActive ? 'SLEEPING' : 'ACTIVE';
        const updates = [
            backbone.updateNode(skill.id, {
                metadata: {
                    ...skill.metadata,
                    status: nextStatus,
                    isActive: nextStatus === 'ACTIVE'
                }
            })
        ];

        // If putting skill to sleep, cascade to its objectives
        if (nextStatus === 'SLEEPING') {
            const skillObjectives = allNodes.filter(n => n.parentId === skill.id && n.type === NodeTypes.OBJECTIVE);
            skillObjectives.forEach(obj => {
                updates.push(backbone.updateNode(obj.id, {
                    metadata: {
                        ...obj.metadata,
                        status: 'SLEEPING',
                        isActive: false,
                        deactivatedAt: Date.now()
                    }
                }));
            });
        }

        try {
            await Promise.all(updates);
            fetchData();
        } catch (error) {
            console.error("Failed to toggle skill:", error);
        }
    };

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
                    ...area.metadata,
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

    if (loading) return <div className="area-page-loading">Loading Area...</div>;
    if (!area) return <div className="area-page-error">Area not found.</div>;

    const activeSkills = skills.filter(s => s.metadata?.status === 'ACTIVE' || (s.metadata?.isActive && s.metadata?.status !== 'SLEEPING'));
    const sleepingSkills = skills.filter(s => !activeSkills.includes(s));

    return (
        <div className="area-page">
            <header className="area-page-header">
                {isEditingArea ? (
                    <div className="area-edit-block" style={{ background: 'var(--alpha-low)', padding: '24px', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                            <div className="edit-field">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', opacity: 0.6 }}>Area Name</label>
                                <input
                                    className="edit-input"
                                    value={areaEditForm.name}
                                    onChange={e => setAreaEditForm({ ...areaEditForm, name: e.target.value })}
                                    style={{ width: '100%', padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }}
                                />
                            </div>
                            <div className="edit-field">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', opacity: 0.6 }}>Identity Anchor</label>
                                <input
                                    className="edit-input"
                                    value={areaEditForm.identityAnchor}
                                    onChange={e => setAreaEditForm({ ...areaEditForm, identityAnchor: e.target.value })}
                                    style={{ width: '100%', padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }}
                                />
                            </div>
                        </div>
                        <div className="edit-field" style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', opacity: 0.6 }}>Icon URL (notionicons.so)</label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                    className="edit-input"
                                    value={areaEditForm.iconUrl}
                                    placeholder="https://notionicons.so/icon/..."
                                    onChange={e => setAreaEditForm({ ...areaEditForm, iconUrl: e.target.value })}
                                    style={{ flex: 1, padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }}
                                />
                                {areaEditForm.iconUrl && (
                                    <div className="icon-preview" style={{ width: '38px', height: '38px', background: 'var(--bg-surface)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)' }}>
                                        <NodeIcon iconUrl={areaEditForm.iconUrl} size={24} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="edit-actions" style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={handleSaveAreaEdit} style={{ padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
                            <button onClick={() => setIsEditingArea(false)} style={{ padding: '8px 20px', background: 'var(--alpha-medium)', color: 'var(--color-text)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <NodeIcon iconUrl={area.metadata?.iconUrl} emoji={area.icon} size={32} />
                                    <h1 className="area-title" style={{ margin: 0 }}>{area.name}</h1>
                                </div>
                                <p className="area-identity-anchor" style={{ opacity: 0.7, margin: 0 }}>{area.metadata?.identityAnchor}</p>
                            </div>
                            <button
                                onClick={handleStartEditArea}
                                style={{ padding: '6px 12px', background: 'var(--alpha-low)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Edit Area
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
                    {activeSkills.map(skill => {
                        const skillObjectives = allNodes.filter(n => n.parentId === skill.id && n.type === NodeTypes.OBJECTIVE);
                        return (
                            <div key={skill.id} className="skill-card is-active">
                                <Link to={`/skill/${skill.id}`} className="skill-card-link">
                                    <header className="skill-card-header">
                                        <div className="skill-title-group">
                                            {skill.metadata?.iconUrl && (
                                                <div className="skill-icon-container" style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
                                                    <NodeIcon iconUrl={skill.metadata.iconUrl} size={28} />
                                                </div>
                                            )}
                                            <h3 className="skill-name">{skill.name}</h3>
                                        </div>
                                        <span className={`tier-badge ${skill.metadata?.identityTier?.toLowerCase() || 'optional'}`}>
                                            {getTierLabel(skill.metadata?.identityTier)}
                                        </span>
                                    </header>

                                    <div className="aura-display-new">
                                        <div className="aura-header-row">
                                            <div className="aura-badge-insignia">L{skill.metadata?.auraLevel || 1}</div>
                                            <div className="aura-stat-container">
                                                <span className="aura-current-val">{(skill.metadata?.auraTotal || 0) % 12}</span>
                                                <span className="aura-max-val">/ 12</span>
                                            </div>
                                        </div>
                                        <div className="aura-bar-container">
                                            <div
                                                className="aura-bar-fill"
                                                style={{
                                                    width: `${(((skill.metadata?.auraTotal || 0) % 12) / 12) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="skill-objectives-preview">
                                        {skillObjectives.length > 0 ? (
                                            <ul className="mini-objective-list">
                                                {skillObjectives.slice(0, 3).map(obj => (
                                                    <li key={obj.id} className="mini-objective-item">
                                                        {obj.metadata?.iconUrl ? (
                                                            <div className="mini-icon" style={{ marginRight: '6px', display: 'inline-flex' }}>
                                                                <NodeIcon iconUrl={obj.metadata.iconUrl} size={14} />
                                                            </div>
                                                        ) : (
                                                            <span className="dot"></span>
                                                        )}
                                                        {obj.name}
                                                    </li>
                                                ))}
                                                {skillObjectives.length > 3 && <li className="mini-objective-more">+{skillObjectives.length - 3} more</li>}
                                            </ul>
                                        ) : (
                                            <div className="no-objectives-hint">No objectives set</div>
                                        )}
                                    </div>
                                </Link>

                                <footer className="skill-card-footer">
                                    <div className="footer-left">
                                        <button
                                            className="skill-status-btn sleep"
                                            onClick={(e) => handleToggleSkill(e, skill)}
                                        >
                                            Put to Sleep
                                        </button>

                                        {!skill.metadata?.cooldownActive ? (
                                            <button
                                                className="skill-status-btn rest"
                                                onClick={async (e) => {

                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (window.confirm(`Start 5-day rest period for ${skill.name}?`)) {
                                                        await backbone.startManualCooldown(skill.id);
                                                        fetchData();
                                                    }
                                                }}
                                            >
                                                Rest 5 Days
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '600', padding: '6px 10px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px' }}>
                                                Resting (5d cycle)
                                            </span>
                                        )}
                                    </div>
                                    {skill.metadata?.pinchState && (
                                        <div className="pinch-tag">
                                            {skill.metadata.pinchState}
                                        </div>
                                    )}
                                </footer>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="skills-section sleeping-section">
                <div className="section-header" onClick={() => setIsSleepingSkillsCollapsed(!isSleepingSkillsCollapsed)}>
                    <NodeIcon iconUrl={isSleepingSkillsCollapsed ? SVG_ICONS.CHEVRON_RIGHT : SVG_ICONS.CHEVRON_DOWN} size={14} />
                    <h2>Sleeping Skills</h2>
                    <span className="count-badge">{sleepingSkills.length}</span>
                </div>

                {!isSleepingSkillsCollapsed && (
                    <div className="skills-grid sleeping-grid">
                        {sleepingSkills.map(skill => (
                            <div key={skill.id} className="skill-card is-sleeping">
                                <Link to={`/skill/${skill.id}`} className="skill-card-link">
                                    <header className="skill-card-header">
                                        <div className="skill-title-group">
                                            <h3 className="skill-name">{skill.name}</h3>
                                        </div>
                                        <span className={`tier-badge ${skill.metadata?.identityTier?.toLowerCase() || 'optional'}`}>
                                            {getTierLabel(skill.metadata?.identityTier)}
                                        </span>
                                    </header>

                                    <div className="aura-display-new">
                                        <div className="aura-header-row">
                                            <div className="aura-badge-insignia">L{skill.metadata?.auraLevel || 1}</div>
                                            <div className="aura-stat-container">
                                                <span className="aura-current-val">{(skill.metadata?.auraTotal || 0) % 12}</span>
                                                <span className="aura-max-val">/ 12</span>
                                            </div>
                                        </div>
                                        <div className="aura-bar-container">
                                            <div
                                                className="aura-bar-fill"
                                                style={{
                                                    width: `${(((skill.metadata?.auraTotal || 0) % 12) / 12) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </Link>

                                <footer className="skill-card-footer">
                                    <div className="footer-left">
                                        <button
                                            className="skill-status-btn activate"
                                            onClick={(e) => handleToggleSkill(e, skill)}
                                        >
                                            <NodeIcon iconUrl={SVG_ICONS.ROCKET} size={14} />
                                            Activate
                                        </button>
                                    </div>
                                    {skill.metadata?.pinchState && (
                                        <div className="pinch-tag">
                                            {skill.metadata.pinchState}
                                        </div>
                                    )}
                                </footer>
                            </div>
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
                        <div className="limit-modal-icon">🚫</div>
                        <p className="limit-modal-message">
                            You can only have 3 Active Skills. Put one to sleep to activate this one.
                        </p>
                        <button className="limit-modal-btn" onClick={() => setIsLimitModalOpen(false)}>
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AreaPage;
