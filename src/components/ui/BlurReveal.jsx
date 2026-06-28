import React from 'react';
import { motion } from 'framer-motion';

export function BlurReveal({ children, className, speedReveal = 1.5, inView = false }) {
    const text = typeof children === 'string' ? children : '';
    const words = text.split(' ');

    // Higher speedReveal means faster animation (so less delay/duration)
    const baseStagger = 0.08;
    const baseDuration = 0.5;

    const staggerDelay = baseStagger / speedReveal;
    const duration = baseDuration / speedReveal;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: staggerDelay,
            }
        }
    };

    const wordVariants = {
        hidden: { 
            opacity: 0, 
            y: 4,
            filter: 'blur(8px)'
        },
        visible: { 
            opacity: 1, 
            y: 0,
            filter: 'blur(0px)',
            transition: {
                duration: duration,
                ease: [0.25, 0.1, 0.25, 1.0]
            }
        }
    };

    return (
        <motion.span
            key={text} // Force re-render and re-trigger on text change
            className={className}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px 6px' }}
        >
            {words.map((word, idx) => (
                <motion.span
                    key={idx}
                    variants={wordVariants}
                    style={{ display: 'inline-block' }}
                >
                    {word}
                </motion.span>
            ))}
        </motion.span>
    );
}
