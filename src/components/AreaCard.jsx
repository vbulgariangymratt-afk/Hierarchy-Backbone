import React from 'react';
import NodeIcon from './NodeIcon';
import { formatDuration } from '../utils/timeUtils';

/**
 * AreaCard Component
 * 
 * Renders an Area Selection card for the Launchpad.
 * Wrapped in React.memo to prevent unnecessary re-renders when other areas are selected.
 */
const AreaCard = React.memo(({ area, isSelected, onToggle }) => {
    return (
        <div
            className={`area-card ${area.inMotion ? 'is-motion' : ''} ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onToggle(area.id)}
        >
            {/* Selection Checkmark Indicator */}
            {isSelected && (
                <div className="selection-indicator">
                    <span className="check-icon">✓</span>
                </div>
            )}

            {/* Area Aura Badge (Top-Right) */}
            <div className="area-aura-badge">
                <span className="aura-badge-value">{area.areaAura}</span>
                <span className="aura-badge-label">Aura</span>
            </div>

            <div className="area-card-header">
                <div className="area-icon-container">
                    <NodeIcon
                        iconUrl={area.metadata?.iconUrl}
                        defaultIcon="🌐"
                        size={24}
                    />
                </div>
                <div className="area-header-badges">
                    {area.inMotion && (
                        <div className="motion-badge">In Motion</div>
                    )}
                    {area.activePinch && (
                        <div className="pinch-badge">
                            PINCH: {area.activePinch}
                        </div>
                    )}
                </div>
            </div>

            <div className="area-info">
                <h2 className="area-name">
                    {area.name}
                    {area.hasActiveSkills && <span className="active-marker-dot"></span>}
                </h2>
                <p className="area-value-statement">
                    {area.metadata?.identityAnchor}
                </p>
            </div>

            {area.stageInfo && (
                <div className="stage-momentum">
                    <span className="stage-label">
                        Currently starting Stage {area.stageInfo.currentStageIndex} of {area.stageInfo.totalStages}
                    </span>
                    <div className="stage-pips">
                        {Array.from({ length: area.stageInfo.totalStages }).map((_, i) => (
                            <div key={i} className="stage-pip">
                                <div
                                    className={`pip-fill ${i < area.stageInfo.currentStageIndex - 1 ? 'is-complete' : ''} ${i === area.stageInfo.currentStageIndex - 1 ? 'is-current' : ''}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {area.nextMinimalStep ? (
                <div className="inviting-action-block">
                    <div className="action-main-text">
                        {formatDuration(5, 'minutes')} on <span className="task-highlight">{area.nextMinimalStep.label}</span>
                    </div>

                    <div className="action-reward-text">
                        +{area.nextMinimalStep.auraReward} Aura
                    </div>
                </div>
            ) : (
                <div className="no-task-placeholder">
                    No active focus tasks found
                </div>
            )}
        </div>
    );
});

export default AreaCard;
