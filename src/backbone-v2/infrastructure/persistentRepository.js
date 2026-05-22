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
        let userId = await getUserId();
        if (!userId) {
            // Wait briefly for token refresh and retry once
            await new Promise(r => setTimeout(r, 1500));
            userId = await getUserId();
        }

        if (!userId) {
            console.error(`Repository [ID:${instanceId}]: Persist FAILED - No user ID after retry`);
            return;
        }


        try {
            // Transform nodes for Supabase
            const nodesToUpsert = (Array.isArray(nodes) ? nodes : [nodes]).map(node => {
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
        } catch (e) {
            console.error('Failed to persist to Supabase:', e);
        }
    };

    const listeners = new Set();
    const _typeCache = new Map();
    const _parentCache = new Map();
    const notify = (changedId = null) => {
        _typeCache.clear();
        _parentCache.clear();
        listeners.forEach(l => l(changedId));
    };
    let initPromise = null;

    const initialize = async () => {
        if (initPromise) return initPromise;

        initPromise = (async () => {
            try {
                const userId = await getUserId();
                if (!userId) {
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

                notify(null);
            } catch (e) {
                console.error('Failed to load V2 data from Supabase:', e);
                storage = [];
            }
        })();

        return initPromise;
    };

    const reinitialize = async () => {
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
            const snapshot = JSON.parse(JSON.stringify(node));
            await persist(snapshot);
            notify(node.id);
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
                }

                storage[index] = updatedNode;
                const snapshot = JSON.parse(JSON.stringify(updatedNode));
                await persist(snapshot);
                notify(id);
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
            if (_parentCache.has(parentId)) return _parentCache.get(parentId);
            const result = storage.filter(n => n.parentId === parentId);
            _parentCache.set(parentId, result);
            return result;
        },

        /**
         * Optimized query: Returns only nodes of specific type.
         */
        getNodesByType: async (type) => {
            if (_typeCache.has(type)) return _typeCache.get(type);
            const result = storage.filter(n => n.type === type);
            _typeCache.set(type, result);
            return result;
        },

        /**
         * Alias for getNodesByParent for clearer semantic usage.
         */
        getChildrenOf: async (nodeId) => {
            return storage.filter(n => n.parentId === nodeId);
        },

        delete: async (id) => {
            const userId = await getUserId();
            if (!userId) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('nodes')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);

            if (error) throw error;

            storage = storage.filter(n => n.id !== id);
            notify(id);
        },

        deleteMany: async (ids) => {
            const userId = await getUserId();
            if (!userId) throw new Error('Not authenticated');

            if (!ids || ids.length === 0) return;

            const { error } = await supabase
                .from('nodes')
                .delete()
                .in('id', ids)
                .eq('user_id', userId);

            if (error) throw error;

            storage = storage.filter(n => !ids.includes(n.id));
            notify(null);
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
                notify(null);
            } catch (e) {
                console.error('Failed to clear nodes from Supabase:', e);
            }
        },

        reset: () => {
            initPromise = null;
            storage = [];
            notify(null);
        }
    };
};
