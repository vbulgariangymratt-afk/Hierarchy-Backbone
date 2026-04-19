import { useEffect } from 'react';
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';

const WINDOW_STATE_KEY = 'tauri-window-state';

export const useWindowState = () => {
    useEffect(() => {
        // Check if running inside Tauri
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;

        const appWindow = getCurrentWindow();
        let saveTimeout;

        const restoreWindowState = async () => {
            try {
                const savedState = localStorage.getItem(WINDOW_STATE_KEY);
                if (savedState) {
                    const { width, height, x, y } = JSON.parse(savedState);

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
