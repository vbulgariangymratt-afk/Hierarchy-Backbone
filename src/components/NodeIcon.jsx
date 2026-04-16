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

            // Clean dimensions - forcing 100% scale to fill the parent wrapper
            return content
                .replace(/\bwidth=["'][^"']*["']/gi, '')
                .replace(/\bheight=["'][^"']*["']/gi, '')
                .replace(/<svg/i, '<svg width="100%" height="100%"');
        } catch (e) {
            console.warn('NodeIcon: SVG processing failed', e);
            return null;
        }
    }, [iconUrl]);

    const renderIcon = () => {
        // Handle data:image URLs directly as requested

        if (processedSvg) {
            return (
                <span
                    className={className}
                    style={{
                        width: '100%',
                        height: '100%',
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
                        width: '100%',
                        height: '100%',
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
                width: '100%',
                height: '100%'
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
