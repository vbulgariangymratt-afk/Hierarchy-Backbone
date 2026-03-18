import React, { useState, useEffect } from 'react';
import { habitService } from '../backbone-v2/index';

const EvolutionDrillIn = ({ habit, skill, onClose, onRefresh }) => {
    const [stats, setStats] = useState(null);
    const [newVariation, setNewVariation] = useState('');
    const [isUpgrading, setIsUpgrading] = useState(false);

    useEffect(() => {
        const loadStats = async () => {
            const eligibility = await habitService.evaluateEvolutionEligibility(habit.id);
            setStats(eligibility);
        };
        loadStats();
    }, [habit.id]);

    const handleLevelUp = async () => {
        if (habit.currentPhaseLevel >= 4 && !newVariation.trim()) {
            alert("Please define the next variation for this open-ended phase.");
            return;
        }

        try {
            setIsUpgrading(true);
            const desc = habit.currentPhaseLevel >= 4 ? newVariation.trim() : ""; // Backend handles growth if level < 5
            await habitService.upgradePhase(habit.id, desc);
            onRefresh();
            onClose();
        } catch (error) {
            alert(error.message);
        } finally {
            setIsUpgrading(false);
        }
    };

    if (!stats) return <div className="evolution-drill-in-overlay">Loading Evolution Data...</div>;

    const currentPhase = habit.phases?.[habit.currentPhaseLevel] || {};
    const stabilityPercent = Math.round((stats.stabilityCount / 12) * 100);
    const isReady = stats.evolutionReady;
    const isPostCap = habit.currentPhaseLevel >= 4;

    return (
        <div className="evolution-drill-in-overlay" onClick={onClose}>
            <div className="evolution-modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="header-text">
                        <h3>Habit Evolution</h3>
                        <p className="subtitle">{habit.ifTrigger}</p>
                    </div>
                    <button className="close-x" onClick={onClose}>×</button>
                </header>

                <div className="modal-body">
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <span className="label">Stability (12d)</span>
                            <span className="value">{stats.stabilityCount}/12</span>
                            <div className="progress-bar-bg">
                                <div className="progress-fill" style={{ width: `${stabilityPercent}%` }}></div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <span className="label">Lifetime</span>
                            <span className="value">{habit.totalCompletions || 0}</span>
                            <span className="sub-value">Goal: {currentPhase.threshold}</span>
                        </div>
                        <div className="metric-card">
                            <span className="label">Friction (8x)</span>
                            <span className="value">{stats.frictionAvg?.toFixed(1) || 'N/A'}</span>
                            <span className={`status-pill ${stats.frictionGate ? 'pass' : 'fail'}`}>
                                {stats.frictionGate ? 'Solid' : 'Unstable'}
                            </span>
                        </div>
                    </div>

                    <div className="identity-reinforcement">
                        <p className="becoming-message">This habit is stabilizing.</p>
                        <p className="identity-anchor">
                            You are becoming someone with {skill.metadata?.identityAnchor || 'unstoppable momentum'}.
                        </p>
                    </div>

                    {isReady ? (
                        <div className="evolution-actions">
                            {isPostCap ? (
                                <div className="post-cap-creation">
                                    <label>Define Habit Variation / Refinement</label>
                                    <textarea
                                        placeholder="Higher intensity, different context, or refined form..."
                                        value={newVariation}
                                        onChange={e => setNewVariation(e.target.value)}
                                    />
                                    <button
                                        className="evolve-btn"
                                        disabled={isUpgrading}
                                        onClick={handleLevelUp}
                                    >
                                        Solidify & Evolve
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="evolve-btn"
                                    disabled={isUpgrading}
                                    onClick={handleLevelUp}
                                >
                                    Solidify & Evolve
                                </button>
                            )}
                            <p className="manual-hint">Manual confirmation required to upgrade phase.</p>
                        </div>
                    ) : (
                        <div className="evolution-status-message">
                            Continuing baseline execution. Evolution gates are currently locked.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(EvolutionDrillIn);
