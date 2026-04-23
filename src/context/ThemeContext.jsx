import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from 'react';

const isTauri = () => typeof window !== 'undefined' && window.__TAURI__ !== undefined;
import { supabase } from '../lib/supabase';
import { fetchWallpaperConfig, saveWallpaperConfig } from '../lib/wallpaperService';

const ThemeContext = createContext();

// ─── Default wallpaper config shape ──────────────────────────────────────────
const DEFAULT_WALLPAPER_CONFIG = {
    wallpaperScope: 'global',
    backgroundMode: 'solid',
    wallpapers: {
        global: { light: null, dark: null },
        pages: {
            launchpad: { light: null, dark: null },
            journal: { light: null, dark: null },
            marketplace: { light: null, dark: null },
            area: { light: null, dark: null },
        }
    }
};

/**
 * Migrate old flat { light, dark } shape → new nested shape.
 */
const migrateWallpaperConfig = (raw) => {
    if (!raw) return DEFAULT_WALLPAPER_CONFIG;

    if (raw.wallpaperScope !== undefined && raw.wallpapers !== undefined) {
        const pages = { ...DEFAULT_WALLPAPER_CONFIG.wallpapers.pages, ...raw.wallpapers.pages };
        const backgroundMode = raw.backgroundMode || 'solid';
        return { ...raw, backgroundMode, wallpapers: { ...raw.wallpapers, pages } };
    }

    return {
        ...DEFAULT_WALLPAPER_CONFIG,
        backgroundMode: raw.backgroundMode || 'solid',
        wallpapers: {
            ...DEFAULT_WALLPAPER_CONFIG.wallpapers,
            global: { light: raw.light || null, dark: raw.dark || null }
        }
    };
};

