import React, { useState } from 'react';
import { backbone, repository, NodeTypes } from '../backbone-v2/index';
import { useSettings } from '../context/SettingsContext';
import './CreateRewardModal.css';

const CreateRewardModal = ({ isOpen, onClose, onSuccess }) => {
    const { currencyName } = useSettings();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [sensoryDescription, setSensoryDescription] = useState('');
    const [category, setCategory] = useState('MARKETPLACE'); // 'MARKETPLACE' or 'TASK'
    const [hryvniaCost, setHryvniaCost] = useState(10);
    const [isLevelGated, setIsLevelGated] = useState(false);
    const [requiredLevel, setRequiredLevel] = useState(1);
    const [requiredSkillId, setRequiredSkillId] = useState(''); // Empty string means no skill selected yet
    const [allSkills, setAllSkills] = useState([]);
    const [iconUrl, setIconUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        const fetchSkills = async () => {
            const nodes = await repository.getAll();
            const skills = nodes.filter(n => n.type === NodeTypes.SKILL);
            setAllSkills(skills);
            
            // Set default skill if none selected
            if (skills.length > 0 && !requiredSkillId) {
                setRequiredSkillId(skills[0].id);
            }
        };
        if (isOpen) fetchSkills();
    }, [isOpen]);

    const handleCostChange = (val) => {
        const cost = Number(val);
        setHryvniaCost(cost);
        
        // Smart Defaults: rewards >= 50 coins are strongly suggested to be gated
        if (cost >= 50 && !isLevelGated) {
            setIsLevelGated(true);
            setRequiredLevel(Math.max(1, Math.floor(cost / 50)));
        } else if (cost < 50 && isLevelGated && requiredLevel === Math.floor(50/50)) {
            // Only auto-untoggle if it was at the default suggested level
            // setIsLevelGated(false); 
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await backbone.addNode({
                name: name.trim(),
                type: NodeTypes.REWARD,
                parentId: 'REWARD_BANK',
                metadata: {
                    description: description.trim(),
                    sensoryDescription: sensoryDescription.trim(),
                    rewardCategory: category,
                    hryvniaCost: Number(hryvniaCost),
                    requiredLevel: isLevelGated ? Number(requiredLevel) : null,
                    requiredSkillId: isLevelGated ? requiredSkillId : null,
                    rewardTier: 1, // Default to tier 1 for now
                    iconUrl: iconUrl.trim() || null
                }
            });

            setName('');
            setDescription('');
            setSensoryDescription('');
            setCategory('MARKETPLACE');
            setHryvniaCost(10);
            setIsLevelGated(false);
            setRequiredLevel(1);
            setRequiredSkillId(allSkills.length > 0 ? allSkills[0].id : '');
            setIconUrl('');

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to create reward:", error);
            alert("Error creating reward: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="reward-modal" onClick={e => e.stopPropagation()}>
                <header className="reward-modal-header">
                    <h2>Create New Reward</h2>
                </header>

                <form onSubmit={handleSubmit} className="reward-form">
                    <div className="form-group">
                        <label>Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. 15min Gaming Break"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Description (Internal)</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Purpose or internal notes..."
                            rows={3}
                        />
                    </div>

                    <div className="form-group">
                        <label>Sensory Description (Visual/Tactile)</label>
                        <textarea
                            value={sensoryDescription}
                            onChange={e => setSensoryDescription(e.target.value)}
                            placeholder="What do you see/feel? (Shown in Marketplace)..."
                            rows={3}
                        />
                    </div>

                    <div className="form-group">
                        <label>Category</label>
                        <div className="category-toggle">
                            <button
                                type="button"
                                className={`toggle-btn ${category === 'MARKETPLACE' ? 'active' : ''}`}
                                onClick={() => setCategory('MARKETPLACE')}
                            >
                                Marketplace
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${category === 'TASK' ? 'active' : ''}`}
                                onClick={() => setCategory('TASK')}
                            >
                                Task
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{currencyName} Cost</label>
                        <div className="cost-input-wrapper">
                            <span className="unit-icon">🪙</span>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={hryvniaCost}
                                onChange={e => handleCostChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group level-gate-group">
                        <div className="gate-toggle-wrapper">
                            <label className="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    checked={isLevelGated}
                                    onChange={e => setIsLevelGated(e.target.checked)}
                                />
                                <span>Gate this by Aura Level?</span>
                            </label>
                            {hryvniaCost >= 50 && !isLevelGated && (
                                <span className="smart-suggestion">Recommended for high-cost rewards</span>
                            )}
                        </div>

                        {isLevelGated && (
                            <div className="level-input-wrapper animated-fade-in">
                                <div className="gate-settings-row">
                                    <div className="gate-field">
                                        <label>Required Aura Level</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={requiredLevel}
                                            onChange={e => setRequiredLevel(e.target.value)}
                                            placeholder="e.g. 5"
                                        />
                                    </div>
                                    <div className="gate-field">
                                        <label>Required In</label>
                                        <select 
                                            value={requiredSkillId} 
                                            onChange={e => setRequiredSkillId(e.target.value)}
                                            className="skill-gate-select"
                                            required={isLevelGated}
                                        >
                                            {allSkills.length === 0 && <option value="">No skills found</option>}
                                            {allSkills.map(skill => (
                                                <option key={skill.id} value={skill.id}>{skill.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Icon URL (notionicons.so)</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={iconUrl}
                                onChange={e => setIconUrl(e.target.value)}
                                placeholder="https://notionicons.so/icon/..."
                                style={{ flex: 1 }}
                            />
                            {iconUrl && (
                                <div className="icon-preview" style={{ width: '36px', height: '36px', background: 'var(--alpha-low)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)' }}>
                                    <img src={iconUrl} alt="preview" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Reward'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateRewardModal;
