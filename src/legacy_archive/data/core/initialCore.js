export const initialCoreState = {
    currency: 0,
    themeMode: 'dark', // 'dark' (default) or 'light'
    showBackgrounds: true, // Toggle background images visibility
    backgrounds: {}, // { '/path': 'url' } (Dark Mode)
    backgroundsLight: {}, // { '/path': 'url' } (Light Mode)
    userProfile: { name: "Warhead's Workspace", avatar: "W" },
    isLoaded: false, // Critical: Prevent saving until data is loaded
    manualSavePing: 0, // NEW: Trigger for manual saves
    apiKey: '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', // Warhead API Key
    warheadInstructions: '', // Custom System Prompt
    warheadMemory: [], // Long-term memory array
    activeSessionId: null, // Currently open chat
    lastRoutineSyncDate: null, // YYYY-MM-DD of last generation
};
