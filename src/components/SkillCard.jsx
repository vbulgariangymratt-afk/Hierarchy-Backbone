import React from 'react';
import { Link } from 'react-router-dom';
import NodeIcon from './NodeIcon';
import BorderGlow from './ui/BorderGlow';
import { NodeTypes } from '../backbone-v2/index';

/**
 * SkillCard Component
 * 
 * Renders an individual skill card for the AreaPage.
 * Wrapped in React.memo with custom comparison to prevent unnecessary re-renders.
 */
const SkillCard = React.memo(({ 
    skill, 
    allNodes, 
    isSleeping,
    inlineEditingId,
    inlineDraftName,
    editingTierSkillId,
    onStartInlineEdit,
    onSaveInlineEdit,
    onInlineKeyDown,
    onSetInlineDraftName,
    onTierChange,
    onSetEditingTierSkillId,
    onToggleSkill,
    onSleepSkill,
    getTierLabel,
    inlineInputRef,
    tierSelectRef,
    SVG_ICONS
}) => {
    const skillObjectives = allNodes.filter(n => 
        n.parentId === skill.id && 
        n.type === NodeTypes.OBJECTIVE &&
        !n.metadata?.isArchived &&
        !n.metadata?.isSleeping &&
        n.metadata?.status !== 'COMPLETED' &&
        n.metadata?.status !== 'ACHIEVED'
    );
    const auraTotal = skill.metadata?.auraTotal || 0;
    const auraLevel = skill.metadata?.auraLevel || 1;
    const progress = (auraTotal % 12) / 12 * 100;

    return (
        <div className={`skill-card ${isSleeping ? 'is-sleeping' : 'is-active'}`} style={{ padding: 0, overflow: 'visible', position: 'relative' }}>
            {skill.metadata?.pinchState && (
                <div className="pinch-tag">
                    {skill.metadata.pinchState === 'HURRY' ? 'URGENCY' : skill.metadata.pinchState}
                </div>
            )}
            <BorderGlow
                className="skill-card-glow-wrapper"
                borderRadius={8}
                backgroundColor="transparent"
                glowColor="94 106 210"
                glowIntensity={0.65}
            >
                <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>

                    {/* ROW 1: Title · Tier Badge · [Level Badge · Progress Bar · Counter] all in one flat flex row */}
                    <div className="skill-card-row1">
                        <Link
                            to={`/skill/${skill.id}`}
                            className="skill-card-row1-link"
                            style={{ display: 'contents' }}
                        >
                            {skill.metadata?.iconUrl && (
                                <span className="skill-icon-container-inline">
                                    <NodeIcon iconUrl={skill.metadata.iconUrl} size={16} />
                                </span>
                            )}

                            {inlineEditingId === skill.id ? (
                                <input
                                    ref={inlineInputRef}
                                    value={inlineDraftName}
                                    onChange={e => onSetInlineDraftName(e.target.value)}
                                    onBlur={() => onSaveInlineEdit(skill.id)}
                                    onKeyDown={e => onInlineKeyDown(e, skill.id)}
                                    onClick={e => e.preventDefault()}
                                    className="skill-inline-input"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid var(--color-accent)',
                                        color: 'inherit',
                                        fontSize: 'inherit',
                                        fontWeight: 'inherit',
                                        outline: 'none',
                                        width: '240px'
                                    }}
                                />
                            ) : (
                                <h3
                                    className="skill-name"
                                    onDoubleClick={(e) => { e.preventDefault(); onStartInlineEdit(skill.id, skill.name); }}
                                >
                                    {skill.metadata?.identityAnchor?.trim()
                                        ? `Becoming ${skill.metadata.identityAnchor.trim().charAt(0).toLowerCase() + skill.metadata.identityAnchor.trim().slice(1)}`
                                        : skill.name
                                    }
                                </h3>
                            )}
                        </Link>

                        {editingTierSkillId === skill.id ? (
                            <select
                                ref={tierSelectRef}
                                autoFocus
                                value={skill.metadata?.identityTier || 'OPTIONAL'}
                                onChange={(e) => onTierChange(skill.id, e.target.value)}
                                onBlur={() => onSetEditingTierSkillId(null)}
                                onKeyDown={(e) => e.key === 'Escape' && onSetEditingTierSkillId(null)}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                className="tier-select"
                                style={{
                                    padding: '2px 4px',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    background: 'var(--alpha-medium)',
                                    color: 'var(--color-text)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="CORE">Core Identity</option>
                                <option value="EXPLORATION">Explorational</option>
                                <option value="OPTIONAL">Optional</option>
                            </select>
                        ) : (
                            <span
                                className={`tier-badge ${skill.metadata?.identityTier?.toLowerCase() || 'optional'}`}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetEditingTierSkillId(skill.id); }}
                                style={{ cursor: 'pointer' }}
                                title="Click to change tier"
                            >
                                {getTierLabel(skill.metadata?.identityTier)}
                            </span>
                        )}

                        {isSleeping && (
                            <span className="sleep-badge-label" style={{ fontSize: '11px', opacity: 0.5, fontWeight: 600 }}>
                                {skill.metadata?.sleepUntil
                                    ? `Sleep until ${new Date(skill.metadata.sleepUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                                    : 'Indefinite Sleep'}
                            </span>
                        )}

                        {/* Spacer pushes the right-side elements to the far right */}
                        <span className="skill-row1-spacer" />

                        <span className="aura-badge-insignia">L{auraLevel}</span>
                        <div className="progress-track">
                            <div className="progress-fill-aura" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="progress-percentage-label">{auraTotal % 12}/12</span>
                    </div>

                    {/* ROW 2: Active Experiment (left) · Action Buttons (right) */}
                    {!isSleeping && (
                        <div className="skill-card-row2">
                            <div className="skill-objectives-preview">
                                {(() => {
                                    const activeObjectives = [...skillObjectives]
                                        .sort((a, b) => {
                                            const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                                            const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                                            return timeB - timeA;
                                        })
                                        .slice(0, 1);

                                    return activeObjectives.length > 0 ? (
                                        <Link to={`/skill/${skill.id}`} className="mini-objective-inline-list">
                                            <span className="active-experiment-label">Active Experiment: </span>
                                            <span className="mini-objective-inline-item">
                                                {activeObjectives[0].metadata?.iconUrl && (
                                                    <span className="mini-icon" style={{ marginRight: '3px', display: 'inline-flex', verticalAlign: 'middle' }}>
                                                        <NodeIcon iconUrl={activeObjectives[0].metadata.iconUrl} size={12} />
                                                    </span>
                                                )}
                                                {activeObjectives[0].name}
                                            </span>
                                            {skillObjectives.length > 1 && (
                                                <span className="mini-objective-more" style={{ marginLeft: '6px' }}>
                                                    (+{skillObjectives.length - 1})
                                                </span>
                                            )}
                                        </Link>
                                    ) : (
                                        <div className="no-objectives-hint">No objectives set</div>
                                    );
                                })()}
                            </div>

                            <div className="skill-card-actions">
                                <button className="skill-status-btn sleep" onClick={(e) => onToggleSkill(e, skill)}>
                                    Put to Sleep
                                </button>
                                <button className="skill-status-btn rest" onClick={(e) => onSleepSkill(e, skill)}>
                                    Rest 5 Days
                                </button>
                            </div>
                        </div>
                    )}

                    {isSleeping && (
                        <div className="skill-card-row2">
                            <div className="skill-objectives-preview" />
                            <div className="skill-card-actions">
                                <button className="skill-status-btn activate" onClick={(e) => onToggleSkill(e, skill)}>
                                    <NodeIcon iconUrl={SVG_ICONS.ROCKET} size={14} />
                                    Wake Up
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </BorderGlow>
        </div>
    );
}, (prev, next) => {
    // Custom comparison to minimize re-renders
    // Only re-render if:
    // 1. The skill node itself was updated or renamed
    // 2. The sleep state changed
    // 3. The objectives beneath it changed
    // 4. Any of the active UI states (editing, tier selection) changed
    // 5. The draft name changed (needed for live typing during rename)
    
    const prevObjectives = prev.allNodes.filter(n => n.parentId === prev.skill.id);
    const nextObjectives = next.allNodes.filter(n => n.parentId === next.skill.id);
    
    const objectivesMatch = prevObjectives.length === nextObjectives.length &&
        prevObjectives.every((o, i) => o.updatedAt === nextObjectives[i].updatedAt);

    return (
        prev.skill.updatedAt === next.skill.updatedAt &&
        prev.skill.name === next.skill.name &&
        prev.isSleeping === next.isSleeping &&
        prev.inlineEditingId === next.inlineEditingId &&
        prev.editingTierSkillId === next.editingTierSkillId &&
        prev.inlineDraftName === next.inlineDraftName &&
        objectivesMatch
    );
});

export default SkillCard;
