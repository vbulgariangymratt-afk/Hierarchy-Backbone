import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './RewardAnimation.css';

const RewardAnimation = forwardRef((props, ref) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((type, amount = 1) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, type, amount }]);
        
        // Remove toast after animation duration
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 1500);
    }, []);

    useImperativeHandle(ref, () => ({
        showReward: (rewards) => {
            // rewards can be [{ type: 'aura', amount: 1 }, { type: 'hryvnia', amount: 1 }]
            rewards.forEach((r, index) => {
                setTimeout(() => {
                    addToast(r.type, r.amount);
                }, index * 200); // Stagger simultaneous rewards
            });
        }
    }));

    return (
        <div className="reward-toasts-container">
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        className={`reward-toast-item ${toast.type}`}
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: -40, scale: 1 }}
                        exit={{ opacity: 0, y: -80, scale: 0.8 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                    >
                        <span className="reward-icon">
                            {toast.type === 'aura' ? '✨' : '🪙'}
                        </span>
                        <span className="reward-amount">+{toast.amount} {toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
});

export default RewardAnimation;
