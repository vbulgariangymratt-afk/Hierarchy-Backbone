import React from 'react';

/**
 * LaunchpadHabitRow Component
 * 
 * Renders a compact habit row for the "Keep It Alive" drawer on the Launchpad.
 * Wrapped in React.memo to prevent unnecessary re-renders in the list.
 */
const LaunchpadHabitRow = React.memo(({ habit, onComplete }) => {
    return (
        <div className="keep-it-alive-habit-row">
            <div className="habit-info">
                <span className="habit-name">{habit.ifTrigger}</span>
                <span className="habit-meta"> (Target: {habit.targetCount || 1}x {habit.frequencyType || 'daily'})</span>
            </div>
            <button 
                className="habit-complete-btn"
                onClick={(e) => { e.stopPropagation(); onComplete?.(habit.id); }}
            >
                Complete
            </button>
        </div>
    );
});

export default LaunchpadHabitRow;
