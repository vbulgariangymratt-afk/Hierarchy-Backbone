import React, { useState } from 'react';
import { backbone, NodeTypes } from '../backbone-v2/index';
import './CreateRewardModal.css';

const CreateRewardModal = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [sensoryDescription, setSensoryDescription] = useState('');
    const [category, setCategory] = useState('MARKETPLACE'); // 'MARKETPLACE' or 'TASK'
    const [hryvniaCost, setHryvniaCost] = useState(10);
    const [iconUrl, setIconUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                    rewardTier: 1, // Default to tier 1 for now
                    iconUrl: iconUrl.trim() || null
                }
            });

            setName('');
            setDescription('');
            setSensoryDescription('');
            setCategory('MARKETPLACE');
            setHryvniaCost(10);
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
                        <label>Hryvnia Cost</label>
                        <div className="cost-input-wrapper">
                            <span className="unit-icon">🪙</span>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={hryvniaCost}
                                onChange={e => setHryvniaCost(e.target.value)}
                            />
                        </div>
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
