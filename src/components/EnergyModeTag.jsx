import React from 'react';
import { useSession } from '../context/SessionContext';
import { motion, AnimatePresence } from 'framer-motion';

const EnergyModeTag = () => {
    const { energyLevel } = useSession();

    if (energyLevel === null) return null;

    let label = "";
    let background = "rgba(255, 255, 255, 0.1)";

    if (energyLevel <= 2) {
        label = "Low Energy Mode";
        background = "rgba(100, 181, 246, 0.2)"; // Soft cool blue
    } else if (energyLevel === 3) {
        label = "Balanced Mode";
        background = "rgba(255, 255, 255, 0.1)"; // Neutral glass
    } else {
        label = "High Energy Mode";
        background = "rgba(129, 199, 132, 0.2)"; // Soft vitality green
    }

    return (
        <AnimatePresence>
            <motion.div
                key="energy-tag"
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                className="energy-mode-tag"
                style={{
                    position: 'fixed',
                    top: '16px',
                    right: '16px',
                    zIndex: 9999,
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    color: 'var(--color-bg-main)',
                    background: 'var(--color-accent)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--alpha-high)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    pointerEvents: 'none', 
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
            >
                {label}
            </motion.div>
        </AnimatePresence>
    );
};

export default EnergyModeTag;