export const ThemeProvider = ({ children }) => {
    const getSystemTheme = () =>
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

    const [themePreference, setThemePreference] = useState(
        () => localStorage.getItem("theme-preference") || "system"
    );

    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    const [backgroundMode, setBackgroundMode] = useState(() => {
        // Migration: Check old localStorage flags
        const savedBg = localStorage.getItem('app-background-mode');
        if (savedBg === 'wallpaper') return 'wallpaper';

        const savedSurface = localStorage.getItem('app-surface-mode');
        if (savedSurface === 'liquid' || savedSurface === 'glass') return 'liquid';

        return 'solid';
    });

    // ─── Wallpaper Config ─────────────────────────────────────────────────────
    const [wallpaperConfig, setWallpaperConfig] = useState(() => {
        const savedNew = localStorage.getItem('app-wallpaper-config');
        if (savedNew) {
            try {
                const parsed = migrateWallpaperConfig(JSON.parse(savedNew));
                // Sync backgroundMode if present in saved config
                if (parsed.backgroundMode) {
                    // We don't call setBackgroundMode here as it's the initializer,
                    // but we can't easily sync back to backgroundMode state from here
                    // without causing a re-render or being redundant.
                    // The effect and migrateWallpaperConfig will handle it.
                }
                return parsed;
            }
            catch (e) { console.error('Failed to parse wallpaper config:', e); }
        }
        const legacy = localStorage.getItem('app-wallpaper');
        if (legacy) return migrateWallpaperConfig({ light: legacy, dark: legacy });
        return DEFAULT_WALLPAPER_CONFIG;
    });
    
    // Derived resolved theme with fallback logic for neutral mode
    const resolvedTheme = (() => {
        if (themePreference === 'system') return systemTheme;
        if (themePreference === 'neutral' && backgroundMode !== 'liquid') return 'dark';
        return themePreference;
    })();

    // Update root data attribute
    useEffect(() => {
        document.documentElement.dataset.theme = resolvedTheme;
    }, [resolvedTheme]);

    // ─── Auth state ───────────────────────────────────────────────────────────
    const [currentUser, setCurrentUser] = useState(null);

    // ─── Sync state flags ─────────────────────────────────────────────────────
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState(null);
    const [showCompletedTasks, setShowCompletedTasks] = useState(() => {
        return localStorage.getItem('app-show-completed-tasks') === 'true';
    });
    const [isMultipleWallpapersMode, setIsMultipleWallpapersMode] = useState(() => {
        return localStorage.getItem('app-multiple-wallpapers-mode') === 'true';
    });


    // Ref to track whether the current config change came from a Supabase load
    // (prevents echo-saving back what we just fetched)
    const isLoadingFromSupabase = useRef(false);

    // Debounce timer ref for Supabase saves
    const saveDebounceRef = useRef(null);

    // ─── Load wallpaper config from Supabase ──────────────────────────────────
    const loadFromSupabase = async (userId) => {
        setIsSyncing(true);
        setSyncError(null);
        try {
            const remoteConfig = await fetchWallpaperConfig(userId);
            if (remoteConfig) {
                const migrated = migrateWallpaperConfig(remoteConfig);
                isLoadingFromSupabase.current = true;
                setWallpaperConfig(migrated);

                // Update backgroundMode from remote if present
                if (migrated.backgroundMode) {
                    setBackgroundMode(migrated.backgroundMode);
                }

                // Also persist to localStorage for offline use
                localStorage.setItem('app-wallpaper-config', JSON.stringify(migrated));
            }
        } catch (err) {
            console.error('[ThemeContext] Failed to load wallpaper config from Supabase:', err);
            setSyncError('Failed to sync wallpapers');
        } finally {
            setIsSyncing(false);
        }
    };

    // ─── Auth listener: sign-in triggers remote load ──────────────────────────
    useEffect(() => {
        // Check session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            const user = session?.user ?? null;
            setCurrentUser(user);
            if (user) loadFromSupabase(user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user ?? null;
            setCurrentUser(user);
            if (user) {
                loadFromSupabase(user.id);
            } else {
                // Signed out: revert to local-only config
                setCurrentUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ─── Debounced Supabase save whenever wallpaperConfig/backgroundMode changes ─────────────
    useEffect(() => {

        // Skip saving back to Supabase if this change originated from a remote load
        if (isLoadingFromSupabase.current) {
            isLoadingFromSupabase.current = false;
            return;
        }

        if (!currentUser) return;

        // Debounce: wait 1.5s after the last change before saving
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);

        saveDebounceRef.current = setTimeout(async () => {
            setIsSyncing(true);
            setSyncError(null);
            try {
                // Include backgroundMode in the saved config
                const configToSave = { ...wallpaperConfig, backgroundMode };
                const { processedConfig } = await saveWallpaperConfig(currentUser.id, configToSave);

                // If data URLs were replaced with public URLs, update local state + localStorage
                if (processedConfig) {
                    isLoadingFromSupabase.current = true; // prevent save echo
                    setWallpaperConfig(processedConfig);
                    localStorage.setItem('app-wallpaper-config', JSON.stringify(processedConfig));
                }
            } catch (err) {
                console.error('[ThemeContext] Failed to save wallpaper config to Supabase:', err);
                setSyncError('Failed to save wallpapers');
            } finally {
                setIsSyncing(false);
            }
        }, 1500);

        return () => {
            if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
        };
    }, [wallpaperConfig, backgroundMode, currentUser]);

    // ─── System theme listener ────────────────────────────────────────────────
    useEffect(() => {
        let unlisten;
        const setupListener = async () => {
            const { listen } = await import("@tauri-apps/api/event");
            unlisten = await listen("system-appearance-changed", (event) => {
                const isDark = event.payload;
                const current = isDark ? "dark" : "light";
                setSystemTheme(current);
                if (themePreference === "system") {
                    document.documentElement.setAttribute("data-theme", current);
                }
            });
        };
        if (isTauri()) {
            setupListener();
        }
        return () => {
            if (unlisten) unlisten();
        };
    }, [themePreference]);

    // ─── DOM & localStorage persistence ──────────────────────────────────────
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("light", "dark", "neutral");
        root.classList.add(resolvedTheme);
        root.setAttribute("data-theme", resolvedTheme);
    }, [resolvedTheme]);

    useEffect(() => {
        if (isTauri()) {
            if (backgroundMode === 'liquid') {
                // For neutral mode, we pass null to Rust to allow natural vibrancy
                const rustTheme = resolvedTheme === 'neutral' ? 'light' : resolvedTheme;
                if (isTauri()) {
                    import('@tauri-apps/api/core').then(({ invoke }) => {
                        invoke('enable_liquid_glass', { theme: rustTheme }).catch(err =>
                            console.error("Failed to enable glass:", err)
                        );
                    });
                }
            } else {
                if (isTauri()) {
                    import('@tauri-apps/api/core').then(({ invoke }) => {
                        invoke('disable_liquid_glass').catch(err =>
                            console.error("Failed to disable glass:", err)
                        );
                    });
                }
            }
        }

        const root = document.documentElement;

        // Map unified backgroundMode to historical surface attributes for CSS compatibility
        // 'wallpaper' and 'liquid' both use glassy/translucent panels
        const surfaceAttr = (backgroundMode === 'liquid' || backgroundMode === 'wallpaper') ? 'glass' : 'solid';

        root.classList.remove('liquid-mode', 'solid-mode', 'wallpaper-mode');
        root.classList.add(`${backgroundMode}-mode`);

        root.setAttribute('data-surface', surfaceAttr);
        root.setAttribute('data-background-mode', backgroundMode);

        localStorage.setItem('app-background-mode', backgroundMode);
        // Clean up old surface mode setting
        localStorage.removeItem('app-surface-mode');

        // Always persist to localStorage (for offline / no-auth)
        localStorage.setItem('app-wallpaper-config', JSON.stringify({ ...wallpaperConfig, backgroundMode }));
    }, [backgroundMode, wallpaperConfig, resolvedTheme]);

    useEffect(() => {
        localStorage.setItem('app-show-completed-tasks', showCompletedTasks);
    }, [showCompletedTasks]);

    useEffect(() => {
        localStorage.setItem('app-multiple-wallpapers-mode', isMultipleWallpapersMode);
    }, [isMultipleWallpapersMode]);


    // ─── Theme setters ────────────────────────────────────────────────────────
    const setTheme = (theme) => {
        setThemePreference(theme);
        localStorage.setItem("theme-preference", theme);
    };

    const toggleTheme = () => {
        setThemePreference(prev => {
            const next = prev === 'light' ? 'dark' : 'light';
            localStorage.setItem("theme-preference", next);
            return next;
        });
    };

    // ─── Wallpaper scope setter ───────────────────────────────────────────────
    const setWallpaperScope = (scope) => {
        setWallpaperConfig(prev => ({ ...prev, wallpaperScope: scope }));
    };

    // ─── Wallpaper setters (scope-aware) ─────────────────────────────────────
    const setLightWallpaper = (url, page = null) => {
        setWallpaperConfig(prev => {
            if (page) {
                return {
                    ...prev,
                    wallpapers: {
                        ...prev.wallpapers,
                        pages: {
                            ...prev.wallpapers.pages,
                            [page]: { ...prev.wallpapers.pages[page], light: url }
                        }
                    }
                };
            }
            return {
                ...prev,
                wallpapers: { ...prev.wallpapers, global: { ...prev.wallpapers.global, light: url } }
            };
        });
    };

    const setDarkWallpaper = (url, page = null) => {
        setWallpaperConfig(prev => {
            if (page) {
                return {
                    ...prev,
                    wallpapers: {
                        ...prev.wallpapers,
                        pages: {
                            ...prev.wallpapers.pages,
                            [page]: { ...prev.wallpapers.pages[page], dark: url }
                        }
                    }
                };
            }
            return {
                ...prev,
                wallpapers: { ...prev.wallpapers, global: { ...prev.wallpapers.global, dark: url } }
            };
        });
    };

    const clearWallpaper = (page = null) => {
        setWallpaperConfig(prev => {
            if (page) {
                return {
                    ...prev,
                    wallpapers: {
                        ...prev.wallpapers,
                        pages: { ...prev.wallpapers.pages, [page]: { light: null, dark: null } }
                    }
                };
            }
            return { ...prev, wallpapers: { ...DEFAULT_WALLPAPER_CONFIG.wallpapers } };
        });
    };

    // Convenience alias (global pair only) — keeps existing consumers working
    const wallpaper = wallpaperConfig.wallpapers.global;
    const wallpaperScope = wallpaperConfig.wallpaperScope;

    const themeValue = useMemo(() => ({
        theme: resolvedTheme,
        themePreference,
        setTheme,
        toggleTheme,
        backgroundMode,
        setBackgroundMode,
        wallpaper,
        wallpaperConfig,
        wallpaperScope,
        setWallpaperScope,
        setLightWallpaper,
        setDarkWallpaper,
        clearWallpaper,
        // Sync status (optional: show in UI)
        isSyncing,
        syncError,
        showCompletedTasks,
        setShowCompletedTasks,
        isMultipleWallpapersMode,
        setIsMultipleWallpapersMode,
    }), [resolvedTheme, themePreference, backgroundMode, wallpaper, wallpaperConfig, wallpaperScope, isSyncing, syncError, showCompletedTasks, isMultipleWallpapersMode]);

    return (
        <ThemeContext.Provider value={themeValue}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
