import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from 'react';

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
import { supabase } from '../lib/supabase';

const ThemeContext = createContext();

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
    
    // Derived resolved theme with fallback logic for neutral mode
    const resolvedTheme = (() => {
        if (themePreference === 'system') return systemTheme;
        if (themePreference === 'neutral' && (backgroundMode !== 'liquid' && backgroundMode !== 'wallpaper')) return 'dark';
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

    const isValidAccentColor = (hex) => {
        if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return false;
        // Saturation safety: reject near-grey/neutral colors
        const num = parseInt(hex.replace('#', ''), 16);
        const r = (num >> 16) & 0xFF;
        const g = (num >> 8) & 0xFF;
        const b = num & 0xFF;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return saturation > 0.15; // reject near-greys
    };

    const BRAND_ACCENT = '#5E6AD2';

    const [solidAccentColor, setSolidAccentColor] = useState(() => {
        const stored = localStorage.getItem('app-solid-accent-color');
        if (isValidAccentColor(stored)) return stored;
        localStorage.setItem('app-solid-accent-color', BRAND_ACCENT);
        return BRAND_ACCENT;
    });

    const [lightWallpaperImage, setLightWallpaperImage] = useState(() => {
        return localStorage.getItem('app-light-wallpaper-image') || null;
    });

    const [darkWallpaperImage, setDarkWallpaperImage] = useState(() => {
        return localStorage.getItem('app-dark-wallpaper-image') || null;
    });

    // Daily limit tracking removed for URL-based wallpapers


    const updateLightWallpaperImage = async (url) => {
        const image = typeof url === 'string' ? url.trim() : null;
        setLightWallpaperImage(image);
        
        if (image) {
            localStorage.setItem('app-light-wallpaper-image', image);
        } else {
            localStorage.removeItem('app-light-wallpaper-image');
        }

        if (currentUser) {
            setIsSyncing(true);
            try {
                await saveWallpaperConfig('light', image);
            } catch (err) {
                console.error('[ThemeContext] Error updating remote light wallpaper config:', err);
            } finally {
                setIsSyncing(false);
            }
        }
    };

    const updateDarkWallpaperImage = async (url) => {
        const image = typeof url === 'string' ? url.trim() : null;
        setDarkWallpaperImage(image);
        
        if (image) {
            localStorage.setItem('app-dark-wallpaper-image', image);
        } else {
            localStorage.removeItem('app-dark-wallpaper-image');
        }

        if (currentUser) {
            setIsSyncing(true);
            try {
                await saveWallpaperConfig('dark', image);
            } catch (err) {
                console.error('[ThemeContext] Error updating remote dark wallpaper config:', err);
            } finally {
                setIsSyncing(false);
            }
        }
    };

    const saveWallpaperConfig = async (mode, url) => {
        if (!currentUser) return;
        try {
            const { data } = await supabase
                .from('wallpaper_configs')
                .select('config')
                .eq('user_id', currentUser.id)
                .single();

            const existingConfig = data?.config || {};
            const newConfig = {
                ...existingConfig,
                [mode]: url
            };

            const { error } = await supabase
                .from('wallpaper_configs')
                .upsert({
                    user_id: currentUser.id,
                    config: newConfig,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
        } catch (err) {
            console.error('[ThemeContext] Failed to save wallpaper config:', err);
        }
    };

    // Load remote wallpaper config on login / user change.
    // Reset wallpaper state BEFORE the async fetch so a new user never sees
    // a leftover wallpaper from the previous session on the same device.
    useEffect(() => {
        // Always clear first — this is synchronous and takes effect immediately,
        // before the fetch resolves, regardless of what the new user's config says.
        setLightWallpaperImage(null);
        setDarkWallpaperImage(null);
        localStorage.removeItem('app-light-wallpaper-image');
        localStorage.removeItem('app-dark-wallpaper-image');

        if (!currentUser) return;

        const loadWallpaperConfig = async () => {
            try {
                const { data, error } = await supabase
                    .from('wallpaper_configs')
                    .select('config')
                    .eq('user_id', currentUser.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('[ThemeContext] Error loading wallpaper config:', error);
                    return;
                }

                if (data && data.config) {
                    // Apply only the fields that are actually saved — absent fields
                    // remain null (already cleared above) rather than showing stale data.
                    const config = data.config;
                    const light = config.light || null;
                    const dark = config.dark || null;

                    setLightWallpaperImage(light);
                    if (light) {
                        localStorage.setItem('app-light-wallpaper-image', light);
                    }

                    setDarkWallpaperImage(dark);
                    if (dark) {
                        localStorage.setItem('app-dark-wallpaper-image', dark);
                    }
                }
                // PGRST116 (no row) or empty config: state is already null from the
                // synchronous reset above — nothing more to do.
            } catch (err) {
                console.error('[ThemeContext] Failed loading wallpaper config:', err);
            }
        };
        loadWallpaperConfig();
    }, [currentUser]);

    const wallpaperImage = resolvedTheme === 'light' ? lightWallpaperImage : darkWallpaperImage;

    const hexToRgb = (hex) => {
        if (!hex || hex.length < 7) return resolvedTheme === 'dark' ? '10, 132, 255' : '0, 113, 227';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    };

    const lightenHexColor = (hex, percent) => {
        if (!hex || hex.length < 7) return resolvedTheme === 'dark' ? '#707ce3' : '#4d59c1';
        const num = parseInt(hex.replace("#",""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
    };

    useEffect(() => {
        if (backgroundMode === 'solid' && solidAccentColor) {
            document.documentElement.style.setProperty('--color-accent', solidAccentColor);
            document.documentElement.style.setProperty('--color-accent-rgb', hexToRgb(solidAccentColor));
            document.documentElement.style.setProperty('--color-accent-hover', lightenHexColor(solidAccentColor, 10));
        } else {
            document.documentElement.style.removeProperty('--color-accent');
            document.documentElement.style.removeProperty('--color-accent-rgb');
            document.documentElement.style.removeProperty('--color-accent-hover');
        }
    }, [solidAccentColor, backgroundMode]);

    const updateSolidAccentColor = (color) => {
        setSolidAccentColor(color);
        localStorage.setItem('app-solid-accent-color', color);
    };

    // ─── Auth listener ────────────────────────────────────────────────────────
    useEffect(() => {
        // Check session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            const user = session?.user ?? null;
            setCurrentUser(user);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user ?? null;
            setCurrentUser(user);
        });

        return () => subscription.unsubscribe();
    }, []);

    // ─── System theme listener ────────────────────────────────────────────────
    useEffect(() => {
        let unlisten;
        const setupListener = async () => {
            const { listen } = await import("@tauri-apps/api/event");
            unlisten = await listen("system-appearance-changed", (event) => {
                const isDark = event.payload;
                const current = isDark ? "dark" : "light";
                setSystemTheme(current);
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
        const applyGlassEffect = async () => {
            if (isTauri()) {
                if (backgroundMode === 'liquid' || backgroundMode === 'wallpaper') {
                    // For neutral mode, we pass null to Rust to allow natural vibrancy
                    const rustTheme = resolvedTheme === 'neutral' ? 'light' : resolvedTheme;
                    try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        await invoke('enable_liquid_glass', { theme: rustTheme });
                    } catch (err) {
                        console.warn('Glass effect not available:', err);
                    }
                } else {
                    try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        await invoke('disable_liquid_glass');
                    } catch (err) {
                        console.warn('Glass effect not available:', err);
                    }
                }
            }
        };

        applyGlassEffect();

        const root = document.documentElement;

        // Map unified backgroundMode to historical surface attributes for CSS compatibility
        // 'wallpaper' and 'liquid' both use glassy/translucent panels
        const surfaceAttr = (backgroundMode === 'liquid' || backgroundMode === 'wallpaper') ? 'glass' : 'solid';

        root.classList.remove('liquid-mode', 'solid-mode', 'wallpaper-mode');
        if (backgroundMode === 'wallpaper') {
            root.classList.add('liquid-mode', 'wallpaper-mode');
        } else {
            root.classList.add(`${backgroundMode}-mode`);
        }

        root.setAttribute('data-surface', surfaceAttr);
        root.setAttribute('data-background-mode', backgroundMode);

        localStorage.setItem('app-background-mode', backgroundMode);
        // Clean up old surface mode setting
        localStorage.removeItem('app-surface-mode');
    }, [backgroundMode, resolvedTheme]);

    useEffect(() => {
        localStorage.setItem('app-show-completed-tasks', showCompletedTasks);
    }, [showCompletedTasks]);

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

    const themeValue = useMemo(() => ({
        theme: resolvedTheme,
        themePreference,
        setTheme,
        toggleTheme,
        backgroundMode,
        setBackgroundMode,
        isSyncing,
        syncError,
        showCompletedTasks,
        setShowCompletedTasks,
        lightWallpaperImage,
        darkWallpaperImage,
        updateLightWallpaperImage,
        updateDarkWallpaperImage,
        wallpaperImage,
    }), [resolvedTheme, themePreference, backgroundMode, isSyncing, syncError, showCompletedTasks, solidAccentColor, lightWallpaperImage, darkWallpaperImage, wallpaperImage]);

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
