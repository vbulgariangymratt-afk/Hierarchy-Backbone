import { useEffect } from 'react';

const isTauri = typeof window !== 'undefined' && (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);
const WINDOW_STATE_KEY = 'tauri-window-state';

export const useWindowState = () => {
    useEffect(() => {
        // Check if running inside Tauri
        if (!isTauri) return;

        let appWindow;
        let saveTimeout;

        const getAppWindow = async () => {
            if (!appWindow) {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                appWindow = getCurrentWindow();
            }
            return appWindow;
        };

        const restoreWindowState = async () => {
            try {
                const win = await getAppWindow();
                const savedState = localStorage.getItem(WINDOW_STATE_KEY);
                if (savedState) {
                    const { width, height, x, y } = JSON.parse(savedState);
                    const { LogicalSize, LogicalPosition } = await import('@tauri-apps/api/window');
                    if (width && height) {
                        await win.setSize(new LogicalSize(width, height));
                    }
                    if (x !== undefined && y !== undefined) {
                        await win.setPosition(new LogicalPosition(x, y));
                    }
                }
            } catch (error) {
            }
        };

        const saveWindowState = async () => {
            try {
                const win = await getAppWindow();
                const factor = await win.scaleFactor();
                const size = await win.innerSize();
                const position = await win.outerPosition();
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

        let unlistenResize;
        let unlistenMove;

        const init = async () => {
            // 1. Initial Restore
            await restoreWindowState();

            // 2. Setup Listeners (guaranteed to have a ready window now)
            const win = await getAppWindow();
            unlistenResize = await win.onResized(debouncedSave);
            unlistenMove = await win.onMoved(debouncedSave);
        };

        init();

        // 3. Cleanup
        return () => {
            clearTimeout(saveTimeout);
            if (unlistenResize) unlistenResize();
            if (unlistenMove) unlistenMove();
        };
    }, []);
};
