import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';

import Sidebar from './Sidebar';
import MiniLaunchpadModal from '../components/modals/MiniLaunchpadModal';
import TrialExpiredSidebar from '../components/TrialExpiredSidebar';
import UndoSnackbar from '../components/UndoSnackbar';
import { backbone, NodeTypes } from '../backbone-v2/index';
import { useBackboneStore } from '../store/backboneStore';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { Coins, Settings, Sun, Moon, Monitor, Square, Droplet, Image, BookOpen, Brain, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, loginWithGoogle } from '../lib/supabase';
import SegmentedControl from '../components/ui/SegmentedControl';
import SettingsPage from '../pages/SettingsPage';
import JournalPage from '../pages/JournalPage';
import Counter from '../components/ui/Counter';
import CustomThemeSwitch from '../components/ui/CustomThemeSwitch';
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

    const [displayedBalance, setDisplayedBalance] = useState(hryvniaBalance);
    useEffect(() => {
        setDisplayedBalance(hryvniaBalance);
    }, [hryvniaBalance]);

    // Fullscreen state for macOS traffic light alignment
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let active = true;
        let tauriUnlisten = null;

        const updateFullscreen = async () => {
            let isFS = false;
            if (window.__TAURI__) {
                try {
                    const { getCurrentWindow } = await import('@tauri-apps/api/window');
                    const appWindow = getCurrentWindow();
                    isFS = await appWindow.isFullscreen();
                } catch (err) {
                    console.error('[MainLayout] Tauri fullscreen query error:', err);
                }
            } else {
                isFS = !!document.fullscreenElement;
            }

            if (active) {
                setIsFullscreen(isFS);
            }
        };

        // Initial check
        updateFullscreen();

        // Listen for standard resize events (fired reliably on macOS fullscreen transitions)
        const handleResize = () => {
            updateFullscreen();
        };
        window.addEventListener('resize', handleResize);
        document.addEventListener('fullscreenchange', handleResize);

        // Tauri window event insurance
        if (window.__TAURI__) {
            import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
                const appWindow = getCurrentWindow();
                appWindow.onResized(() => {
                    updateFullscreen();
                }).then(unlisten => {
                    tauriUnlisten = unlisten;
                });
            });
        }

        return () => {
            active = false;
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('fullscreenchange', handleResize);
            if (tauriUnlisten) {
                tauriUnlisten();
            }
        };
    }, []);

    const triggerCoinJiggle = () => {
        setDisplayedBalance(prev => prev + 5);
        setTimeout(() => {
            setDisplayedBalance(hryvniaBalance);
        }, 400);
    };
    
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

    // Daily Log popover state
    const [showDailyLog, setShowDailyLog] = useState(false);
    const dailyLogContainerRef = React.useRef(null);

    // Custom theme switch state (double-click trigger)
    const [showCustomSwitch, setShowCustomSwitch] = useState(false);
    const [lastThemeClick, setLastThemeClick] = useState({ theme: null, time: 0 });

    const handleThemeChange = (newTheme) => {
        const now = Date.now();
        if (newTheme === themePreference && lastThemeClick.theme === newTheme && now - lastThemeClick.time < 350) {
            setShowCustomSwitch(true);
        } else {
            setLastThemeClick({ theme: newTheme, time: now });
        }
        setTheme(newTheme);
    };

    const handleCustomSwitchToggle = (e) => {
        const targetTheme = e.target.checked ? 'dark' : 'light';
        setTheme(targetTheme);
    };

    const handleCustomSwitchDoubleClick = () => {
        setShowCustomSwitch(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dailyLogContainerRef.current && 
                !dailyLogContainerRef.current.contains(event.target) &&
                !event.target.closest('.header-daily-log-btn-ghost')
            ) {
                setShowDailyLog(false);
            }
        };

        if (showDailyLog) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDailyLog]);

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
    const [showGlobalSearch, setShowGlobalSearch] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const allNodes = useBackboneStore(state => state.nodes);

    const openLaunchpad = useCallback((skill) => {
        setSelectedSkill(skill);
        setIsLaunchpadOpen(true);
    }, []);


    const [hasUpdate, setHasUpdate] = useState(false);

    useEffect(() => {
        const checkForUpdates = async () => {
            const isTauri = typeof window !== 'undefined' && (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);
            if (isTauri) {
                try {
                    const { check } = await import('@tauri-apps/plugin-updater');
                    const update = await check();
                    if (update) {
                        setHasUpdate(true);
                    }
                } catch (e) {
                    console.error('Quiet update check failed:', e);
                }
            }
        };
        checkForUpdates();
    }, []);

    const location = useLocation();
    const navigate = useNavigate();
    const isSettingsOpen = location.pathname === '/settings';

    const closeSettings = useCallback(() => {
        // navigate(-1) silently fails when there's no back history.
        // Go to launchpad as a reliable fallback instead.
        navigate('/launchpad');
    }, [navigate]);

    return (
        <div className="main-layout">
            <div className="app-drag-region" data-tauri-drag-region />
            
            <header className={`app-header ${isFullscreen ? 'is-fullscreen' : ''}`} data-tauri-drag-region>
                <div className="header-left" data-tauri-drag-region style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="logo-text">Backbone Hierarchy</span>
                    {hasUpdate && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/settings', { state: { tab: 'updates' } })}
                            className="update-pill cursor-target"
                            style={{
                                marginLeft: '12px',
                                background: 'rgba(var(--color-accent-rgb), 0.1)',
                                border: '1px solid rgba(var(--color-accent-rgb), 0.2)',
                                color: 'var(--color-text-primary)',
                                height: '28px',
                                padding: '0 12px',
                                borderRadius: '9999px',
                                fontSize: '0.8rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxSizing: 'border-box'
                            }}
                        >
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent)', boxShadow: '0 0 8px var(--color-accent)' }} />
                            Update Ready
                        </motion.button>
                    )}
                </div>
                
                <div className="header-right">
                    {energyLevel >= 3 && (
                        <div className="header-info-group">
                            {/* Search icon */}
                            <button
                                onClick={() => setShowGlobalSearch(true)}
                                className="header-daily-log-btn-ghost cursor-target"
                                title="Search for a task"
                            >
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Search size={16} />
                                </motion.div>
                            </button>

                            {/* Future Self button */}
                            {(energyLevel === 5 || energyLevel === 4) && (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => navigate('/launchpad?prep=true')}
                                    className="hryvnia-display-header-pill cursor-target"
                                    style={{
                                        cursor: 'pointer',
                                        color: 'var(--text-primary)',
                                        fontWeight: 500
                                    }}
                                    title="Prepare everything for your future self"
                                >
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.15, 1],
                                        }}
                                        transition={{
                                            duration: 2.5,
                                            repeat: Infinity,
                                            repeatType: "reverse",
                                            ease: "easeInOut"
                                        }}
                                        style={{ display: 'inline-flex', alignItems: 'center' }}
                                    >
                                        <Brain size={13} style={{ color: 'var(--color-accent)' }} />
                                    </motion.div>
                                    <span>Future Self</span>
                                </motion.button>
                            )}

                            {/* Ekkos balance pill */}
                            {energyLevel > 3 && (
                                <div 
                                    className="hryvnia-display-header-pill interactive-balance-pill cursor-target"
                                    onClick={triggerCoinJiggle}
                                    style={{ cursor: 'pointer' }}
                                    title="Interactive Balance"
                                >
                                    <Coins size={14} className="hryvnia-icon" />
                                    <span className="hryvnia-amount">
                                        <Counter value={displayedBalance} fontSize={14} fontWeight={600} />
                                    </span>
                                    <span className="hryvnia-name">{currencyName.charAt(0).toUpperCase() + currencyName.slice(1).toLowerCase()}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="header-controls-group">
                        {/* Daily Log Button */}
                        <div className="header-daily-log-container">
                            <button
                                className={`header-daily-log-btn-ghost ${showDailyLog ? 'active' : ''}`}
                                onClick={() => setShowDailyLog(!showDailyLog)}
                                title="Daily Log"
                            >
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <BookOpen size={16} />
                                </motion.div>
                            </button>
                            
                            <AnimatePresence>
                                {showDailyLog && (
                                    <>
                                        <motion.div
                                            className="daily-log-backdrop"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            onClick={() => setShowDailyLog(false)}
                                        />
                                        <motion.div
                                            ref={dailyLogContainerRef}
                                            className="daily-log-popover liquid-glass"
                                            style={{ transformOrigin: 'top right' }}
                                            initial={{ opacity: 0, rotate: -3, scale: 0.95 }}
                                            animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                            exit={{ opacity: 0, rotate: -3, scale: 0.95, transition: { duration: 0.15, ease: 'easeIn' } }}
                                            transition={{ type: 'spring', stiffness: 700, damping: 20 }}
                                        >
                                            <div className="daily-log-popover-header">
                                                <h3>Daily Log</h3>
                                                <button className="close-popover-btn" onClick={() => setShowDailyLog(false)}>✕</button>
                                            </div>
                                            <div className="daily-log-popover-content scrollbar-hidden">
                                                <JournalPage />
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                        
                        {/* Appearance / Settings controls */}
                        {energyLevel > 3 && (
                            <>
                                {showCustomSwitch ? (
                                    <div 
                                        onDoubleClick={handleCustomSwitchDoubleClick}
                                        title="Double click to switch back to normal theme controls"
                                        style={{ display: 'flex', alignItems: 'center', height: '28px' }}
                                    >
                                        <CustomThemeSwitch
                                            checked={themePreference === 'dark'}
                                            onChange={handleCustomSwitchToggle}
                                        />
                                    </div>
                                ) : (
                                    <SegmentedControl
                                        options={THEMES}
                                        value={themePreference}
                                        onChange={handleThemeChange}
                                        layoutPrefix="theme"
                                        buttonSize={28}
                                        fontSize="0.8rem"
                                        activePadding="0 12px"
                                    />
                                )}
                                
                                <SegmentedControl
                                    options={MODES}
                                    value={backgroundMode}
                                    onChange={setBackgroundMode}
                                    layoutPrefix="bg"
                                    buttonSize={28}
                                    fontSize="0.8rem"
                                    activePadding="0 12px"
                                />

                                <button onClick={() => navigate('/settings')} className="header-settings-btn-ghost" title="Settings">
                                    <motion.div
                                        whileHover={{ rotate: 90 }}
                                        whileTap={{ rotate: 180 }}
                                        animate={{ rotate: isSettingsOpen ? 90 : 0 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Settings size={16} />
                                    </motion.div>
                                </button>
                            </>
                        )}
                    </div>
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

            {/* Settings Modal Overlay — portal always mounted, AnimatePresence inside */}
            {createPortal(
                <AnimatePresence>
                    {isSettingsOpen && (
                        <motion.div
                            key="settings-scrim"
                            className="settings-modal-scrim"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={(e) => { if (e.target === e.currentTarget) closeSettings(); }}
                        >
                            <motion.div
                                key="settings-modal"
                                className="settings-modal-panel"
                                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                            >
                                <button className="settings-modal-close" onClick={closeSettings} aria-label="Close settings">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                    </svg>
                                </button>
                                <SettingsPage />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Global Search Overlay Portal */}
            {createPortal(
                <AnimatePresence>
                    {showGlobalSearch && (
                        <motion.div
                            key="global-search-scrim"
                            className="settings-modal-scrim"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => {
                                setShowGlobalSearch(false);
                                setGlobalSearchQuery('');
                            }}
                            style={{
                                backdropFilter: 'blur(12px)',
                                zIndex: 99999
                            }}
                        >
                            <motion.div
                                key="global-search-modal"
                                className="settings-modal-panel"
                                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    maxWidth: '500px',
                                    padding: '40px',
                                    fontFamily: "'Lexend', sans-serif"
                                }}
                            >
                                <button 
                                    className="settings-modal-close" 
                                    onClick={() => {
                                        setShowGlobalSearch(false);
                                        setGlobalSearchQuery('');
                                    }} 
                                    aria-label="Close search"
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                    </svg>
                                </button>

                                <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <Search size={24} color="var(--text-primary)" />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Type to search tasks..."
                                        value={globalSearchQuery}
                                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                        style={{ 
                                            background: 'transparent', 
                                            border: 'none', 
                                            color: 'var(--text-primary)', 
                                            fontSize: '20px', 
                                            outline: 'none', 
                                            width: '100%',
                                            fontFamily: "'Lexend', sans-serif"
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '50vh', overflowY: 'auto' }}>
                                    {globalSearchQuery.trim() !== '' && allNodes.filter(n => 
                                        n.type === NodeTypes.TASK && 
                                        n.metadata?.status !== 'DONE' && 
                                        n.name.toLowerCase().includes(globalSearchQuery.toLowerCase())
                                    ).slice(0, 10).map(task => (
                                        <button
                                            key={task.id}
                                            className="e5-task-row visual-receipt-active cursor-target"
                                            style={{ 
                                                width: '100%', 
                                                textAlign: 'left',
                                                padding: '12px 16px',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '8px',
                                                background: 'var(--color-bg-card)',
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer',
                                                fontFamily: "'Lexend', sans-serif"
                                            }}
                                            onClick={() => {
                                                navigate('/focus', { state: { taskId: task.id, autoStart: true } });
                                                setShowGlobalSearch(false);
                                                setGlobalSearchQuery('');
                                            }}
                                        >
                                            {task.name}
                                        </button>
                                    ))}
                                    {globalSearchQuery.trim() !== '' && allNodes.filter(n => 
                                        n.type === NodeTypes.TASK && 
                                        n.metadata?.status !== 'DONE' && 
                                        n.name.toLowerCase().includes(globalSearchQuery.toLowerCase())
                                    ).length === 0 && (
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                                            No matching active tasks found.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

        </div>
    );
};


export default MainLayout;
