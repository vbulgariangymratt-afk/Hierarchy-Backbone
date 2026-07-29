import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FlyingOrbsOverlay = () => {
    const [orbs, setOrbs] = useState([]);

    useEffect(() => {
        const handleTrigger = (e) => {
            const { startX, startY } = e.detail;

            // Defer coordinate calculation slightly to let React render the Focus button
            setTimeout(() => {
                let destX, destY;
                const destEl = document.querySelector('.focus-toggle-btn');
                console.log('DEST ELEMENT FOUND:', destEl, 'RECT:', destEl?.getBoundingClientRect());
                if (destEl) {
                    const rect = destEl.getBoundingClientRect();
                    destX = rect.left + rect.width / 2;
                    destY = rect.top + rect.height / 2;
                } else {
                    // Fallback to top-middle of the sidebar
                    const sidebar = document.querySelector('.sidebar');
                    const sidebarRect = sidebar
                        ? sidebar.getBoundingClientRect()
                        : { left: 0, top: 0, width: 240 };
                    destX = sidebarRect.left + sidebarRect.width / 2;
                    destY = sidebarRect.top + 120;
                }

                const orbId = Math.random().toString(36).substring(2, 9);
                setOrbs(prev => [...prev, { id: orbId, startX, startY, destX, destY }]);
            }, 60);
        };

        window.addEventListener('trigger-focus-orb', handleTrigger);
        return () => {
            window.removeEventListener('trigger-focus-orb', handleTrigger);
        };
    }, []);

    return (
        <div 
            className="flying-orbs-overlay" 
            style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                width: '100vw', 
                height: '100vh', 
                pointerEvents: 'none', 
                zIndex: 99999,
                overflow: 'hidden'
            }}
        >
            <AnimatePresence>
                {orbs.map(orb => (
                    <motion.div
                        key={orb.id}
                        initial={{
                            x: orb.startX,
                            y: orb.startY,
                            scale: 1.2,
                            opacity: 0.9
                        }}
                        animate={{
                            x: [orb.startX, orb.startX + 140, orb.destX, orb.destX],
                            y: [orb.startY, orb.startY - 90, orb.destY, orb.destY],
                            scale: [1.2, 1.5, 0.8, 0.3],
                            opacity: [0.9, 1.0, 1.0, 0.0]
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: 2.5,
                            ease: ["easeOut", "easeIn"],
                            times: [0, 0.45, 0.85, 1]
                        }}
                        onAnimationComplete={() => {
                            setOrbs(prev => prev.filter(o => o.id !== orb.id));
                            window.dispatchEvent(new CustomEvent('focus-orb-landed'));
                        }}
                        style={{
                            position: 'absolute',
                            left: -15, // center the 30px orb
                            top: -15,
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, var(--color-accent, #5E6AD2) 0%, rgba(94, 106, 210, 0.4) 40%, rgba(94, 106, 210, 0) 70%)',
                            filter: 'blur(3px)',
                            boxShadow: '0 0 15px var(--color-accent-alpha-low, rgba(94, 106, 210, 0.5))'
                        }}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default memo(FlyingOrbsOverlay);
