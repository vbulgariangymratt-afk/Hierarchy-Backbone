import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { backbone, repository, NodeTypes, IdentityTiers } from '../backbone-v2/index';
import './AreaPage.css';

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

    const [allNodes, setAllNodes] = useState([]);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [isSleepingSkillsCollapsed, setIsSleepingSkillsCollapsed] = useState(true);

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
                    auraTotal: 0
                }
            });
            setNewSkillName('');
            setNewSkillPinch('');
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

    if (loading) return <div className="area-page-loading">Loading Area...</div>;
    if (!area) return <div className="area-page-error">Area not found.</div>;

    const activeSkills = skills.filter(s => s.metadata?.status === 'ACTIVE' || (s.metadata?.isActive && s.metadata?.status !== 'SLEEPING'));
    const sleepingSkills = skills.filter(s => !activeSkills.includes(s));

    return (
        <div className="area-page">
            <header className="area-page-header">
                <h1 className="area-title">{area.name}</h1>
                <p className="area-identity-anchor">{area.metadata?.identityAnchor}</p>
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
                                            <h3 className="skill-name">{skill.name}</h3>
                                            <span className={`tier-badge ${skill.metadata?.identityTier?.toLowerCase() || 'optional'}`}>
                                                {getTierLabel(skill.metadata?.identityTier)}
                                            </span>
                                            <div className="aura-display-new" style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                marginLeft: 'auto',
                                                padding: '4px 8px',
                                                background: 'var(--alpha-low)',
                                                borderRadius: '8px'
                                            }}>
                                                <div className="aura-badge-sq" style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '1.5px solid #3b82f6',
                                                    borderRadius: '6px',
                                                    background: 'rgba(59, 130, 246, 0.05)',
                                                    color: '#3b82f6',
                                                    fontSize: '14px',
                                                    fontWeight: '800'
                                                }}>
                                                    L{skill.metadata?.auraLevel || 1}
                                                </div>
                                                <div className="aura-progress-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                                        <span>Aura</span>
                                                        <span>{(skill.metadata?.auraTotal || 0) % 12} / 12</span>
                                                    </div>
                                                    <div className="aura-bar-container" style={{ width: '100%', height: '4px', background: 'var(--alpha-medium)', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div
                                                            className="aura-bar-fill"
                                                            style={{
                                                                width: `${(((skill.metadata?.auraTotal || 0) % 12) / 12) * 100}%`,
                                                                height: '100%',
                                                                background: '#c29462',
                                                                borderRadius: '2px'
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </header>

                                    <div className="skill-objectives-preview">
                                        {skillObjectives.length > 0 ? (
                                            <ul className="mini-objective-list">
                                                {skillObjectives.slice(0, 3).map(obj => (
                                                    <li key={obj.id} className="mini-objective-item">
                                                        <span className="dot"></span>
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
                                    <div className="footer-left" style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="skill-status-btn sleep"
                                            onClick={(e) => handleToggleSkill(e, skill)}
                                        >
                                            💤 Put to Sleep
                                        </button>

                                        {!skill.metadata?.cooldownActive ? (
                                            <button
                                                className="skill-status-btn rest"
                                                style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (window.confirm(`Start 5-day rest period for ${skill.name}?`)) {
                                                        await backbone.startManualCooldown(skill.id);
                                                        fetchData();
                                                    }
                                                }}
                                            >
                                                🛌 Rest 5 Days
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
                <div className="section-header collapsible" onClick={() => setIsSleepingSkillsCollapsed(!isSleepingSkillsCollapsed)}>
                    <h2 className="section-title">Sleeping Skills ({sleepingSkills.length})</h2>
                    <span className="collapse-arrow">{isSleepingSkillsCollapsed ? '▼' : '▲'}</span>
                </div>

                {!isSleepingSkillsCollapsed && (
                    <div className="skills-grid sleeping-grid">
                        {sleepingSkills.map(skill => (
                            <div key={skill.id} className="skill-card is-sleeping">
                                <Link to={`/skill/${skill.id}`} className="skill-card-link">
                                    <header className="skill-card-header">
                                        <div className="skill-title-group">
                                            <h3 className="skill-name">{skill.name}</h3>
                                            <span className={`tier-badge ${skill.metadata?.identityTier?.toLowerCase() || 'optional'}`}>
                                                {getTierLabel(skill.metadata?.identityTier)}
                                            </span>
                                            <div className="aura-display-new" style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                marginLeft: 'auto',
                                                padding: '4px 8px',
                                                background: 'var(--alpha-low)',
                                                borderRadius: '8px'
                                            }}>
                                                <div className="aura-badge-sq" style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '1.5px solid #3b82f6',
                                                    borderRadius: '6px',
                                                    background: 'rgba(59, 130, 246, 0.05)',
                                                    color: '#3b82f6',
                                                    fontSize: '14px',
                                                    fontWeight: '800'
                                                }}>
                                                    L{skill.metadata?.auraLevel || 1}
                                                </div>
                                                <div className="aura-progress-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                                        <span>Aura</span>
                                                        <span>{(skill.metadata?.auraTotal || 0) % 12} / 12</span>
                                                    </div>
                                                    <div className="aura-bar-container" style={{ width: '100%', height: '4px', background: 'var(--alpha-medium)', borderRadius: '2px', overflow: 'hidden' }}>
                                                        <div
                                                            className="aura-bar-fill"
                                                            style={{
                                                                width: `${(((skill.metadata?.auraTotal || 0) % 12) / 12) * 100}%`,
                                                                height: '100%',
                                                                background: '#c29462',
                                                                borderRadius: '2px'
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </header>
                                </Link>

                                <footer className="skill-card-footer">
                                    <div className="footer-left">
                                        <button
                                            className="skill-status-btn activate"
                                            onClick={(e) => handleToggleSkill(e, skill)}
                                        >
                                            🚀 Activate
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
                                    <div className="creation-actions">
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
