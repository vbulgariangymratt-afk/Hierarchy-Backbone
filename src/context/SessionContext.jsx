import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [previousRoute, setPreviousRoute] = useState('/launchpad');
    const [energyLevel, setEnergyLevel] = useState(null);

    
    // Refs for handlers defined in page components
    const completeHandlerRef = useRef(null);
    const exitHandlerRef = useRef(null);

    const registerCompleteHandler = useCallback((handler) => {
        completeHandlerRef.current = handler;
    }, []);

    const unregisterCompleteHandler = useCallback(() => {
        completeHandlerRef.current = null;
    }, []);

    const registerExitHandler = useCallback((handler) => {
        exitHandlerRef.current = handler;
    }, []);

    const unregisterExitHandler = useCallback(() => {
        exitHandlerRef.current = null;
    }, []);

    const completeSession = useCallback(() => {
        if (completeHandlerRef.current) {
            completeHandlerRef.current();
        }
    }, []);

    const exitFocusMode = useCallback(() => {
        if (exitHandlerRef.current) {
            exitHandlerRef.current();
        }
    }, []);


    return (
        <SessionContext.Provider value={{
            activeSessionId,
            setActiveSessionId,
            isSessionActive,
            setIsSessionActive,
            completeSession,
            registerCompleteHandler,
            unregisterCompleteHandler,
            exitFocusMode,
            registerExitHandler,
            unregisterExitHandler,
            previousRoute,
            setPreviousRoute,
            energyLevel,
            setEnergyLevel
        }}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};
