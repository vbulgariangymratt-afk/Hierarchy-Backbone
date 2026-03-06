import { useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';

/**
 * WarheadPulse
 * Invisible component that monitors active task timers.
 * If a task has been running for > 2 hours straight, triggers the WarheadPrompt.
 */
const WarheadPulse = () => {
    const { state, dispatch } = useStore();
    const lastCheck = useRef(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

            // Find an active task
            const activeTask = Object.values(state.tasks || {}).find(t => t.status === 'in-progress' && t.lastStartedAt);

            if (activeTask) {
                const duration = now - activeTask.lastStartedAt;

                // Trigger if > 2 hours and we haven't already prompted for THIS specific session
                // We use the lastStartedAt as a unique ID for the session
                if (duration > TWO_HOURS_MS) {
                    if (state.warheadPrompt?.lastStartedAt !== activeTask.lastStartedAt) {
                        console.log(`[WarheadPulse] Task "${activeTask.title}" active for ${Math.round(duration / 60000)}m. Triggering prompt.`);
                        dispatch({
                            type: 'SET_WARHEAD_PROMPT',
                            payload: {
                                taskId: activeTask.id,
                                title: activeTask.title,
                                lastStartedAt: activeTask.lastStartedAt,
                                triggeredAt: now
                            }
                        });
                    }
                }
            } else if (state.warheadPrompt) {
                // If no active task but prompt exists, and the task was finished/stopped elsewhere, clear it
                // Actually, let's just leave it for the user to dismiss or keep it robust.
                // If the prompt taskId doesn't match a running task anymore, clear it.
                const promptTask = state.tasks[state.warheadPrompt.taskId];
                if (!promptTask || promptTask.status !== 'in-progress') {
                    dispatch({ type: 'SET_WARHEAD_PROMPT', payload: null });
                }
            }

            lastCheck.current = now;
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [state.tasks, state.warheadPrompt, dispatch]);

    return null;
};

export default WarheadPulse;
