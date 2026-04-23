import { useEffect } from 'react';

const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

const WINDOW_STATE_KEY = 'tauri-window-state';

export const useWindowState = () => {
    useEffect(() => {
        // Check if running inside Tauri
        if (!isTauri) return;

        let appWindow;
        let saveTimeout;

        const restoreWindowState = async () => {
            try {
                if (!appWindow) {
                    const { getCurrentWindow } = await import('@tauri-apps/api/window');
                    appWindow = getCurrentWindow();
                }
                const savedState = localStorage.getItem(WINDOW_STATE_KEY);
                if (savedState) {
                    const { width, height, x, y } = JSON.parse(savedState);
                    const { LogicalSize, LogicalPosition } = await import('@tauri-apps/api/window');

                    if (width && height) {
                        await appWindow.setSize(new LogicalSize(width, height));
                    }
                    if (x !== undefined && y !== undefined) {
                        await appWindow.setPosition(new LogicalPosition(x, y));
                    }
                }
            } catch (error) {
            }
        };

        const saveWindowState = async () => {
            try {
                if (!appWindow) {
                    const { getCurrentWindow } = await import('@tauri-apps/api/window');
                    appWindow = getCurrentWindow();
                }
                const factor = await appWindow.scaleFactor();
                const size = await appWindow.innerSize();
                const position = await appWindow.outerPosition();

                const logicalSize = size.toLogical(factor);
                const logicalPosition = position.toLogical(factor);

                const state = {
                    width: logicalSize.width,
                    height: logicalSize.height,
                    x: logicalPosition.x,
                    y: logicalPosition.y
                };

                localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state));
            } catch (error) {
                console.error('WindowState: Failed to save:', error);
            }
        };

        const debouncedSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveWindowState, 500);
        };

        // 1. Initial Restore
        restoreWindowState();

        // 2. Setup Listeners
        let unlistenResize;
        let unlistenMove;

        const setupListeners = async () => {
            unlistenResize = await appWindow.onResized(debouncedSave);
            unlistenMove = await appWindow.onMoved(debouncedSave);
        };

        setupListeners();

        // 3. Cleanup
        return () => {
            clearTimeout(saveTimeout);
            if (unlistenResize) unlistenResize();
            if (unlistenMove) unlistenMove();
        };
    }, []);
};
