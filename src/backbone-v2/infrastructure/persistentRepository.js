import { supabase } from '../../lib/supabase';

/**
 * Persistent implementation of the Hierarchy Repository.
 * Uses Supabase cloud storage.
 */
export const createPersistentRepository = () => {
    let storage = [];
    const instanceId = Math.random().toString(36).substr(2, 5);

    // Internal helper to get current authenticated user
    const getUserId = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id;
    };

    // Internal helper to save to cloud
    const persist = async (nodes) => {
        const userId = await getUserId();
        if (!userId) {
            console.error(`Repository [ID:${instanceId}]: Persist FAILED - No user ID`);
            return;
        }

        console.log(`Repository [ID:${instanceId}]: Persisting to Supabase. User: ${userId}. Nodes:`, nodes);

        try {
            // Transform nodes for Supabase
            const nodesToUpsert = (Array.isArray(nodes) ? nodes : [nodes]).map(node => {
                console.log('[DEBUG REPO] Upserting node:', node.id, 'metadata.status:', node.metadata?.status);
                return {
                    id: node.id,
                    user_id: userId,
                    name: node.name || 'Untitled',
                    type: node.type || 'NODE',
                    parent_id: node.parentId,
                    metadata: node.metadata || {},
                    updated_at: new Date().toISOString()
                };
            });

            const { error } = await supabase
                .from('nodes')
                .upsert(nodesToUpsert);

            if (error) throw error;
            console.log(`Repository [ID:${instanceId}]: Synced to Supabase`);
        } catch (e) {
            console.error('Failed to persist to Supabase:', e);
        }
    };

    const listeners = new Set();
    const notify = () => listeners.forEach(l => l());
    let initPromise = null;

    const initialize = async () => {
        if (initPromise) return initPromise;

        initPromise = (async () => {
            console.log(`Repository [ID:${instanceId}]: Loading from Supabase...`);
            try {
                const userId = await getUserId();
                if (!userId) {
                    console.warn('Repository: No user authenticated. Initializing empty storage.');
                    storage = [];
                    return;
                }

                const { data, error } = await supabase
                    .from('nodes')
                    .select('*')
                    .eq('user_id', userId);

                if (error) throw error;

                // Transform back to application format
                storage = (data || []).map(row => ({
                    id: row.id,
                    name: row.name,
                    type: row.type,
                    parentId: row.parent_id,
                    metadata: row.metadata,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));

                console.log(`Repository [ID:${instanceId}]: Loaded ${storage.length} nodes from Supabase`);
                notify();
            } catch (e) {
                console.error('Failed to load V2 data from Supabase:', e);
                storage = [];
            }
        })();

        return initPromise;
    };

    const reinitialize = async () => {
        console.log(`Repository [ID:${instanceId}]: FORCED RE-INITIALIZATION`);
        initPromise = null;
        return await initialize();
    };

    return {
        instanceId,
        subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },

        initialize,
        reinitialize,


        save: async (node) => {
            const index = storage.findIndex(n => n.id === node.id);
            if (index !== -1) {
                storage[index] = node;
            } else {
                storage.push(node);
            }
            await persist(node);
            notify();
            return node;
        },

        getById: async (id) => {
            return storage.find(n => n.id === id) || null;
        },

        update: async (id, updates) => {
            const index = storage.findIndex(n => n.id === id);
            if (index !== -1) {
                const existing = storage[index];
                
                // Shallow merge metadata for safety if provided
                let newMetadata = existing.metadata || {};
                if (updates.metadata) {
                    newMetadata = { ...newMetadata, ...updates.metadata };
                }

                const updatedNode = { 
                    ...existing, 
                    ...updates, 
                    metadata: newMetadata,
                    updatedAt: Date.now() 
                };
                
                if (id === 'TASK-1774556587495-5ltn0' || updatedNode.type === 'TASK') {
                    console.log(`[DEBUG Repository] Final merged metadata sessions:`, updatedNode.metadata?.sessions?.length || 0);
                }

                storage[index] = updatedNode;
                await persist(storage[index]);
                notify();
                return storage[index];
            }
            throw new Error(`Node with ID ${id} not found.`);
        },

        getAll: async () => {
            return [...storage];
        },

        /**
         * Optimized query: Returns only nodes with specific parentId.
         * References are preserved for efficient React.memo usage.
         */
        getNodesByParent: async (parentId) => {
            return storage.filter(n => n.parentId === parentId);
        },

        /**
         * Optimized query: Returns only nodes of specific type.
         */
        getNodesByType: async (type) => {
            return storage.filter(n => n.type === type);
        },

        /**
         * Alias for getNodesByParent for clearer semantic usage.
         */
        getChildrenOf: async (nodeId) => {
            return storage.filter(n => n.parentId === nodeId);
        },

        delete: async (id) => {
            try {
                const { error } = await supabase
                    .from('nodes')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                storage = storage.filter(n => n.id !== id);
                notify();
            } catch (e) {
                console.error('Failed to delete node from Supabase:', e);
            }
        },

        clear: async () => {
            const userId = await getUserId();
            if (!userId) return;

            try {
                const { error } = await supabase
                    .from('nodes')
                    .delete()
                    .eq('user_id', userId);

                if (error) throw error;

                storage = [];
                notify();
            } catch (e) {
                console.error('Failed to clear nodes from Supabase:', e);
            }
        }
    };
};
