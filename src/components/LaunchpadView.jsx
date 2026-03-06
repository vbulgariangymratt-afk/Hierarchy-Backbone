import React, { useState, useEffect, useRef } from 'react';
import './LaunchpadView.css';
import NodeIcon from './NodeIcon';

/**
 * LaunchpadView - Presentational with Local Selection State
 */
const LaunchpadView = ({
    auraPoints = 0,
    hryvniaBalance = 0,
    areas = [],
    maintenance = null,
    onStartDay,
    onMaintenanceComplete,
    onMaintenanceReplace
}) => {
    const [selectedAreaIds, setSelectedAreaIds] = useState([]);
    const isInitialized = useRef(false);

    // Initial default selection: Top 3 Areas on first data load
    useEffect(() => {
        if (!isInitialized.current && areas.length > 0) {
            const top3 = areas.slice(0, 3).map(a => a.id);
            setSelectedAreaIds(top3);
            isInitialized.current = true;
        }
    }, [areas]);

    const toggleSelection = (areaId) => {
        setSelectedAreaIds(prev => {
            const isSelected = prev.includes(areaId);
            if (isSelected) {
                if (prev.length <= 1) return prev; // Min 1
                return prev.filter(id => id !== areaId);
            } else {
                if (prev.length >= 3) return prev; // Max 3
                return [...prev, areaId];
            }
        });
    };
    return (
        <div className="launchpad-view">
            {/* 1. FIXED HEADER SECTION */}
            <header className="launchpad-fixed-header">
                <div className="header-stat">
                    <span className="stat-label">Hryvnia Balance</span>
                    <span className="stat-value hryvnia">₴{hryvniaBalance}</span>
                </div>
            </header>

            {/* 2. MAIN SECTION - AREA CARDS */}
            <main className="area-cards-container">
                {areas.map(area => {
                    const isSelected = selectedAreaIds.includes(area.id);
                    return (
                        <div
                            key={area.id}
                            className={`area-card ${area.inMotion ? 'is-motion' : ''} ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => toggleSelection(area.id)}
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
                                        emoji={area.icon}
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
                                        5 minutes on <span className="task-highlight">{area.nextMinimalStep.label}</span>
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
                })}
            </main>

            {/* 3. MAINTENANCE PANEL */}
            {maintenance && (
                <section className="maintenance-panel">
                    <h3 className="maintenance-title">Today's Maintenance</h3>
                    <div className="maintenance-card">
                        <div className="maintenance-info">
                            <span className="maintenance-label">{maintenance.metadata?.activityText}</span>
                            <span className="maintenance-duration">{maintenance.metadata?.durationMinutes} min</span>
                        </div>
                        <div className="maintenance-actions">
                            <button
                                className="maint-btn complete"
                                onClick={(e) => { e.stopPropagation(); onMaintenanceComplete?.(maintenance.id); }}
                            >
                                Complete
                            </button>
                            <button
                                className="maint-btn replace"
                                onClick={(e) => { e.stopPropagation(); onMaintenanceReplace?.(maintenance.id); }}
                            >
                                Replace
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* 4. START MY DAY BUTTON */}
            <div className="start-day-footer">
                <button
                    className="start-day-btn"
                    disabled={selectedAreaIds.length === 0}
                    onClick={() => onStartDay?.(selectedAreaIds)}
                >
                    Start My Day
                </button>
                <div className="selection-summary">
                    {selectedAreaIds.length} of 3 Areas Selected
                </div>
            </div>
        </div>
    );
};

export default LaunchpadView;
