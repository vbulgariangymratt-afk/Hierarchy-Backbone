import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useBackboneStore } from '../store/backboneStore';
import { backbone } from '../backbone-v2';

/**
 * Global interceptor that freezes data creation in Read-Only Mode when subscription is not active.
 */
const ReadOnlyInterceptor = () => {
    const { hasAccess, loading } = useSettings();
    const addUndoToast = useBackboneStore(state => state.addUndoToast);

    useEffect(() => {
        if (loading) return;

        // 1. Monkeypatch backbone.addNode to freeze new tasks, areas, skills, rewards
        const originalAddNode = backbone.addNode;
        backbone.addNode = async function(...args) {
            if (hasAccess === false) {
                if (addUndoToast) {
                    addUndoToast("Subscription paused. Your account is in read-only mode.", null);
                }
                return Promise.reject(new Error("Subscription paused. Account is in read-only mode."));
            }
            return originalAddNode.apply(this, args);
        };

        // 2. Monkeypatch activeUpgradeHabit setter in Zustand store
        const originalSetActiveUpgrade = useBackboneStore.getState().setActiveUpgradeHabit;
        useBackboneStore.getState().setActiveUpgradeHabit = function(habit) {
            if (habit && hasAccess === false) {
                if (addUndoToast) {
                    addUndoToast("Subscription paused. Your account is in read-only mode.", null);
                }
                return;
            }
            return originalSetActiveUpgrade(habit);
        };

        return () => {
            // Restore original implementations on cleanup / access restoration
            backbone.addNode = originalAddNode;
            useBackboneStore.getState().setActiveUpgradeHabit = originalSetActiveUpgrade;
        };
    }, [hasAccess, loading, addUndoToast]);

    return null;
};

export default ReadOnlyInterceptor;

