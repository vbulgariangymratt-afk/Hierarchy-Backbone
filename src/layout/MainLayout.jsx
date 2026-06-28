import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';

import Sidebar from './Sidebar';
import MiniLaunchpadModal from '../components/modals/MiniLaunchpadModal';
import TrialExpiredSidebar from '../components/TrialExpiredSidebar';
import UndoSnackbar from '../components/UndoSnackbar';
import { backbone, NodeTypes } from '../backbone-v2/index';
import { useBackboneStore } from '../store/backboneStore';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { Coins, Settings, Sun, Moon, Monitor, Square, Droplet, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, loginWithGoogle } from '../lib/supabase';
import './MainLayout.css';

const THEMES = [
  { id: "light", title: "Light", icon: Sun },
  { id: "system", title: "System", icon: Monitor },
  { id: "dark", title: "Dark", icon: Moon },
];

const MODES = [
  { id: "solid", title: "Solid", icon: Square },
  { id: "liquid", title: "Liquid", icon: Droplet },
  { id: "wallpaper", title: "Wallpaper", icon: Image },
];

const MainLayout = () => {
    // --- ZUSTAND SELECTORS ---
    const safeMode = useBackboneStore(state =>
        state.nodes.some(n => n.type === NodeTypes.OBJECTIVE && n.metadata?.burnoutRisk === true)
    );
    const { isTrialActive, trialDaysRemaining, hasAccess, loading: settingsLoading, energyLevel } = useSettings();
    const { theme, themePreference, setTheme, backgroundMode, setBackgroundMode } = useTheme();

    const rootNode = useBackboneStore(state => state.nodes.find(n => n.id === 'ROOT'));
    const hryvniaBalance = rootNode?.metadata?.hryvniaBalance || 0;
    const currencyName = rootNode?.metadata?.currencyName || 'EKKOS';
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
            
            <header className="app-header" data-tauri-drag-region>
                <div className="header-left" data-tauri-drag-region>
                    <span className="logo-text">Backbone Hierarchy</span>
                </div>
                
                <div className="header-right">
                    {energyLevel > 3 && (
                        <div className="hryvnia-display-header-pill">
                            <Coins size={14} className="hryvnia-icon" />
                            <span className="hryvnia-amount">{hryvniaBalance}</span>
                            <span className="hryvnia-name">{currencyName.charAt(0).toUpperCase() + currencyName.slice(1).toLowerCase()}</span>
                        </div>
                    )}
                    
                    {energyLevel > 3 && (
                        <div className="header-controls-group">
                            <div className="header-theme-toggle">
                                {THEMES.map((themeItem) => {
                                    const isActive = themePreference === themeItem.id;
                                    const ThemeIcon = themeItem.icon;
                                    return (
                                        <motion.button
                                            key={themeItem.id}
                                            className={`header-theme-option ${isActive ? "active" : ""}`}
                                            onClick={() => setTheme(themeItem.id)}
                                            layoutId={`theme-btn-wrapper-${themeItem.id}`}
                                            transition={{
                                                layout: {
                                                    type: "spring",
                                                    damping: 20,
                                                    stiffness: 230,
                                                    mass: 1.2
                                                }
                                            }}
                                            style={{ position: 'relative' }}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="theme-active-indicator"
                                                    className="header-theme-active-pill"
                                                    transition={{
                                                        type: "spring",
                                                        damping: 20,
                                                        stiffness: 230,
                                                        mass: 1.2
                                                    }}
                                                />
                                            )}
                                            <motion.div className="header-option-content" layout>
                                                <motion.div layoutId={`theme-icon-${themeItem.id}`} className="header-option-icon-wrapper">
                                                    <ThemeIcon size={14} className="header-option-icon" />
                                                </motion.div>
                                                {isActive && (
                                                    <motion.span
                                                        className="header-option-label"
                                                        initial={{ opacity: 0, filter: "blur(4px)" }}
                                                        animate={{ opacity: 1, filter: "blur(0px)" }}
                                                        transition={{
                                                            duration: 0.2,
                                                            ease: [0.86, 0, 0.07, 1]
                                                        }}
                                                    >
                                                        {themeItem.title}
                                                    </motion.span>
                                                )}
                                            </motion.div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                            
                            <div className="header-theme-toggle">
                                {MODES.map((modeItem) => {
                                    const isActive = backgroundMode === modeItem.id;
                                    const ModeIcon = modeItem.icon;
                                    return (
                                        <motion.button
                                            key={modeItem.id}
                                            className={`header-theme-option ${isActive ? "active" : ""}`}
                                            onClick={() => setBackgroundMode(modeItem.id)}
                                            layoutId={`mode-btn-wrapper-${modeItem.id}`}
                                            transition={{
                                                layout: {
                                                    type: "spring",
                                                    damping: 20,
                                                    stiffness: 230,
                                                    mass: 1.2
                                                }
                                            }}
                                            style={{ position: 'relative' }}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="bg-active-indicator"
                                                    className="header-theme-active-pill"
                                                    transition={{
                                                        type: "spring",
                                                        damping: 20,
                                                        stiffness: 230,
                                                        mass: 1.2
                                                    }}
                                                />
                                            )}
                                            <motion.div className="header-option-content" layout>
                                                <motion.div layoutId={`mode-icon-${modeItem.id}`} className="header-option-icon-wrapper">
                                                    <ModeIcon size={14} className="header-option-icon" />
                                                </motion.div>
                                                {isActive && (
                                                    <motion.span
                                                        className="header-option-label"
                                                        initial={{ opacity: 0, filter: "blur(4px)" }}
                                                        animate={{ opacity: 1, filter: "blur(0px)" }}
                                                        transition={{
                                                            duration: 0.2,
                                                            ease: [0.86, 0, 0.07, 1]
                                                        }}
                                                    >
                                                        {modeItem.title}
                                                    </motion.span>
                                                )}
                                            </motion.div>
                                        </motion.button>
                                    );
                                })}
                            </div>

                            <Link to="/settings" className="header-settings-btn-ghost" title="Settings">
                                <motion.div
                                    whileHover={{ rotate: 90 }}
                                    whileTap={{ rotate: 180 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Settings size={16} />
                                </motion.div>
                            </Link>
                        </div>
                    )}
                </div>
            </header>

            <div className="app-body">
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
            </div>

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

            {/* Global Delayed Undo Snackbar */}
            <UndoSnackbar />

        </div>
    );
};


export default MainLayout;
