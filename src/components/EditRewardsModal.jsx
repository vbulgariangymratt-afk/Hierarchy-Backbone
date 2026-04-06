import React, { useState, useEffect } from 'react';
import { backbone, repository, NodeTypes } from '../backbone-v2/index';
import NodeIcon from './NodeIcon';
import './EditRewardsModal.css';

const BANKNOTE_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='20' height='12' x='2' y='6' rx='2'/%3E%3Cpath d='M6 12h.01M18 12h.01'/%3E%3C/svg%3E";

const EditRewardsModal = ({ isOpen, onClose, onSuccess }) => {
    const [allRewards, setAllRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editPrice, setEditPrice] = useState('');
    const [savingId, setSavingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

    const fetchRewards = async () => {
        setLoading(true);
        try {
            const allNodes = await repository.getAll();
            const rewards = allNodes.filter(
                n => n.type === NodeTypes.REWARD && n.parentId === 'REWARD_BANK'
            );
            setAllRewards(rewards);
        } catch (err) {
            console.error('Failed to load rewards:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchRewards();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleStartEdit = (reward) => {
        setEditingId(reward.id);
        setEditPrice(reward.metadata?.hryvniaCost ?? 10);
    };

    const handleSavePrice = async (reward) => {
        setSavingId(reward.id);
        try {
            await repository.update(reward.id, {
                metadata: { ...reward.metadata, hryvniaCost: Number(editPrice) }
            });
            setEditingId(null);
            await fetchRewards();
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Failed to update price:', err);
        } finally {
            setSavingId(null);
        }
    };

    const handleDeleteClick = (e, rewardId) => {
        e.stopPropagation();
        setConfirmingDeleteId(rewardId);
    };

    const handleConfirmDelete = async (rewardId) => {
        setConfirmingDeleteId(null);
        setDeletingId(rewardId);
        try {
            await repository.delete(rewardId);
            console.log('REWARD DELETED SUCCESSFULLY');
            await fetchRewards();
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Failed to delete reward:', err);
            alert('Error deleting reward: ' + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const categoryLabel = (cat) => cat === 'TASK' ? 'Task' : 'Marketplace';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="edit-rewards-modal" onClick={e => e.stopPropagation()}>
                <header className="edit-rewards-header">
                    <h2>Edit Rewards</h2>
                    <button className="er-close-btn" onClick={onClose}>×</button>
                </header>

                <p className="er-subtitle">All rewards in your bank — edit prices or remove them.</p>

                {loading ? (
                    <div className="er-loading">Loading rewards…</div>
                ) : allRewards.length === 0 ? (
                    <div className="er-empty">No rewards found. Create one first!</div>
                ) : (
                    <ul className="er-list">
                        {allRewards.map(reward => (
                            <li key={reward.id} className="er-item">
                                <div className="er-item-info">
                                    <span className="er-item-name">{reward.name}</span>
                                    <span className="er-item-cat">{categoryLabel(reward.metadata?.rewardCategory)}</span>
                                </div>

                                <div className="er-item-actions">
                                    {editingId === reward.id ? (
                                        <div className="er-price-edit">
                                            <NodeIcon iconUrl={BANKNOTE_SVG} size={14} />
                                            <input
                                                type="number"
                                                min="0"
                                                value={editPrice}
                                                onChange={e => setEditPrice(e.target.value)}
                                                className="er-price-input"
                                                autoFocus
                                            />
                                            <button
                                                className="er-save-btn"
                                                onClick={() => handleSavePrice(reward)}
                                                disabled={savingId === reward.id}
                                            >
                                                {savingId === reward.id ? '…' : 'Save'}
                                            </button>
                                            <button
                                                className="er-cancel-btn"
                                                onClick={() => setEditingId(null)}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="er-price-display">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <NodeIcon iconUrl={BANKNOTE_SVG} size={14} />
                                                <span className="er-price-value">{reward.metadata?.hryvniaCost ?? 0}</span>
                                            </div>
                                            <button
                                                className="er-edit-btn"
                                                onClick={() => handleStartEdit(reward)}
                                            >
                                                Edit Price
                                            </button>
                                        </div>
                                    )}

                                    {confirmingDeleteId === reward.id ? (
                                        <div className="er-confirm-delete">
                                            <span>Delete?</span>
                                            <button
                                                className="er-confirm-yes"
                                                onClick={() => handleConfirmDelete(reward.id)}
                                            >
                                                Yes
                                            </button>
                                            <button
                                                className="er-confirm-no"
                                                onClick={() => setConfirmingDeleteId(null)}
                                            >
                                                No
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="er-delete-btn"
                                            onClick={(e) => handleDeleteClick(e, reward.id)}
                                            disabled={deletingId === reward.id}
                                        >
                                            {deletingId === reward.id ? '…' : '🗑'}
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default EditRewardsModal;
