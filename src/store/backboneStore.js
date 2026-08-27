import { create } from 'zustand';

/**
 * Backbone Store - Optimized Reactor for Hierarchy Data
 * 
 * This Zustand store acts as the reactive data layer for the Backbone system.
 * It coordinates with the persistent repository to ensure that UI updates 
 * are granular (using selectors) rather than full-re-renders.
 */
export const useBackboneStore = create((set) => ({
    // 1. Core State: The flat list of all nodes across the hierarchy
    nodes: [],
    loading: true,
    engagementMap: {}, // Stores { skillId: { status, daysSince, label, ... } }
    activeUpgradeHabit: null,
    undoToast: null, // { message: string, onUndo: function, timeoutId: number }
    hasDismissedOnboarding: typeof window !== 'undefined' && localStorage.getItem('has_dismissed_onboarding_hub') === 'true',

    // 2. Actions: Methods to manipulate the state immutably

    setHasDismissedOnboarding: (val) => {
        if (typeof window !== 'undefined') {
            if (val) localStorage.setItem('has_dismissed_onboarding_hub', 'true');
            else localStorage.removeItem('has_dismissed_onboarding_hub');
        }
        set({ hasDismissedOnboarding: !!val });
    },

    setActiveUpgradeHabit: (habit) => set({ activeUpgradeHabit: habit }),

    /**
     * 10-Second Delayed Undo System
     */
    addUndoToast: (message, onUndo) => set((state) => {
        if (state.undoToast?.timeoutId) {
            clearTimeout(state.undoToast.timeoutId);
        }
        
        const timeoutId = setTimeout(() => {
            set({ undoToast: null });
        }, 10000); // 10 seconds

        return { undoToast: { message, onUndo, timeoutId } };
    }),
    
    clearUndoToast: () => set((state) => {
        if (state.undoToast?.timeoutId) {
            clearTimeout(state.undoToast.timeoutId);
        }
        return { undoToast: null };
    }),

    /**
     * Update the entire engagement map at once.
     */
    setEngagementMap: (map) => set({ engagementMap: map }),

    /**
     * Bulk initialization of nodes. 
     * Used on app startup or after a full sync from Supabase.
     */
    initializeNodes: (nodes) => set({ 
        nodes: Array.isArray(nodes) ? nodes : [], 
        loading: false 
    }),

    /**
     * Targeted update of a single node.
     * Maps across the nodes array and creates a new object only for the match.
     * This allows component selectors to detect changes at the individual node level.
     */
    updateNode: (id, updates) => set((state) => ({
        nodes: state.nodes.map(node => 
            node.id === id 
                ? { 
                    ...node, 
                    ...updates, 
                    // Deep merge metadata if it's provided in the update
                    metadata: updates.metadata 
                        ? { ...node.metadata, ...updates.metadata } 
                        : node.metadata,
                    updatedAt: Date.now() 
                  } 
                : node
        )
    })),

    /**
     * Add a new node to the flat list.
     * Creates a new array reference to trigger listeners.
     */
    addNode: (node) => set((state) => ({
        nodes: [...state.nodes, node]
    })),

    /**
     * Remove a node by ID.
     * Filters the list and returns a new array reference.
     */
    removeNode: (id) => set((state) => ({
        nodes: state.nodes.filter(node => node.id !== id)
    })),

    /**
     * Batch update multiple nodes.
     * Accepts an array of { id, updates } objects.
     * Applies all changes in a single set() call to prevent redundant re-renders.
     */
    updateNodes: (updatesArray) => set((state) => {
        const updateMap = new Map(updatesArray.map(u => [u.id, u.updates]));
        
        return {
            nodes: state.nodes.map(node => {
                const updates = updateMap.get(node.id);
                if (!updates) return node;

                return {
                    ...node,
                    ...updates,
                    metadata: updates.metadata 
                        ? { ...node.metadata, ...updates.metadata } 
                        : node.metadata,
                    updatedAt: Date.now()
                };
            })
        };
    }),

    /**
     * Set loading state manually if needed during transition reloads
     */
    setLoading: (loading) => set({ loading })
}));
