import React, { useState, useEffect } from 'react';

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}|:<>?-=[]\\;',./";

export function RandomizedText({ children, className, delay = 0 }) {
    const text = typeof children === 'string' ? children : '';
    const [displayText, setDisplayText] = useState(text);

    useEffect(() => {
        if (!text) return;
        
        let iteration = 0;
        let interval = null;

        const startScramble = () => {
            clearInterval(interval);
            interval = setInterval(() => {
                setDisplayText(
                    text
                        .split('')
                        .map((char, index) => {
                            if (char === ' ') return ' ';
                            if (index < iteration) {
                                return text[index];
                            }
                            return CHARS[Math.floor(Math.random() * CHARS.length)];
                        })
                        .join('')
                );

                if (iteration >= text.length) {
                    clearInterval(interval);
                }
                
                // Speed calculation: resolves about 1-2 characters per frame
                iteration += 1.5; 
            }, 30);
        };

        if (delay > 0) {
            const timeout = setTimeout(startScramble, delay * 1000);
            return () => {
                clearTimeout(timeout);
                clearInterval(interval);
            };
        } else {
            startScramble();
            return () => clearInterval(interval);
        }
    }, [text, delay]);

    return (
        <span className={className}>
            {displayText}
        </span>
    );
}
