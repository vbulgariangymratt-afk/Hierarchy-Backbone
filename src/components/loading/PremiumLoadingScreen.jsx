import React from 'react';
import './PremiumLoadingScreen.css';
import BackgroundLayer from '../background/BackgroundLayer';

/**
 * Premium glassmorphic loading experience. 
 * Renders instantly to provide immediate visual feedback.
 */
const PremiumLoadingScreen = ({ secondaryText }) => {
    const [showReload, setShowReload] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setShowReload(true);
        }, 5000); // 5 seconds fallback
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="premium-loader-container">
            {/* 1. Blurred background of the app persists behind this */}
            <BackgroundLayer />
            
            {/* 2. Darker translucent overlay to help centered text popup */}
            <div className="loader-bg-overlay" />
            
            {/* 3. Glass centered container */}
            <div className="loader-glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            
                {/* 4. Elegant circular spinner */}
                <div className="loader-ring" />
                
                {/* 5. Minimal text indicator */}
                <div className="loader-text">
                    Initializing
                </div>
                
                {secondaryText && (
                    <div className="loader-secondary-text" style={{ 
                        marginTop: '10px', 
                        fontSize: '10px', 
                        opacity: 0.4, 
                        fontWeight: 500,
                        color: 'var(--text-secondary)'
                    }}>
                        {secondaryText}
                    </div>
                )}

                {showReload && (
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{
                            marginTop: '24px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#fff',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            zIndex: 9999,
                            pointerEvents: 'auto'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.12)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
                    >
                        Taking too long? Reload Page
                    </button>
                )}
            </div>
            
        </div>
    );
};

export default PremiumLoadingScreen;
