import React, { useState } from 'react';
import { backbone, repository, NodeTypes } from '../backbone-v2/index';
import { useSettings } from '../context/SettingsContext';
import { Coins } from 'lucide-react';
import './CreateRewardModal.css';

const CreateRewardModal = ({ isOpen, onClose, onSuccess, defaultTier = 1, isTaskReward = false }) => {
    const { currencyName } = useSettings();
    const [name, setName] = useState('');
    const [sensoryDescription, setSensoryDescription] = useState('');
    const [rewardTier, setRewardTier] = useState(defaultTier);
    const [hryvniaCost, setHryvniaCost] = useState(10);
    const [isLevelGated, setIsLevelGated] = useState(false);
    const [requiredLevel, setRequiredLevel] = useState(1);
    const [requiredSkillId, setRequiredSkillId] = useState(''); // Empty string means no skill selected yet
    const [allSkills, setAllSkills] = useState([]);
    const [coverUrl, setCoverUrl] = useState('');
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
        if (isOpen) {
            fetchSkills();
            if (isTaskReward) {
                setRewardTier(1);
                setIsLevelGated(false);
            } else {
                setRewardTier(defaultTier);
            }
        }
    }, [isOpen, defaultTier, isTaskReward]);

    const handleCostChange = (val) => {
        const cost = Number(val);
        setHryvniaCost(cost);
        
        // Smart Defaults: rewards >= 50 coins are strongly suggested to be gated
        if (cost >= 50 && !isLevelGated) {
            setIsLevelGated(true);
            setRequiredLevel(Math.max(1, Math.floor(cost / 50)));
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            const createdNode = await backbone.addNode({
                name: name.trim(),
                type: NodeTypes.REWARD,
                parentId: 'REWARD_BANK',
                metadata: {
                    sensoryDescription: sensoryDescription.trim(),
                    rewardCategory: 'MARKETPLACE',
                    hryvniaCost: Number(hryvniaCost),
                    requiredLevel: isLevelGated ? Number(requiredLevel) : null,
                    requiredSkillId: isLevelGated ? requiredSkillId : null,
                    rewardTier: Number(rewardTier),
                    coverUrl: coverUrl.trim() || null,
                    iconUrl: coverUrl.trim() || null // Maintain backwards compatibility
                }
            });

            setName('');
            setSensoryDescription('');
            setRewardTier(1);
            setHryvniaCost(10);
            setIsLevelGated(false);
            setRequiredLevel(1);
            setRequiredSkillId(allSkills.length > 0 ? allSkills[0].id : '');
            setCoverUrl('');

            if (onSuccess) onSuccess(createdNode);
            onClose();
        } catch (error) {
            console.error("Failed to create reward:", error);
            alert("Error creating reward: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedSkill = allSkills.find(s => s.id === requiredSkillId);
    const currentLevel = selectedSkill?.metadata?.currentLevel || 0;

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
                        <label>Sensory Description (Visual/Tactile)</label>
                        <textarea
                            value={sensoryDescription}
                            onChange={e => setSensoryDescription(e.target.value)}
                            placeholder="What do you see/feel? (Shown in Marketplace)..."
                            rows={3}
                        />
                    </div>

                    {!isTaskReward && (
                        <div className="form-group">
                            <label>Category</label>
                            <div className="category-toggle">
                                <button
                                    type="button"
                                    className={`toggle-btn ${rewardTier === 1 ? 'active' : ''}`}
                                    onClick={() => setRewardTier(1)}
                                >
                                    Micro-Reset
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${rewardTier === 2 ? 'active' : ''}`}
                                    onClick={() => setRewardTier(2)}
                                >
                                    Mid-Reset
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${rewardTier === 3 ? 'active' : ''}`}
                                    onClick={() => setRewardTier(3)}
                                >
                                    Epic Milestone
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>{currencyName} Cost</label>
                        <div className="cost-input-wrapper">
                            <Coins size={16} className="cost-unit-icon" />
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={hryvniaCost}
                                onChange={e => handleCostChange(e.target.value)}
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>
                    {!isTaskReward && (
                        <div className="form-group level-gate-group">
                            <div className="gate-toggle-wrapper">
                                <label className="checkbox-label custom-switch-container">
                                    <input 
                                        type="checkbox" 
                                        checked={isLevelGated}
                                        onChange={e => setIsLevelGated(e.target.checked)}
                                        className="custom-switch-input"
                                    />
                                    <span className="custom-switch-slider" />
                                    <span className="switch-text">Gate this by Aura Level?</span>
                                </label>
                                
                                <div className="gate-toggle-right-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {hryvniaCost >= 50 && !isLevelGated && (
                                        <span className="smart-suggestion">Recommended</span>
                                    )}
                                    <div className="aura-help-wrapper">
                                        <span className="aura-help-icon">?</span>
                                        <div className="aura-help-tooltip">
                                            Aura is how you'll track progress on your skills.
                                        </div>
                                    </div>
                                </div>
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
                                            <label>
                                                Required In
                                                {selectedSkill && (
                                                    <span style={{ color: 'var(--color-accent)', textTransform: 'none', marginLeft: '6px' }}>
                                                        (Current Lvl: {currentLevel})
                                                    </span>
                                                )}
                                            </label>
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
                    )}

                    <div className="form-group">
                        <label>Cover Image URL (ADHD visual anchor)</label>
                        <input
                            type="text"
                            value={coverUrl}
                            onChange={e => setCoverUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/..."
                        />
                        {coverUrl && (
                            <div 
                                className="cover-preview-card" 
                                style={{ 
                                    backgroundImage: `url(${coverUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    height: '110px',
                                    borderRadius: '12px',
                                    marginTop: '12px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255, 255, 255, 0.08)'
                                }}
                            >
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.72) 100%)',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    padding: '12px',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Cover Wallpaper Preview
                                </div>
                            </div>
                        )}
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
