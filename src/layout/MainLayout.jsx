import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useOutlet } from 'react-router-dom';

import Sidebar from './Sidebar';
import MiniLaunchpadModal from '../components/modals/MiniLaunchpadModal';
import { backbone, NodeTypes } from '../backbone-v2/index';
import { useBackboneStore } from '../store/backboneStore';
import './MainLayout.css';

const MainLayout = () => {
    // --- ZUSTAND SELECTORS ---
    const safeMode = useBackboneStore(state => 
        state.nodes.some(n => n.type === NodeTypes.OBJECTIVE && n.metadata?.burnoutRisk === true)
    );

    const [bannerDismissed, setBannerDismissed] = useState(false);

    // Modal state
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false);

    const openLaunchpad = (skill) => {
        setSelectedSkill(skill);
        setIsLaunchpadOpen(true);
    };


    const location = useLocation();
    const outlet = useOutlet();
    const showBanner = safeMode && !bannerDismissed;

    return (
        <div className="main-layout">
            <div className="app-drag-region" data-tauri-drag-region />
            <Sidebar onSkillClick={openLaunchpad} />
            <main className="content-area">
                <div style={{ height: '100%', width: '100%' }}>
                    {outlet}
                </div>
            </main>

            {/* Global Modals */}
            <MiniLaunchpadModal 
                isOpen={isLaunchpadOpen} 
                onClose={() => setIsLaunchpadOpen(false)} 
                skill={selectedSkill}
            />
        </div>
    );
};


export default MainLayout;
