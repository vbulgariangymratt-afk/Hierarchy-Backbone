import React, { useState, useEffect } from 'react';
import { backbone, repository, NodeTypes } from '../backbone-v2/index';
import CreateRewardModal from '../components/CreateRewardModal';
import './MarketplacePage.css';

const MarketplacePage = () => {
    const [balance, setBalance] = useState(0);
    const [marketplaceRewards, setMarketplaceRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchaseLoading, setPurchaseLoading] = useState(null); // ID of reward being purchased
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fetchData = async () => {
        try {
            const [currentBalance, allNodes, rootNode] = await Promise.all([
                backbone.getHryvniaBalance(),
                repository.getAll(),
                repository.getById('ROOT')
            ]);

            setBalance(currentBalance);

            const activeIds = (rootNode?.metadata?.activeMarketplace || []).map(item => item.rewardId || item);

            // Map active IDs to full reward objects
            const rewards = activeIds.map(id => allNodes.find(n => n.id === id)).filter(Boolean);

            // Filter: only "MARKETPLACE" category
            const filteredRewards = rewards.filter(r => r.metadata?.rewardCategory === 'MARKETPLACE');

            setMarketplaceRewards(filteredRewards);
        } catch (error) {
            console.error("Failed to fetch marketplace data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Subscribe to repository changes to update balance/rewards in real-time
        if (repository.subscribe) {
            return repository.subscribe(() => {
                fetchData();
            });
        }
    }, []);

    const handleBuy = async (rewardId) => {
        setPurchaseLoading(rewardId);
        try {
            const success = await backbone.redeemReward(rewardId);
            if (success) {
                // Balance and rewards will update via subscription
                console.log("Purchase successful!");
            } else {
                alert("Insufficient Hryvnia");
            }
        } catch (error) {
            console.error("Purchase failed:", error);
            alert(error.message);
        } finally {
            setPurchaseLoading(null);
        }
    };

    const handleRefill = async () => {
        try {
            await backbone.refillMarketplace();
            // Data will update via subscription
        } catch (error) {
            console.error("Refill failed:", error);
            alert(error.message);
        }
    };

    if (loading) {
        return (
            <div className="marketplace-loading">
                <div className="loading-spinner"></div>
                <p>Opening Marketplace...</p>
            </div>
        );
    }

    return (
        <div className="marketplace-page">
            <header className="marketplace-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1>Marketplace</h1>
                        <button
                            className="create-reward-btn"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <span className="plus-icon">+</span>
                            Create Reward
                        </button>
                    </div>

                    <div className="hryvnia-card">
                        <span className="hryvnia-icon">🪙</span>
                        <div className="hryvnia-details">
                            <span className="balance-label">Hryvnia Balance</span>
                            <span className="balance-value">{balance}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="marketplace-main">
                <div className="rewards-grid">
                    {marketplaceRewards.map(reward => {
                        const canAfford = balance >= (reward.metadata?.hryvniaCost || 0);
                        const isPurchasing = purchaseLoading === reward.id;
                        const tier = reward.metadata?.rewardTier;

                        return (
                            <div key={reward.id} className={`reward-card ${!canAfford ? 'insufficient' : ''}`}>
                                {tier && <div className="reward-tier">Tier {tier}</div>}
                                <div className="reward-content">
                                    <h3 className="reward-name">{reward.name}</h3>
                                    <p className="reward-description">
                                        {reward.metadata?.sensoryDescription || "No description available."}
                                    </p>
                                </div>
                                <div className="reward-footer">
                                    <div className="reward-cost">
                                        <span className="cost-icon">🪙</span>
                                        <span className="cost-value">{reward.metadata?.hryvniaCost || 0}</span>
                                    </div>
                                    <button
                                        className={`buy-button ${!canAfford ? 'disabled' : ''}`}
                                        onClick={() => handleBuy(reward.id)}
                                        disabled={!canAfford || isPurchasing}
                                    >
                                        {isPurchasing ? 'Processing...' : (canAfford ? 'Buy' : 'Insufficient Hryvnia')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="marketplace-footer">
                    <button className="refill-button" onClick={handleRefill}>
                        <span className="refill-icon">♻️</span>
                        Refill Marketplace
                    </button>
                </div>
            </main>

            <CreateRewardModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => fetchData()}
            />
        </div>
    );
};

export default MarketplacePage;

