import React from 'react';
import { useBackboneStore } from '../store/backboneStore';
import './TrialPaywallOverlay.css';

// Bionic Reading utility to format text
const bionic = (text) => {
    if (!text) return '';
    return text.split(' ').map((word, i) => {
        if (!word) return null;
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
        if (cleanWord.length === 0) {
            return <span key={i} style={{ marginRight: '0.28em' }}>{word}</span>;
        }
        
        // Bold the first ceil(length/2) characters
        const mid = Math.ceil(cleanWord.length / 2);
        let cleanCharCount = 0;
        let splitIndex = 0;
        
        for (let j = 0; j < word.length; j++) {
            if (/[a-zA-Z0-9]/.test(word[j])) {
                cleanCharCount++;
            }
            if (cleanCharCount === mid) {
                splitIndex = j + 1;
                break;
            }
        }
        
        if (splitIndex === 0) {
            splitIndex = Math.ceil(word.length / 2);
        }

        const boldPart = word.substring(0, splitIndex);
        const restPart = word.substring(splitIndex);

        return (
            <span key={i} className="bionic-word" style={{ marginRight: '0.28em', display: 'inline-block' }}>
                <strong className="bionic-bold">{boldPart}</strong>
                <span className="bionic-muted">{restPart}</span>
            </span>
        );
    });
};

const TrialPaywallOverlay = () => {
    const showPaywall = useBackboneStore(state => state.showPaywall);
    const setShowPaywall = useBackboneStore(state => state.setShowPaywall);

    if (!showPaywall) return null;

    const handleSubscribe = () => {
        alert("Subscription triggered!");
    };

    const handleClose = () => {
        setShowPaywall(false);
    };

    return (
        <div className="trial-paywall-overlay fade-in">
            <div className="trial-paywall-container">
                
                <h1 className="paywall-message-primary">
                    {bionic("If this system helped you bypass your executive freeze this month, you can keep full access for $50/month")}
                </h1>
                
                <p className="paywall-message-secondary">
                    {bionic("There are no hidden fees anywhere, and this is the only tier of Backbone Hierarchy, and if you ever need to pause or stop you can cancel anytime with a single button in your settings")}
                </p>

                <div className="paywall-actions">
                    <button className="paywall-btn secondary-btn" onClick={handleClose}>
                        not right now
                    </button>
                    <button className="paywall-btn primary-btn" onClick={handleSubscribe}>
                        Subscribe for $50/month
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrialPaywallOverlay;
