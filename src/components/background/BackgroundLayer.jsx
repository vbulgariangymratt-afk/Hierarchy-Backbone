import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import './BackgroundLayer.css';

// Maps URL pathname patterns to page keys used in wallpaperConfig.wallpapers.pages
const resolvePageKey = (pathname) => {
    if (pathname === '/' || pathname === '/launchpad') return 'launchpad';
    if (pathname.startsWith('/journal')) return 'journal';
    if (pathname.startsWith('/marketplace')) return 'marketplace';
    if (pathname.startsWith('/area')) return 'area';
    return null;
};

const BackgroundLayer = () => {
    const { theme, backgroundMode, wallpaperConfig } = useTheme();
    const location = useLocation();

    // ─── Non-wallpaper modes: unmount entirely or show default ───────────────
    if (backgroundMode !== 'wallpaper') {
        // Liquid mode: transparent window — render nothing at all
        if (backgroundMode === 'liquid') return null;
        // Solid mode: plain background div
        return <div className="background-layer default-bg" />;
    }

    // ─── Wallpaper mode ───────────────────────────────────────────────────────
    const { wallpaperScope, wallpapers } = wallpaperConfig;

    let resolvedPair = wallpapers.global;

    if (wallpaperScope === 'per-page') {
        const pageKey = resolvePageKey(location.pathname);
        const pagePair = pageKey ? wallpapers.pages[pageKey] : null;

        // Use page-specific values, falling back field-by-field to global
        if (pagePair && (pagePair.light || pagePair.dark)) {
            resolvedPair = {
                light: pagePair.light || wallpapers.global.light,
                dark: pagePair.dark || wallpapers.global.dark,
            };
        }
    }

    const url = theme === 'dark' ? resolvedPair.dark : resolvedPair.light;

    // Wallpaper mode is active but no URL is set yet — show plain background
    if (!url) {
        return <div className="background-layer default-bg" />;
    }

    return (
        <>
            <div className="background-layer wallpaper-bg">
                <img src={url} alt="" className="wallpaper-image" />
            </div>
            <div className="background-layer wallpaper-overlay" />
        </>
    );
};

export default BackgroundLayer;
