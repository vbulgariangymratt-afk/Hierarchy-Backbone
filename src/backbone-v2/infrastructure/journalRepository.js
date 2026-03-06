/**
 * @typedef {Object} SleepData
 * @property {number} [sleepStartTime] - Timestamp
 * @property {number} [wakeTime] - Timestamp
 * @property {number} [sleepDurationMinutes]
 * @property {boolean} [sleepDetectedAutomatically]
 */

/**
 * @typedef {Object} JournalEntry
 * @property {string} id
 * @property {string} date - YYYY-MM-DD
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {SleepData} biological
 * @property {Object} activation
 * @property {1|2|3|4|5} [activation.morningActivationLevel]
 * @property {Object} regulation
 * @property {boolean} [regulation.hadDeepLockOver90Min]
 * @property {boolean} [regulation.rsdTrigger]
 * @property {string} [notes]
 */

/**
 * Persistent implementation of the Journal Repository.
 * Stores entries and lifecycle metadata.
 */
export const createJournalRepository = () => {
    let storage = {
        entries: [],
        metadata: {
            lastAppCloseTime: null,
            firstAppOpenTime: null
        }
    };
    const instanceId = Math.random().toString(36).substr(2, 5);

    const persist = async () => {
        try {
            await fetch('/api/journal-data/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(storage)
            });
        } catch (e) {
            console.error('Failed to persist Journal data:', e);
        }
    };

    const normalize = (data) => {
        if (!data) return storage;

        // Ensure standard structure
        const normalized = {
            entries: Array.isArray(data.entries) ? data.entries : (Array.isArray(data) ? data : []),
            metadata: {
                lastAppCloseTime: data.metadata?.lastAppCloseTime || storage.metadata.lastAppCloseTime,
                firstAppOpenTime: data.metadata?.firstAppOpenTime || storage.metadata.firstAppOpenTime
            }
        };

        return normalized;
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
                try {
                    const response = await fetch('/api/journal-data/load');
                    const data = await response.json();
                    storage = normalize(data);
                    notify();
                } catch (e) {
                    console.error('Failed to load Journal data, initializing empty:', e);
                    storage = normalize(null); // Ensure valid state even on failure
                }
            })();
            return initPromise;
        },

        getMetadata: () => {
            if (!storage.metadata) storage.metadata = { lastAppCloseTime: null, firstAppOpenTime: null };
            return { ...storage.metadata };
        },
        updateMetadata: async (updates) => {
            if (!storage.metadata) storage.metadata = { lastAppCloseTime: null, firstAppOpenTime: null };
            storage.metadata = { ...storage.metadata, ...updates };
            await persist();
            notify();
        },

        getByDate: async (date) => {
            if (!Array.isArray(storage.entries)) storage.entries = [];
            return storage.entries.find(e => e.date === date) || null;
        },

        save: async (entry) => {
            if (!Array.isArray(storage.entries)) storage.entries = [];
            const index = storage.entries.findIndex(e => e.id === entry.id);
            if (index !== -1) {
                storage.entries[index] = { ...entry, updatedAt: Date.now() };
            } else {
                storage.entries.push({
                    ...entry,
                    createdAt: entry.createdAt || Date.now(),
                    updatedAt: Date.now()
                });
            }
            await persist();
            notify();
            return entry;
        },

        update: async (id, updates) => {
            if (!Array.isArray(storage.entries)) storage.entries = [];
            const index = storage.entries.findIndex(e => e.id === id);
            if (index !== -1) {
                storage.entries[index] = { ...storage.entries[index], ...updates, updatedAt: Date.now() };
                await persist();
                notify();
                return { ...storage.entries[index] };
            }
            throw new Error(`Journal entry with ID ${id} not found.`);
        },

        getAll: async () => {
            return storage.entries.map(e => ({ ...e }));
        }
    };
};
