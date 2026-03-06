import React, { useRef, useState } from 'react';

import { Download, Upload, Shield, Save, CheckCircle, AlertTriangle, Info, X, Cloud, RotateCw, Clock, History, Sparkles } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabase';

const Settings = () => {
    const { state, dispatch } = useStore();
    const fileInputRef = useRef(null);
    const [status, setStatus] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }
    const [pendingData, setPendingData] = useState(null); // For storing data before confirmation
    const [backups, setBackups] = useState(null);
    const [isLoadingBackups, setIsLoadingBackups] = useState(false);

    const loadBackups = async () => {
        setIsLoadingBackups(true);
        setStatus({ type: 'info', message: 'Fetching backup history...' });
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not logged in");

            const { data, error } = await supabase
                .from('user_backups')
                .select('id, created_at, backup_type, content')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setBackups(data || []);
            setStatus(null);
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: 'Failed to load history: ' + err.message });
        } finally {
            setIsLoadingBackups(false);
        }
    };

    const restoreBackup = (backup) => {
        if (window.confirm(`Restore backup from ${new Date(backup.created_at).toLocaleString()}? Current data will be replaced.`)) {
            // Safety: Create a pre-restore backup of current state
            const safetyValidation = Object.keys(state.tasks || {}).length;
            if (safetyValidation > 0) {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "pre_restore_safety_backup.json");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            }

            dispatch({ type: 'LOAD_STATE', payload: backup.content });
            setStatus({ type: 'success', message: 'Restored snapshot from ' + new Date(backup.created_at).toLocaleTimeString() });
            setBackups(null); // Close the list
        }
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "latte_app_backup_" + new Date().toISOString().split('T')[0] + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        setStatus({ type: 'success', message: 'Data exported successfully!' });
    };

    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Reset
        setStatus({ type: 'info', message: 'Reading file...' });
        setPendingData(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);

                // Validation
                if (!json.areas || !json.skills) {
                    setStatus({ type: 'error', message: 'Invalid file: Missing areas or skills data.' });
                    return;
                }

                // Instead of window.confirm, we set pending data and ask UI to show confirm buttons
                setPendingData(json);
                setStatus(null); // Clear status to show confirmation UI instead

            } catch (error) {
                console.error("Error parsing backup:", error);
                setStatus({ type: 'error', message: 'Failed to read file. It might be corrupted or not a valid JSON.' });
            }
            // Reset input so same file can be selected again
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const confirmImport = () => {
        if (pendingData) {
            dispatch({ type: 'LOAD_STATE', payload: pendingData });
            setPendingData(null);
            setStatus({ type: 'success', message: 'Data loaded successfully! Content updated.' });
        }
    };

    const cancelImport = () => {
        setPendingData(null);
        setStatus({ type: 'info', message: 'Import cancelled.' });
    };

    return (
        <div className="settings-page" style={{ paddingBottom: '100px' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--spacing-xl)' }}>Settings</h1>

            <div style={{ display: 'grid', gap: '24px', maxWidth: '800px' }}>

                {/* Status Message Box */}
                {status && (
                    <div style={{
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                            status.type === 'success' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(96, 165, 250, 0.1)',
                        border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                            status.type === 'success' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(96, 165, 250, 0.3)'
                            }`,
                        color: status.type === 'error' ? '#fca5a5' :
                            status.type === 'success' ? '#6ee7b7' : '#93c5fd',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        {status.type === 'error' && <AlertTriangle size={20} />}
                        {status.type === 'success' && <CheckCircle size={20} />}
                        {status.type === 'info' && <Info size={20} />}
                        <span>{status.message}</span>
                    </div>
                )}

                {/* Cloud Sync Section */}
                <div style={{ marginBottom: '0px' }}>
                    <Auth />
                </div>

                {/* Warhead Intelligence Section */}
                <div className="liquid-glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(212, 163, 115, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #d4a373, #b08968)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 10px rgba(212, 163, 115, 0.4)'
                        }}>
                            <Sparkles size={18} color="white" />
                        </div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0, color: '#e7d7c1' }}>Warhead Intelligence</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                        Connect OpenRouter AI (DeepSeek V3.1 Terminus) to enable deep behavioral analysis. Your key is stored locally.
                    </p>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="password"
                            value={state.apiKey || ''}
                            onChange={(e) => dispatch({ type: 'SET_API_KEY', payload: e.target.value })}
                            placeholder="Paste your OpenRouter API Key (sk-or-v1-...)"
                            style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '14px',
                                fontFamily: 'monospace'
                            }}
                        />
                        {state.apiKey && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                color: '#4ade80', fontSize: '12px',
                                padding: '0 12px', background: 'rgba(74, 222, 128, 0.1)',
                                borderRadius: '8px', border: '1px solid rgba(74, 222, 128, 0.2)'
                            }}>
                                <CheckCircle size={14} /> Active
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '16px' }}>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '8px', fontSize: '13px' }}>
                            Custom System Instructions (Optional). Tell Warhead how to behave or what to focus on.
                        </p>
                        <textarea
                            value={state.warheadInstructions || ''}
                            onChange={(e) => dispatch({ type: 'SET_WARHEAD_INSTRUCTIONS', payload: e.target.value })}
                            placeholder="e.g., 'You are a ruthless drill sergeant. Focus on my sleep patterns and call me out when I'm lazy.'"
                            style={{
                                width: '100%',
                                height: '80px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                </div>

                {/* Import Confirmation UI */}
                {pendingData && (
                    <div className="liquid-glass" style={{
                        padding: '24px',
                        borderRadius: '16px',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#fbbf24' }}>
                            <AlertTriangle size={24} />
                            <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>Confirm Overwrite</h2>
                        </div>
                        <p style={{ color: 'var(--color-text-main)', marginBottom: '24px' }}>
                            You are about to import a backup. This will <strong>DELETE</strong> all current data on this device and replace it with the backup file.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={confirmImport}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#ef4444',
                                    color: 'white',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <CheckCircle size={18} /> Yes, Overwrite Everything
                            </button>
                            <button
                                onClick={cancelImport}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(255,255,255,0.1)',
                                    color: 'white',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Data Persistence Section */}
                <div className="liquid-glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Save size={24} color="#60a5fa" />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>Data & Backup</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                        Your data is currently saved in your browser. To transfer it to another device or keep a permanent safe copy, use the buttons below.
                    </p>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleExport}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '12px 20px',
                                backgroundColor: 'rgba(96, 165, 250, 0.2)',
                                border: '1px solid #60a5fa',
                                borderRadius: '8px',
                                color: '#93c5fd',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600'
                            }}
                        >
                            <Download size={18} /> Export Data to File
                        </button>

                        <button
                            onClick={() => fileInputRef.current.click()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '12px 20px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                color: 'var(--color-text-main)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600'
                            }}
                        >
                            <Upload size={18} /> Import Data from File
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImport}
                            style={{ display: 'none' }}
                            accept=".json"
                        />
                    </div>
                </div>

                {/* Time Machine / Backup History */}
                <div className="liquid-glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(147, 197, 253, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <History size={24} color="#93c5fd" />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>Time Machine</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                        View and restore automatic daily snapshots of your history (split at 4 AM).
                    </p>

                    {!backups && (
                        <button
                            onClick={loadBackups}
                            disabled={isLoadingBackups}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: 'rgba(147, 197, 253, 0.1)',
                                border: '1px solid #93c5fd',
                                borderRadius: '8px',
                                color: '#93c5fd',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            {isLoadingBackups ? <RotateCw className="spin" size={18} /> : <Clock size={18} />}
                            {isLoadingBackups ? 'Scanning Timeline...' : 'View Backup History'}
                        </button>
                    )}

                    {backups && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                            {backups.length === 0 && <div style={{ opacity: 0.7 }}>No backups found yet. (Start a new session to trigger one)</div>}
                            {backups.map(backup => {
                                const taskCount = backup.content?.tasks ? Object.keys(backup.content.tasks).length : 0;
                                return (
                                    <div key={backup.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px',
                                        backgroundColor: 'rgba(0,0,0,0.2)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#e5e7eb' }}>
                                                {new Date(backup.created_at).toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                                Tasks: {taskCount} • Type: {backup.backup_type || 'Auto'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => restoreBackup(backup)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                                                border: '1px solid #34d399',
                                                borderRadius: '6px',
                                                color: '#34d399',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                fontWeight: '600'
                                            }}
                                        >
                                            Restore This
                                        </button>
                                    </div>
                                );
                            })}
                            <button
                                onClick={() => setBackups(null)}
                                style={{
                                    marginTop: '12px',
                                    background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline'
                                }}>
                                Close History
                            </button>
                        </div>
                    )}
                </div>

                {/* Cloud Data Management Section (Emergency) */}
                <div className="liquid-glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Cloud size={24} color="#ef4444" />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0, color: '#ef4444' }}>Emergency Zone</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                        If your data looks missing or corrupted, you can try to force-reload the last saved version from the cloud.
                        <br />
                        <strong style={{ color: '#ef4444' }}>Warning: This will overwrite your current local data.</strong>
                    </p>

                    <button
                        onClick={async () => {
                            if (!window.confirm("Are you sure? This will replace your current data with the version from the cloud.")) return;

                            setStatus({ type: 'info', message: 'Fetching cloud data...' });
                            try {
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session) throw new Error("Not logged in!");

                                const { data, error } = await supabase
                                    .from('user_data')
                                    .select('content, updated_at')
                                    .eq('id', session.user.id)
                                    .single();

                                if (error) throw error;
                                if (!data?.content) throw new Error("No cloud data found.");

                                // Create a safety backup first
                                const safetyBackup = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
                                const anchor = document.createElement('a');
                                anchor.href = safetyBackup;
                                anchor.download = "safety-backup-before-restore.json";
                                anchor.click();

                                dispatch({ type: 'LOAD_STATE', payload: data.content });
                                setStatus({
                                    type: 'success',
                                    message: `Restored successfully! (Cloud backup from ${new Date(data.updated_at).toLocaleString()})`
                                });

                            } catch (err) {
                                console.error(err);
                                setStatus({ type: 'error', message: `Restore failed: ${err.message}` });
                            }
                        }}
                        style={{
                            padding: '12px 20px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid #ef4444',
                            borderRadius: '8px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <RotateCw size={18} /> Force Restore from Cloud
                    </button>
                </div>

                {/* Installation Section */}
                <div className="liquid-glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Shield size={24} color="#34d399" />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>Permanent Access</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                        You can install this app to your dock/desktop to access it without opening a terminal.
                    </p>
                    <div style={{
                        padding: '16px',
                        backgroundColor: 'rgba(52, 211, 153, 0.1)',
                        border: '1px solid rgba(52, 211, 153, 0.3)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'start',
                        gap: '12px'
                    }}>
                        <CheckCircle size={20} color="#34d399" style={{ marginTop: '2px' }} />
                        <div>
                            <strong style={{ color: '#6ee7b7', display: 'block', marginBottom: '4px' }}>How to Install:</strong>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                                <li>In Chrome/Edge: Look for the install icon in the address bar (monitor with down arrow).</li>
                                <li>The app will work offline and save data automatically.</li>
                                <li>To sync between devices, use the Export/Import feature above.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '32px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    <p>Latte App v1.1 • Local Storage Persistence</p>
                </div>

            </div>
        </div>
    );
};

export default Settings;
