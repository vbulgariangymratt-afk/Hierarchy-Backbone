import React from 'react';
import { habitService } from '../../backbone-v2/index';
import HabitEvolutionGauge from '../habits/HabitEvolutionGauge';

/**
 * SidebarSpotlightCard Component
 * 
 * Renders a high-importance maintenance habit in the sidebar spotlight.
 * Wrapped in React.memo to ensure it only re-renders when the habit data or completion state changes.
 */
const SidebarSpotlightCard = React.memo(({ 
    habit, skill, isCompleting, onNavigate, onComplete 
}) => {
    // Re-calculating progress for stable rendering
    const prog = habitService.getHabitProgress(habit);
    
    return (
        <div 
            className={`spotlight-card ${prog.isDone ? 'done' : ''} ${isCompleting ? 'completing' : ''}`}
        >
            <div className="spotlight-meta">
                {skill && (
                    <span 
                        className="spotlight-skill-label" 
                        onClick={() => onNavigate(`/skill/${skill.id}`)}
                    >
                        {skill.name}
                    </span>
                )}
                <span className="spotlight-progress">
                    {prog.displayProgress}
                </span>
            </div>
            <div className="spotlight-habit-name">{habit.ifTrigger}</div>
            <HabitEvolutionGauge habitId={habit.id} compact={true} />
            <button
                className={`spotlight-action-btn ${prog.isDone ? 'btn-done' : ''}`}
                onClick={() => !prog.isDone && onComplete(habit.id)}
                disabled={prog.isDone || isCompleting}
            >
                {prog.isDone ? '✓ Done' : 'Complete'}
            </button>
        </div>
    );
});

export default SidebarSpotlightCard;
