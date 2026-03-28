import React, { useState, useEffect } from 'react';
import { supabase, loginWithGoogle } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import WallpaperInputPair from '../components/WallpaperInputPair';
import './SettingsPage.css';

const SettingsPage = () => {
    const [user, setUser] = useState(null);
    const {
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

    const global = wallpaperConfig.wallpapers.global;

    useEffect(() => {
        console.log('[SettingsPage] Mounted, checking initial auth state...');
        supabase.auth.getUser().then(({ data: { user } }) => {
            console.log('[SettingsPage] Initial user from getUser():', user ? user.email : 'null');
            setUser(user);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[SettingsPage] Auth state changed event:', event, 'User:', session?.user?.email ?? 'null');
            setUser(session?.user ?? null);
        });

        return () => {
            console.log('[SettingsPage] Unmounting, unsubscribing from auth changes');
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

            {/* ── Biological Tracking Section ─────────────────────────────── */}
            <section className="settings-section">
                <h2 className="settings-section-title">Biological Tracking</h2>
                <div className="settings-card">
                    <div className="appearance-row">
                        <div className="appearance-row-label">Manual Sleep Logging</div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={localStorage.getItem('pref_manual_sleep') === 'true'}
                                onChange={(e) => {
                                    localStorage.setItem('pref_manual_sleep', e.target.checked);
                                    // Force re-render if needed, but since it's a simple toggle, 
                                    // we can just use local state to track it for immediate feedback.
                                    window.dispatchEvent(new Event('storage'));
                                    setUser({ ...user }); // Dummy update to trigger re-render
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
                                    console.log('[SettingsPage] Login button clicked');
                                    try {
                                        await loginWithGoogle();
                                        console.log('[SettingsPage] loginWithGoogle execution finished');
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
