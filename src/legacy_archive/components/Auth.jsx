
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, UserPlus, AlertTriangle, Loader, CheckCircle } from 'lucide-react';

const Auth = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('login'); // 'login' or 'signup'
    const [message, setMessage] = useState(null);
    const [session, setSession] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session && onLoginSuccess) onLoginSuccess(session);
        });

        return () => subscription.unsubscribe();
    }, [onLoginSuccess]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (mode === 'signup') {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                if (data.user && !data.session) {
                    setMessage("Check your email for the confirmation link!");
                } else {
                    setMessage("Account created! You are now logged in.");
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // Session listener handles the rest
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        await supabase.auth.signOut();
        setLoading(false);
    };

    if (session) {
        return (
            <div className="liquid-glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(52, 211, 153, 0.3)', backgroundColor: 'rgba(52, 211, 153, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontWeight: 'bold' }}>
                            {session.user.email[0].toUpperCase()}
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 'bold', color: '#ecfdf5' }}>Logged In</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#a7f3d0' }}>{session.user.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid #ef4444',
                            borderRadius: '8px',
                            color: '#fca5a5',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        {loading ? '...' : 'Sign Out'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="liquid-glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h2 style={{ fontSize: 'var(--font-size-xl)', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {mode === 'login' ? <LogIn size={24} color="#60a5fa" /> : <UserPlus size={24} color="#34d399" />}
                {mode === 'login' ? 'Cloud Sync Login' : 'Create Cloud Account'}
            </h2>

            {error && (
                <div style={{
                    marginBottom: '16px', padding: '12px', borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {message && (
                <div style={{
                    marginBottom: '16px', padding: '12px', borderRadius: '8px',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)',
                    color: '#6ee7b7', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <CheckCircle size={16} /> {message}
                </div>
            )}

            <form onSubmit={handleAuth} style={{ display: 'grid', gap: '16px' }}>
                <div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Mail size={18} color="#94a3b8" />
                        <input
                            type="email"
                            placeholder="Email address"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                        />
                    </div>
                </div>
                <div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Lock size={18} color="#94a3b8" />
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: mode === 'login' ? '#3b82f6' : '#10b981',
                        color: 'white',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                    }}
                >
                    {loading && <Loader size={18} className="spin" />}
                    {mode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
            </form>

            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px', color: '#94a3b8' }}>
                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                    onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}
                >
                    {mode === 'login' ? 'Sign Up' : 'Log In'}
                </button>
            </div>
        </div>
    );
};

export default Auth;
