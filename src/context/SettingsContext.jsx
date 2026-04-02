import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SettingsContext = createContext();

// ---------------------------------------------------------------------------
// Slot role definitions — the canonical single source of truth
// ---------------------------------------------------------------------------
export const SLOT_ROLES = [
    {
        index: 0,
        label: 'Main Quest',
        shortLabel: 'Main',
        emoji: '🎯',
        description: 'Your primary deep-work skill — the one thing that matters most right now.',
    },
    {
        index: 1,
        label: 'Growth',
        shortLabel: 'Growth',
        emoji: '📈',
        description: 'A skill you are actively developing and building momentum in.',
    },
    {
        index: 2,
        label: 'Maintenance',
        shortLabel: 'Maint.',
        emoji: '🔧',
        description: 'Important recurring upkeep — keep this from slipping under the radar.',
    },
    {
        index: 3,
        label: 'Wildcard',
        shortLabel: 'Wild',
        emoji: '🃏',
        description: 'A stretch goal, passion project, or opportunistic skill.',
    },
    {
        index: 4,
        label: 'Flex',
        shortLabel: 'Flex',
        emoji: '⚡',
        description: 'Optional overflow slot — swap freely based on current priorities.',
    },
];

// ---------------------------------------------------------------------------
// Module-level singleton cache — survives component re-mounts and HMR
// This is the key fix: the loaded settings are stored OUTSIDE React state
// so they are never lost when SettingsProvider re-renders or re-mounts.
// ---------------------------------------------------------------------------
const _cache = {
    uid: null,
    focusSlots: [null, null, null, null, null],
    maintenanceSkillIds: [],
    maintenanceEnabled: true,
    guidedSlotRoles: true,
    energyLevel: 3,
    hasLoaded: false,
};

