import React, { useState, useEffect, useRef } from 'react';
import { habitService } from '../../backbone-v2/index';
import { useBackboneStore } from '../../store/backboneStore';
import './HabitUpgradeFlow.css';

// Bionic Reading utility to format texts
const bionic = (text) => {
    if (!text) return '';
    return text.split(' ').map((word, i) => {
        if (!word) return null;
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
        if (cleanWord.length === 0) {
            return <span key={i} style={{ marginRight: '0.28em' }}>{word}</span>;
        }
        
        // Bold the first ceil(length/2) characters
        const mid = Math.ceil(cleanWord.length / 2);
        let cleanCharCount = 0;
        let splitIndex = 0;
        
        for (let j = 0; j < word.length; j++) {
            if (/[a-zA-Z0-9]/.test(word[j])) {
                cleanCharCount++;
            }
            if (cleanCharCount === mid) {
                splitIndex = j + 1;
                break;
            }
        }
        
        if (splitIndex === 0) {
            splitIndex = Math.ceil(word.length / 2);
        }

        const boldPart = word.substring(0, splitIndex);
        const restPart = word.substring(splitIndex);

        return (
            <span key={i} className="bionic-word" style={{ marginRight: '0.28em', display: 'inline-block' }}>
                <strong className="bionic-bold">{boldPart}</strong>
                <span className="bionic-muted">{restPart}</span>
            </span>
        );
    });
};

const HabitUpgradeFlow = () => {
    const habit = useBackboneStore(state => state.activeUpgradeHabit);
    const setActiveUpgradeHabit = useBackboneStore(state => state.setActiveUpgradeHabit);
    
    const [screen, setScreen] = useState(1);
    const [newAction, setNewAction] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (screen === 2 && inputRef.current) {
            inputRef.current.focus();
        }
    }, [screen]);

    if (!habit) return null;

    const nextPhaseNum = (habit.currentPhaseLevel || 0) + 2;

    const handleNextScreen = () => {
        setScreen(2);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!newAction.trim()) return;

        try {
            await habitService.upgradePhase(habit.id, newAction.trim());
            setActiveUpgradeHabit(null);
        } catch (error) {
            console.error('Failed to upgrade phase:', error);
            alert(error.message || 'Failed to upgrade habit phase.');
        }
    };

    return (
        <div className="habit-upgrade-overlay">
            <div className="habit-upgrade-container-wrapper">
                <div className="habit-upgrade-container">
                    {screen === 1 ? (
                        <div className="upgrade-screen-content fade-in">
                            <div className="upgrade-celebration-badge">
                                {bionic("Level Up Available")}
                            </div>
                            <h2 className="upgrade-title-primary">
                                {bionic("You crushed Phase 1.")}
                            </h2>
                            <div className="upgrade-warning-body">
                                <p>{bionic("Now your brain will try to trick you into doing the full-blown habit bcuz you feel more capable.")}</p>
                                <p className="highlight-warning">
                                    {bionic("That will backfire. Keep doing what you already know works for your brain")}
                                </p>
                            </div>
                            <button className="upgrade-flow-btn" onClick={handleNextScreen}>
                                Ready for phase {nextPhaseNum}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="upgrade-screen-content fade-in">
                            <h2 className="upgrade-title-secondary">
                                {bionic("What is just a tiny bit bigger than what you're already doing?")}
                            </h2>
                            <p className="upgrade-subtitle-context">
                                {bionic("(If Phase 1 was \"opening a book,\" Phase 2 is \"read one sentence\".)")}
                                <br />
                                {bionic("Your trigger stays exactly the same.")}
                            </p>

                            <div className="habit-formula-builder">
                                <div className="formula-part">
                                    <span className="formula-label">IF</span>
                                    <span className="formula-value-trigger">"{habit.ifTrigger}"</span>
                                </div>
                                <div className="formula-part">
                                    <span className="formula-label highlight-then">THEN I</span>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={newAction}
                                        onChange={(e) => setNewAction(e.target.value)}
                                        placeholder="type the new phase of the habit..."
                                        className="formula-input-action"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="upgrade-actions-row">
                                <button type="button" className="upgrade-flow-btn cancel-btn" onClick={() => setActiveUpgradeHabit(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="upgrade-flow-btn save-btn" disabled={!newAction.trim()}>
                                    Save & Evolve
                                </button>
                            </div>
                        </form>
                    )}
                </div>
                <div className="upgrade-later-footer">
                    <button type="button" className="upgrade-later-btn" onClick={() => setActiveUpgradeHabit(null)}>
                        Upgrade later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HabitUpgradeFlow;
