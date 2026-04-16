import React from 'react';

/**
 * MiniLaunchpadTaskButton Component
 * 
 * Renders a task choice in the Mini-Launchpad modal.
 * Wrapped in React.memo to ensure smooth transitions and prevent redundant re-renders 
 * when the modal logic or energy level state updates.
 */
const MiniLaunchpadTaskButton = React.memo(({ task, onClick }) => {
    return (
        <button 
            className="task-button"
            onClick={() => onClick(task)}
        >
            <span className="task-name">{task.name}</span>
        </button>
    );
});

export default MiniLaunchpadTaskButton;
