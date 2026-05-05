import React, { useState, useEffect } from 'react';
import { supabase, loginWithGoogle } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { backbone, NodeTypes } from '../backbone-v2/index';
import WallpaperInputPair from '../components/WallpaperInputPair';
import './SettingsPage.css';

const SettingsPage = () => {
    const [user, setUser] = useState(null);
    const {
        themePreference,
        setTheme,
        backgroundMode,
        setBackgroundMode,
        wallpaperConfig,
        wallpaperScope,
        setWallpaperScope,
        setLightWallpaper,
        setDarkWallpaper,
        isSyncing,
        syncError,
    } = useTheme();

    const { 
        guidedSlotRoles, 
        updateGuidedSlotRoles,
        focusSlots,
        maintenanceSkillIds,
        maintenanceEnabled,
        updateMaintenanceSkillIds,
        toggleMaintenanceEnabled,
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
    } = useSettings();

    const [saveIndicator, setSaveIndicator] = useState(null);

    const handleUpdateTodayMode = (mode) => {
        console.log('[SettingsPage] Clicked Today Mode:', mode);
        updateTodayRemovalMode(mode);
        setSaveIndicator('today');
        setTimeout(() => setSaveIndicator(null), 2000);
    };

    const [allSkills, setAllSkills] = useState([]);
    const [manualSleep, setManualSleep] = useState(localStorage.getItem('pref_manual_sleep') === 'true');

    const global = wallpaperConfig.wallpapers.global;

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });

        // Load all skills for the Maintenance selector
        backbone.getNodesByType(NodeTypes.SKILL).then(setAllSkills);

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

    return (
        <div className="settings-page">
            <header className="settings-header">
                <h1 className="settings-title">Settings</h1>
                <p className="settings-subtitle">Manage your account and preferences</p>
            </header>

            {/* ── Appearance Section ──────────────────────────────────────── */}
            <section className="settings-section">
                <h2 className="settings-section-title">
                    Appearance
                    {isSyncing && <span className="sync-indicator syncing">Saving…</span>}
                    {syncError && !isSyncing && <span className="sync-indicator error">Sync failed</span>}
                </h2>
                <div className="settings-card">

                    {/* Unified Appearance Toggle */}
                    <div className="settings-section">
                        <p className="settings-section-label">Appearance</p>
                        <div className="theme-sync-toggle">
                            {[
                                { value: "light", label: "Light" },
                                { value: "system", label: "System" },
                                { value: "dark", label: "Dark" },
                            ].map(({ value, label }) => (
                                <button
                                    key={value}
                                    className={`theme-sync-option ${themePreference === value ? "active" : ""}`}
                                    onClick={() => setTheme(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="notion-divider" style={{ margin: '16px 0', opacity: 0.2 }} />

                    {/* Background Mode Control */}
                    <div className="appearance-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                        <div className="appearance-row-label">Background Mode</div>
                        <div className="segmented-control" style={{ width: '100%', maxWidth: '400px' }}>
                            <button
                                className={`segmented-control-item ${backgroundMode === 'solid' ? 'active' : ''}`}
                                onClick={() => setBackgroundMode('solid')}
                            >
                                Solid
                            </button>
                            <button
                                className={`segmented-control-item ${backgroundMode === 'liquid' ? 'active' : ''}`}
                                onClick={() => setBackgroundMode('liquid')}
                            >
                                Liquid
                            </button>
                            <button
                                className={`segmented-control-item ${backgroundMode === 'wallpaper' ? 'active' : ''}`}
                                onClick={() => setBackgroundMode('wallpaper')}
                            >
                                Wallpaper
                            </button>
                        </div>
                    </div>
                    {/* Status Dot Style Control */}
                    <div className="appearance-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                        <div className="appearance-row-label">Status Dot Style</div>
                        <div className="segmented-control" style={{ width: '100%', maxWidth: '400px' }}>
                            <button
                                className={`segmented-control-item ${healthDotStyle === 'glowing' ? 'active' : ''}`}
                                onClick={() => updateHealthDotStyle('glowing')}
                            >
                                Glowing
                            </button>
                            <button
                                className={`segmented-control-item ${healthDotStyle === 'static' ? 'active' : ''}`}
                                onClick={() => updateHealthDotStyle('static')}
                            >
                                Static
                            </button>
                        </div>
                    </div>

                    {backgroundMode === 'liquid' && (
                        <div className="appearance-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                            <div className="appearance-row-label">Liquid Mode Quality</div>
                            <p className="appearance-hint" style={{ marginTop: '-6px', marginBottom: 0 }}>
                                Performance keeps 60fps on all devices. Quality enables full live blur.
                            </p>
                            <div className="segmented-control" style={{ width: '100%', maxWidth: '400px' }}>
                                <button
                                    className={`segmented-control-item ${blurQuality === 'performance' ? 'active' : ''}`}
                                    onClick={() => updateBlurQuality('performance')}
                                >
                                    Performance
                                </button>
                                <button
                                    className={`segmented-control-item ${blurQuality === 'quality' ? 'active' : ''}`}
                                    onClick={() => updateBlurQuality('quality')}
                                >
                                    Quality
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="notion-divider" style={{ margin: '8px 0', opacity: 0.15 }} />

                    {backgroundMode === 'wallpaper' && (
                        <>
                            <div className="notion-divider" style={{ margin: '8px 0', opacity: 0.3 }} />
                            {/* Wallpaper Behavior toggle */}
                            <div className="appearance-row">
                                <div className="appearance-row-label">Wallpaper Behavior</div>
                                <div className="appearance-radio-group">
                                    <label className="appearance-radio-row">
                                        <input
                                            type="radio"
                                            name="settings-wallpaper-scope"
                                            value="global"
                                            checked={wallpaperScope === 'global'}
                                            onChange={() => setWallpaperScope('global')}
                                        />
                                        <span>One wallpaper for entire app</span>
                                    </label>
                                    <label className="appearance-radio-row">
                                        <input
                                            type="radio"
                                            name="settings-wallpaper-scope"
                                            value="per-page"
                                            checked={wallpaperScope === 'per-page'}
                                            onChange={() => setWallpaperScope('per-page')}
                                        />
                                        <span>Different wallpaper per page</span>
                                    </label>
                                </div>
                            </div>

                            {/* Global wallpaper inputs — only shown when scope is global */}
                            {wallpaperScope === 'global' && (
                                <div className="appearance-wallpaper-inputs">
                                    <WallpaperInputPair
                                        lightValue={global.light}
                                        darkValue={global.dark}
                                        onLightChange={(url) => setLightWallpaper(url, null)}
                                        onDarkChange={(url) => setDarkWallpaper(url, null)}
                                        idPrefix="settings-global"
                                    />
                                </div>
                            )}

                            {wallpaperScope === 'per-page' && (
                                <p className="appearance-hint">
                                    Per-page wallpapers are configured in the sidebar while browsing each page.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* ── Focus Set Section ───────────────────────────────────── */}
            <section className="settings-section">
                <h2 className="settings-section-title">Focus Set</h2>
                <div className="settings-card">
                    <div className="appearance-row">
                        <div>
                            <div className="appearance-row-label">Guided Slot Roles</div>
                            <p className="appearance-hint" style={{ marginTop: '4px', marginBottom: 0 }}>
                                Show role labels (Main Quest, Growth, Maintenance, Wildcard, Flex) and helper descriptions in the Focus Center.
                            </p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={guidedSlotRoles}
                                onChange={(e) => updateGuidedSlotRoles(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </section>

            {/* ── Task Behavior Section ─────────────────────────────────── */}
            <section className="settings-section">
                <h2 className="settings-section-title">Task Behavior</h2>
                <div className="settings-card">
                    <div className="appearance-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                        <div className="appearance-row-label">Today Task Auto-Removal</div>
                        <p className="appearance-hint" style={{ marginTop: '-6px', marginBottom: 0 }}>
                            Choose when a task should be removed from your "Today" list.
                        </p>
                        <div className="segmented-control" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
                            <button
                                className={`segmented-control-item ${todayRemovalMode === 'after_session' ? 'active' : ''}`}
                                onClick={() => handleUpdateTodayMode('after_session')}
                            >
                                After Session
                            </button>
                            <button
                                className={`segmented-control-item ${todayRemovalMode === 'on_completion' ? 'active' : ''}`}
                                onClick={() => handleUpdateTodayMode('on_completion')}
                            >
                                On Completion
                            </button>
                            {saveIndicator === 'today' && (
                                <span className="sync-indicator" style={{ position: 'absolute', right: '-60px', top: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                                    Saved
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Experiments Section ─────────────────────────────────── */}
            <section className="settings-section">
                <h2 className="settings-section-title">Experiments</h2>
                <div className="settings-card">
                    <div className="appearance-row">
                        <div>
                            <div className="appearance-row-label">Active Experiment Limit</div>
                            <p className="appearance-hint" style={{ marginTop: '4px', marginBottom: 0 }}>
                                Maximum number of active experiments allowed per skill.
                            </p>
                        </div>
                        <div className="limit-input-container">
                            <input 
                                type="number" 
                                min="1" 
                                max="10"
                                className={`settings-number-input ${!dbSupportsExperimentLimit ? 'disabled' : ''}`}
                                value={activeExperimentLimit || 1}
                                disabled={!dbSupportsExperimentLimit}
                                onChange={(e) => updateActiveExperimentLimit(e.target.value)}
                            />
                            {!dbSupportsExperimentLimit && (
                                <p className="appearance-hint error" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                                    Database column missing. Limits will not persist.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </section>



            {/* ── Biological Tracking Section ─────────────────────────────── */}
            <section className="settings-section">
                <h2 className="settings-section-title">Biological Tracking</h2>
                <div className="settings-card">
                    <div className="appearance-row">
                        <div className="appearance-row-label">Manual Sleep Logging</div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={manualSleep}
                                onChange={(e) => {
                                    localStorage.setItem('pref_manual_sleep', e.target.checked);
                                    setManualSleep(e.target.checked);
                                }}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                    <p className="appearance-hint">
                        Prefer manual sleep log (auto-detection becomes secondary)
                    </p>
                </div>
            </section>

            {/* ── Economy Section ─────────────────────────────────────── */}
            <section className="settings-section">
                <h2 className="settings-section-title">Economy</h2>
                <div className="settings-card">
                    <div className="appearance-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                        <div>
                            <div className="appearance-row-label">Currency Name</div>
                            <p className="appearance-hint" style={{ marginTop: '4px', marginBottom: '8px', borderTop: 'none', paddingTop: 0 }}>
                                Choose a preset or set a custom name for your hard-earned currency.
                            </p>
                        </div>
                        
                        <div className="currency-presets">
                            {['Coins', 'Ekkos', 'Sparks', 'Orbs', 'Hryvnia', 'Pulsars'].map(preset => (
                                <button
                                    key={preset}
                                    className={`currency-preset-btn ${currencyName === preset ? 'active' : ''}`}
                                    onClick={() => updateCurrencyName(preset)}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        <div className="custom-currency-container">
                            <div className="appearance-row-label" style={{ fontSize: '11px', opacity: 0.6, marginBottom: '6px' }}>Custom Name</div>
                            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                <input
                                    type="text"
                                    className="appearance-url-input"
                                    placeholder="Enter custom name..."
                                    value={!['Coins', 'Ekkos', 'Sparks', 'Orbs', 'Hryvnia', 'Pulsars'].includes(currencyName) ? currencyName : ''}
                                    onChange={(e) => updateCurrencyName(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                {!['Coins', 'Ekkos', 'Sparks', 'Orbs', 'Hryvnia', 'Pulsars'].includes(currencyName) && currencyName && (
                                    <div className="custom-active-indicator">Active</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Account Section ─────────────────────────────────────────── */}
            <section className="settings-section">
                <h2 className="settings-section-title">Account</h2>
                <div className="settings-card">
                    {user ? (
                        <>
                            <div className="account-row">
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
                                    <span className="meta-value">
                                        {user.app_metadata?.provider || 'google'}
                                    </span>
                                </div>
                                <div className="meta-row">
                                    <span className="meta-key">Last Sign-in</span>
                                    <span className="meta-value">
                                        {user.last_sign_in_at
                                            ? new Date(user.last_sign_in_at).toLocaleString()
                                            : '—'}
                                    </span>
                                </div>
                            </div>

                            <div className="account-actions">
                                <button className="logout-btn" onClick={handleLogout}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Logout
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="not-signed-in">
                            <p className="not-signed-in-text">You are not signed in.</p>
                            <button
                                className="login-btn"
                                onClick={async () => {
                                    try {
                                        await loginWithGoogle();
                                    } catch (err) {
                                        console.error('[SettingsPage] Login button error:', err);
                                    }
                                }}
                            >
                                Sign in with Google
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default SettingsPage;
