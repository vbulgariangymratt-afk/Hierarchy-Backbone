import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { habitService } from '../../backbone-v2/index';
import { X, Sparkles, Brain, Zap, Save } from 'lucide-react';
import './EvolutionArchitectModal.css';

const EvolutionArchitectModal = ({ habit, skill, onClose, onRefresh }) => {
    const [newAction, setNewAction] = useState(`If ${habit.ifTrigger}, then I will [New Action].`);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // Validation logic
    const validateStructure = (text) => {
        const lower = text.toLowerCase().trim();
        return lower.startsWith('if ') && lower.includes(', then i will ');
    };

    const handleSave = async () => {
        if (!validateStructure(newAction)) {
            setError("Please maintain the 'If [Trigger], then I will [New Action]' structure.");
            return;
        }

        if (newAction.includes('[New Action]')) {
            setError("Please define your new action.");
            return;
        }

        try {
            setIsSaving(true);
            setError(null);
            
            // Extract the new action part if needed, but habitService.upgradePhase 
            // usually takes the full description or just the action part.
            // Based on HabitCard.jsx, it seems description is the action.
            // Let's extract the "then I will " part or just save the whole thing if that's the pattern.
            // Actually, the user says "Let's define the next tiny evolution".
            
            await habitService.upgradePhase(habit.id, newAction);
            onRefresh();
            onClose();
        } catch (err) {
            setError(err.message || "Failed to evolve habit.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="evolution-architect-overlay" onClick={onClose}>
            <motion.div 
                className="evolution-architect-modal" 
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
                <header className="evolution-header">
                    <div className="header-icon">
                        <Sparkles size={24} />
                    </div>
                    <div className="header-text">
                        <h2>Identity Evolution</h2>
                        <p className="identity-anchor">You are becoming <span>{skill.metadata?.identityAnchor || skill.name}</span></p>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </header>

                <div className="evolution-body">
                    <div className="evolution-context">
                        <div className="context-icon"><Brain size={18} /></div>
                        <p>You've mastered <strong>{habit.phases?.[habit.currentPhaseLevel]?.description || 'the current stage'}</strong>. Let’s define the next tiny evolution.</p>
                    </div>

                    <div className="mad-libs-container">
                        <label>The Next Protocol</label>
                        <textarea 
                            value={newAction}
                            onChange={(e) => {
                                setNewAction(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder="If [Trigger], then I will [New Action]."
                            className={error ? 'has-error' : ''}
                            autoFocus
                        />
                        {error && <p className="error-message">{error}</p>}
                        <p className="helper-text">Focus on the smallest possible increase in difficulty or scope.</p>
                    </div>
                </div>

                <footer className="evolution-footer">
                    <div className="footer-left">
                        <button className="secondary-btn" onClick={onClose}>
                            Save for later
                        </button>
                        <button className="secondary-btn" onClick={onClose}>
                            I'll do this when I have more energy
                        </button>
                    </div>
                    <button 
                        className="primary-btn" 
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? "Evolving..." : (
                            <>
                                <Save size={16} />
                                Solidify Evolution
                            </>
                        )}
                    </button>
                </footer>
            </motion.div>
        </div>
    );
};

export default EvolutionArchitectModal;
