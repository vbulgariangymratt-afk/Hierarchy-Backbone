import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PremiumLoadingScreen from '../components/loading/PremiumLoadingScreen';

const AuthCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async () => {
            // Get the code from the URL
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');

            if (code) {
                try {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                    
                    // Success! Redirect to home
                    navigate('/', { replace: true });
                } catch (err) {
                    console.error('Error exchanging code for session:', err.message);
                    // On error, redirect to home or a login page if you have one
                    navigate('/', { replace: true });
                }
            } else {
                // No code found, just go home
                navigate('/', { replace: true });
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <PremiumLoadingScreen 
            secondaryText="Finalizing authentication..." 
        />
    );
};

export default AuthCallback;
