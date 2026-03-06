import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import useImageBrightness from '../hooks/useImageBrightness';

const DynamicBackground = () => {
    const location = useLocation();
    const { state } = useStore();

    // Calculate image synchronously to avoid state-in-effect pattern
    const image = React.useMemo(() => {
        const isLight = state.themeMode === 'light';
        const backgrounds = isLight ? state.backgroundsLight : state.backgrounds;

        // Try exact match first (individual page overrides)
        let bg = backgrounds?.[location.pathname];

        // Fallback for skill pages: prioritize parent area background
        if (!bg && location.pathname.startsWith('/skill/')) {
            const skillId = location.pathname.split('/').pop();
            const skill = state.skills?.[skillId];

            if (skill) {
                // 1. Try parent area background
                const areaBg = backgrounds?.[`/area/${skill.areaId}`];
                if (areaBg) {
                    bg = areaBg;
                }
                // 2. Secondary fallback: skill cover image
                else {
                    const cover = isLight ? skill.coverLight : skill.cover;
                    if (cover) bg = cover;
                }
            }
        }

        // Fallback for belief pages: use Spiritual area background
        if (!bg && location.pathname.startsWith('/beliefs/')) {
            const spiritualArea = Object.values(state.areas || {}).find(a => a.name === 'Spiritual');
            if (spiritualArea) {
                const spiritualBg = backgrounds?.[`/area/${spiritualArea.id}`];
                if (spiritualBg) {
                    bg = spiritualBg;
                }
            }
        }

        return bg || null;
    }, [location.pathname, state.backgrounds, state.backgroundsLight, state.skills, state.areas, state.themeMode]);

    const { mode, color } = useImageBrightness(image);

    useEffect(() => {
        // Apply to body for global CSS access (brightness mode)
        document.body.setAttribute('data-bg-brightness', mode);

        // Apply to Meta Theme Color (Browser Title Bar)
        let metaThemeColor = document.querySelector("meta[name='theme-color']");
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }

        // Set toolbar to #141414
        metaThemeColor.setAttribute("content", '#141414');

    }, [mode]);

    // Don't render if backgrounds are disabled or no image is set
    if (!state.showBackgrounds || !image) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(16px)',
                zIndex: 0,
                pointerEvents: 'none',
            }}
        />
    );
};

export default DynamicBackground;
