import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import Desires from './Desires';

const GenericTracker = () => {
    const { trackerId } = useParams();
    const { state, updateTracker } = useStore();

    // Find tracker by ID or path
    const tracker = state.trackers?.[trackerId] ||
        Object.values(state.trackers || {}).find(t => t.path === `/trackers/${trackerId}`);

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (tracker) {
            setEditName(tracker.name);
        }
    }, [tracker]);

    if (!tracker) {
        return <div style={{ padding: '2rem', color: 'white' }}>Tracker not found: {trackerId}</div>;
    }

    // Special Case: "Desires" Tracker integration
    // If the user names a tracker "Desires", we inject the advanced Desires Lab UI
    if (tracker.name.toLowerCase() === 'desires' || trackerId === 'desires' || tracker.id === 'desires') {
        return <Desires />;
    }

    const handleSave = () => {
        if (editName.trim() && editName !== tracker.name) {
            updateTracker(tracker.id, { name: editName });
        }
        setIsEditing(false);
    };

    return (
        <div style={{ padding: '2rem', color: 'white' }}>
            {isEditing ? (
                <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        fontSize: '2em', // H1 size equivalent
                        fontWeight: 'bold',
                        width: '100%',
                        outline: 'none',
                        marginBlockStart: '0.67em',
                        marginBlockEnd: '0.67em',
                        padding: 0,
                        fontFamily: 'inherit'
                    }}
                />
            ) : (
                <h1
                    onClick={() => setIsEditing(true)}
                    style={{ cursor: 'pointer' }}
                    title="Click to rename"
                >
                    {tracker.name}
                </h1>
            )}
            <p>This is a custom tracker. Add your specific tracking logic here.</p>
            {/* Future: Allow adding widgets generically? */}
        </div>
    );
};

export default GenericTracker;
