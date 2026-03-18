import React, { useState } from 'react';
import { habitService } from '../backbone-v2/index';

const HabitCard = React.memo(({ habit, onOpenEvolution, onToggleActive }) => {
    const [completing, setCompleting] = useState(false);
    const currentPhase = habit.phases?.[habit.currentPhaseLevel] || {};
    const isCompletedToday = habit.lastCompletedAt &&
        new Date(habit.lastCompletedAt).toDateString() === new Date().toDateString();

    const handleComplete = async (friction) => {
        try {
            await habitService.completeHabit(habit.id, friction);
            setCompleting(false);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className={`habit-card-minimal ${isCompletedToday ? 'completed' : ''}`} id={`habit-${habit.id}`}>
            <div className="habit-card-main" onClick={() => onOpenEvolution(habit)}>
                <div className="habit-info">
                    <div className="habit-header-row">
                        <h4 className="habit-name">{habit.ifTrigger}</h4>
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
                    <p className="habit-phase-desc">Then: {currentPhase.description}</p>
                    <span className="habit-phase-label">Phase {habit.currentPhaseLevel + 1}</span>
                </div>

                {!isCompletedToday && (
                    <div className="habit-actions" onClick={e => e.stopPropagation()}>
                        {!completing ? (
                            <button className="complete-btn" onClick={() => setCompleting(true)}>Complete</button>
                        ) : (
                            <div className="friction-selector-minimal">
                                <button onClick={() => handleComplete('low')} title="Easy">🟢</button>
                                <button onClick={() => handleComplete('medium')} title="Medium">🟡</button>
                                <button onClick={() => handleComplete('high')} title="Hard">🔴</button>
                            </div>
                        )}
                    </div>
                )}

                {isCompletedToday && <span className="completion-check">✓</span>}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.habit.id === nextProps.habit.id &&
        prevProps.habit.ifTrigger === nextProps.habit.ifTrigger &&
        prevProps.habit.isActive === nextProps.habit.isActive &&
        prevProps.habit.currentPhaseLevel === nextProps.habit.currentPhaseLevel &&
        prevProps.habit.lastCompletedAt === nextProps.habit.lastCompletedAt
    );
});

export default HabitCard;
