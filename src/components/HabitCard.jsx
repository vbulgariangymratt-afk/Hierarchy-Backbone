import React, { useState, useEffect } from 'react';
import { habitService } from '../backbone-v2/index';
import HabitEvolutionGauge from './habits/HabitEvolutionGauge';
import { Feather, Circle, Flame, X, HelpCircle, Pencil, Save, XCircle, Dumbbell } from 'lucide-react';


const HabitCard = React.memo(({ habit, onOpenEvolution, onToggleActive, onComplete, onUpdate }) => {
    const [completing, setCompleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);
    const [eligibility, setEligibility] = useState(null);
    
    useEffect(() => {
        let isMounted = true;
        const fetchElig = async () => {
            try {
                const data = await habitService.evaluateEvolutionEligibility(habit.id);
                if (isMounted) setEligibility(data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchElig();
        return () => { isMounted = false; };
    }, [habit.id]);

    const [editForm, setEditForm] = useState({
        ifTrigger: habit.ifTrigger,
        description: habit.phases?.[habit.currentPhaseLevel]?.description || '',
        targetPeriod: habit.targetPeriod || habit.frequencyType || 'day',
        targetCount: habit.targetCount || 1
    });

    const currentPhase = habit.phases?.[habit.currentPhaseLevel] || {};
    const progress = habitService.getHabitProgress(habit);

    const handleComplete = async (friction) => {
        try {
            setIsPulsing(true);
            setTimeout(() => setIsPulsing(false), 500);
            await habitService.completeHabit(habit.id, friction);
            setCompleting(false);
            if (onComplete) onComplete(habit.id);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveEdit = async () => {
        try {
            const updatedPhases = [...(habit.phases || [])];
            if (updatedPhases[habit.currentPhaseLevel]) {
                updatedPhases[habit.currentPhaseLevel] = {
                    ...updatedPhases[habit.currentPhaseLevel],
                    description: editForm.description
                };
            }

            await habitService.updateHabit(habit.id, {
                ifTrigger: editForm.ifTrigger,
                targetPeriod: editForm.targetPeriod,
                targetCount: parseInt(editForm.targetCount) || 1,
                phases: updatedPhases
            });
            setIsEditing(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
        }
    };

    if (isEditing) {
        return (
            <div className="habit-card-minimal editing" id={`habit-${habit.id}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
                    <div className="edit-section">
                        <label className="edit-label">Identity / Intent</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.4, fontWeight: 800 }}>IF</span>
                            <input 
                                type="text" 
                                value={editForm.ifTrigger} 
                                onChange={e => setEditForm({...editForm, ifTrigger: e.target.value})}
                                className="habit-edit-input"
                                placeholder="I sit down to work"
                            />
                        </div>
                    </div>

                    <div className="edit-section">
                        <label className="edit-label">Current Action (Phase {habit.currentPhaseLevel + 1})</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(96, 165, 250, 0.6)', fontWeight: 800 }}>THEN</span>
                            <input 
                                type="text" 
                                value={editForm.description} 
                                onChange={e => setEditForm({...editForm, description: e.target.value})}
                                className="habit-edit-input"
                                placeholder="I open the hierarchy"
                            />
                        </div>
                    </div>

                    <div className="edit-section">
                        <label className="edit-label">Frequency Target</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input 
                                type="number" 
                                min="1"
                                max="100"
                                value={editForm.targetCount} 
                                onChange={e => setEditForm({...editForm, targetCount: e.target.value})}
                                className="habit-edit-input"
                                style={{ width: '60px', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '13px', opacity: 0.6 }}>times per</span>
                            <select 
                                value={editForm.targetPeriod}
                                onChange={e => setEditForm({...editForm, targetPeriod: e.target.value})}
                                className="habit-edit-select"
                            >
                                <option value="day">day</option>
                                <option value="week">week</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button className="habit-save-btn" onClick={handleSaveEdit}>
                            <Save size={14} /> Save Changes
                        </button>
                        <button className="habit-cancel-btn" onClick={() => setIsEditing(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Eligibility logic
    let validCompletions = 0;
    let requiredCompletions = 1;
    let barPercentage = 0;
    let compsRemaining = 0;
    
    if (eligibility) {
        validCompletions = (habit?.completions || []).filter(c => c.friction !== 'heavy' && c.friction !== 'high' && c.friction !== 'fail').length;
        requiredCompletions = eligibility.gateStatus.lifetime.required || 1;
        compsRemaining = Math.max(0, requiredCompletions - validCompletions);
        barPercentage = Math.min(100, (validCompletions / requiredCompletions) * 100);
    }

    return (
        <div className={`habit-card-minimal ${progress.isDone ? "completed sage-glow" : ""} ${isPulsing ? "satisfaction-pulse" : ""}`} id={`habit-${habit.id}`}>
            
            {/* 1. Header (Top Row) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div className="habit-intention" style={{ fontSize: '13.5px', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', overflow: 'hidden', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 800, flexShrink: 0, fontSize: '13.5px' }}>IF</span> 
                    <span style={{ fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden' }}>{habit.ifTrigger}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 800, flexShrink: 0, fontSize: '13.5px' }}>THEN</span>
                    <span style={{ fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentPhase.description}</span>
                </div>
                
                {/* Top Right: Icons & Activation Config */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                    <button className="habit-edit-icon-btn" onClick={() => setIsEditing(true)} title="Edit Habit">
                        <Pencil size={14} />
                    </button>
                    <div className="habit-tooltip-wrapper">
                        <span className="habit-help-icon">
                            <HelpCircle size={14} />
                        </span>
                        <div className="habit-custom-tooltip">
                            This system turns chores into automatic reflexes by rewarding your steady rhythm instead of demanding perfect streaks. We track Friction as technical data to help you optimize without the weight of shame.
                        </div>
                    </div>
                    {!habit.isActive && (
                        <span className="habit-activation-tag paused" onClick={(e) => { e.stopPropagation(); onToggleActive?.(habit); }}>Paused</span>
                    )}
                </div>
            </div>

            {/* 2. Stats Row (Horizontal, Muted) */}
            {eligibility && (
                <div className="habit-stats-row">
                    <span>{habit.totalCompletions || 0} total</span>
                    <span style={{ opacity: 0.3 }}>•</span>
                    <span>Stability: {eligibility.gateStatus.stability.completedDays}/8</span>
                    <span style={{ opacity: 0.3 }}>•</span>
                    <span>Friction: {eligibility.gateStatus.friction.average.toFixed(1)}</span>
                    {progress.targetCount > 1 && (
                        <>
                            <span style={{ opacity: 0.3 }}>•</span>
                            <span>{progress.displayProgress}</span>
                        </>
                    )}
                </div>
            )}

            {/* 3. Global Action Row (Complete Button + Mastery Bar) */}
            <div className="habit-action-evolution-row">
                
                {/* Left: Complete Button / Friction Selector */}
                {habit.isActive && (
                    <div onClick={e => e.stopPropagation()} style={{ minWidth: completing ? '160px' : 'auto', transition: 'all 0.3s' }}>
                        {!completing ? (
                            <button className="complete-btn" onClick={() => setCompleting(true)}>
                                {progress.isDone ? '+ Log Extra' : 'Complete'}
                            </button>
                        ) : (
                            <div className="friction-selector-modern">
                                <div className="friction-option-wrapper">
                                    <button onClick={() => handleComplete('low')} className="friction-btn low">
                                        <Feather size={14} />
                                    </button>
                                    <span className="friction-tooltip">Light (easy)</span>
                                </div>
                                
                                <div className="friction-option-wrapper">
                                    <button onClick={() => handleComplete('medium')} className="friction-btn medium">
                                        <Flame size={14} />
                                    </button>
                                    <span className="friction-tooltip">Medium</span>
                                </div>
                                
                                <div className="friction-option-wrapper">
                                    <button onClick={() => handleComplete('high')} className="friction-btn high">
                                        <Dumbbell size={14} />
                                    </button>
                                    <span className="friction-tooltip">Heavy (hard)</span>
                                </div>

                                <div className="friction-option-wrapper">
                                    <button onClick={() => setCompleting(false)} className="friction-cancel">
                                        <XCircle size={14} />
                                    </button>
                                    <span className="friction-tooltip">Close</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Right: Mastery Area (Evolution progress bar) */}
                {eligibility && (
                    <div className={`mastery-bar-container ${progress.todayCount > 0 ? 'shimmer' : ''}`} style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <div className="phase-badge">Phase {habit.currentPhaseLevel + 1}</div>
                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                · {validCompletions >= 6 ? `${compsRemaining} more to level up` : 'In Progress'}
                            </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--alpha-high)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                            <div className={progress.todayCount > 0 ? 'shimmer-fill' : ''} style={{ width: `${barPercentage}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-accent) 0%, rgba(96, 165, 250, 0.8) 100%)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                        </div>
                    </div>
                )}
            </div>
            
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.habit.id === nextProps.habit.id &&
        prevProps.habit.ifTrigger === nextProps.habit.ifTrigger &&
        prevProps.habit.isActive === nextProps.habit.isActive &&
        prevProps.habit.currentPhaseLevel === nextProps.habit.currentPhaseLevel &&
        prevProps.habit.lastCompletedAt === nextProps.habit.lastCompletedAt &&
        prevProps.habit.frequencyType === nextProps.habit.frequencyType &&
        prevProps.habit.targetCount === nextProps.habit.targetCount &&
        JSON.stringify(prevProps.habit.completions) === JSON.stringify(nextProps.habit.completions) &&
        JSON.stringify(prevProps.habit.phases) === JSON.stringify(nextProps.habit.phases)
    );
});

export default HabitCard;
