import React, { useMemo } from 'react';

const NodeIcon = ({ iconUrl, emoji, defaultIcon = '🌐', className = 'app-icon', size = 20 }) => {
    // Process SVG data URLs to enable dynamic theming
    const processedSvg = useMemo(() => {
        if (!iconUrl || typeof iconUrl !== 'string' || !iconUrl.startsWith('data:image/svg+xml')) {
            return null;
        }

        try {
            let content = '';
            if (iconUrl.includes('base64,')) {
                // Safely handle base64 decoding in browser environment
                const base64Data = iconUrl.split('base64,')[1];
                content = window.atob(base64Data);
            } else {
                const parts = iconUrl.split(',');
                if (parts.length < 2) return null;
                const data = parts[1];
                content = data.includes('%') ? decodeURIComponent(data) : data;
            }

            // Clean dimensions and inject currentColor for theme adaptation
            return content
                .replace(/width=["'][^"']*["']/gi, '')
                .replace(/height=["'][^"']*["']/gi, '')
                .replace(/stroke=["']((?!none|currentColor)[^"']+)["']/gi, 'stroke="currentColor"')
                .replace(/fill=["']((?!none|currentColor)[^"']+)["']/gi, 'fill="currentColor"');
        } catch (e) {
            return null;
        }
    }, [iconUrl]);

    const renderIcon = () => {
        // Handle data:image URLs directly as requested (Non-SVG images)
        if (iconUrl && typeof iconUrl === 'string' && iconUrl.startsWith('data:image') && !iconUrl.startsWith('data:image/svg+xml')) {
            // If it's an SVG and we're NOT using the img route, processedSvg would handle it.
            // But the user specifically asked for an <img> element for regular data images.
            return (
                <img
                    src={iconUrl}
                    alt=""
                    className={className}
                    style={{
                        width: size + 'px',
                        height: size + 'px',
                        objectFit: 'contain',
                        borderRadius: '4px'
                    }}
                />
            );
        }

        if (processedSvg) {
            return (
                <span
                    className={className}
                    style={{
                        width: size + 'px',
                        height: size + 'px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'inherit'
                    }}
                    dangerouslySetInnerHTML={{ __html: processedSvg }}
                />
            );
        }

        if (iconUrl) {
            return (
                <img
                    src={iconUrl}
                    alt="icon"
                    className={className}
                    style={{
                        width: size + 'px',
                        height: size + 'px',
                        objectFit: 'contain',
                        borderRadius: '4px'
                    }}
                />
            );
        }

        return (
            <span className={`${className} ${!iconUrl && !processedSvg ? 'is-emoji' : ''}`} style={{
                fontSize: (size * 0.8) + 'px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size + 'px'
            }}>
                {emoji || defaultIcon}
            </span>
        );
    };

    return (
        <span className="icon-container" style={{
            width: (size + 8) + 'px',
            height: (size + 8) + 'px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
        }}>
            {renderIcon()}
        </span>
    );
};

export default React.memo(NodeIcon);
