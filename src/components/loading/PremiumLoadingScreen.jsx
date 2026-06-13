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
        }, 3000); // 3 seconds fallback
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="premium-loader-container">

            
            {/* 2. Darker translucent overlay to help centered text popup */}
            <div className="loader-bg-overlay" />
            
            {/* 3. Glass centered container */}
            <div className="loader-glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            
                {/* 4. Elegant circular spinner */}
                <div className="loader-ring" />
                
                {/* 5. Minimal text indicator & secondary text, hidden when reload button shows */}
                {!showReload && (
                    <>
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
                    </>
                )}

                {showReload && (
                    <button 
                        className="loader-reload-btn"
                        onClick={() => window.location.reload()} 
                    >
                        Refresh now pls
                    </button>
                )}
            </div>
            
        </div>
    );
};

export default PremiumLoadingScreen;
