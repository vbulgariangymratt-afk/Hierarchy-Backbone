import React, { createContext, useContext, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // 2. Helper function to detect OS theme
    const getSystemTheme = () =>
        window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";

    // 1. Replace existing theme state with themePreference
    const [themePreference, setThemePreference] = useState(
        () => localStorage.getItem("theme-preference") || "system"
    );

    // Internal state to track system theme changes and trigger React re-renders
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    // 3. Resolved theme value (actual theme applied to UI)
    const resolvedTheme =
        themePreference === "system"
            ? systemTheme
            : themePreference;

    // 7. Initialization improvement for Tauri apps to avoid flicker
    document.documentElement.dataset.theme = resolvedTheme;

    // Existing UI preference states
    const [surfaceMode, setSurfaceMode] = useState(() => {
        const saved = localStorage.getItem('app-surface-mode');
        if (saved === 'glass') return 'liquid'; // Migration: 'glass' -> 'liquid'
        return saved || 'solid';
    });
    const [backgroundMode, setBackgroundMode] = useState(() => localStorage.getItem('app-background-mode') || 'default');

    // Wallpaper configuration for Light and Dark modes
    const [wallpaper, setWallpaperState] = useState(() => {
        const saved = localStorage.getItem('app-wallpaper-config');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse wallpaper config:", e);
            }
        }

        // Migration: check if there was a single wallpaper set previously
        const legacyWallpaper = localStorage.getItem('app-wallpaper');
        if (legacyWallpaper) {
            return { light: legacyWallpaper, dark: legacyWallpaper };
        }

        return { light: null, dark: null };
    });

    // 5. System theme listener: only reacts when themePreference === "system"
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleChange = () => {
            const currentSystemTheme = mediaQuery.matches ? "dark" : "light";
            setSystemTheme(currentSystemTheme);

            if (themePreference === "system") {
                document.documentElement.setAttribute("data-theme", currentSystemTheme);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [themePreference]);

    // 4. DOM Application logic: only modifies document.documentElement
    useEffect(() => {
        const root = document.documentElement;

        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
        root.setAttribute("data-theme", resolvedTheme);

        console.log(`[ThemeEngine] Preference: ${themePreference}, Resolved: ${resolvedTheme}`);
    }, [resolvedTheme]);

    // Side effects for Surface Mode and Native Tauri integration
    useEffect(() => {
        if (surfaceMode === 'liquid') {
            invoke('enable_liquid_glass', { theme: resolvedTheme }).catch(err => console.error("Failed to enable glass:", err));
        } else {
            invoke('disable_liquid_glass').catch(err => console.error("Failed to disable glass:", err));
        }

        const root = document.documentElement;

        // Apply classes to root only
        // CSS expects 'glass' for data-surface, but we call it 'liquid' in settings
        const surfaceAttr = surfaceMode === 'liquid' ? 'glass' : 'solid';

        root.classList.remove('liquid-mode', 'solid-mode');
        root.classList.add(surfaceMode === 'liquid' ? 'liquid-mode' : 'solid-mode');
        root.setAttribute('data-surface', surfaceAttr);
        localStorage.setItem('app-surface-mode', surfaceMode);

        root.setAttribute('data-background-mode', backgroundMode);
        localStorage.setItem('app-background-mode', backgroundMode);

        // Persist Wallpaper Config
        localStorage.setItem('app-wallpaper-config', JSON.stringify(wallpaper));
    }, [surfaceMode, wallpaper, backgroundMode, resolvedTheme]);

    // 6. Updated setter: persists the preference
    const setTheme = (theme) => {
        setThemePreference(theme);
        localStorage.setItem("theme-preference", theme);
    };

    const toggleTheme = () => {
        setThemePreference(prev => {
            // Cycle: light -> dark -> system -> light
            let next;
            if (prev === 'light') next = 'dark';
            else if (prev === 'dark') next = 'system';
            else next = 'light';

            localStorage.setItem("theme-preference", next);
            return next;
        });
    };

    // Helper setters for wallpaper
    const setLightWallpaper = (url) => setWallpaperState(prev => ({ ...prev, light: url }));
    const setDarkWallpaper = (url) => setWallpaperState(prev => ({ ...prev, dark: url }));
    const clearWallpaper = () => setWallpaperState({ light: null, dark: null });

    return (
        <ThemeContext.Provider value={{
            theme: resolvedTheme, // Keep API compatibility (resolved light/dark)
            themePreference,      // Expose new preference state
            setTheme,             // Expose updated setter
            toggleTheme,
            surface: surfaceMode,
            setSurfaceMode,
            backgroundMode,
            setBackgroundMode,
            wallpaper,
            setLightWallpaper,
            setDarkWallpaper,
            clearWallpaper
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

