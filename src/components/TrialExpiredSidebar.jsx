import React from 'react';
import './TrialExpiredSidebar.css';
import { useSettings } from '../context/SettingsContext';

const TrialExpiredSidebar = ({ isOpen, onClose }) => {
    const { extendTrial, redirectToCheckout } = useSettings();

    if (!isOpen) return null;

    const handleExtend = () => {
        extendTrial();
        onClose();
    };

    return (
        <div className="trial-sidebar-overlay" onClick={onClose}>
            <div className="trial-sidebar-container" onClick={(e) => e.stopPropagation()}>
                <div className="trial-sidebar-header">
                    <button className="trial-sidebar-close" onClick={onClose}>✕</button>
                </div>
                <div className="trial-sidebar-content">
                    {/* Bionic reading presentation of the specified text */}
                    <p className="trial-sidebar-message">
                        <strong>Hey</strong>y, <strong>I bu</strong>ilt <strong>Back</strong>bone <strong>know</strong>ing <strong>o</strong>ur <strong>ener</strong>gy <strong>i</strong>s <strong>n</strong>ot <strong>line</strong>ar, <strong>may</strong>be <strong>30 da</strong>ys <strong>is</strong>n’t <strong>eno</strong>ugh <strong>t</strong>o <strong>ful</strong>ly <strong>te</strong>st <strong>t</strong>he <strong>sys</strong>tem <strong>i</strong>f <strong>yo</strong>u <strong>ha</strong>d <strong>a l</strong>ow <strong>ener</strong>gy <strong>we</strong>ek.
                    </p>
                    
                    <p className="trial-sidebar-message">
                        <strong>S</strong>o <strong>i</strong>f <strong>yo</strong>u <strong>ne</strong>ed <strong>a b</strong>it <strong>mo</strong>re <strong>ti</strong>me <strong>t</strong>o <strong>te</strong>st <strong>th</strong>is <strong>o</strong>ut <strong>yo</strong>u <strong>c</strong>an <strong>exte</strong>nd <strong>i</strong>t <strong>f</strong>or <strong>anot</strong>her <strong>we</strong>ek, <strong>n</strong>o <strong>cre</strong>dit <strong>ca</strong>rd <strong>requi</strong>red.
                    </p>
 
                    <div className="trial-sidebar-actions">
                        <button className="trial-sidebar-subscribe-btn" onClick={() => { redirectToCheckout(); onClose(); }}>
                            Subscribe to Premium
                        </button>
                        <button className="trial-sidebar-extend-btn" onClick={handleExtend}>
                            Extend for another week
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrialExpiredSidebar;
