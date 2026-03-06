import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Get initial theme from localStorage or system preference
    const getInitialTheme = () => {
        const savedTheme = localStorage.getItem('app-theme');
        if (savedTheme) return savedTheme;

        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        // Apply theme to document root
        const root = window.document.documentElement;
        console.log(`[ThemeEngine] Applying theme: ${theme}`);

        root.classList.remove('light', 'dark');
        root.classList.add(theme);

        // Verify application
        console.log(`[ThemeEngine] root classes:`, root.className);

        // Persist theme
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'light' ? 'dark' : 'light';
            console.log(`[ThemeEngine] Toggling theme: ${prev} -> ${next}`);
            return next;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
