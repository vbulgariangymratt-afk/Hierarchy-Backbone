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

import { supabase } from '../../lib/supabase';

/**
 * Persistent implementation of the Journal Repository.
 * Stores entries and lifecycle metadata in Supabase.
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

    // Internal helper to get current authenticated user
    const getUserId = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id;
    };

    const persist = async (entry) => {
        const userId = await getUserId();
        if (!userId) return;

        try {
            const { error } = await supabase
                .from('journal_entries')
                .upsert({
                    id: entry.id,
                    user_id: userId,
                    date: entry.date,
                    biological: entry.biological || {},
                    activation: entry.activation || {},
                    regulation: entry.regulation || {},
                    notes: entry.notes || '',
                    metadata: storage.metadata || {},
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
        } catch (e) {
            console.error('Failed to persist Journal entry to Supabase:', e);
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

    const initialize = async () => {
        if (initPromise) return initPromise;
        initPromise = (async () => {
            console.log(`JournalRepo [ID:${instanceId}]: Initializing from Supabase...`);
            try {
                const userId = await getUserId();
                if (!userId) {
                    console.warn('JournalRepo: No user authenticated.');
                    return;
                }

                const { data, error } = await supabase
                    .from('journal_entries')
                    .select('*')
                    .eq('user_id', userId);

                if (error) throw error;

                const entries = (data || []).map(row => ({
                    id: row.id,
                    date: row.date,
                    biological: row.biological,
                    activation: row.activation,
                    regulation: row.regulation,
                    notes: row.notes,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));

                // Metadata might be repeated across rows or stored elsewhere. 
                // For now, take from the first row if available
                const metadata = data?.[0]?.metadata || storage.metadata;

                storage = {
                    entries,
                    metadata
                };

                notify();
            } catch (e) {
                console.error('Failed to load Journal data from Supabase:', e);
                storage = normalize(null);
            }
        })();
        return initPromise;
    };

    const reinitialize = async () => {
        console.log(`JournalRepo [ID:${instanceId}]: FORCED RE-INITIALIZATION`);
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


        getMetadata: () => {
            if (!storage.metadata) storage.metadata = { lastAppCloseTime: null, firstAppOpenTime: null };
            return { ...storage.metadata };
        },
        updateMetadata: async (updates) => {
            if (!storage.metadata) storage.metadata = { lastAppCloseTime: null, firstAppOpenTime: null };
            storage.metadata = { ...storage.metadata, ...updates };

            // Sync metadata (this will upsert one entry with the new metadata)
            if (storage.entries.length > 0) {
                await persist(storage.entries[0]);
            }
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
            await persist(entry);
            notify();
            return entry;
        },

        update: async (id, updates) => {
            if (!Array.isArray(storage.entries)) storage.entries = [];
            const index = storage.entries.findIndex(e => e.id === id);
            if (index !== -1) {
                storage.entries[index] = { ...storage.entries[index], ...updates, updatedAt: Date.now() };
                await persist(storage.entries[index]);
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
