import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

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
    const showBanner = safeMode && !bannerDismissed;

    return (
        <div className="main-layout">
            <div className="app-drag-region" data-tauri-drag-region />
            <Sidebar onSkillClick={openLaunchpad} />
            <main className="content-area">
                <div style={{ height: '100%', width: '100%' }}>
                    <Outlet />
                </div>
            </main>

            {/* Global Modals */}
            <MiniLaunchpadModal 
                isOpen={isLaunchpadOpen} 
                onClose={() => setIsLaunchpadOpen(false)} 
                skill={selectedSkill}
            />

            {/* Temporary Test Button for Aura Animation */}
            <button 
                onClick={() => {
                    const skill = useBackboneStore.getState().nodes.find(n => n.type === NodeTypes.SKILL);
                    if (skill) {
                        window.dispatchEvent(new CustomEvent('skill-level-up', { 
                            detail: { skillId: skill.id } 
                        }));
                    }
                }}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 9999,
                    background: 'rgba(153, 186, 215, 0.2)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(153, 186, 215, 0.4)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                title="Test Aura Glow"
            >
                ✨
            </button>
        </div>
    );
};


export default MainLayout;
