import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Sidebar from './Sidebar';
import MiniLaunchpadModal from '../components/modals/MiniLaunchpadModal';
import TrialExpiredSidebar from '../components/TrialExpiredSidebar';
import { backbone, NodeTypes } from '../backbone-v2/index';
import { useBackboneStore } from '../store/backboneStore';
import { useSettings } from '../context/SettingsContext';
import { supabase, loginWithGoogle } from '../lib/supabase';
import './MainLayout.css';

const MainLayout = () => {
    // --- ZUSTAND SELECTORS ---
    const safeMode = useBackboneStore(state =>
        state.nodes.some(n => n.type === NodeTypes.OBJECTIVE && n.metadata?.burnoutRisk === true)
    );
    const { isTrialActive, trialDaysRemaining, hasAccess, loading: settingsLoading } = useSettings();
    const [bannerDismissed, setBannerDismissed] = useState(false);
    
    // Auth & Safety Net Banner state
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [safetyNetDismissed, setSafetyNetDismissed] = useState(
        localStorage.getItem('safety_net_dismissed') === 'true'
    );
    const [extensionWarningDismissed, setExtensionWarningDismissed] = useState(
        localStorage.getItem('trial_extension_warning_dismissed') === 'true'
    );

    // Sidebar overlay state
    const [isTrialSidebarOpen, setIsTrialSidebarOpen] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user: initialUser } }) => {
            setUser(initialUser);
            setAuthLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Check if trial has expired (isTrialActive === false / hasAccess === false)
    // and they are in Planning Mode (which is any page rendered under MainLayout, i.e. not "/focus")
    // Removed automatic lockout sidebar popup as trial expiration now uses Read-Only Paywall Interceptor instead.

    const completedTasksCount = useBackboneStore(state =>
        state.nodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.completedAt).length
    );

    const showSafetyNetBanner = !authLoading && !user && completedTasksCount >= 3 && !safetyNetDismissed;

    // Check if we should show the 2-day reminder warning (trialDaysRemaining <= 2 and > 0)
    const [forceShowExtensionWarning, setForceShowExtensionWarning] = useState(false);
    const showExtensionWarning = (forceShowExtensionWarning || (!settingsLoading && isTrialActive && trialDaysRemaining <= 2)) && !extensionWarningDismissed;

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle();
        } catch (err) {
            console.error('[MainLayout] Login error:', err);
        }
    };

    const dismissSafetyNet = () => {
        localStorage.setItem('safety_net_dismissed', 'true');
        setSafetyNetDismissed(true);
    };

    const dismissExtensionWarning = () => {
        localStorage.setItem('trial_extension_warning_dismissed', 'true');
        setExtensionWarningDismissed(true);
        setForceShowExtensionWarning(false);
    };

    // Modal state
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false);

    const openLaunchpad = useCallback((skill) => {
        setSelectedSkill(skill);
        setIsLaunchpadOpen(true);
    }, []);


    const location = useLocation();

    return (
        <div className="main-layout">
            <div className="app-drag-region" data-tauri-drag-region />
            <Sidebar onSkillClick={openLaunchpad} />
            <main className="content-area">
                {showSafetyNetBanner && (
                    <div className="safety-net-banner">
                        <div className="safety-net-message">
                            <span className="safety-net-emoji">🧠</span>
                            <div>
                                <strong style={{ display: 'block', fontWeight: '600' }}>
                                    Nice bruv, you can login to save your data for when your brain's recharging
                                </strong>
                                <span style={{ display: 'block', marginTop: '4px', opacity: 0.8, fontSize: '0.78rem' }}>
                                    No password needed, cuz remembering passwords is a crime against working memory anyway
                                </span>
                            </div>
                        </div>
                        <div className="safety-net-actions">
                            <button className="safety-net-login-btn" onClick={handleGoogleLogin}>
                                Sign in with Google
                             </button>
                            <button className="safety-net-dismiss-btn" onClick={dismissSafetyNet} title="Dismiss">
                                ✕
                            </button>
                        </div>
                    </div>
                )}
                {showExtensionWarning && (
                    <div className="trial-extension-warning-toast">
                        <span className="trial-warning-text">
                            Hey, your 7-day extension on Backbone wraps up in a couple days. No action needed right now, its just so there are no surprises ;)
                        </span>
                        <button className="trial-warning-dismiss-btn" onClick={dismissExtensionWarning} title="Dismiss warning">
                            ✕
                        </button>
                    </div>
                )}
                <div style={{ height: '100%', width: '100%' }}>
                    <Outlet />
                </div>
            </main>

            {/* Global Modals */}
            <MiniLaunchpadModal 
                isOpen={isLaunchpadOpen} 
                onClose={() => setIsLaunchpadOpen(false)} 
                skill={selectedSkill}
            />

            {/* Trial Expired Sidebar */}
            <TrialExpiredSidebar 
                isOpen={isTrialSidebarOpen}
                onClose={() => setIsTrialSidebarOpen(false)}
            />

        </div>
    );
};


export default MainLayout;
