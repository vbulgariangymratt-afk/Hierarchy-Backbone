import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { backbone, NodeTypes } from '../backbone-v2/index';
import './MainLayout.css';

const MainLayout = () => {
    const [safeMode, setSafeMode] = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(false);

    useEffect(() => {
        const check = async () => {
            try {
                const nodes = await backbone.getAllNodes();
                const hasRisk = nodes.some(
                    n => n.type === NodeTypes.OBJECTIVE && n.metadata?.burnoutRisk === true
                );
                setSafeMode(hasRisk);
            } catch (_) { }
        };
        check();
        const interval = setInterval(check, 60_000);
        return () => clearInterval(interval);
    }, []);

    const showBanner = safeMode && !bannerDismissed;

    return (
        <div className="main-layout">
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
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
