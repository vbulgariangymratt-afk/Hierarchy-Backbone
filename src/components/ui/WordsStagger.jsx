import React from 'react';
import { motion } from 'framer-motion';

export function WordsStagger({ children, className, speed = 0.5, inView = false }) {
    const text = typeof children === 'string' ? children : '';
    const words = text.split(' ');

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: speed * 0.15, // scale stagger duration based on speed prop
            }
        }
    };

    const wordVariants = {
        hidden: { 
            opacity: 0, 
            y: 8,
            filter: 'blur(4px)'
        },
        visible: { 
            opacity: 1, 
            y: 0,
            filter: 'blur(0px)',
            transition: {
                duration: 0.35,
                ease: [0.2, 0.65, 0.3, 1] // sleek spring-like ease
            }
        }
    };

    return (
        <motion.span
            key={text} // Force re-mount / re-animation when text changes
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
