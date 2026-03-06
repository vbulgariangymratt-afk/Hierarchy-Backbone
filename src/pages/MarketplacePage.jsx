import React, { useState, useEffect } from 'react';
import { backbone, repository, NodeTypes } from '../backbone-v2/index';
import CreateRewardModal from '../components/CreateRewardModal';
import NodeIcon from '../components/NodeIcon';
import './MarketplacePage.css';

const SVG_ICONS = {
    COIN: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8'/%3E%3Cpath d='M12 18V6'/%3E%3C/svg%3E",
    REFILL: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/%3E%3Cpath d='M21 3v5h-5'/%3E%3Cpath d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/%3E%3Cpath d='M3 21v-5h5'/%3E%3C/svg%3E",
    PLUS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='12' y1='5' x2='12' y2='19'/%3E%3Cline x1='5' y1='12' x2='19' y2='12'/%3E%3C/svg%3E"
};

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
                            <NodeIcon iconUrl={SVG_ICONS.PLUS} size={14} />
                            Create Reward
                        </button>
                    </div>

                    <div className="hryvnia-card">
                        <NodeIcon iconUrl={SVG_ICONS.COIN} size={24} />
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
                                        <NodeIcon iconUrl={SVG_ICONS.COIN} size={14} />
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
                        <NodeIcon iconUrl={SVG_ICONS.REFILL} size={16} />
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

