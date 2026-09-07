import React, { useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

const BackgroundLayer = () => {
    const { backgroundMode, wallpaperImage, theme } = useTheme();

    // Preload the wallpaper image at the network level so it survives
    // any brief BackgroundLayer unmount without a visible reload delay.
    useEffect(() => {
        if (!wallpaperImage) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = wallpaperImage;
        document.head.appendChild(link);
        return () => {
            if (document.head.contains(link)) {
                document.head.removeChild(link);
            }
        };
    }, [wallpaperImage]);

    if (backgroundMode !== 'wallpaper' || !wallpaperImage) {
        return null;
    }

    const isLight = theme === 'light';

    const imageFilter = isLight
        ? 'blur(8px) saturate(1.6) brightness(1.1)'
        : 'blur(8px) saturate(1.3) brightness(0.75)';

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -99999,
                pointerEvents: 'none',
                overflow: 'hidden',
                backgroundColor: 'transparent'
            }}
        >
            <img 
                src={wallpaperImage} 
                alt="Wallpaper Background"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    filter: imageFilter,
                    transform: 'scale(1.02)', // Prevents the blurred edge artifacts
                }}
            />
            <div 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: isLight 
                        ? 'rgba(255, 255, 255, 0.7)' 
                        : 'rgba(10, 10, 10, 0.58)',
                }}
            />
        </div>
    );
};

export default BackgroundLayer;
