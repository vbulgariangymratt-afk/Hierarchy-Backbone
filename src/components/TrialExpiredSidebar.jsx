import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase, loginWithGoogle } from '../lib/supabase';
import './TrialExpiredSidebar.css';

export default function AuthGate({ user }) {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const handleGoogleSignIn = async () => {
        setIsLoggingIn(true);
        setErrorMsg(null);
        try {
            const { error } = await loginWithGoogle();
            if (error) {
                setErrorMsg('Sign in could not be completed. Please try again.');
                setIsLoggingIn(false);
            }
        } catch (err) {
            console.error('[AuthGate] Login error:', err);
            setErrorMsg('An unexpected error occurred during sign in.');
            setIsLoggingIn(false);
        }
    };

    const handleOpenWebsite = async (e) => {
        e?.preventDefault?.();
        const checkoutBaseUrl = import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL || 'https://backbonehierarchy.com';
        let url;
        try {
            url = new URL(checkoutBaseUrl);
        } catch {
            url = new URL('https://backbonehierarchy.com');
        }

        if (user?.id) {
            url.searchParams.set('checkout[custom][user_id]', user.id);
        }
        if (user?.email) {
            url.searchParams.set('checkout[email]', user.email);
        }

        const checkoutUrl = url.toString();

        try {
            if (window.__TAURI_INTERNALS__) {
                const { openUrl } = await import('@tauri-apps/plugin-opener');
                await openUrl(checkoutUrl);
            } else {
                window.open(checkoutUrl, '_blank');
            }
        } catch (err) {
            window.open(checkoutUrl, '_blank');
        }
    };

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('[AuthGate] Sign out error:', err);
        }
    };

    const handleSwitchAccount = async () => {
        try {
            await supabase.auth.signOut();
            await loginWithGoogle();
        } catch (err) {
            console.error('[AuthGate] Switch account error:', err);
        }
    };

    // State 1: User is logged in, but has no active paid subscription -> Show video + purchase gate
    if (user) {
        return (
            <div className="auth-gate-container">
                <div className="app-drag-region" data-tauri-drag-region />
                <motion.div 
                    className="auth-gate-card auth-gate-card-wide"
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                    <div className="auth-gate-header">
                        <h1 className="auth-gate-title">Backbone Hierarchy</h1>
                        <p className="auth-gate-subtitle auth-gate-user-badge">
                            Signed in as <strong className="user-email-highlight">{user.email}</strong>
                        </p>
                    </div>

                    <div className="auth-gate-body">
                        {/* Horizontal Video Placeholder (16:9) */}
                        <div className="auth-gate-video-container">
                            <div className="auth-gate-video-placeholder">
                                <div className="video-placeholder-inner">
                                    <svg className="video-play-icon" viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                    <span className="video-placeholder-label">Video Space</span>
                                </div>
                            </div>
                        </div>

                        <motion.button
                            className="auth-gate-unlock-btn cursor-target"
                            onClick={handleOpenWebsite}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span>Become a Backboner</span>
                            <span className="unlock-arrow">→</span>
                        </motion.button>

                        <div className="auth-gate-footer auth-gate-actions-row">
                            <button className="auth-gate-link-secondary cursor-target" onClick={handleSwitchAccount}>
                                Switch Google Account
                            </button>
                            <span className="auth-gate-separator">•</span>
                            <button className="auth-gate-link-secondary cursor-target" onClick={handleSignOut}>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // State 2: Not logged in -> Show initial Google sign-in screen
    return (
        <div className="auth-gate-container">
            <div className="app-drag-region" data-tauri-drag-region />
            <motion.div 
                className="auth-gate-card"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
                <div className="auth-gate-header">
                    <h1 className="auth-gate-title">Backbone Hierarchy</h1>
                    <p className="auth-gate-subtitle">
                        Prosthetic brain for adhd founders & entrepreneurs with depression
                    </p>
                </div>

                <div className="auth-gate-body">
                    {errorMsg && (
                        <div className="auth-gate-notice">
                            {errorMsg}
                        </div>
                    )}

                    <motion.button
                        className="auth-gate-google-btn cursor-target"
                        onClick={handleGoogleSignIn}
                        disabled={isLoggingIn}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
                    </motion.button>

                    <div className="auth-gate-footer">
                        <span>Tryna go around payment?</span>
                        <button className="auth-gate-link-btn cursor-target" onClick={handleOpenWebsite}>
                            Subscribe bruv
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
