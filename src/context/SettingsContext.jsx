import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { backbone as backboneService } from '../backbone-v2';

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
    energyLevel: 5,
    activeExperimentLimit: 1,
    dbSupportsExperimentLimit: true, // Track if column exists to avoid save errors
    healthDotStyle: localStorage.getItem('app-health-dot-style') || 'glowing',
    blurQuality: localStorage.getItem('app-blur-quality') || 'performance',
    currencyName: localStorage.getItem('app-currency-name') || 'Coins',
    todayRemovalMode: localStorage.getItem('app-today-removal-mode') || 'on_completion',
    isWhitelisted: false,
    trialStartAt: null,
    hasLoaded: false,
};

export const SettingsProvider = ({ children }) => {
    // Initialise from cache so we never flash the empty state on re-mount
    const [focusSlots, setFocusSlots] = useState(_cache.focusSlots);
    const [maintenanceSkillIds, setMaintenanceSkillIdsState] = useState(_cache.maintenanceSkillIds);
    const [maintenanceEnabled, setMaintenanceEnabledState] = useState(_cache.maintenanceEnabled);
    const [guidedSlotRoles, setGuidedSlotRoles] = useState(_cache.guidedSlotRoles);
    const [energyLevel, setEnergyLevel] = useState(_cache.energyLevel);
    const [activeExperimentLimit, setActiveExperimentLimitState] = useState(_cache.activeExperimentLimit);
    const [healthDotStyle, setHealthDotStyleState] = useState(_cache.healthDotStyle);
    const [blurQuality, setBlurQualityState] = useState(_cache.blurQuality);
    const [currencyName, setCurrencyNameState] = useState(_cache.currencyName);
    const [todayRemovalMode, setTodayRemovalModeState] = useState(_cache.todayRemovalMode);
    const [isWhitelisted, setIsWhitelistedState] = useState(_cache.isWhitelisted);
    const [trialStartAt, setTrialStartAtState] = useState(_cache.trialStartAt);
    const [loading, setLoading] = useState(!_cache.hasLoaded);


    const loadSettings = useCallback(async (uid) => {
        if (!uid) return;

        // Skip if this user's settings are already cached
        if (_cache.uid === uid && _cache.hasLoaded) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            // Step 1: Try to fetch with all columns (including new ones)
            let query = supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', uid)
                .single();
            
            let { data, error } = await query;

            // Step 2: If it fails, it might be due to missing columns (legacy DB)
            // We'll try to fallback to a minimal set of columns that we know exist
            if (error && (error.message?.includes('active_experiment_limit') || error.message?.includes('currency_name'))) {
                const minimalQuery = await supabase
                    .from('user_settings')
                    .select('focus_slots, guided_slot_roles, energy_level, maintenance_skill_ids, maintenance_enabled, today_removal_mode')
                    .eq('user_id', uid)
                    .single();
                data = minimalQuery.data ? { ...minimalQuery.data, currency_name: 'Coins' } : null;
                error = minimalQuery.error;
                
                if (error.message?.includes('active_experiment_limit')) {
                    _cache.dbSupportsExperimentLimit = false;
                }
            }

            if (error && error.code === 'PGRST116') {
                // Row doesn't exist yet — create with defaults
                const defaults = {
                    user_id: uid,
                    focus_slots: [null, null, null, null, null],
                    maintenance_skill_ids: [],
                    maintenance_enabled: true,
                    guided_slot_roles: true,
                    energy_level: 5,
                    is_whitelisted: false,
                    trial_start_at: new Date().toISOString(),
                    ...(_cache.dbSupportsExperimentLimit ? { active_experiment_limit: 1 } : {})
                };
                
                let { error: insertError } = await supabase
                    .from('user_settings')
                    .insert(defaults);

                // If insert failed due to column, try without it
                if (insertError && insertError.message?.includes('active_experiment_limit')) {
                    _cache.dbSupportsExperimentLimit = false;
                    delete defaults.active_experiment_limit;
                    const retryInsert = await supabase.from('user_settings').insert(defaults);
                    insertError = retryInsert.error;
                }

                if (!insertError) {
                    _cache.focusSlots = [null, null, null, null, null];
                    _cache.maintenanceSkillIds = [];
                    _cache.maintenanceEnabled = true;
                    _cache.guidedSlotRoles = true;
                    _cache.energyLevel = 5;
                    _cache.activeExperimentLimit = 1;
                    _cache.currencyName = 'Coins';
                    _cache.todayRemovalMode = 'on_completion';
                    _cache.isWhitelisted = false;
                    _cache.trialStartAt = defaults.trial_start_at;
                    _cache.hasLoaded = true;
                    _cache.uid = uid;
                    setFocusSlots(_cache.focusSlots);
                    setMaintenanceSkillIdsState(_cache.maintenanceSkillIds);
                    setMaintenanceEnabledState(_cache.maintenanceEnabled);
                    setGuidedSlotRoles(_cache.guidedSlotRoles);
                    setEnergyLevel(_cache.energyLevel);
                    setActiveExperimentLimitState(_cache.activeExperimentLimit);
                    setCurrencyNameState(_cache.currencyName);
                    setTodayRemovalModeState(_cache.todayRemovalMode);
                    setIsWhitelistedState(false);
                    setTrialStartAtState(defaults.trial_start_at);
                }
            } else if (!error && data) {
                _cache.focusSlots = data.focus_slots || [null, null, null, null, null];
                _cache.maintenanceSkillIds = data.maintenance_skill_ids || [];
                _cache.maintenanceEnabled = data.maintenance_enabled !== undefined ? data.maintenance_enabled : true;
                _cache.guidedSlotRoles = data.guided_slot_roles !== undefined ? data.guided_slot_roles : true;
                _cache.energyLevel = data.energy_level !== undefined ? data.energy_level : 5;
                _cache.activeExperimentLimit = data.active_experiment_limit !== undefined ? data.active_experiment_limit : 1;
                _cache.currencyName = data.currency_name ?? 'Coins';
                _cache.todayRemovalMode = data.today_removal_mode || 'on_completion';
                _cache.isWhitelisted = data.is_whitelisted || false;
                
                let trialStart = data.trial_start_at;
                if (!trialStart) {
                    trialStart = new Date().toISOString();
                    supabase.from('user_settings')
                        .update({ trial_start_at: trialStart })
                        .eq('user_id', uid)
                        .then(() => {});
                }
                _cache.trialStartAt = trialStart;
                
                _cache.hasLoaded = true;
                _cache.uid = uid;
                setFocusSlots(_cache.focusSlots);
                setMaintenanceSkillIdsState(_cache.maintenanceSkillIds);
                setMaintenanceEnabledState(_cache.maintenanceEnabled);
                setGuidedSlotRoles(_cache.guidedSlotRoles);
                setEnergyLevel(_cache.energyLevel);
                setActiveExperimentLimitState(_cache.activeExperimentLimit);
                setCurrencyNameState(_cache.currencyName);
                setTodayRemovalModeState(_cache.todayRemovalMode);
                setIsWhitelistedState(_cache.isWhitelisted);
                setTrialStartAtState(_cache.trialStartAt);
            }
        } catch (err) {
            console.error('[SettingsContext] Unexpected error during load:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const saveSettings = async (updates) => {
        if (!_cache.uid) return;
        
        // Strip out the experiment limit if we know the DB doesn't have the column
        const cleanUpdates = { ...updates };
        if (!_cache.dbSupportsExperimentLimit) {
            delete cleanUpdates.active_experiment_limit;
        }

        // If nothing left to update, skip
        if (Object.keys(cleanUpdates).length === 0 && !updates.focus_slots) {
             // We allow focus_slots even if it's the only one
        }

        try {
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: _cache.uid,
                    ...cleanUpdates,
                    updated_at: new Date().toISOString(),
                });
            
            if (error && error.message?.includes('active_experiment_limit')) {
                console.error('[SettingsContext] Save failed due to missing limit column. Disabling limit sync.');
                _cache.dbSupportsExperimentLimit = false;
                // Retry without the failing column
                delete cleanUpdates.active_experiment_limit;
                await supabase.from('user_settings').upsert({
                    user_id: _cache.uid,
                    ...cleanUpdates,
                    updated_at: new Date().toISOString(),
                });
            }
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

    const updateActiveExperimentLimit = (limit) => {
        const val = parseInt(limit);
        if (isNaN(val)) return;
        _cache.activeExperimentLimit = val;
        setActiveExperimentLimitState(val);
        saveSettings({ active_experiment_limit: val });
    };

    const updateHealthDotStyle = (style) => {
        _cache.healthDotStyle = style;
        setHealthDotStyleState(style);
        localStorage.setItem('app-health-dot-style', style);
    };

    const updateBlurQuality = (quality) => {
        _cache.blurQuality = quality;
        setBlurQualityState(quality);
        localStorage.setItem('app-blur-quality', quality);
    };
    
    const updateCurrencyName = (name) => {
        const finalName = name || 'Coins';
        _cache.currencyName = finalName;
        setCurrencyNameState(finalName);
        localStorage.setItem('app-currency-name', finalName);
        saveSettings({ currency_name: finalName });
    };

    const updateTodayRemovalMode = (mode) => {
        const finalMode = mode || 'on_completion';
        _cache.todayRemovalMode = finalMode;
        setTodayRemovalModeState(finalMode);
        localStorage.setItem('app-today-removal-mode', finalMode);
        saveSettings({ today_removal_mode: finalMode });
    };

    // Reflect health dot style to DOM for CSS access
    useEffect(() => {
        document.documentElement.dataset.healthDotStyle = healthDotStyle;
    }, [healthDotStyle]);

    useEffect(() => {
        document.documentElement.dataset.blurQuality = blurQuality;
    }, [blurQuality]);



    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

            // ONLY react to these major events. Ignore TOKEN_REFRESHED, USER_UPDATED, etc.
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                const uid = session?.user?.id;
                if (uid && uid !== _cache.uid) {
                    loadSettings(uid).then(() => {
                        // Check if there's a pending whitelist to sync
                        if (localStorage.getItem('pending_beta_whitelist') === 'true') {
                            supabase.rpc('verify_and_whitelist_user', { input_password: 'Vg5d9Xk3' })
                                .then(({ data, error }) => {
                                    if (data && !error) {
                                        console.log('[SettingsContext] Sync: Successfully applied pending beta whitelist to database.');
                                        _cache.isWhitelisted = true;
                                        setIsWhitelistedState(true);
                                        localStorage.removeItem('pending_beta_whitelist');
                                    }
                                });
                        }
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                _cache.uid = null;
                _cache.hasLoaded = false;
                _cache.focusSlots = [null, null, null, null, null];
                _cache.maintenanceSkillIds = [];
                _cache.maintenanceEnabled = true;
                _cache.guidedSlotRoles = true;
                _cache.energyLevel = 5;
                _cache.activeExperimentLimit = 1;
                _cache.currencyName = 'Coins';
                _cache.todayRemovalMode = 'on_completion';
                _cache.isWhitelisted = false;
                _cache.trialStartAt = null;
                setFocusSlots(_cache.focusSlots);
                setMaintenanceSkillIdsState(_cache.maintenanceSkillIds);
                setMaintenanceEnabledState(_cache.maintenanceEnabled);
                setGuidedSlotRoles(_cache.guidedSlotRoles);
                setEnergyLevel(_cache.energyLevel);
                setActiveExperimentLimitState(_cache.activeExperimentLimit);
                setCurrencyNameState(_cache.currencyName);
                setTodayRemovalModeState(_cache.todayRemovalMode);
                setIsWhitelistedState(false);
                setTrialStartAtState(null);
            }
        });

        // Initial check if already authenticated
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) loadSettings(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, [loadSettings]);

    const refreshSettings = useCallback(() => {
        if (_cache.uid) loadSettings(_cache.uid);
    }, [loadSettings]);

    const applyWhitelist = async (password) => {
        try {
            if (_cache.uid) {
                const { data, error } = await supabase.rpc('verify_and_whitelist_user', {
                    input_password: password
                });
                if (error) throw error;
                if (data) {
                    _cache.isWhitelisted = true;
                    setIsWhitelistedState(true);
                    return { success: true, message: "Lifetime beta access unlocked!" };
                } else {
                    return { success: false, message: "Incorrect password." };
                }
            } else {
                if (password === 'Vg5d9Xk3') {
                    localStorage.setItem('pending_beta_whitelist', 'true');
                    return { success: true, message: "Beta code accepted! Your lifetime access will apply as soon as you sign in." };
                } else {
                    return { success: false, message: "Incorrect password." };
                }
            }
        } catch (err) {
            console.error('[SettingsContext] Failed to apply whitelist:', err);
            return { success: false, message: err.message || "An unexpected error occurred." };
        }
    };

    const isTrialActive = useMemo(() => {
        if (!trialStartAt) return true; // Guest user: local access remains unrestricted
        const start = new Date(trialStartAt).getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        return Date.now() - start < thirtyDays;
    }, [trialStartAt]);

    const hasAccess = useMemo(() => {
        return isWhitelisted || isTrialActive;
    }, [isWhitelisted, isTrialActive]);

    const settingsValue = useMemo(() => ({
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
        activeExperimentLimit,
        updateActiveExperimentLimit,
        healthDotStyle,
        updateHealthDotStyle,
        blurQuality,
        updateBlurQuality,
        currencyName,
        updateCurrencyName,
        todayRemovalMode,
        updateTodayRemovalMode,
        isWhitelisted,
        applyWhitelist,
        trialStartAt,
        isTrialActive,
        hasAccess,
        dbSupportsExperimentLimit: _cache.dbSupportsExperimentLimit,
        loading,
        userId: _cache.uid,
        refreshSettings,
    }), [focusSlots, maintenanceSkillIds, maintenanceEnabled, guidedSlotRoles, energyLevel, activeExperimentLimit, healthDotStyle, blurQuality, currencyName, todayRemovalMode, isWhitelisted, trialStartAt, isTrialActive, hasAccess, loading, refreshSettings]);

    return (
        <SettingsContext.Provider value={settingsValue}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
