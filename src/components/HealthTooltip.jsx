import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import './HealthTooltip.css';


const HealthTooltip = ({ children, engagement }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);

    const updatePosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top,
                left: rect.left + rect.width / 2
            });
        }
    };

    const show = () => {
        updatePosition();
        setIsVisible(true);
    };
    const hide = () => setIsVisible(false);

    // Update position on scroll/resize if visible
    useEffect(() => {
        if (isVisible) {
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isVisible]);

    // Format the last reinforcement time
    const getReinforcedLabel = () => {
        if (!engagement || engagement.daysSince === Infinity || engagement.daysSince === null) {
            return "No previous reinforcement recorded.";
        }
        if (engagement.daysSince === 0) return "Reinforced today";
        if (engagement.daysSince === 1) return "Reinforced yesterday";
        return `Last reinforced: ${engagement.daysSince} days ago`;
    };

    const tooltipContent = (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    className="health-tooltip-content"
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    style={{
                        position: 'fixed',
                        top: coords.top - 12, // Offset above the dot
                        left: coords.left,
                        transform: 'translate(-50%, -100%)', // Center horizontally and place above
                        zIndex: 9999,
                        pointerEvents: 'none'
                    }}
                >
                    <div className="tooltip-legend">
                        <div className="legend-item">
                            <span className="legend-dot blue"></span>
                            <span className="legend-text"><strong>Blue:</strong> Reinforced recently (within last 3 days)</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot orange"></span>
                            <span className="legend-text"><strong>Orange:</strong> Getting cold (3–7 days)</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot grey"></span>
                            <span className="legend-text"><strong>Grey:</strong> Resting (7+ days)</span>
                        </div>
                    </div>
                    <div className="tooltip-divider"></div>
                    <div className="tooltip-status">
                        {getReinforcedLabel()}
                    </div>
                    {/* Arrow down */}
                    <div className="tooltip-arrow-down" />
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <div 
                ref={triggerRef}
                className="health-tooltip-wrapper"
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                tabIndex={0}
                role="tooltip"
                aria-label="Health Status Legend"
            >
                {children}
            </div>
            {createPortal(tooltipContent, document.body)}
        </>
    );
};


export default HealthTooltip;
