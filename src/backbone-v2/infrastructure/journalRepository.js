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
        let userId = await getUserId();
        if (!userId) {
            // Unauthenticated guest user: save all to localStorage
            localStorage.setItem('guest_journal', JSON.stringify(storage));
            return;
        }

        try {
            const { error } = await supabase
                .from('journal_entries')
                .upsert({
                    id: entry.id,
                    user_id: userId,
                    date: entry.date,
                    biological: entry.biological || {},
                    activation: entry.activation || {},
                    regulation: {
                        ...(entry.regulation || {}),
                        wake_up_ease: entry.wake_up_ease !== undefined ? entry.wake_up_ease : null,
                        shut_down_ease: entry.shut_down_ease !== undefined ? entry.shut_down_ease : null,
                        hydration_total: entry.hydration_total !== undefined ? entry.hydration_total : null,
                        meds_taken: entry.meds_taken || []
                    },
                    medication_taken: entry.medication_taken || false,
                    med_taken_at: entry.med_taken_at || null,
                    dopamine_spark_at: entry.dopamine_spark_at || null,
                    hydration_level: entry.hydration_level || 2,
                    nutrition_level: entry.nutrition_level || 2,
                    sugar_level: entry.sugar_level || 2,
                    morning_activity_done: entry.morning_activity_done || false,
                    morning_activity_at: entry.morning_activity_at || null,
                    notes: entry.notes || '',
                    medications: entry.medications || [],
                    snapshots: entry.snapshots || {},
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
            try {
                const userId = await getUserId();
                if (!userId) {
                    const localData = localStorage.getItem('guest_journal');
                    storage = localData ? JSON.parse(localData) : normalize(null);
                    notify();
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
                    medication_taken: row.medication_taken,
                    med_taken_at: row.med_taken_at,
                    dopamine_spark_at: row.dopamine_spark_at,
                    hydration_level: row.hydration_level,
                    nutrition_level: row.nutrition_level,
                    sugar_level: row.sugar_level,
                    morning_activity_done: row.morning_activity_done,
                    morning_activity_at: row.morning_activity_at,
                    notes: row.notes,
                    medications: row.medications || [],
                    snapshots: row.snapshots || {},
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    wake_up_ease: row.regulation?.wake_up_ease !== undefined ? row.regulation.wake_up_ease : undefined,
                    shut_down_ease: row.regulation?.shut_down_ease !== undefined ? row.regulation.shut_down_ease : undefined,
                    hydration_total: row.regulation?.hydration_total !== undefined ? row.regulation.hydration_total : undefined,
                    meds_taken: row.regulation?.meds_taken || []
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

            const userId = await getUserId();
            if (!userId) {
                localStorage.setItem('guest_journal', JSON.stringify(storage));
            } else if (storage.entries.length > 0) {
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
            const snapshot = JSON.parse(JSON.stringify(entry));
            await persist(snapshot);
            notify();
            return entry;
        },

        update: async (id, updates) => {
            if (!Array.isArray(storage.entries)) storage.entries = [];
            const index = storage.entries.findIndex(e => e.id === id);
            if (index !== -1) {
                storage.entries[index] = { ...storage.entries[index], ...updates, updatedAt: Date.now() };
                const snapshot = JSON.parse(JSON.stringify(storage.entries[index]));
                await persist(snapshot);
                notify();
                return { ...storage.entries[index] };
            }
            throw new Error(`Journal entry with ID ${id} not found.`);
        },

        getAll: async () => {
            return storage.entries.map(e => ({ ...e }));
        },

        reset: () => {
            initPromise = null;
            storage = {
                entries: [],
                metadata: {
                    lastAppCloseTime: null,
                    firstAppOpenTime: null
                }
            };
            notify();
        },

        migrateGuestData: async (userId) => {
            if (!userId) return;
            const localData = localStorage.getItem('guest_journal');
            if (!localData) return;
            try {
                const localJournal = JSON.parse(localData);
                const entries = localJournal.entries || [];
                const metadata = localJournal.metadata || {};
                
                if (entries.length === 0) return;

                const entriesToUpsert = entries.map(entry => ({
                    id: entry.id,
                    user_id: userId,
                    date: entry.date,
                    biological: entry.biological || {},
                    activation: entry.activation || {},
                    regulation: {
                        ...(entry.regulation || {}),
                        wake_up_ease: entry.wake_up_ease !== undefined ? entry.wake_up_ease : null,
                        shut_down_ease: entry.shut_down_ease !== undefined ? entry.shut_down_ease : null,
                        hydration_total: entry.hydration_total !== undefined ? entry.hydration_total : null,
                        meds_taken: entry.meds_taken || []
                    },
                    medication_taken: entry.medication_taken || false,
                    med_taken_at: entry.med_taken_at || null,
                    dopamine_spark_at: entry.dopamine_spark_at || null,
                    hydration_level: entry.hydration_level || 2,
                    nutrition_level: entry.nutrition_level || 2,
                    sugar_level: entry.sugar_level || 2,
                    morning_activity_done: entry.morning_activity_done || false,
                    morning_activity_at: entry.morning_activity_at || null,
                    notes: entry.notes || '',
                    medications: entry.medications || [],
                    snapshots: entry.snapshots || {},
                    metadata: metadata,
                    updated_at: new Date().toISOString()
                }));

                const { error } = await supabase
                    .from('journal_entries')
                    .upsert(entriesToUpsert);

                if (error) throw error;
                localStorage.removeItem('guest_journal');
                console.log('[journalRepository] Migrated guest journal successfully.');
            } catch (err) {
                console.error('[journalRepository] Migration failed:', err);
            }
        }
    };
};
