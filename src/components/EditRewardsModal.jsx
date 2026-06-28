import React, { useState, useEffect, useRef } from 'react';
import { repository } from '../backbone-v2/index';
import './EditRewardsModal.css';

const EditRewardsModal = ({ isOpen, onClose, onSuccess, reward, focusField }) => {
    const [name, setName] = useState('');
    const [sensoryDescription, setSensoryDescription] = useState('');
    const [hryvniaCost, setHryvniaCost] = useState(10);
    const [rewardTier, setRewardTier] = useState(1);
    const [coverUrl, setCoverUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const nameInputRef = useRef(null);
    const priceInputRef = useRef(null);
    const tierInputRef = useRef(null);
    const coverInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && reward) {
            setName(reward.name || '');
            setSensoryDescription(reward.metadata?.sensoryDescription || '');
            setHryvniaCost(reward.metadata?.hryvniaCost || 10);
            setRewardTier(reward.metadata?.rewardTier || 1);
            setCoverUrl(reward.metadata?.coverUrl || reward.metadata?.iconUrl || '');

            // Dynamic Auto-focus based on selected context menu option
            setTimeout(() => {
                if (focusField === 'name' && nameInputRef.current) {
                    nameInputRef.current.focus();
                    nameInputRef.current.select();
                } else if (focusField === 'price' && priceInputRef.current) {
                    priceInputRef.current.focus();
                    priceInputRef.current.select();
                } else if (focusField === 'tier' && tierInputRef.current) {
                    tierInputRef.current.focus();
                } else if (focusField === 'cover' && coverInputRef.current) {
                    coverInputRef.current.focus();
                    coverInputRef.current.select();
                }
            }, 50);
        }
    }, [isOpen, reward, focusField]);

    if (!isOpen || !reward) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            await repository.update(reward.id, {
                name: name.trim(),
                metadata: {
                    ...reward.metadata,
                    sensoryDescription: sensoryDescription.trim(),
                    hryvniaCost: Number(hryvniaCost),
                    rewardTier: Number(rewardTier),
                    coverUrl: coverUrl.trim() || null
                }
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to update reward:', err);
            alert('Failed to update reward: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="reward-modal" onClick={e => e.stopPropagation()}>
                <header className="reward-modal-header">
                    <h2>Edit Reward Details</h2>
                    <button className="er-close-btn" onClick={onClose}>×</button>
                </header>

                <form onSubmit={handleSubmit} className="reward-form">
                    <div className="form-group">
                        <label>Reward Name</label>
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Sensory Description (ADHD-safe description)</label>
                        <textarea
                            value={sensoryDescription}
                            onChange={e => setSensoryDescription(e.target.value)}
                            rows={3}
                            placeholder="Warm, sweet, crunchy..."
                            className="textarea-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>Cover Image URL (ADHD visual anchor)</label>
                        <input
                            ref={coverInputRef}
                            type="text"
                            value={coverUrl}
                            onChange={e => setCoverUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/..."
                        />
                    </div>

                    <div className="form-row-2">
                        <div className="form-group">
                            <label>Price (Ekkos)</label>
                            <input
                                ref={priceInputRef}
                                type="number"
                                min="0"
                                value={hryvniaCost}
                                onChange={e => setHryvniaCost(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Reward Tier</label>
                            <select
                                ref={tierInputRef}
                                value={rewardTier}
                                onChange={e => setRewardTier(Number(e.target.value))}
                                className="tier-select"
                            >
                                <option value="1">Tier 1</option>
                                <option value="2">Tier 2</option>
                                <option value="3">Tier 3</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditRewardsModal;
