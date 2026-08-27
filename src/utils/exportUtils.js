/**
 * Data Export Utility for Backbone Hierarchy
 * Bundles all local nodes, tasks, journal entries, and settings into a JSON backup file.
 */

export const exportUserDataAsJson = () => {
    try {
        // Collect guest nodes from localStorage or memory
        const guestNodesRaw = localStorage.getItem('guest_nodes');
        const guestNodes = guestNodesRaw ? JSON.parse(guestNodesRaw) : [];

        // Collect guest journal entries
        const guestJournalRaw = localStorage.getItem('guest_journal');
        const guestJournal = guestJournalRaw ? JSON.parse(guestJournalRaw) : {};

        // Collect key settings
        const settings = {
            energyLevel: localStorage.getItem('app-energy-level') || '3',
            currencyName: localStorage.getItem('app-currency-name') || 'Coins',
            todayRemovalMode: localStorage.getItem('app-today-removal-mode') || 'on_completion',
            guestTrialStartAt: localStorage.getItem('guest_trial_start_at') || null,
        };

        const exportPayload = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            app: 'Backbone Hierarchy',
            data: {
                nodes: guestNodes,
                journal: guestJournal,
                settings: settings,
            }
        };

        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(exportPayload, null, 2)
        )}`;

        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', jsonString);
        const fileName = `backbone_brain_backup_${new Date().toISOString().slice(0, 10)}.json`;
        downloadAnchor.setAttribute('download', fileName);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        return { success: true, fileName };
    } catch (err) {
        console.error('[ExportUtils] Failed to export data:', err);
        return { success: false, error: err.message };
    }
};
