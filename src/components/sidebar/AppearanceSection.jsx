import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import WallpaperInputPair from '../WallpaperInputPair';
import './AppearanceSection.css';

// Same mapping as BackgroundLayer
const resolvePageKey = (pathname) => {
    if (pathname === '/' || pathname === '/launchpad') return 'launchpad';
    if (pathname.startsWith('/journal')) return 'journal';
    if (pathname.startsWith('/marketplace')) return 'marketplace';
    if (pathname.startsWith('/area')) return 'area';
    return null;
};

const PAGE_LABELS = {
    launchpad: 'Launchpad',
    journal: 'Journal',
    marketplace: 'Marketplace',
    area: 'Area',
};

const AppearanceSection = ({ isVisible }) => {
    const {
        wallpaperConfig,
        wallpaperScope,
        setLightWallpaper,
        setDarkWallpaper,
    } = useTheme();

    const location = useLocation();
    const pageKey = resolvePageKey(location.pathname);

    // Only render when wallpaper mode is on AND scope is per-page
    if (!isVisible || wallpaperScope !== 'per-page') return null;

    const { wallpapers } = wallpaperConfig;
    const pagePair = pageKey ? wallpapers.pages[pageKey] : null;
    const pageLabel = pageKey ? PAGE_LABELS[pageKey] : null;

    return (
        <div className="wallpaper-settings-nested">
            {pageKey ? (
                <WallpaperInputPair
                    label={`${pageLabel} wallpaper`}
                    lightValue={pagePair?.light}
                    darkValue={pagePair?.dark}
                    onLightChange={(url) => setLightWallpaper(url, pageKey)}
                    onDarkChange={(url) => setDarkWallpaper(url, pageKey)}
                    idPrefix={`sidebar-${pageKey}`}
                />
            ) : (
                <div className="wallpaper-no-page-hint">
                    Navigate to a page to set its wallpaper.
                </div>
            )}
        </div>
    );
};

export default AppearanceSection;
