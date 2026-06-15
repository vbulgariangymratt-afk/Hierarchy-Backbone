import React, { useState, useEffect } from 'react';
import { habitService } from '../backbone-v2/index';
import HabitEvolutionGauge from './habits/HabitEvolutionGauge';
import { Feather, Circle, Flame, X, HelpCircle, Pencil, Save, XCircle, Dumbbell, Moon, Sun } from 'lucide-react';
import { useBackboneStore } from '../store/backboneStore';
import { playCompletionSound } from '../utils/audioHelper';


const HabitCard = React.memo(({ habit, energyLevel, onOpenEvolution, onToggleActive, onComplete, onUpdate, onSleep, onDelete }) => {

    const [completing, setCompleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);
    const [eligibility, setEligibility] = useState(null);
    const [celebration, setCelebration] = useState(null); // { identity: string, fading: false, active: false, type: 'complete' | 'levelup' }
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // Get skill for identity reinforcement
    const nodes = useBackboneStore(state => state.nodes);

    useEffect(() => {
        let isMounted = true;
        const fetchElig = async () => {
            try {
                const data = await habitService.evaluateEvolutionEligibility(habit.id);
                if (isMounted) {
                    // Check if it just became ready to evolution
                    if (eligibility && !eligibility.evolutionReady && data.evolutionReady) {
                        triggerLevelUpCelebration();
                    }
                    setEligibility(data);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchElig();
        return () => { isMounted = false; };
    }, [habit.id, habit.totalCompletions]);

    const triggerLevelUpCelebration = () => {
        const skillId = habit.linkedSkillId || (habit.linkedSkillIds && habit.linkedSkillIds[0]);
        const skill = nodes.find(n => n.id === skillId);
        const identity = skill?.metadata?.identityAnchor || skill?.metadata?.wish || skill?.name || "your best self";

        setCelebration({ identity, fading: false, active: true, type: 'levelup' });

        try {
            const audio = new Audio('/Level-up chime.mp3');
            audio.volume = 0.5;
            audio.play();
        } catch (err) { }

        setTimeout(() => {
            setCelebration(prev => prev ? { ...prev, fading: true } : null);
            setTimeout(() => setCelebration(prev => prev ? { ...prev, active: false } : null), 400);
        }, 4000);
    };

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

            // 1. Identity Reinforcement Logic
            const skillId = habit.linkedSkillId || (habit.linkedSkillIds && habit.linkedSkillIds[0]);
            const skill = nodes.find(n => n.id === skillId);
            const identity = skill?.metadata?.identityAnchor || skill?.metadata?.wish || skill?.name || "your best self";

            setCelebration({ identity, fading: false, active: true, type: 'complete' });

            // 2. Audio Sync
            playCompletionSound(0.35);

            await habitService.completeHabit(habit.id, friction);
            setCompleting(false);

            // 3. Timing Orchestration
            // Ripple & Label (3s), Glow (5s)
            setTimeout(() => {
                setCelebration(prev => prev ? { ...prev, fading: true } : null);
                setTimeout(() => setCelebration(prev => prev ? { ...prev, active: false } : null), 300);
            }, 2700);

            // Lingering glow persists for 5s
            setTimeout(() => {
                setCelebration(null);
            }, 5000);

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
                                onChange={e => setEditForm({ ...editForm, ifTrigger: e.target.value })}
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
                                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
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
                                onChange={e => setEditForm({ ...editForm, targetCount: e.target.value })}
                                className="habit-edit-input"
                                style={{ width: '60px', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '13px', opacity: 0.6 }}>times per</span>
                            <select
                                value={editForm.targetPeriod}
                                onChange={e => setEditForm({ ...editForm, targetPeriod: e.target.value })}
                                className="habit-edit-select"
                            >
                                <option value="day">day</option>
                                <option value="week">week</option>
                            </select>
                        </div>
                    </div>

                    {confirmingDelete ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', padding: '12px', background: 'rgba(255, 77, 79, 0.08)', borderRadius: '10px', border: '1px solid rgba(255, 77, 79, 0.2)' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,77,79,0.9)', fontWeight: 600 }}>Delete this habit? All history will be lost.</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="habit-cancel-btn"
                                    style={{ color: '#ff4d4f', borderColor: 'rgba(255, 77, 79, 0.3)', background: 'rgba(255, 77, 79, 0.15)', fontWeight: 700 }}
                                    onClick={() => { setConfirmingDelete(false); onDelete?.(habit.id); }}
                                >
                                    Yes, delete
                                </button>
                                <button className="habit-cancel-btn" onClick={() => setConfirmingDelete(false)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                            <button className="habit-save-btn" onClick={handleSaveEdit}>
                                <Save size={14} /> Save Changes
                            </button>
                            <button className="habit-cancel-btn" onClick={() => setIsEditing(false)}>
                                Cancel
                            </button>
                            <button
                                className="habit-cancel-btn"
                                style={{ marginLeft: 'auto', color: '#ff4d4f', borderColor: 'rgba(255, 77, 79, 0.2)', background: 'rgba(255, 77, 79, 0.1)' }}
                                onClick={() => setConfirmingDelete(true)}
                            >
                                Delete
                            </button>
                        </div>
                    )}
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

    const isLevelUpReady = eligibility?.evolutionReady && energyLevel >= 3;

    return (
        <div
            className={`habit-card-minimal ${progress.isDone ? "completed sage-glow" : ""} ${isPulsing ? "satisfaction-pulse" : ""} ${celebration?.active ? "habit-celebrating" : ""} ${celebration ? "habit-lingering-glow" : ""} ${isLevelUpReady ? "level-up-ready" : ""}`}
            id={`habit-${habit.id}`}
            style={{ position: 'relative', overflow: 'hidden' }}
        >
            {celebration?.active && <div className={`habit-ripple ${celebration.type === 'levelup' ? 'levelup' : ''}`} />}
            {celebration?.active && (
                <div className={`habit-identity-label ${celebration.fading ? 'fade-out' : 'fade-in'} ${celebration.type === 'levelup' ? 'levelup' : ''}`}>
                    {celebration.type === 'levelup' ? '✨ LEVEL UP READY ✨' : `+ Aura (Becoming ${celebration.identity})`}
                    {celebration.type === 'levelup' && <div className="identity-reinforcement">Becoming {celebration.identity}</div>}
                </div>
            )}

            {/* Top Right: Icons (Absolute Positioned to not mess with vertical spacing) */}
            <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start', zIndex: 10 }}>
                {isLevelUpReady && (
                    <button className="level-up-ready-badge" onClick={() => onOpenEvolution(habit)}>
                        Level Up Ready
                    </button>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
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
                    <button className="habit-edit-icon-btn" onClick={(e) => { e.stopPropagation(); onSleep?.(habit); }} title={habit.isSleeping ? "Wake Habit" : "Sleep Habit"}>
                        {habit.isSleeping ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                </div>
            </div>

            {/* 1. Header (Top Row) */}
            <div className="habit-intention" style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: '1.4', paddingRight: '40px' }}>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 800, marginRight: '6px' }}>IF</span>
                <span style={{ fontWeight: 700, marginRight: '6px' }}>{habit.ifTrigger}</span>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 800, marginRight: '6px' }}>THEN</span>
                <span style={{ fontWeight: 700 }}>{currentPhase.description}</span>
                {!habit.isActive && (
                    <span className="habit-activation-tag paused" onClick={(e) => { e.stopPropagation(); onToggleActive?.(habit); }} style={{ marginLeft: '8px', display: 'inline-block' }}>Paused</span>
                )}
            </div>

            {/* 2. Stats Row (Horizontal, Muted) */}
            {eligibility && (
                <div className="habit-stats-row">
                    <span>{habit.totalCompletions || 0} total</span>
                    <span style={{ opacity: 0.3 }}>•</span>
                    <span>Stability: {eligibility.gateStatus.stability.completedDays}/8</span>
                    <span style={{ opacity: 0.3 }}>•</span>
                    <span>Friction: {isNaN(eligibility.gateStatus.friction.average) ? '0.0' : eligibility.gateStatus.friction.average.toFixed(1)}</span>
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
                                · {(validCompletions >= requiredCompletions && eligibility.gateStatus.stability.completedDays >= 8) ? `${compsRemaining} more to level up` : 'In Progress'}
                            </span>
                        </div>
                        <div className="habit-mastery-bar-container">
                            <div
                                className={`habit-mastery-bar-fill ${progress.todayCount > 0 ? 'shimmer-fill' : ''}`}
                                style={{ width: `${barPercentage}%` }}
                            />
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
