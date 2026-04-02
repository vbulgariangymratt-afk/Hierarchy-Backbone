import React from 'react';
import { Link } from 'react-router-dom';
import NodeIcon from './NodeIcon';
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
    const skillObjectives = allNodes.filter(n => n.parentId === skill.id && n.type === NodeTypes.OBJECTIVE);
    const auraTotal = skill.metadata?.auraTotal || 0;
    const auraLevel = skill.metadata?.auraLevel || 1;
    const progress = (auraTotal % 12) / 12 * 100;

    return (
        <div className={`skill-card ${isSleeping ? 'is-sleeping' : 'is-active'}`}>
            <Link to={`/skill/${skill.id}`} className="skill-card-link">
                <header className="skill-card-header">
                    <div className="skill-title-group">
                        {skill.metadata?.iconUrl && (
                            <div className="skill-icon-container" style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
                                <NodeIcon iconUrl={skill.metadata.iconUrl} size={28} />
                            </div>
                        )}
                        {inlineEditingId === skill.id ? (
                            <input
                                ref={inlineInputRef}
                                value={inlineDraftName}
                                onChange={e => onSetInlineDraftName(e.target.value)}
                                onBlur={() => onSaveInlineEdit(skill.id)}
                                onKeyDown={e => onInlineKeyDown(e, skill.id)}
                                onClick={e => e.preventDefault()}
                                style={{ 
                                    background: 'transparent', 
                                    border: 'none', 
                                    borderBottom: '1px solid var(--color-accent)', 
                                    color: 'inherit', 
                                    fontSize: 'inherit', 
                                    fontWeight: 'inherit', 
                                    outline: 'none', 
                                    width: '100%' 
                                }}
                            />
                        ) : (
                            <h3 className="skill-name" onDoubleClick={(e) => { e.preventDefault(); onStartInlineEdit(skill.id, skill.name); }}>
                                {skill.name}
                            </h3>
                        )}
                    </div>
                    
                    {editingTierSkillId === skill.id ? (
                        <select
                            ref={tierSelectRef}
                            autoFocus
                            value={skill.metadata?.identityTier || 'OPTIONAL'}
                            onChange={(e) => onTierChange(skill.id, e.target.value)}
                            onBlur={() => onSetEditingTierSkillId(null)}
                            onKeyDown={(e) => e.key === 'Escape' && onSetEditingTierSkillId(null)}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
                </header>

                <div className="aura-display-new">
                    <div className="aura-header-row">
                        <div className="aura-badge-insignia">L{auraLevel}</div>
                        <div className="aura-stat-container">
                            <span className="aura-current-val">{auraTotal % 12}</span>
                            <span className="aura-max-val">/ 12</span>
                        </div>
                    </div>
                    <div className="aura-bar-container">
                        <div className="aura-bar-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                {!isSleeping && (
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
                )}
            </Link>

            <footer className="skill-card-footer">
                <div className="footer-left">
                    {isSleeping ? (
                        <>
                            <button className="skill-status-btn activate" onClick={(e) => onToggleSkill(e, skill)}>
                                <NodeIcon iconUrl={SVG_ICONS.ROCKET} size={14} />
                                Wake Up
                            </button>
                            {skill.metadata?.sleepUntil && (
                                <span style={{ fontSize: '11px', opacity: 0.6, fontWeight: 600 }}>
                                    Sleep until {new Date(skill.metadata.sleepUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                            )}
                            {skill.metadata?.isSleeping && (
                                <span style={{ fontSize: '11px', opacity: 0.6, fontWeight: 600 }}>
                                    Indefinite Sleep
                                </span>
                            )}
                        </>
                    ) : (
                        <>
                            <button className="skill-status-btn sleep" onClick={(e) => onToggleSkill(e, skill)}>
                                Put to Sleep
                            </button>
                            <button className="skill-status-btn rest" onClick={(e) => onSleepSkill(e, skill)}>
                                Rest 5 Days
                            </button>
                        </>
                    )}
                </div>
                {skill.metadata?.pinchState && (
                    <div className="pinch-tag">{skill.metadata.pinchState}</div>
                )}
            </footer>
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
