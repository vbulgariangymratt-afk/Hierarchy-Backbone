/**
 * Persistent implementation of the Hierarchy Repository.
 * Uses a local JSON file via the Vite dev server API.
 */
export const createPersistentRepository = () => {
    let storage = [];
    const instanceId = Math.random().toString(36).substr(2, 5);

    // Internal helper to save to disk
    const persist = async () => {
        try {
            await fetch('/api/backbone-v2/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(storage)
            });
            console.log(`Repository [ID:${instanceId}]: Synced to v2_data.json`);
        } catch (e) {
            console.error('Failed to persist V2 data:', e);
        }
    };

    const listeners = new Set();
    const notify = () => listeners.forEach(l => l());
    let initPromise = null;

    return {
        instanceId,
        subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },

        initialize: async () => {
            if (initPromise) return initPromise;

            initPromise = (async () => {
                console.log(`Repository [ID:${instanceId}]: Loading from v2_data.json...`);
                let needsPersist = false;
                try {
                    const response = await fetch('/api/backbone-v2/load');
                    const data = await response.json();
                    const rawNodes = Array.isArray(data) ? data : [];
                    storage = rawNodes.map(node => {
                        if (!node.id) {
                            const newId = `${node.type || 'NODE'}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                            console.warn(`Repository [ID:${instanceId}]: Repairing node missing ID: "${node.name}". Assigned: ${newId}`);
                            needsPersist = true;
                            return { ...node, id: newId };
                        }
                        return node;
                    });

                    if (needsPersist) {
                        console.log(`Repository [ID:${instanceId}]: Integrity repairs made, persisting to disk...`);
                        await persist();
                    }
                    console.log(`Repository [ID:${instanceId}]: Loaded ${storage.length} nodes (Integrity check passed)`);
                    notify();
                } catch (e) {
                    console.error('Failed to load V2 data:', e);
                    storage = [];
                }
            })();

            return initPromise;
        },

        save: async (node) => {
            console.log(`Repository [ID:${instanceId}]: Saving node`, node);
            const index = storage.findIndex(n => n.id === node.id);
            if (index !== -1) {
                storage[index] = node;
            } else {
                storage.push(node);
            }
            await persist();
            notify();
            return node;
        },

        getById: async (id) => {
            return storage.find(n => n.id === id) || null;
        },

        update: async (id, updates) => {
            console.log(`Repository [ID:${instanceId}]: Updating node ${id}`, updates);
            const index = storage.findIndex(n => n.id === id);
            if (index !== -1) {
                storage[index] = { ...storage[index], ...updates, updatedAt: Date.now() };
                await persist();
                notify();
                return { ...storage[index] };
            }
            throw new Error(`Node with ID ${id} not found.`);
        },

        getAll: async () => {
            return storage.map(node => ({ ...node }));
        },

        delete: async (id) => {
            storage = storage.filter(n => n.id !== id);
            await persist();
            notify();
        },

        clear: async () => {
            storage = [];
            await persist();
            notify();
        }
    };
};
