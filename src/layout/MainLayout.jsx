import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Sidebar from './Sidebar';
import MiniLaunchpadModal from '../components/modals/MiniLaunchpadModal';
import { backbone, NodeTypes } from '../backbone-v2/index';
import { useBackboneStore } from '../store/backboneStore';
import { supabase, loginWithGoogle } from '../lib/supabase';
import './MainLayout.css';

const MainLayout = () => {
    // --- ZUSTAND SELECTORS ---
    const safeMode = useBackboneStore(state => 
        state.nodes.some(n => n.type === NodeTypes.OBJECTIVE && n.metadata?.burnoutRisk === true)
    );

    const [bannerDismissed, setBannerDismissed] = useState(false);
    
    // Auth & Safety Net Banner state
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [safetyNetDismissed, setSafetyNetDismissed] = useState(
        localStorage.getItem('safety_net_dismissed') === 'true'
    );

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

    const completedTasksCount = useBackboneStore(state =>
        state.nodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.completedAt).length
    );

    const showSafetyNetBanner = !authLoading && !user && completedTasksCount >= 3 && !safetyNetDismissed;

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

    // Modal state
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false);

    const openLaunchpad = useCallback((skill) => {
        setSelectedSkill(skill);
        setIsLaunchpadOpen(true);
    }, []);


    const location = useLocation();
    const showBanner = safeMode && !bannerDismissed;

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


        </div>
    );
};


export default MainLayout;
