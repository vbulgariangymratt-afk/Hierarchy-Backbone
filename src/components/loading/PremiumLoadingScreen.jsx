import React from 'react';
import './PremiumLoadingScreen.css';
import BackgroundLayer from '../background/BackgroundLayer';

/**
 * Premium glassmorphic loading experience. 
 * Renders instantly to provide immediate visual feedback.
 */
const PremiumLoadingScreen = ({ secondaryText }) => {
    return (
        <div className="premium-loader-container">
            {/* 1. Blurred background of the app persists behind this */}
            <BackgroundLayer />
            
            {/* 2. Darker translucent overlay to help centered text popup */}
            <div className="loader-bg-overlay" />
            
            {/* 3. Glass centered container */}
            <div className="loader-glass">
            
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
            </div>
            
        </div>
    );
};

export default PremiumLoadingScreen;
