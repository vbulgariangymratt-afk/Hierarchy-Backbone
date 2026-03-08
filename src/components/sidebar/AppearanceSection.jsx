import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import './AppearanceSection.css';

const AppearanceSection = ({ isWallpaperEnabled }) => {
    const {
        wallpaper,
        setLightWallpaper,
        setDarkWallpaper
    } = useTheme();

    if (!isWallpaperEnabled) return null;

    return (
        <div className="wallpaper-settings-nested">
            <div className="wallpaper-input-group">
                <label className="wallpaper-label">Light Mode Wallpaper URL</label>
                <input
                    type="text"
                    className="wallpaper-input"
                    placeholder="Paste Light Mode URL"
                    value={wallpaper?.light || ''}
                    onChange={(e) => setLightWallpaper(e.target.value)}
                />
            </div>

            <div className="wallpaper-input-group">
                <label className="wallpaper-label">Dark Mode Wallpaper URL</label>
                <input
                    type="text"
                    className="wallpaper-input"
                    placeholder="Paste Dark Mode URL"
                    value={wallpaper?.dark || ''}
                    onChange={(e) => setDarkWallpaper(e.target.value)}
                />
            </div>
        </div>
    );
};

export default AppearanceSection;
