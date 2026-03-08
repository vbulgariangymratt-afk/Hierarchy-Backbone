import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import './BackgroundLayer.css';

const BackgroundLayer = () => {
    const { theme, surface, backgroundMode, wallpaper } = useTheme();

    // 1. Wallpaper Mode
    if (backgroundMode === 'wallpaper') {
        const url = theme === 'dark' ? wallpaper.dark : wallpaper.light;

        if (!url) {
            // Fallback if mode is wallpaper but no URL is set
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
    }

    // 2. Liquid Mode (without wallpaper)
    if (surface === 'liquid') {
        // Render nothing so the Electron/macOS transparent window shows the desktop
        return null;
    }

    // 3. Default (Solid Mode)
    return <div className="background-layer default-bg" />;
};

export default BackgroundLayer;
