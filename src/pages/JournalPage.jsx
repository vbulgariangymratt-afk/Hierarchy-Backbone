import React, { useState, useEffect } from 'react';
import { Droplet, Plus, Minus, Moon, Sun, Pill, Pencil, X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { journalService, repository } from '../backbone-v2';
import './JournalPage.css';
import BorderGlow from '../components/ui/BorderGlow';

const DiscreteSlider = ({ min = 1, max = 5, value, onChange }) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="custom-slider-container" style={{ position: 'relative' }}>
            <div className="custom-slider-track-wrapper">
                <div className="custom-slider-track">
                    <motion.div 
                        className="custom-slider-fill" 
                        initial={false}
                        animate={{ width: `${percentage}%` }}
                        transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    />
                    <motion.div 
                        className="custom-slider-thumb"
                        initial={false}
                        animate={{ left: `${percentage}%` }}
                        transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    />
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="invisible-range-input"
            />
        </div>
    );
};

const WATER_SIZES = [
    { label: 'Glass', value: 250 },
    { label: 'Big glass', value: 350 },
    { label: 'Full bottle', value: 500 }
];

const getTodayDateStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const JournalPage = () => {
    const todayStr = getTodayDateStr();
    
    const [loading, setLoading] = useState(true);
    const [wakeUpEase, setWakeUpEase] = useState(3);
    const [shutDownEase, setShutDownEase] = useState(3);
    
    const [lastAdded, setLastAdded] = useState(250);
    const [hydrationTotal, setHydrationTotal] = useState(0);

    // Medication states
    const [rootNode, setRootNode] = useState(null);
    const [configuredMeds, setConfiguredMeds] = useState([]);
    const [medsTaken, setMedsTaken] = useState([]);
    const [isConfiguringMeds, setIsConfiguringMeds] = useState(false);
    const [newMedInput, setNewMedInput] = useState('');

    // Load initial today's log & root settings from Supabase
    useEffect(() => {
        const loadData = async () => {
            try {
                const [entry, root] = await Promise.all([
                    journalService.getEntry(todayStr),
                    repository.getById('ROOT')
                ]);
                
                if (entry) {
                    setWakeUpEase(entry.wake_up_ease || 3);
                    setShutDownEase(entry.shut_down_ease || 3);
                    setHydrationTotal(entry.hydration_total || 0);
                    setMedsTaken(entry.meds_taken || []);
                }
                
                if (root) {
                    setRootNode(root);
                    setConfiguredMeds(root.metadata?.configuredMedications || []);
                }
            } catch (error) {
                console.error("Failed to load journal entry / root metadata:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [todayStr]);

    // Save helpers
    const saveUpdates = async (updates) => {
        try {
            await journalService.updateEntry(todayStr, updates);
        } catch (error) {
            console.error("Failed to save journal updates:", error);
        }
    };

    const handleWakeUpChange = (val) => {
        const value = Number(val);
        setWakeUpEase(value);
        saveUpdates({ wake_up_ease: value });
    };

    const handleShutDownChange = (val) => {
        const value = Number(val);
        setShutDownEase(value);
        saveUpdates({ shut_down_ease: value });
    };

    const addWater = (amount) => {
        const newTotal = hydrationTotal + amount;
        setHydrationTotal(newTotal);
        setLastAdded(amount);
        saveUpdates({ 
            hydration_total: newTotal
        });
    };

    const undoLastWater = () => {
        const newTotal = Math.max(0, hydrationTotal - lastAdded);
        setHydrationTotal(newTotal);
        saveUpdates({ 
            hydration_total: newTotal
        });
    };

    // Medication actions (Supabase Sync)
    const handleAddMedication = async (e) => {
        e.preventDefault();
        const medName = newMedInput.trim();
        if (!medName || !rootNode) return;
        
        // Prevent duplicate names
        if (configuredMeds.some(m => m.toLowerCase() === medName.toLowerCase())) {
            setNewMedInput('');
            return;
        }

        const newMeds = [...configuredMeds, medName];
        setConfiguredMeds(newMeds);
        setNewMedInput('');

        try {
            const updatedRoot = await repository.update('ROOT', {
                metadata: {
                    ...(rootNode.metadata || {}),
                    configuredMedications: newMeds
                }
            });
            if (updatedRoot) setRootNode(updatedRoot);
        } catch (error) {
            console.error("Failed to add medication name to Supabase:", error);
        }
    };

    const handleRemoveMedication = async (medName) => {
        if (!rootNode) return;
        const newMeds = configuredMeds.filter(m => m !== medName);
        setConfiguredMeds(newMeds);

        // Also clean up today's completions if the med was removed
        const newMedsTaken = medsTaken.filter(m => m !== medName);
        setMedsTaken(newMedsTaken);

        try {
            const updatedRoot = await repository.update('ROOT', {
                metadata: {
                    ...(rootNode.metadata || {}),
                    configuredMedications: newMeds
                }
            });
            if (updatedRoot) setRootNode(updatedRoot);
            saveUpdates({ meds_taken: newMedsTaken });
        } catch (error) {
            console.error("Failed to remove medication name from Supabase:", error);
        }
    };

    const toggleMedicationTaken = (medName) => {
        let newMedsTaken;
        if (medsTaken.includes(medName)) {
            newMedsTaken = medsTaken.filter(m => m !== medName);
        } else {
            newMedsTaken = [...medsTaken, medName];
        }
        setMedsTaken(newMedsTaken);
        saveUpdates({ meds_taken: newMedsTaken });
    };

    const getWakeUpLabel = (val) => {
        if (val === 1) return 'Refreshed';
        if (val === 2) return 'Light Sleep / Mostly Ok';
        if (val === 3) return 'Neutral';
        if (val === 4) return 'Grogginess / Tired';
        if (val === 5) return 'Exhausted';
        return 'Neutral';
    };

    const getShutDownLabel = (val) => {
        if (val === 1) return 'Easy Sleep';
        if (val === 2) return 'A bit restless';
        if (val === 3) return 'Neutral';
        if (val === 4) return 'Delayed shutdown';
        if (val === 5) return 'Avoided sleep (revenge bedtime procrastination)';
        return 'Neutral';
    };

    if (loading) {
        return (
            <div className="journal-skeleton">
                <div className="loading-spinner"></div>
                <span>Loading your daily log...</span>
            </div>
        );
    }

    return (
        <div className="journal-page">
            <header className="journal-header">
                <h1>Daily Log</h1>
                <span className="journal-date">{todayStr}</span>
            </header>

            <main className="journal-main">
                {/* 1. Wake Up Ease Section */}
                <section className="journal-section">
                    <div className="section-body-content">
                        <label className="input-label-themed inline-header">
                            <Sun size={14} className="section-icon sun-icon" />
                            <span>How easy was it to wake up?</span>
                        </label>
                        <DiscreteSlider 
                            value={wakeUpEase}
                            onChange={handleWakeUpChange}
                        />
                        <div className="slider-labels">
                            <span className="slider-label-extreme">Refreshed</span>
                            <motion.span 
                                layout 
                                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                                className="slider-current-value"
                            >
                                <motion.span layout transition={{ duration: 0 }}>
                                    {getWakeUpLabel(wakeUpEase)}
                                </motion.span>
                            </motion.span>
                            <span className="slider-label-extreme">Exhausted</span>
                        </div>
                    </div>
                </section>

                {/* 2. Shut Down Ease Section */}
                <section className="journal-section">
                    <div className="section-body-content">
                        <label className="input-label-themed inline-header">
                            <Moon size={14} className="section-icon moon-icon" />
                            <span>How easy was it to shut down last night?</span>
                        </label>
                        <DiscreteSlider 
                            value={shutDownEase}
                            onChange={handleShutDownChange}
                        />
                        <div className="slider-labels">
                            <span className="slider-label-extreme">Easy sleep</span>
                            <motion.span 
                                layout 
                                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                                className="slider-current-value"
                            >
                                <motion.span layout transition={{ duration: 0 }}>
                                    {getShutDownLabel(shutDownEase)}
                                </motion.span>
                            </motion.span>
                            <span className="slider-label-extreme">Avoided sleep</span>
                        </div>
                    </div>
                </section>

                {/* 3. Hydration Section */}
                <section className="journal-section">
                    <div className="section-body-content">
                        <label className="input-label-themed inline-header">
                            <Droplet size={14} className="section-icon water-icon" />
                            <span>Hydration tracker</span>
                        </label>
                        <div className="water-quick-log-row">
                            {WATER_SIZES.map((size) => (
                                <BorderGlow
                                    key={size.value}
                                    glowRadius={16}
                                    backgroundColor="transparent"
                                    fillOpacity={0.25}
                                    className="water-size-log-glow-wrapper"
                                >
                                    <button
                                        type="button"
                                        className="water-size-log-btn"
                                        onClick={() => addWater(size.value)}
                                    >
                                        <Droplet size={12} />
                                        <span>{size.label}</span>
                                    </button>
                                </BorderGlow>
                            ))}
                        </div>

                        <div className="water-progress-indicator inline-progress">
                            <div className="water-progress-text">
                                Today's total: <strong className="water-highlight">{hydrationTotal} ml</strong>
                            </div>
                            {hydrationTotal > 0 && (
                                <button 
                                    className="water-mini-undo-btn"
                                    onClick={undoLastWater}
                                    title={`Undo last +${lastAdded}ml`}
                                >
                                    Undo (-{lastAdded}ml)
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* 4. Medications Tracker Section */}
                <section className="journal-section">
                    <div className="section-body-content">
                        <div className="inline-header-with-action">
                            <label className="input-label-themed inline-header">
                                <Pill size={14} className="section-icon med-icon" />
                                <span>Medication tracker</span>
                            </label>
                            {configuredMeds.length > 0 && (
                                <button
                                    type="button"
                                    className="med-config-toggle-btn"
                                    onClick={() => setIsConfiguringMeds(!isConfiguringMeds)}
                                    title={isConfiguringMeds ? "Save layout" : "Manage medications"}
                                >
                                    <Pencil size={14} />
                                </button>
                            )}
                        </div>

                        {configuredMeds.length === 0 || isConfiguringMeds ? (
                            // Configuration View
                            <div className="med-setup-container">
                                <label className="input-sublabel-themed">Configure your medications</label>
                                
                                <form onSubmit={handleAddMedication} className="med-setup-form">
                                    <input
                                        type="text"
                                        className="med-setup-input"
                                        placeholder="Type medication name..."
                                        value={newMedInput}
                                        onChange={(e) => setNewMedInput(e.target.value)}
                                        maxLength={40}
                                    />
                                    <button type="submit" className="med-setup-add-btn">
                                        <Plus size={16} />
                                        Add
                                    </button>
                                </form>

                                <div className="med-setup-list">
                                    {configuredMeds.map((med, idx) => (
                                        <div key={idx} className="med-setup-item">
                                            <span>{med}</span>
                                            <button
                                                type="button"
                                                className="med-setup-remove-btn"
                                                onClick={() => handleRemoveMedication(med)}
                                                title="Remove medication"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {configuredMeds.length > 0 && (
                                    <button
                                        type="button"
                                        className="med-setup-finish-btn"
                                        onClick={() => setIsConfiguringMeds(false)}
                                    >
                                        Finish Setup
                                    </button>
                                )}
                            </div>
                        ) : (
                            // One-Tap Logging View
                            <div className="med-tracker-container">
                                <label className="input-sublabel-themed">Tap name to log taken</label>
                                <div className="med-grid">
                                    {configuredMeds.map((med, idx) => {
                                        const isTaken = medsTaken.includes(med);
                                        return (
                                            <BorderGlow
                                                key={idx}
                                                glowRadius={16}
                                                backgroundColor="transparent"
                                                fillOpacity={0.25}
                                                className={`med-log-glow-wrapper ${isTaken ? 'taken' : ''}`}
                                            >
                                                <button
                                                    type="button"
                                                    className={`med-log-btn ${isTaken ? 'taken' : ''}`}
                                                    onClick={() => toggleMedicationTaken(med)}
                                                >
                                                    <span className="med-checkbox">
                                                        {isTaken && <Check size={12} />}
                                                    </span>
                                                    <span className="med-name-text">{med}</span>
                                                </button>
                                            </BorderGlow>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default JournalPage;
