import React from 'react';
import { ShoppingBag, Plus, Trash2, Coins, Image } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const Marketplace = () => {
    const { state, addReward, deleteReward, redeemReward, updateReward, reorderRewards } = useStore();
    const [hoveredRewardId, setHoveredRewardId] = React.useState(null);
    const [focusedRewardId, setFocusedRewardId] = React.useState(null);

    // Convert rewards object to array and sort by order
    const rewards = Object.values(state.rewards || {}).sort((a, b) => (a.order || 0) - (b.order || 0));

    // Drag and Drop State
    const draggedRewardRef = React.useRef(null);

    const handleDragStart = (e, reward) => {
        draggedRewardRef.current = reward;
        e.dataTransfer.effectAllowed = 'move';
        // Add a small delay/class for visuals if needed
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        draggedRewardRef.current = null;
        e.currentTarget.style.opacity = '1';
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary for Drop
    };

    const handleDrop = (e, targetReward) => {
        e.preventDefault();
        const draggedReward = draggedRewardRef.current;
        if (!draggedReward || draggedReward.id === targetReward.id) return;

        // Reorder logic
        const currentIndex = rewards.findIndex(r => r.id === draggedReward.id);
        const targetIndex = rewards.findIndex(r => r.id === targetReward.id);

        if (currentIndex === -1 || targetIndex === -1) return;

        const newRewards = [...rewards];
        // Remove dragged item
        newRewards.splice(currentIndex, 1);
        // Insert at new position
        newRewards.splice(targetIndex, 0, draggedReward);

        // Extract IDs in new order
        const newOrderIds = newRewards.map(r => r.id);
        reorderRewards(newOrderIds);
    };

    const handleAddReward = () => {
        const name = prompt("What's the reward? (e.g., 'Cheat Meal', 'Video Game', 'Movie Night')");
        if (!name) return;

        const costStr = prompt("How many Hryvnia does it cost?");
        const cost = parseInt(costStr);

        if (name && !isNaN(cost)) {
            addReward(name, cost);
        }
    };

    const handleBuy = (reward) => {
        if (state.currency >= reward.cost) {
            if (confirm(`Purchase '${reward.name}' for ${reward.cost} ₴?`)) {
                redeemReward(reward.id, reward.cost);
                alert("Enjoy your reward! 🎉");
            }
        } else {
            alert("Not enough Hryvnia! Get back to work! 🍅");
        }
    };

    return (
        <div className="marketplace">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-xl)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', display: 'flex', alignItems: 'center', gap: '12px', color: 'white' }}>
                        <ShoppingBag size={32} /> Marketplace
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Spend your hard-earned Hryvnia here.</p>
                </div>

                <div className="liquid-glass" style={{
                    padding: '12px 24px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 'bold',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)',
                    backdropFilter: state.showBackgrounds ? 'blur(10px)' : 'none',
                    WebkitBackdropFilter: state.showBackgrounds ? 'blur(10px)' : 'none',
                    transition: 'transform 0.4s ease, box-shadow 0.4s ease',
                    boxShadow: !state.showBackgrounds
                        ? '0 4px 8px -2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)'
                        : '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
                }}>
                    <Coins size={24} color="#FFD700" />
                    <span>{state.currency} ₴</span>
                </div>
            </div>

            {/* Actions */}
            <button
                onClick={handleAddReward}
                className="liquid-glass hover-trigger"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    backdropFilter: state.showBackgrounds ? 'blur(8px)' : 'none',
                    WebkitBackdropFilter: state.showBackgrounds ? 'blur(8px)' : 'none',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-xl)',
                    cursor: 'pointer',
                    fontWeight: '600',
                    boxShadow: !state.showBackgrounds
                        ? '0 4px 8px -2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)'
                        : '0 4px 6px rgba(0,0,0,0.1)'
                }}
            >
                <Plus size={20} /> Create New Reward
            </button>

            {/* Rewards Grid */}
            {rewards.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-2xl)',
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--color-text-secondary)'
                }}>
                    <ShoppingBag size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <p>The shop is empty.</p>
                    <p>Add items you want to buy for yourself!</p>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-lg)',
                    alignItems: 'flex-start',
                    paddingTop: '10px'
                }}>
                    {[0, 1, 2, 3, 4].map(colIndex => (
                        <div key={colIndex} style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-lg)'
                        }}>
                            {rewards.filter((_, idx) => idx % 5 === colIndex).map(reward => {
                                const canAfford = state.currency >= reward.cost;
                                const hasCover = (reward.cover?.startsWith('http') || reward.cover?.startsWith('data:'));

                                return (
                                    <div key={reward.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, reward)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, reward)}
                                        onClick={() => setFocusedRewardId(focusedRewardId === reward.id ? null : reward.id)}
                                        style={{
                                            backgroundColor: 'var(--color-bg-card)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-lg)',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            cursor: 'grab',
                                            transform: 'translateY(0)',
                                        }}
                                        className="hover-trigger"
                                    >
                                        {hasCover ? (
                                            <div style={{ position: 'relative', width: '100%', lineHeight: 0 }}>
                                                <img
                                                    src={reward.cover}
                                                    alt=""
                                                    style={{
                                                        width: '100%',
                                                        height: 'auto',
                                                        display: 'block',
                                                        minHeight: '140px',
                                                        transition: 'transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                                    }}
                                                    className="reward-img"
                                                />
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    left: 0,
                                                    right: 0,
                                                    background: 'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.5), transparent)',
                                                    padding: '40px 12px 12px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    lineHeight: 1.5
                                                }}>
                                                    <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600', color: 'white', marginBottom: '4px' }}>
                                                        {reward.name}
                                                    </h3>
                                                    <div>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '2px 8px',
                                                            backgroundColor: 'rgba(255,255,255,0.15)',
                                                            borderRadius: '4px',
                                                            color: 'white',
                                                            fontWeight: '500',
                                                            fontSize: '13px',
                                                            gap: '4px'
                                                        }}>
                                                            <Coins size={12} /> {reward.cost} ₴
                                                        </span>
                                                    </div>

                                                    {/* Floating Buy Button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleBuy(reward); }}
                                                        disabled={!canAfford}
                                                        style={{
                                                            position: 'absolute',
                                                            bottom: '12px',
                                                            right: '12px',
                                                            width: '36px',
                                                            height: '36px',
                                                            borderRadius: '50%',
                                                            background: canAfford
                                                                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))'
                                                                : 'rgba(0, 0, 0, 0.3)',
                                                            backdropFilter: 'blur(8px)',
                                                            WebkitBackdropFilter: 'blur(8px)',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: canAfford ? 'pointer' : 'not-allowed',
                                                            opacity: focusedRewardId === reward.id ? (canAfford ? 1 : 0.5) : 0,
                                                            pointerEvents: focusedRewardId === reward.id ? 'auto' : 'none',
                                                            transform: focusedRewardId === reward.id ? 'translateY(0)' : 'translateY(10px)',
                                                            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                                            boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.1)'
                                                        }}
                                                        title={canAfford ? 'Buy Reward' : 'Not enough funds'}
                                                    >
                                                        <ShoppingBag size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ padding: 'var(--spacing-lg)', position: 'relative' }}>
                                                <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600', marginBottom: '8px' }}>{reward.name}</h3>
                                                <div style={{
                                                    display: 'inline-block',
                                                    padding: '4px 8px',
                                                    backgroundColor: 'var(--color-bg-secondary)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    color: 'var(--color-text-secondary)',
                                                    fontWeight: '500'
                                                }}>
                                                    Cost: {reward.cost} ₴
                                                </div>

                                                {/* Buy Button for No Cover */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleBuy(reward); }}
                                                    disabled={!canAfford}
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '16px',
                                                        right: '16px',
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: canAfford
                                                            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))'
                                                            : 'rgba(255, 255, 255, 0.05)',
                                                        backdropFilter: 'blur(8px)',
                                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                                        color: canAfford ? 'white' : 'var(--color-text-secondary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: canAfford ? 'pointer' : 'not-allowed',
                                                        opacity: focusedRewardId === reward.id ? (canAfford ? 1 : 0.7) : 0,
                                                        pointerEvents: focusedRewardId === reward.id ? 'auto' : 'none',
                                                        transform: focusedRewardId === reward.id ? 'translateY(0)' : 'translateY(10px)',
                                                        boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.1)',
                                                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
                                                    }}
                                                >
                                                    <ShoppingBag size={18} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Actions Protocol */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            display: 'flex',
                                            gap: '4px',
                                            zIndex: 10,
                                            opacity: focusedRewardId === reward.id ? 1 : 0,
                                            pointerEvents: focusedRewardId === reward.id ? 'auto' : 'none',
                                            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                            transform: focusedRewardId === reward.id ? 'translateY(0)' : 'translateY(-5px)'
                                        }} className="action-buttons">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const cover = prompt("Paste Cover Image URL:");
                                                    if (cover) updateReward(reward.id, { cover });
                                                }}
                                                style={{
                                                    background: 'rgba(0, 0, 0, 0.3)',
                                                    backdropFilter: 'blur(8px)',
                                                    WebkitBackdropFilter: 'blur(8px)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    padding: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white'
                                                }}
                                                title="Set Cover Image"
                                            >
                                                <Image size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Delete reward?')) deleteReward(reward.id);
                                                }}
                                                style={{
                                                    background: 'rgba(0, 0, 0, 0.3)',
                                                    backdropFilter: 'blur(8px)',
                                                    WebkitBackdropFilter: 'blur(8px)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    color: 'var(--color-danger)',
                                                    padding: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )
            }
        </div >
    );
};

export default Marketplace;
