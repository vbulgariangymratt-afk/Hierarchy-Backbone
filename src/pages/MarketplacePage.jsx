import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { backbone, repository, NodeTypes } from '../backbone-v2/index';
import CreateRewardModal from '../components/CreateRewardModal';
import EditRewardsModal from '../components/EditRewardsModal';
import NodeIcon from '../components/NodeIcon';
import './MarketplacePage.css';

const SVG_ICONS = {
    COIN: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8'/%3E%3Cpath d='M12 18V6'/%3E%3C/svg%3E",
    REFILL: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/%3E%3Cpath d='M21 3v5h-5'/%3E%3Cpath d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/%3E%3Cpath d='M3 21v-5h5'/%3E%3C/svg%3E",
    PLUS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='12' y1='5' x2='12' y2='19'/%3E%3Cline x1='5' y1='12' x2='19' y2='12'/%3E%3C/svg%3E",
    BANKNOTE: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='20' height='12' x='2' y='6' rx='2'/%3E%3Cpath d='M6 12h.01M18 12h.01'/%3E%3C/svg%3E"
};

const MarketplacePage = () => {
    const [balance, setBalance] = useState(0);
    const [marketplaceRewards, setMarketplaceRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchaseLoading, setPurchaseLoading] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [globalLevel, setGlobalLevel] = useState(1);
    const [skillLevels, setSkillLevels] = useState({});
    const [skills, setSkills] = useState([]);
    const { currencyName } = useSettings();

    const fetchData = async () => {
        try {
            const [currentBalance, allNodes, rootNode, currentLevel] = await Promise.all([
                backbone.getHryvniaBalance(),
                repository.getAll(),
                repository.getById('ROOT'),
                backbone.getGlobalLevel ? backbone.getGlobalLevel() : Promise.resolve(1)
            ]);
            
            const skillNodes = allNodes.filter(n => n.type === NodeTypes.SKILL);
            setSkills(skillNodes);

            // Pre-calculate levels for all skills
            const levels = {};
            for (const skill of skillNodes) {
                levels[skill.id] = backbone.auraService?.calculateLevel(skill.metadata?.auraTotal || 0) || 1;
            }
            setSkillLevels(levels);
            
            setBalance(currentBalance);
            setGlobalLevel(currentLevel || 1);

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
            } else {
                alert(`Insufficient ${currencyName}`);
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
                        <button
                            className="create-reward-btn"
                            onClick={() => setIsEditModalOpen(true)}
                        >
                            Edit Rewards
                        </button>
                    </div>

                    <div className="hryvnia-card liquid-glass">
                        <NodeIcon iconUrl={SVG_ICONS.COIN} size={24} />
                        <div className="hryvnia-details">
                            <span className="balance-value">{balance}</span>
                            <span className="balance-label">{currencyName}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="marketplace-main">
                <div className="rewards-grid">
                    {marketplaceRewards.map(reward => {
                        const canAfford = balance >= (reward.metadata?.hryvniaCost || 0);
                        const requiredLevel = reward.metadata?.requiredLevel;
                        const requiredSkillId = reward.metadata?.requiredSkillId;
                        
                        let isLocked = false;
                        let requirementLabel = '';

                        if (requiredLevel && requiredSkillId) {
                            const skill = skills.find(s => s.id === requiredSkillId);
                            const currentSkillLevel = skillLevels[requiredSkillId] || 1;
                            isLocked = currentSkillLevel < requiredLevel;
                            requirementLabel = `${skill?.name || 'Skill'} Lvl ${requiredLevel}`;
                        }

                        const isPurchasing = purchaseLoading === reward.id;
                        const tier = reward.metadata?.rewardTier;

                        return (
                            <div key={reward.id} className={`reward-card liquid-glass ${!canAfford ? 'insufficient' : ''} ${isLocked ? 'locked' : ''}`}>
                                {tier && <div className="reward-tier">Tier {tier}</div>}
                                {isLocked && (
                                    <div className="locked-overlay">
                                        <div className="lock-icon">🔒</div>
                                        <div className="lock-requirement">{requirementLabel}</div>
                                    </div>
                                )}
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
                                        className={`buy-button ${!canAfford || isLocked ? 'disabled' : ''}`}
                                        onClick={() => !isLocked && handleBuy(reward.id)}
                                        disabled={!canAfford || isPurchasing || isLocked}
                                    >
                                        {isLocked ? 'Locked' : (isPurchasing ? 'Processing...' : (canAfford ? 'Buy' : `Insufficient ${currencyName}`))}
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
                    <div className="refill-info-wrapper">
                        <span className="refill-info-icon">?</span>
                        <div className="refill-tooltip">
                            <strong>How the Marketplace works</strong>
                            <p>The marketplace displays up to <em>8 randomly selected rewards</em> from your reward bank at a time. This keeps the shop feeling fresh and curated. This format has multiple neurological purposes for ADHD and MDD brains.</p>
                            <p>When you create a new reward it goes into the bank but won't appear until the next refill. Hit <em>Refill Marketplace</em> to shuffle in a new selection — including your latest rewards.</p>
                        </div>
                    </div>
                </div>
            </main>

            <CreateRewardModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => fetchData()}
            />
            <EditRewardsModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => fetchData()}
            />
        </div>
    );
};

export default MarketplacePage;

