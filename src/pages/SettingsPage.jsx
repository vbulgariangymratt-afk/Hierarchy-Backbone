import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, loginWithGoogle } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { useBackboneStore } from '../store/backboneStore';
import SegmentedControl from '../components/ui/SegmentedControl';
import { 
    Sun, 
    Moon, 
    Monitor, 
    Square, 
    Droplet, 
    Image, 
    Activity, 
    Circle, 
    Zap, 
    Clock, 
    CheckCircle2, 
    Coins, 
    Sparkles, 
    DollarSign,
    Download,
    RefreshCw,
    Cpu
} from 'lucide-react';
import './SettingsPage.css';

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

const HEALTH_DOT_OPTIONS = [
  { id: "glowing", title: "Glowing", icon: Activity },
  { id: "static", title: "Static", icon: Circle },
];

const BLUR_QUALITY_OPTIONS = [
  { id: "performance", title: "Performance", icon: Zap },
  { id: "quality", title: "Live Desktop", icon: Monitor },
];

const TODAY_REMOVAL_OPTIONS = [
  { id: "after_session", title: "After Session", icon: Clock },
  { id: "on_completion", title: "On Completion", icon: CheckCircle2 },
];

const CURRENCY_PRESETS = [
  { id: "Coins", title: "Coins", icon: Coins },
  { id: "Ekkos", title: "Ekkos", icon: Sparkles },
  { id: "Sparks", title: "Sparks", icon: Zap },
  { id: "Orbs", title: "Orbs", icon: Circle },
  { id: "Hryvnia", title: "Hryvnia", icon: DollarSign },
  { id: "Pulsars", title: "Pulsars", icon: Activity },
];

