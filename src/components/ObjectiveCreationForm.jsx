import React, { useState } from 'react';
import { backbone, NodeTypes } from '../backbone-v2/index';

/**
 * ObjectiveCreationForm Component
 * Manages the local state and submission logic for creating a new objective (experiment).
 */
const ObjectiveCreationForm = ({ skillId, fetchData, onCancel }) => {
    const [newObjectiveName, setNewObjectiveName] = useState('');
    const [newObjectiveTheme, setNewObjectiveTheme] = useState('');
    const [newObjectiveDuration, setNewObjectiveDuration] = useState(30);
    const [newObjectiveAccType, setNewObjectiveAccType] = useState('tasks or activities');
    const [newObjectiveMVE, setNewObjectiveMVE] = useState('');
    const [newObjectiveWish, setNewObjectiveWish] = useState('');
    const [newObjectiveOutcome, setNewObjectiveOutcome] = useState('');
    const [newObjectiveIconUrl, setNewObjectiveIconUrl] = useState('');

    const handleCreateObjective = async (e) => {
        if (e && e.key && e.key !== 'Enter' && e.type !== 'click') return;

        const name = newObjectiveName.trim();
        const theme = newObjectiveTheme.trim();
        const mve = newObjectiveMVE.trim();
        const duration = newObjectiveDuration === '' ? null : parseInt(newObjectiveDuration);
        const accType = newObjectiveAccType;

        if (!name || !accType) return;

        try {
            await backbone.addNode({
                type: NodeTypes.OBJECTIVE,
                parentId: skillId,
                name: name,
                metadata: {
                    status: 'ROTATING',
                    isActive: false,
                    isSleeping: false,
                    isArchived: false,
                    activatedAt: null,
                    deactivatedAt: Date.now(),
                    theme,
                    durationInDays: duration,
                    accumulationType: accType,
                    mve,
                    wish: newObjectiveWish.trim(),
                    outcome: newObjectiveOutcome.trim(),
                    iconUrl: newObjectiveIconUrl.trim(),
                    masterAccumulatedMetric: 0
                }
            });
            
            // Success cleanup
            setNewObjectiveName('');
            setNewObjectiveTheme('');
            setNewObjectiveMVE('');
            setNewObjectiveWish('');
            setNewObjectiveOutcome('');
            setNewObjectiveIconUrl('');
            
            if (onCancel) onCancel(); // Close form
            if (fetchData) fetchData();
        } catch (error) {
            console.error("Failed to create objective:", error);
        }
    };

    return (
        <div className="objective-creation-form">
            <div className="creation-row">
                <input
                    autoFocus
                    placeholder="Experiment Title..."
                    value={newObjectiveName}
                    onChange={e => setNewObjectiveName(e.target.value)}
                    className="form-input title-input"
                />
            </div>
            <div className="creation-row">
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    <strong>Optional</strong> theme
                </label>
                <input
                    placeholder="e.g. Speed, Quality, Joy..."
                    value={newObjectiveTheme}
                    onChange={e => setNewObjectiveTheme(e.target.value)}
                    className="form-input"
                />
            </div>
            <div className="creation-row meta-row">
                <div className="input-group">
                    <label>Duration (Days)</label>
                    <input
                        type="number"
                        placeholder="Indefinite"
                        value={newObjectiveDuration}
                        onChange={e => setNewObjectiveDuration(e.target.value)}
                        className="form-input num-input"
                    />
                </div>
            </div>
            <div className="creation-row">
                <input
                    placeholder="Wish (What do I want?)"
                    value={newObjectiveWish}
                    onChange={e => setNewObjectiveWish(e.target.value)}
                    className="form-input"
                />
            </div>
            <div className="creation-row">
                <input
                    placeholder="Outcome (What does success look like?)"
                    value={newObjectiveOutcome}
                    onChange={e => setNewObjectiveOutcome(e.target.value)}
                    className="form-input"
                />
            </div>
            <div className="creation-row">
                <input
                    placeholder="Icon URL (https://notionicons.so/icon/...)"
                    value={newObjectiveIconUrl}
                    onChange={e => setNewObjectiveIconUrl(e.target.value)}
                    onKeyDown={handleCreateObjective}
                    className="form-input"
                />
            </div>
            <div className="creation-actions">
                <button className="confirm-btn" onClick={handleCreateObjective}>Launch Experiment</button>
                <button className="cancel-btn" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
};

export default ObjectiveCreationForm;
