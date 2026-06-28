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

    // Daily limit tracking state
    const [lightWallpaperChanges, setLightWallpaperChanges] = useState(() => {
        try {
            const saved = localStorage.getItem('app-light-wallpaper-changes');
            return saved ? JSON.parse(saved) : { date: '', count: 0 };
        } catch {
            return { date: '', count: 0 };
        }
    });

    const [darkWallpaperChanges, setDarkWallpaperChanges] = useState(() => {
        try {
            const saved = localStorage.getItem('app-dark-wallpaper-changes');
            return saved ? JSON.parse(saved) : { date: '', count: 0 };
        } catch {
            return { date: '', count: 0 };
        }
    });

    const getTodayDateString = () => new Date().toISOString().split('T')[0];

    const lightChangesRemaining = Math.max(0, 2 - (lightWallpaperChanges.date === getTodayDateString() ? lightWallpaperChanges.count : 0));
    const darkChangesRemaining = Math.max(0, 2 - (darkWallpaperChanges.date === getTodayDateString() ? darkWallpaperChanges.count : 0));

    const incrementChangeCount = async (mode) => {
        const todayStr = getTodayDateString();
        let currentChanges = mode === 'light' ? lightWallpaperChanges : darkWallpaperChanges;
        let newCount = 1;
        if (currentChanges.date === todayStr) {
            newCount = currentChanges.count + 1;
        }
        const updated = { date: todayStr, count: newCount };
        
        if (mode === 'light') {
            setLightWallpaperChanges(updated);
            localStorage.setItem('app-light-wallpaper-changes', JSON.stringify(updated));
        } else {
            setDarkWallpaperChanges(updated);
            localStorage.setItem('app-dark-wallpaper-changes', JSON.stringify(updated));
        }

        if (currentUser) {
            try {
                const { data } = await supabase
                    .from('wallpaper_configs')
                    .select('config')
                    .eq('user_id', currentUser.id)
                    .single();

                const existingConfig = data?.config || {};
                const newConfig = {
                    ...existingConfig,
                    [`${mode}_changes`]: updated
                };

                await supabase
                    .from('wallpaper_configs')
                    .upsert({
                        user_id: currentUser.id,
                        config: newConfig,
                        updated_at: new Date().toISOString()
                    });
            } catch (err) {
                console.error('[ThemeContext] Failed to sync daily change count:', err);
            }
        }
    };

    const updateLightWallpaperImage = async (image) => {
        const todayStr = getTodayDateString();
        // Check if this is a change to a new wallpaper image
        const isNewImage = image !== null && image !== lightWallpaperImage;
        if (isNewImage) {
            const count = lightWallpaperChanges.date === todayStr ? lightWallpaperChanges.count : 0;
            if (count >= 2) {
                const errMsg = 'Daily light wallpaper limit reached. You can only change the wallpaper twice per day.';
                setSyncError(errMsg);
                alert(errMsg);
                return;
            }
        }

        if (image instanceof File) {
            if (currentUser) {
                setIsSyncing(true);
                try {
                    const publicUrl = await uploadWallpaper(image, 'light');
                    if (publicUrl) {
                        setLightWallpaperImage(publicUrl);
                        localStorage.setItem('app-light-wallpaper-image', publicUrl);
                        await saveWallpaperConfig('light', publicUrl);
                        await incrementChangeCount('light');
                    }
                } catch (err) {
                    setSyncError(err.message || 'Failed to upload light wallpaper');
                } finally {
                    setIsSyncing(false);
                }
            } else {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const dataUrl = event.target.result;
                    setLightWallpaperImage(dataUrl);
                    localStorage.setItem('app-light-wallpaper-image', dataUrl);
                    await incrementChangeCount('light');
                };
                reader.readAsDataURL(image);
            }
        } else if (typeof image === 'string' || image === null) {
            setLightWallpaperImage(image);
            if (image) {
                localStorage.setItem('app-light-wallpaper-image', image);
            } else {
                localStorage.removeItem('app-light-wallpaper-image');
            }

            if (currentUser) {
                setIsSyncing(true);
                try {
                    if (image === null) {
                        await supabase.storage
                            .from('wallpapers')
                            .remove([`${currentUser.id}/light_wallpaper`]);
                    }
                    await saveWallpaperConfig('light', image);
                    if (isNewImage) {
                        await incrementChangeCount('light');
                    }
                } catch (err) {
                    console.error('[ThemeContext] Error updating remote light wallpaper config:', err);
                } finally {
                    setIsSyncing(false);
                }
            } else if (isNewImage) {
                await incrementChangeCount('light');
            }
        }
    };

    const updateDarkWallpaperImage = async (image) => {
        const todayStr = getTodayDateString();
        const isNewImage = image !== null && image !== darkWallpaperImage;
        if (isNewImage) {
            const count = darkWallpaperChanges.date === todayStr ? darkWallpaperChanges.count : 0;
            if (count >= 2) {
                const errMsg = 'Daily dark wallpaper limit reached. You can only change the wallpaper twice per day.';
                setSyncError(errMsg);
                alert(errMsg);
                return;
            }
        }

        if (image instanceof File) {
            if (currentUser) {
                setIsSyncing(true);
                try {
                    const publicUrl = await uploadWallpaper(image, 'dark');
                    if (publicUrl) {
                        setDarkWallpaperImage(publicUrl);
                        localStorage.setItem('app-dark-wallpaper-image', publicUrl);
                        await saveWallpaperConfig('dark', publicUrl);
                        await incrementChangeCount('dark');
                    }
                } catch (err) {
                    setSyncError(err.message || 'Failed to upload dark wallpaper');
                } finally {
                    setIsSyncing(false);
                }
            } else {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const dataUrl = event.target.result;
                    setDarkWallpaperImage(dataUrl);
                    localStorage.setItem('app-dark-wallpaper-image', dataUrl);
                    await incrementChangeCount('dark');
                };
                reader.readAsDataURL(image);
            }
        } else if (typeof image === 'string' || image === null) {
            setDarkWallpaperImage(image);
            if (image) {
                localStorage.setItem('app-dark-wallpaper-image', image);
            } else {
                localStorage.removeItem('app-dark-wallpaper-image');
            }

            if (currentUser) {
                setIsSyncing(true);
                try {
                    if (image === null) {
                        await supabase.storage
                            .from('wallpapers')
                            .remove([`${currentUser.id}/dark_wallpaper`]);
                    }
                    await saveWallpaperConfig('dark', image);
                    if (isNewImage) {
                        await incrementChangeCount('dark');
                    }
                } catch (err) {
                    console.error('[ThemeContext] Error updating remote dark wallpaper config:', err);
                } finally {
                    setIsSyncing(false);
                }
            } else if (isNewImage) {
                await incrementChangeCount('dark');
            }
        }
    };

    const uploadWallpaper = async (file, mode) => {
        if (!currentUser) return null;
        try {
            const filePath = `${currentUser.id}/${mode}_wallpaper`;
            const { error } = await supabase.storage
                .from('wallpapers')
                .upload(filePath, file, {
                    cacheControl: '0',
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('wallpapers')
                .getPublicUrl(filePath);

            return `${publicUrl}?t=${Date.now()}`;
        } catch (err) {
            console.error(`[ThemeContext] Failed uploading wallpaper:`, err);
            throw err;
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

    // Load remote wallpaper config on login
    useEffect(() => {
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
                    const config = data.config;
                    if (config.light) {
                        setLightWallpaperImage(config.light);
                        localStorage.setItem('app-light-wallpaper-image', config.light);
                    }
                    if (config.dark) {
                        setDarkWallpaperImage(config.dark);
                        localStorage.setItem('app-dark-wallpaper-image', config.dark);
                    }
                    if (config.light_changes) {
                        setLightWallpaperChanges(config.light_changes);
                        localStorage.setItem('app-light-wallpaper-changes', JSON.stringify(config.light_changes));
                    }
                    if (config.dark_changes) {
                        setDarkWallpaperChanges(config.dark_changes);
                        localStorage.setItem('app-dark-wallpaper-changes', JSON.stringify(config.dark_changes));
                    }
                }
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
        lightChangesRemaining,
        darkChangesRemaining,
    }), [resolvedTheme, themePreference, backgroundMode, isSyncing, syncError, showCompletedTasks, solidAccentColor, lightWallpaperImage, darkWallpaperImage, wallpaperImage, lightChangesRemaining, darkChangesRemaining]);

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