export const SettingsProvider = ({ children }) => {
    // Initialise from cache so we never flash the empty state on re-mount
    const [focusSlots, setFocusSlots] = useState(_cache.focusSlots);
    const [maintenanceSkillIds, setMaintenanceSkillIdsState] = useState(_cache.maintenanceSkillIds);
    const [maintenanceEnabled, setMaintenanceEnabledState] = useState(_cache.maintenanceEnabled);
    const [guidedSlotRoles, setGuidedSlotRoles] = useState(_cache.guidedSlotRoles);
    const [energyLevel, setEnergyLevel] = useState(_cache.energyLevel);
    const [loading, setLoading] = useState(!_cache.hasLoaded);

    const loadSettings = useCallback(async (uid) => {
        if (!uid) return;

        // Skip if this user's settings are already cached
        if (_cache.uid === uid && _cache.hasLoaded) {
            console.log('[SettingsContext] Cache HIT — skipping fetch for', uid);
            setLoading(false);
            return;
        }

        console.log('[SettingsContext] Loading settings from Supabase for:', uid);
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('focus_slots, guided_slot_roles, energy_level, maintenance_skill_ids, maintenance_enabled')
                .eq('user_id', uid)
                .single();

            if (error && error.code === 'PGRST116') {
                // Row doesn't exist yet — create with defaults
                console.log('[SettingsContext] No settings found — creating defaults for', uid);
                const defaults = {
                    user_id: uid,
                    focus_slots: [null, null, null, null, null],
                    maintenance_skill_ids: [],
                    maintenance_enabled: true,
                    guided_slot_roles: true,
                    energy_level: 3,
                };
                const { error: insertError } = await supabase
                    .from('user_settings')
                    .insert(defaults);

                if (!insertError) {
                    _cache.focusSlots = [null, null, null, null, null];
                    _cache.maintenanceSkillIds = [];
                    _cache.maintenanceEnabled = true;
                    _cache.guidedSlotRoles = true;
                    _cache.energyLevel = 3;
                    _cache.hasLoaded = true;
                    _cache.uid = uid;
                    setFocusSlots(_cache.focusSlots);
                    setMaintenanceSkillIdsState(_cache.maintenanceSkillIds);
                    setMaintenanceEnabledState(_cache.maintenanceEnabled);
                    setGuidedSlotRoles(_cache.guidedSlotRoles);
                    setEnergyLevel(_cache.energyLevel);
                }
            } else if (!error && data) {
                _cache.focusSlots = data.focus_slots || [null, null, null, null, null];
                _cache.maintenanceSkillIds = data.maintenance_skill_ids || [];
                _cache.maintenanceEnabled = data.maintenance_enabled !== undefined ? data.maintenance_enabled : true;
                _cache.guidedSlotRoles = data.guided_slot_roles !== undefined ? data.guided_slot_roles : true;
                _cache.energyLevel = data.energy_level !== undefined ? data.energy_level : 3;
                _cache.hasLoaded = true;
                _cache.uid = uid;
                setFocusSlots(_cache.focusSlots);
                setMaintenanceSkillIdsState(_cache.maintenanceSkillIds);
                setMaintenanceEnabledState(_cache.maintenanceEnabled);
                setGuidedSlotRoles(_cache.guidedSlotRoles);
                setEnergyLevel(_cache.energyLevel);
                console.log('[SettingsContext] Loaded settings successfully');
            }
        } catch (err) {
            console.error('[SettingsContext] Unexpected error during load:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const saveSettings = async (updates) => {
        if (!_cache.uid) return;
        try {
            await supabase
                .from('user_settings')
                .upsert({
                    user_id: _cache.uid,
                    ...updates,
                    updated_at: new Date().toISOString(),
                });
        } catch (err) {
            console.error('[SettingsContext] Failed to save settings:', err);
        }
    };

    const updateFocusSlot = (index, skillId) => {
        const newSlots = [..._cache.focusSlots];
        newSlots[index] = skillId;
        
        _cache.focusSlots = newSlots;
        setFocusSlots(newSlots);
        saveSettings({ focus_slots: newSlots });
    };

    const updateGuidedSlotRoles = (enabled) => {
        _cache.guidedSlotRoles = enabled;
        setGuidedSlotRoles(enabled);
        saveSettings({ guided_slot_roles: enabled });
    };

    const updateMaintenanceSkillIds = (ids) => {
        _cache.maintenanceSkillIds = ids;
        setMaintenanceSkillIdsState(ids);
        saveSettings({ maintenance_skill_ids: ids });
    };

    const toggleMaintenanceEnabled = (enabled) => {
        _cache.maintenanceEnabled = enabled;
        setMaintenanceEnabledState(enabled);
        saveSettings({ maintenance_enabled: enabled });
    };
    
    const updateEnergyLevel = (level) => {
        const clampedLevel = Math.max(1, Math.min(5, level));
        _cache.energyLevel = clampedLevel;
        setEnergyLevel(clampedLevel);
        saveSettings({ energy_level: clampedLevel });
    };

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[SettingsContext] Auth event:', event);

            // ONLY react to these major events. Ignore TOKEN_REFRESHED, USER_UPDATED, etc.
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                const uid = session?.user?.id;
                if (uid && uid !== _cache.uid) {
                    loadSettings(uid);
                }
            } else if (event === 'SIGNED_OUT') {
                console.log('[SettingsContext] Cleaning cache on sign out');
                _cache.uid = null;
                _cache.hasLoaded = false;
                _cache.focusSlots = [null, null, null, null, null];
                _cache.maintenanceSkillIds = [];
                _cache.maintenanceEnabled = true;
                _cache.guidedSlotRoles = true;
                _cache.energyLevel = 3;
                setFocusSlots(_cache.focusSlots);
                setMaintenanceSkillIdsState(_cache.maintenanceSkillIds);
                setMaintenanceEnabledState(_cache.maintenanceEnabled);
                setGuidedSlotRoles(_cache.guidedSlotRoles);
                setEnergyLevel(_cache.energyLevel);
            }
        });

        // Initial check if already authenticated
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) loadSettings(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, [loadSettings]);

    return (
        <SettingsContext.Provider value={{
            focusSlots,
            maintenanceSkillIds,
            maintenanceEnabled,
            guidedSlotRoles,
            energyLevel,
            updateFocusSlot,
            updateMaintenanceSkillIds,
            toggleMaintenanceEnabled,
            updateGuidedSlotRoles,
            updateEnergyLevel,
            loading,
            userId: _cache.uid,
            refreshSettings: () => _cache.uid && loadSettings(_cache.uid),
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