const ToggleSwitch = ({ checked, onChange }) => (
    <button
        type="button"
        className={`toggle-switch-btn ${checked ? 'active' : ''}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
    >
        <span className="toggle-switch-knob" />
    </button>
);

const SettingsPage = () => {
    const [user, setUser] = useState(null);
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(() => location.state?.tab || 'appearance');

    const { 
        themePreference,
        setTheme,
        backgroundMode,
        setBackgroundMode,
        isSyncing,
        syncError,
        lightWallpaperImage,
        darkWallpaperImage,
        updateLightWallpaperImage,
        updateDarkWallpaperImage,
        lightChangesRemaining,
        darkChangesRemaining,
    } = useTheme();

    const { 
        guidedSlotRoles, 
        updateGuidedSlotRoles,
        activeExperimentLimit,
        updateActiveExperimentLimit,
        dbSupportsExperimentLimit,
        healthDotStyle,
        updateHealthDotStyle,
        blurQuality,
        updateBlurQuality,
        currencyName = 'Coins',
        updateCurrencyName,
        todayRemovalMode,
        updateTodayRemovalMode,
        isWhitelisted,
        applyWhitelist,
        hasAccess,
        redirectToCheckout,
    } = useSettings();

    const [saveIndicator, setSaveIndicator] = useState(null);

    const [updaterState, setUpdaterState] = useState({
        checking: false,
        updateFound: false,
        updateInstalled: false,
        downloadProgress: 0,
        error: null,
        message: '',
        versionInfo: null
    });

    const [appVersion, setAppVersion] = useState('0.1.0');

    useEffect(() => {
        const loadVersion = async () => {
            const isTauri = typeof window !== 'undefined' && (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);
            if (isTauri) {
                try {
                    const { getVersion } = await import('@tauri-apps/api/app');
                    const version = await getVersion();
                    setAppVersion(version);
                } catch (e) {
                    console.error('Failed to read app version:', e);
                }
            }
        };
        loadVersion();
    }, []);

    useEffect(() => {
        if (activeTab === 'updates' && !updaterState.versionInfo && !updaterState.updateInstalled && !updaterState.checking) {
            checkUpdate();
        }
    }, [activeTab]);

    const checkUpdate = async () => {
        setUpdaterState(prev => ({
            ...prev,
            checking: true,
            error: null,
            message: 'Checking for updates...'
        }));

        try {
            const update = await useBackboneStore.getState().checkForAppUpdates();
            if (update) {
                setUpdaterState(prev => ({
                    ...prev,
                    checking: false,
                    updateFound: true,
                    versionInfo: update,
                    message: `Version ${update.version} is available!`
                }));
            } else {
                setUpdaterState(prev => ({
                    ...prev,
                    checking: false,
                    updateFound: false,
                    message: 'You are on the latest version.'
                }));
            }
        } catch (err) {
            console.error('Update check failed:', err);
            setUpdaterState(prev => ({
                ...prev,
                checking: false,
                error: err.message || String(err),
                message: err.message || 'Could not connect to update server.'
            }));
        }
    };

    const downloadAndInstallUpdate = async () => {
        let versionInfo = updaterState.versionInfo || useBackboneStore.getState().availableUpdate;
        
        if (!versionInfo) {
            setUpdaterState(prev => ({ ...prev, checking: true, message: 'Checking for update package...' }));
            versionInfo = await useBackboneStore.getState().checkForAppUpdates();
        }

        if (!versionInfo) {
            setUpdaterState(prev => ({ 
                ...prev, 
                checking: false, 
                error: 'Could not find update package.', 
                message: 'No update available to download.' 
            }));
            return;
        }

        setUpdaterState(prev => ({
            ...prev,
            checking: false,
            downloadProgress: 5,
            error: null,
            message: 'Starting download...'
        }));

        try {
            let downloaded = 0;
            let contentLength = 0;

            await versionInfo.downloadAndInstall((event) => {
                switch (event.event) {
                    case 'Started':
                        contentLength = event.data.contentLength || 0;
                        setUpdaterState(prev => ({
                            ...prev,
                            downloadProgress: 10,
                            message: 'Download started...'
                        }));
                        break;
                    case 'Progress':
                        downloaded += event.data.chunkLength;
                        const pct = contentLength ? Math.round((downloaded / contentLength) * 100) : 50;
                        setUpdaterState(prev => ({
                            ...prev,
                            downloadProgress: Math.max(10, pct),
                            message: `Downloading: ${pct}%`
                        }));
                        break;
                    case 'Finished':
                        setUpdaterState(prev => ({
                            ...prev,
                            downloadProgress: 100,
                            message: 'Download finished. Applying update...'
                        }));
                        break;
                }
            });

            useBackboneStore.getState().setAvailableUpdate(null);
            setUpdaterState(prev => ({
                ...prev,
                downloadProgress: 0,
                updateInstalled: true,
                updateFound: false,
                message: 'Update installed successfully! Relaunching Backbone...'
            }));

            try {
                const { relaunch } = await import('@tauri-apps/plugin-process');
                await relaunch();
            } catch (relaunchErr) {
                console.warn('Auto-relaunch failed, user can restart manually:', relaunchErr);
            }
        } catch (err) {
            console.error('Update installation failed:', err);
            setUpdaterState(prev => ({
                ...prev,
                downloadProgress: 0,
                error: err.message || String(err),
                message: err.message || 'Update failed. Let\'s try that again.'
            }));
        }
    };

    const handleUpdateTodayMode = (mode) => {
        updateTodayRemovalMode(mode);
        setSaveIndicator('today');
        setTimeout(() => setSaveIndicator(null), 2000);
    };

    const [manualSleep, setManualSleep] = useState(localStorage.getItem('pref_manual_sleep') === 'true');
    const [completionSoundsEnabled, setCompletionSoundsEnabled] = useState(localStorage.getItem('completion_sounds_enabled') !== 'false');
    const [experimentSoundsEnabled, setExperimentSoundsEnabled] = useState(localStorage.getItem('experiment_sounds_enabled') !== 'false');

    const handleCurrencyNameChange = async (val) => {
        const secret = 'Vg5d9Xk3';
        if (val.trim() === secret) {
            const result = await applyWhitelist(val.trim());
            alert(result.message);
            updateCurrencyName('Coins');
        } else {
            updateCurrencyName(val);
        }
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);
            if (event === 'SIGNED_IN') {
                setTimeout(() => window.scrollTo(0, 0), 100);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleLogout = () => {
        supabase.auth.signOut();
    };

    const tabDescriptions = {
        appearance: "Tailor visual atmosphere, themes, and background modes for ocular comfort.",
        behavior: "Configure Obsession slot roles, task removal triggers, and experiment limits.",
        signals: "Manage sleep tracking modes, completion sounds, and objective chimes.",
        economy: "Customize currency names and economy rewards presets.",
        account: "Manage your account identity and local vault sync.",
        guide: "Watch my personal workflow video and learn how to structure your cognitive architecture.",
        updates: "Check for software updates and view device & system diagnostics."
    };

    return (
        <div className="settings-page-wrapper">
            <div className="settings-container">
                {/* ── Left Sidebar Navigation ──────────────────────────────── */}
                <aside className="settings-sidebar">
                    <div className="settings-sidebar-header">
                        <div className="settings-user-avatar">
                            {user ? (user.email?.[0]?.toUpperCase() || 'U') : 'G'}
                        </div>
                        <div className="settings-user-info">
                            <span className="settings-user-name">
                                {user ? (user.email?.split('@')[0] || 'User') : 'Guest'}
                            </span>
                        </div>
                    </div>

                    <div className="settings-nav-group">
                        <div className="settings-nav-label">Cognitive & UI</div>
                        <button
                            className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                            onClick={() => setActiveTab('appearance')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            <span>Appearance & Theme</span>
                        </button>

                        <button
                            className={`settings-nav-item ${activeTab === 'behavior' ? 'active' : ''}`}
                            onClick={() => setActiveTab('behavior')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                            <span>Behavior & Obsessions</span>
                        </button>

                        <button
                            className={`settings-nav-item ${activeTab === 'signals' ? 'active' : ''}`}
                            onClick={() => setActiveTab('signals')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                            <span>Signals & Tracking</span>
                        </button>
                    </div>

                    <div className="settings-nav-group">
                        <div className="settings-nav-label">System & Vault</div>
                        <button
                            className={`settings-nav-item ${activeTab === 'economy' ? 'active' : ''}`}
                            onClick={() => setActiveTab('economy')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="18"/></svg>
                            <span>Economy & Currency</span>
                        </button>

                        <button
                            className={`settings-nav-item ${activeTab === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>Account & Billing</span>
                        </button>

                        <button
                            className={`settings-nav-item ${activeTab === 'guide' ? 'active' : ''}`}
                            onClick={() => setActiveTab('guide')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <span>Workflow Video Guide</span>
                        </button>

                        <button
                            className={`settings-nav-item ${activeTab === 'updates' ? 'active' : ''}`}
                            onClick={() => setActiveTab('updates')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Updates & System</span>
                        </button>
                    </div>

                    <div className="settings-sidebar-footer">
                        <span className="settings-footer-text">Backbone Hierarchy</span>
                    </div>
                </aside>

                {/* ── Main Settings Pane ─────────────────────────────────────── */}
                <main className="settings-main-pane">
                    <header className="settings-pane-header">
                        <div>
                            <h1 className="settings-pane-title">
                                {activeTab === 'appearance' && 'Appearance & Theme'}
                                {activeTab === 'behavior' && 'Behavior & Obsessions'}
                                {activeTab === 'signals' && 'Signals & Tracking'}
                                {activeTab === 'economy' && 'Economy & Currency'}
                                {activeTab === 'account' && 'Account & Billing'}
                            </h1>
                            <p className="settings-pane-subtitle">{tabDescriptions[activeTab]}</p>
                        </div>
                        {isSyncing && <span className="sync-indicator syncing">Saving…</span>}
                        {syncError && !isSyncing && <span className="sync-indicator error">Sync failed</span>}
                    </header>

                    <div className="settings-pane-body">

                        {/* ── TAB 1: APPEARANCE ────────────────────────────────────── */}
                        {activeTab === 'appearance' && (
                            <div className="settings-tab-content">
                                <div className="settings-group">

                                    
                                    <div className="settings-row">
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Theme Mode</span>
                                            <span className="settings-row-desc">Synchronize with system preferences or lock to light/dark.</span>
                                        </div>
                                        <div className="settings-row-control">
                                            <SegmentedControl
                                                options={THEMES}
                                                value={themePreference}
                                                onChange={setTheme}
                                                layoutPrefix="settings-theme"
                                                buttonSize={28}
                                                fontSize="0.8rem"
                                                activePadding="0 12px"
                                            />
                                        </div>
                                    </div>

                                    {/* Background Mode + Direct Inline Wallpaper Uploader */}
                                    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                            <div className="settings-row-label">
                                                <span className="settings-row-title">Background Atmosphere</span>
                                                <span className="settings-row-desc">Select solid slate, liquid glass blur, or custom wallpaper backdrop.</span>
                                            </div>
                                            <div className="settings-row-control">
                                                <SegmentedControl
                                                    options={MODES}
                                                    value={backgroundMode}
                                                    onChange={setBackgroundMode}
                                                    layoutPrefix="settings-bg"
                                                    buttonSize={28}
                                                    fontSize="0.8rem"
                                                    activePadding="0 12px"
                                                />
                                            </div>
                                        </div>

                                        {/* Direct Wallpaper Upload Box Below Wallpaper Mode */}
                                        {backgroundMode === 'wallpaper' && (
                                            <div className="inline-wallpaper-container">
                                                <span className="inline-wallpaper-hint">
                                                    Upload background images for Light and Dark modes.
                                                </span>
                                                <div className="inline-wallpaper-grid">
                                                    {/* Light Mode Wallpaper */}
                                                    <div className="wallpaper-upload-box">
                                                        <span className="wallpaper-label">
                                                            Light Wallpaper ({lightChangesRemaining} left)
                                                        </span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                id="wallpaper-upload-light"
                                                                disabled={lightChangesRemaining === 0}
                                                                style={{ display: 'none' }}
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) updateLightWallpaperImage(file);
                                                                }}
                                                            />
                                                            <label 
                                                                htmlFor={lightChangesRemaining > 0 ? "wallpaper-upload-light" : undefined}
                                                                className="wallpaper-btn-choose"
                                                                style={{ 
                                                                    opacity: lightChangesRemaining === 0 ? 0.4 : 1,
                                                                    cursor: lightChangesRemaining === 0 ? 'not-allowed' : 'pointer'
                                                                }}
                                                            >
                                                                {lightChangesRemaining === 0 ? 'Locked' : 'Choose Image'}
                                                            </label>
                                                            {lightWallpaperImage && (
                                                                <button
                                                                    className="wallpaper-btn-remove"
                                                                    onClick={() => updateLightWallpaperImage(null)}
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Dark Mode Wallpaper */}
                                                    <div className="wallpaper-upload-box">
                                                        <span className="wallpaper-label">
                                                            Dark Wallpaper ({darkChangesRemaining} left)
                                                        </span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                id="wallpaper-upload-dark"
                                                                disabled={darkChangesRemaining === 0}
                                                                style={{ display: 'none' }}
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) updateDarkWallpaperImage(file);
                                                                }}
                                                            />
                                                            <label 
                                                                htmlFor={darkChangesRemaining > 0 ? "wallpaper-upload-dark" : undefined}
                                                                className="wallpaper-btn-choose"
                                                                style={{ 
                                                                    opacity: darkChangesRemaining === 0 ? 0.4 : 1,
                                                                    cursor: darkChangesRemaining === 0 ? 'not-allowed' : 'pointer'
                                                                }}
                                                            >
                                                                {darkChangesRemaining === 0 ? 'Locked' : 'Choose Image'}
                                                            </label>
                                                            {darkWallpaperImage && (
                                                                <button
                                                                    className="wallpaper-btn-remove"
                                                                    onClick={() => updateDarkWallpaperImage(null)}
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Liquid Mode Quality option inline */}
                                        {backgroundMode === 'liquid' && (
                                            <div className="inline-wallpaper-container">
                                                <span className="inline-wallpaper-hint">
                                                    Performance keeps 60fps. Live Desktop Wallpaper enables full desktop blur.
                                                </span>
                                                <div style={{ marginTop: '8px' }}>
                                                    <SegmentedControl
                                                        options={BLUR_QUALITY_OPTIONS}
                                                        value={blurQuality}
                                                        onChange={updateBlurQuality}
                                                        layoutPrefix="settings-blur"
                                                        buttonSize={28}
                                                        fontSize="0.8rem"
                                                        activePadding="0 12px"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Status Dot Animation</span>
                                            <span className="settings-row-desc">Choose glowing pulse or static indicator for habit health.</span>
                                        </div>
                                        <div className="settings-row-control">
                                            <SegmentedControl
                                                options={HEALTH_DOT_OPTIONS}
                                                value={healthDotStyle}
                                                onChange={updateHealthDotStyle}
                                                layoutPrefix="settings-healthdot"
                                                buttonSize={28}
                                                fontSize="0.8rem"
                                                activePadding="0 12px"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 2: BEHAVIOR & OBSESSIONS ─────────────────────────── */}
                        {activeTab === 'behavior' && (
                            <div className="settings-tab-content">
                                <div className="settings-group">
                                    <div className="settings-group-header">Obsession Workflow</div>
                                    <div className="settings-row">
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Guided Slot Roles</span>
                                            <span className="settings-row-desc">Display role badges (Main Quest, Growth, Maintenance) in Obsession Center.</span>
                                        </div>
                                        <div className="settings-row-control">
                                            <ToggleSwitch
                                                checked={guidedSlotRoles}
                                                onChange={(val) => updateGuidedSlotRoles(val)}
                                            />
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Today Task Auto-Removal</span>
                                            <span className="settings-row-desc">Specify when tasks clear from your daily view.</span>
                                        </div>
                                        <div className="settings-row-control">
                                            <SegmentedControl
                                                options={TODAY_REMOVAL_OPTIONS}
                                                value={todayRemovalMode}
                                                onChange={handleUpdateTodayMode}
                                                layoutPrefix="settings-today-removal"
                                                buttonSize={28}
                                                fontSize="0.8rem"
                                                activePadding="0 12px"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-group">
                                    <div className="settings-group-header">Experiments Limit</div>
                                    <div className="settings-row">
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Active Experiment Limit</span>
                                            <span className="settings-row-desc">Maximum concurrent active experiments allowed per skill area.</span>
                                        </div>
                                        <div className="settings-row-control">
                                            <div className={`stepper-control ${!dbSupportsExperimentLimit ? 'disabled' : ''}`}>
                                                <button
                                                    className="stepper-btn"
                                                    onClick={() => updateActiveExperimentLimit(Math.max(1, (activeExperimentLimit || 1) - 1))}
                                                    disabled={!dbSupportsExperimentLimit || (activeExperimentLimit || 1) <= 1}
                                                    aria-label="Decrease"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                                </button>
                                                <span className="stepper-value">{activeExperimentLimit || 1}</span>
                                                <button
                                                    className="stepper-btn"
                                                    onClick={() => updateActiveExperimentLimit(Math.min(10, (activeExperimentLimit || 1) + 1))}
                                                    disabled={!dbSupportsExperimentLimit || (activeExperimentLimit || 1) >= 10}
                                                    aria-label="Increase"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 3: SIGNALS & TRACKING ───────────────────────────── */}
                        {activeTab === 'signals' && (
                            <div className="settings-tab-content">
                                <div className="settings-group">
                                    <div className="settings-group-header">Biological Tracking</div>
                                    <div className="settings-row">
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Manual Sleep Logging</span>
                                            <span className="settings-row-desc">Prioritize manual sleep entry over automated detection.</span>
                                        </div>
                                        <div className="settings-row-control">
                                            <ToggleSwitch
                                                checked={manualSleep}
                                                onChange={(val) => {
                                                    localStorage.setItem('pref_manual_sleep', val);
                                                    setManualSleep(val);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-group">
                                    <div className="settings-group-header">Audio Feedback</div>
                                    <div className="settings-row">
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Completion Sound Effects</span>
                                            <span className="settings-row-desc">Play audio feedback when checking off habits or focus tasks.</span>
                                        </div>
                                        <div className="settings-row-control">
                                            <ToggleSwitch
                                                checked={completionSoundsEnabled}
                                                onChange={(val) => {
                                                    localStorage.setItem('completion_sounds_enabled', val);
                                                    setCompletionSoundsEnabled(val);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Experiment & Objective Chimes</span>
                                            <span className="settings-row-desc">Play acoustic chime on experiment completion.</span>
                                        </div>
                                        <div className="settings-row-control">
                                            <ToggleSwitch
                                                checked={experimentSoundsEnabled}
                                                onChange={(val) => {
                                                    localStorage.setItem('experiment_sounds_enabled', val);
                                                    setExperimentSoundsEnabled(val);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 4: ECONOMY & CURRENCY ────────────────────────────── */}
                        {activeTab === 'economy' && (
                            <div className="settings-tab-content">
                                <div className="settings-group">

                                    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                                        <div className="settings-row-label">
                                            <span className="settings-row-title">Currency Name Presets</span>
                                            <span className="settings-row-desc">Choose a currency title for completing habit loops and focus sessions.</span>
                                        </div>
                                        <div>
                                            <SegmentedControl
                                                options={CURRENCY_PRESETS}
                                                value={currencyName}
                                                onChange={updateCurrencyName}
                                                layoutPrefix="settings-currency"
                                                buttonSize={28}
                                                fontSize="0.8rem"
                                                activePadding="0 12px"
                                            />
                                        </div>

                                        <div style={{ width: '100%', marginTop: '8px' }}>
                                            <span className="settings-row-title" style={{ fontSize: '13px' }}>Custom Currency Name</span>
                                            <div style={{ marginTop: '6px' }}>
                                                <input
                                                    type="text"
                                                    className="appearance-url-input"
                                                    placeholder="Enter custom currency name..."
                                                    value={!['Coins', 'Ekkos', 'Sparks', 'Orbs', 'Hryvnia', 'Pulsars'].includes(currencyName) ? currencyName : ''}
                                                    onChange={(e) => handleCurrencyNameChange(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TAB 5: ACCOUNT & BILLING ────────────────────────────── */}
                        {activeTab === 'account' && (
                            <div className="settings-tab-content">
                                <div className="settings-group">

                                    {user ? (
                                        <>
                                            <div className="account-row" style={{ padding: '12px 0' }}>
                                                <div className="account-avatar">
                                                    {user.email?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="account-info">
                                                    <span className="account-label">Signed in as</span>
                                                    <span className="account-email">{user.email}</span>
                                                </div>
                                            </div>

                                            <div className="account-meta">
                                                <div className="meta-row">
                                                    <span className="meta-key">User ID</span>
                                                    <span className="meta-value meta-mono">{user.id}</span>
                                                </div>
                                                <div className="meta-row">
                                                    <span className="meta-key">Provider</span>
                                                    <span className="meta-value">{user.app_metadata?.provider || 'google'}</span>
                                                </div>
                                                <div className="meta-row">
                                                    <span className="meta-key">Subscription</span>
                                                    <span className="meta-value" style={{ fontWeight: '500', color: hasAccess ? '#10b981' : '#F59E0B' }}>
                                                        {hasAccess ? 'Active' : 'Paused (Read-Only Mode)'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                                                {!hasAccess && (
                                                    <button 
                                                        className="wallpaper-btn-choose"
                                                        onClick={redirectToCheckout}
                                                    >
                                                        Renew Subscription
                                                    </button>
                                                )}
                                                <button className="wallpaper-btn-remove" onClick={handleLogout}>
                                                    Sign Out
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="not-signed-in">
                                            <p className="not-signed-in-text">
                                                Sign in to sync your data across devices seamlessly.
                                            </p>
                                            <button
                                                className="wallpaper-btn-choose"
                                                onClick={async () => {
                                                    try {
                                                        await loginWithGoogle();
                                                    } catch (err) {
                                                        console.error('Login error:', err);
                                                    }
                                                }}
                                            >
                                                Sign in with Google
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── TAB 6: UPDATES & SYSTEM ──────────────────────────────── */}
                        {activeTab === 'updates' && (
                            <div className="settings-tab-content">
                                <div className="settings-group">
                                    <div className="settings-group-header">Software Updates</div>
                                    <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'row', gap: '16px' }}>
                                        {updaterState.updateFound ? (
                                            <div className="settings-row-label" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                <span className="settings-row-title" style={{ color: 'var(--color-text-primary)' }}>
                                                    New version: {updaterState.versionInfo?.version}
                                                </span>
                                                <span className="settings-row-desc" style={{ marginTop: '6px', maxWidth: '520px', lineHeight: '1.5', display: 'block', textAlign: 'left' }}>
                                                    <strong>Changes:</strong> {updaterState.versionInfo?.notes}
                                                </span>

                                                <button
                                                    className="wallpaper-btn-choose"
                                                    onClick={downloadAndInstallUpdate}
                                                    disabled={updaterState.downloadProgress > 0 && !updaterState.updateInstalled && !updaterState.error}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        marginTop: '16px',
                                                        background: 'var(--color-accent)',
                                                        border: 'none',
                                                        color: '#ffffff',
                                                        padding: '8px 16px',
                                                        borderRadius: '6px',
                                                        fontWeight: '600',
                                                        fontSize: '13px',
                                                        boxShadow: '0 2px 8px rgba(var(--color-accent-rgb), 0.25)',
                                                        transition: 'transform 0.15s ease, background-color 0.15s ease',
                                                        transform: 'scale(1)',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                                                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    <Download size={14} style={{ stroke: '#ffffff' }} />
                                                    <span>{updaterState.downloadProgress > 0 ? 'Installing...' : 'Install Update'}</span>
                                                </button>

                                                {updaterState.message && (
                                                    <div style={{ 
                                                        marginTop: '10px', 
                                                        fontSize: '12px', 
                                                        color: updaterState.error ? '#ef4444' : 'var(--color-text-secondary, #9da1b0)',
                                                        fontWeight: '500'
                                                    }}>
                                                        {updaterState.message}
                                                    </div>
                                                )}

                                                {updaterState.downloadProgress > 0 && !updaterState.updateInstalled && !updaterState.error && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', width: '100%', maxWidth: '320px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                            <span>Downloading...</span>
                                                            <span>{updaterState.downloadProgress}%</span>
                                                        </div>
                                                        <div className="update-progress-container" style={{ background: 'rgba(255, 255, 255, 0.08)', borderRadius: '8px', height: '5px', overflow: 'hidden', width: '100%' }}>
                                                            <div
                                                                className="update-progress-bar"
                                                                style={{
                                                                    background: 'var(--color-accent)',
                                                                    height: '100%',
                                                                    width: `${updaterState.downloadProgress}%`,
                                                                    transition: 'width 0.3s ease-out'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : updaterState.updateInstalled ? (
                                            <div className="settings-row-label" style={{ width: '100%' }}>
                                                <span className="settings-row-title" style={{ color: '#10b981' }}>
                                                    Upgrade Complete (v{updaterState.versionInfo?.version || '0.2.0'})
                                                </span>
                                                <span className="settings-row-desc" style={{ marginTop: '6px', maxWidth: '520px', lineHeight: '1.5', display: 'block', textAlign: 'left' }}>
                                                    The files have been written. Please restart Backbone Hierarchy to run the new version.
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="settings-row-label" style={{ width: '100%' }}>
                                                    <span className="settings-row-title">
                                                        Current Version: v{appVersion}
                                                    </span>
                                                    <span className="settings-row-desc" style={{ marginTop: '6px', display: 'block', textAlign: 'left' }}>
                                                        {updaterState.message || "Your system is up to date."}
                                                    </span>
                                                </div>

                                                <div className="settings-row-control">
                                                    <button
                                                        className="wallpaper-btn-choose"
                                                        disabled={updaterState.checking}
                                                        onClick={checkUpdate}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            transform: 'scale(1)'
                                                        }}
                                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        {updaterState.checking ? (
                                                            <>
                                                                <RefreshCw size={14} className="animate-spin" />
                                                                <span>Checking...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw size={14} />
                                                                <span>Check Now</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="settings-group">
                                    <div className="settings-group-header">System Diagnostics</div>
                                    <div className="settings-row" style={{ display: 'block' }}>
                                        <div className="diagnostics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '8px' }}>
                                            <div className="diagnostic-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Cpu size={24} style={{ color: '#60a5fa' }} />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform</span>
                                                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                        {typeof window !== 'undefined' && window.__TAURI__ ? 'Desktop App' : 'Web Browser'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="diagnostic-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Activity size={24} style={{ color: '#34d399' }} />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Database Status</span>
                                                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#34d399' }}>Connected</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'guide' && (
                            <div className="settings-tab-content">
                                <div className="settings-group">
                                    <div className="settings-group-header">Personal Workflow Walkthrough</div>
                                    <div className="settings-row" style={{ display: 'block', padding: '20px 24px' }}>
                                        <div style={{
                                            width: '100%',
                                            aspectRatio: '16 / 9',
                                            background: 'rgba(0, 0, 0, 0.4)',
                                            border: '1px dashed rgba(255, 255, 255, 0.16)',
                                            borderRadius: '14px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '12px',
                                            color: 'var(--color-text-secondary, #9da1b0)',
                                            cursor: 'pointer'
                                        }}>
                                            <div style={{
                                                width: '52px',
                                                height: '52px',
                                                borderRadius: '50%',
                                                background: 'rgba(var(--color-accent-rgb, 99, 102, 241), 0.15)',
                                                border: '1px solid rgba(var(--color-accent-rgb, 99, 102, 241), 0.3)',
                                                color: 'var(--color-accent, #6366f1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                                    <path d="M8 5v14l11-7z"/>
                                                </svg>
                                            </div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Personal Workflow Walkthrough Video</span>
                                        </div>

                                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-start' }}>
                                            <button 
                                                className="wallpaper-btn-choose"
                                                onClick={() => {
                                                    useBackboneStore.getState().setHasDismissedOnboarding(false);
                                                    alert('Onboarding Hub reset! Open the Launchpad tab to view the 2 options.');
                                                }}
                                            >
                                                Reset First-Time Onboarding Screen
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
};

export default SettingsPage;
