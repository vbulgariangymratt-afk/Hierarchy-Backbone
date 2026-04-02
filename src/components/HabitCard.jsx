import React, { useState } from 'react';
import { habitService } from '../backbone-v2/index';
import HabitEvolutionGauge from './habits/HabitEvolutionGauge';


const HabitCard = React.memo(({ habit, onOpenEvolution, onToggleActive }) => {
    const [completing, setCompleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        ifTrigger: habit.ifTrigger,
        description: habit.phases?.[habit.currentPhaseLevel]?.description || '',
        frequencyType: habit.frequencyType || 'daily',
        targetCount: habit.targetCount || 1
    });

    const currentPhase = habit.phases?.[habit.currentPhaseLevel] || {};
    const progress = habitService.getHabitProgress(habit);

    const handleComplete = async (friction) => {
        try {
            await habitService.completeHabit(habit.id, friction);
            setCompleting(false);
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
                frequencyType: editForm.frequencyType,
                targetCount: parseInt(editForm.targetCount),
                phases: updatedPhases
            });
            setIsEditing(false);
        } catch (error) {
            console.error(error);
        }
    };

    if (isEditing) {
        return (
            <div className="habit-card-minimal editing">
                <div className="habit-edit-form">
                    <input 
                        className="habit-edit-input"
                        value={editForm.ifTrigger}
                        onChange={e => setEditForm({...editForm, ifTrigger: e.target.value})}
                        placeholder="Trigger"
                    />
                    <input 
                        className="habit-edit-input"
                        value={editForm.description}
                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                        placeholder="Action"
                    />
                    <div className="habit-edit-row">
                        <select 
                            value={editForm.frequencyType}
                            onChange={e => setEditForm({...editForm, frequencyType: e.target.value})}
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                        </select>
                        <input 
                            type="number"
                            style={{ width: '40px' }}
                            value={editForm.targetCount}
                            onChange={e => setEditForm({...editForm, targetCount: e.target.value})}
                        />
                    </div>
                    <div className="habit-edit-actions">
                        <button className="save-btn" onClick={handleSaveEdit}>Save</button>
                        <button className="cancel-btn" onClick={() => setIsEditing(false)}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`habit-card-minimal ${progress.isDone ? 'completed' : ''}`} id={`habit-${habit.id}`}>
            <div className="habit-card-main" onClick={() => onOpenEvolution(habit)}>
                <div className="habit-info">
                    <div className="habit-header-row">
                        <h4 className="habit-name">{habit.ifTrigger}</h4>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="habit-progress-pill">{progress.displayProgress}</span>
                            <span
                                className={`habit-activation-tag ${habit.isActive ? 'active' : 'paused'}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleActive(habit);
                                }}
                            >
                                {habit.isActive ? 'Active' : 'Paused'}
                            </span>
                        </div>
                    </div>
                    <p className="habit-phase-desc">Then: {currentPhase.description}</p>
                    <HabitEvolutionGauge habitId={habit.id} compact={false} />
                    <div className="habit-footer-row">

                        <span className="habit-phase-label">Phase {habit.currentPhaseLevel + 1}</span>
                        <button 
                            className="habit-edit-btn" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                        >
                            Edit
                        </button>
                    </div>
                </div>

                {habit.isActive && (
                    <div className="habit-actions" onClick={e => e.stopPropagation()}>
                        {!completing ? (
                            <button className="complete-btn" onClick={() => setCompleting(true)}>
                                {progress.isDone ? '+ Log Extra' : 'Complete'}
                            </button>
                        ) : (
                            <div className="friction-selector-minimal">
                                <button onClick={() => handleComplete('low')} title="Easy">🟢</button>
                                <button onClick={() => handleComplete('medium')} title="Medium">🟡</button>
                                <button onClick={() => handleComplete('high')} title="Hard">🔴</button>
                            </div>
                        )}
                    </div>
                )}

                {progress.isDone && <span className="completion-check">✓</span>}
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
        JSON.stringify(prevProps.habit.completions) === JSON.stringify(nextProps.habit.completions)
    );
});

export default HabitCard;
