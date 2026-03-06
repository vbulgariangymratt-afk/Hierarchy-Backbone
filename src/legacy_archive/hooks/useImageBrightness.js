import { useState, useEffect } from 'react';

const useImageBrightness = (imageSrc) => {
    const [brightness, setBrightness] = useState({ mode: 'dark', color: '#000000' }); // Default to dark

    useEffect(() => {
        if (!imageSrc) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d');

                // Sample 1x1 from top-left
                ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
                const p = ctx.getImageData(0, 0, 1, 1).data;

                // Check for transparent/failed pixel
                if (p[3] === 0) {
                    console.warn("🎨 Theme Sampling: Transparent pixel detected (CORS or Empty Image).");
                }

                const luminance = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
                const toHex = (c) => c.toString(16).padStart(2, '0');
                const hexColor = `#${toHex(p[0])}${toHex(p[1])}${toHex(p[2])}`;

                setBrightness({ mode: luminance > 100 ? 'light' : 'dark', color: hexColor });
            } catch (err) {
                console.error("🎨 Theme Sampling Blocked (likely CORS):", err);
                setBrightness({ mode: 'dark', color: '#000000' });
            }
        };

        img.onerror = () => {
            console.error("🎨 Theme Sampling: Image failed to load.");
        };
    }, [imageSrc]);

    return brightness; // returns { mode: 'light'|'dark', color: '#rrggbb' }
};

export default useImageBrightness;
