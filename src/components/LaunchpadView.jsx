import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import './LaunchpadView.css';
import NodeIcon from './NodeIcon';
import AreaCard from './AreaCard';
import { Coins } from 'lucide-react';
import HabitCard from './HabitCard';
import { formatDuration } from '../utils/timeUtils';


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
    onMaintenanceReplace,
    maintenanceHabitGroups = [],
    onHabitComplete
}) => {
    const { energyLevel, currencyName } = useSettings();
    const [selectedAreaIds, setSelectedAreaIds] = useState([]);
    const [isKeepAliveExpanded, setIsKeepAliveExpanded] = useState(false);
    const isInitialized = useRef(false);

    // Force expanded in low energy
    useEffect(() => {
        if (energyLevel <= 2) setIsKeepAliveExpanded(true);
    }, [energyLevel]);

    // Initial default selection: Top 3 Areas on first data load
    useEffect(() => {
        if (!isInitialized.current && areas.length > 0) {
            const top3 = areas.slice(0, 3).map(a => a.id);
            setSelectedAreaIds(top3);
            isInitialized.current = true;
        }
    }, [areas]);

    const toggleSelection = useCallback((areaId) => {
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
    }, []);
    return (
        <div className="launchpad-view">
            {/* 1. FIXED HEADER SECTION */}
            <header className="launchpad-fixed-header">
                <div className="header-stat">
                    <span className="stat-label">{currencyName} Balance</span>
                    <span className="stat-value hryvnia" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Coins size={18} style={{ color: 'var(--color-accent)' }} />
                        {hryvniaBalance}
                    </span>
                </div>
            </header>

            {/* 2. MAIN SECTION - AREA CARDS (Hidden in low energy) */}
            {energyLevel >= 3 && (
                <main className="area-cards-container">
                    {areas.map(area => (
                        <AreaCard 
                            key={area.id}
                            area={area}
                            isSelected={selectedAreaIds.includes(area.id)}
                            onToggle={toggleSelection}
                        />
                    ))}
                </main>
            )}

            {/* 3. MAINTENANCE PANEL */}
            {maintenance && (
                <section className="maintenance-panel">
                    <h3 className="maintenance-title">Today's Maintenance</h3>
                    <div className="maintenance-card">
                        <div className="maintenance-info">
                            <span className="maintenance-label">{maintenance.metadata?.activityText}</span>
                            <span className="maintenance-duration">{formatDuration(maintenance.metadata?.durationMinutes, 'minutes')}</span>

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
            {/* 4. KEEP IT ALIVE (Maintenance Habits) SECTION */}
            <section className="keep-it-alive-section">
                <header 
                    className={`keep-it-alive-header ${isKeepAliveExpanded ? 'is-expanded' : ''}`}
                    onClick={() => setIsKeepAliveExpanded(!isKeepAliveExpanded)}
                >
                    <span className="toggle-chevron">‣</span>
                    <span className="keep-it-alive-title">Keep It Alive</span>
                </header>
                
                {isKeepAliveExpanded && (
                    <div className="keep-it-alive-content">
                        {maintenanceHabitGroups.length > 0 ? (
                            maintenanceHabitGroups.map(group => (
                                <div key={group.skill.id} className="keep-it-alive-group">
                                    <div className="keep-it-alive-skill-name">
                                        {group.skill.name}
                                    </div>
                                    <div className="keep-it-alive-habit-list">
                                        {!group.hasNoHabits ? (
                                            group.habits.map(habit => (
                                                <HabitCard 
                                                    key={habit.id}
                                                    habit={habit}
                                                    onComplete={onHabitComplete}
                                                    onToggleActive={() => {}} // Non-functional in Launchpad
                                                    onOpenEvolution={() => {}} // Non-functional in Launchpad
                                                />
                                            ))
                                        ) : (
                                            <div className="keep-it-alive-placeholder">
                                                Open this skill for {formatDuration(2, 'minutes')}

                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="everything-is-alive-message">
                                {energyLevel <= 2 && maintenanceHabitGroups.length > 0 ? (
                                    <div className="low-energy-instruction">
                                        <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>Open: {maintenanceHabitGroups[0].skill.name}</div>
                                        <div style={{ fontSize: '14px', opacity: 0.6 }}>Just 2 minutes of focus.</div>
                                    </div>
                                ) : (
                                    "Everything is alive today."
                                )}
                            </div>
                        )}
                    </div>
                )}
            </section>

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
