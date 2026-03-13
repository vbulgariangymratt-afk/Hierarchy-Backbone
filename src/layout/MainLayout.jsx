import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useOutlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { backbone, NodeTypes } from '../backbone-v2/index';
import './MainLayout.css';

const MainLayout = () => {
    const [safeMode, setSafeMode] = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(false);

    useEffect(() => {
        console.log('[MainLayout] Checking objectives for burnout risk...');
        const check = async () => {
            try {
                const nodes = await backbone.getAllNodes();
                console.log('[MainLayout] Found', nodes.length, 'nodes total');
                const hasRisk = nodes.some(
                    n => n.type === NodeTypes.OBJECTIVE && n.metadata?.burnoutRisk === true
                );
                if (hasRisk) console.log('[MainLayout] Burnout risk detected, enabling Energy Protection Mode');
                setSafeMode(hasRisk);
            } catch (err) {
                console.error('[MainLayout] Error checking for risk:', err);
            }
        };
        check();
        const interval = setInterval(check, 60_000);
        return () => clearInterval(interval);
    }, []);

    const location = useLocation();
    const outlet = useOutlet();
    const showBanner = safeMode && !bannerDismissed;

    return (
        <div className="main-layout">
            <div className="app-drag-region" data-tauri-drag-region />
            <Sidebar />
            <main className="content-area">
                {showBanner && (
                    <div className="safe-mode-banner">
                        <span className="safe-mode-banner-text">Energy Protection Mode Active</span>
                        <button
                            className="safe-mode-dismiss-btn"
                            onClick={() => setBannerDismissed(true)}
                            aria-label="Dismiss"
                        >
                            ×
                        </button>
                    </div>
                )}
                
                <AnimatePresence mode="wait">
                    {outlet && (
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0.01, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            style={{ 
                                height: '100%', 
                                width: '100%',
                                willChange: 'opacity, transform'
                            }}
                        >
                            {outlet}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default MainLayout;
