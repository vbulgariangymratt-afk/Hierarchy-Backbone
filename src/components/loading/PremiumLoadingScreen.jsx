import React from 'react';
import './PremiumLoadingScreen.css';

/**
 * Premium glassmorphic loading experience. 
 * Renders instantly to provide immediate visual feedback.
 */
const PremiumLoadingScreen = ({ secondaryText }) => {
    const [showReload, setShowReload] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setShowReload(true);
        }, 12000); // 12 seconds fallback
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="premium-loader-container">
            {/* Darker translucent overlay to help centered text popup */}
            <div className="loader-bg-overlay" />
            
            {/* Glass centered container */}
            <div className="loader-glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {/* Elegant circular spinner */}
                <div className="loader-ring" />
                
                {/* Minimal text indicator & secondary text */}
                <div className="loader-text" style={{ textTransform: 'none', letterSpacing: '0.04em' }}>
                    Initializing
                </div>
                
                {secondaryText && (
                    <div className="loader-secondary-text" style={{ 
                        marginTop: '8px', 
                        fontSize: '11px', 
                        opacity: 0.6, 
                        fontWeight: 500,
                        textAlign: 'center',
                        color: 'var(--text-secondary)'
                    }}>
                        {secondaryText}
                    </div>
                )}

                {showReload && (
                    <button 
                        className="loader-reload-btn"
                        style={{ marginTop: '12px' }}
                        onClick={() => window.location.reload()} 
                    >
                        Taking longer than usual? Refresh
                    </button>
                )}
            </div>
        </div>
    );
};

export default PremiumLoadingScreen;
