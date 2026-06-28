import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { backbone, repository, NodeTypes } from '../backbone-v2/index';
import CreateRewardModal from '../components/CreateRewardModal';
import EditRewardsModal from '../components/EditRewardsModal';
import NodeIcon from '../components/NodeIcon';
import './MarketplacePage.css';
import { Coins, Pencil, Layers, Trash2, Star, Zap, Shield, Trophy, Image, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import SegmentedControl from '../components/ui/SegmentedControl';
import { BlurReveal } from '../components/ui/BlurReveal';

const SVG_ICONS = {
    COIN: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8'/%3E%3Cpath d='M12 18V6'/%3E%3C/svg%3E",
    REFILL: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/%3E%3Cpath d='M21 3v5h-5'/%3E%3Cpath d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/%3E%3Cpath d='M3 21v-5h5'/%3E%3C/svg%3E",
    PLUS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='12' y1='5' x2='12' y2='19'/%3E%3Cline x1='5' y1='12' x2='19' y2='12'/%3E%3C/svg%3E",
    BANKNOTE: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='20' height='12' x='2' y='6' rx='2'/%3E%3Cpath d='M6 12h.01M18 12h.01'/%3E%3C/svg%3E"
};

const TIERS = [
    { id: 'tier1', title: 'Micro-Resets',    icon: Zap },
    { id: 'tier2', title: 'Mid-Resets',      icon: Shield },
    { id: 'tier3', title: 'Epic Milestones', icon: Trophy },
];

const gridContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    },
    exit: {
        opacity: 0,
        transition: {
            staggerChildren: 0.03,
            staggerDirection: -1,
            duration: 0.15
        }
    }
};

const cardVariants = {
    hidden: { 
        opacity: 0, 
        y: 20, 
        scale: 0.95 
    },
    visible: { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 260,
            damping: 22
        }
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: -10,
        transition: {
            duration: 0.15
        }
    }
};

const MarketplacePage = () => {
    const [balance, setBalance] = useState(0);
    const [marketplaceRewards, setMarketplaceRewards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchaseLoading, setPurchaseLoading] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedRewardForEdit, setSelectedRewardForEdit] = useState(null);
    const [editFocusField, setEditFocusField] = useState('all'); // 'name' | 'price' | 'tier' | 'all'
    
    // Inline editing states
    const [editingRewardId, setEditingRewardId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        sensoryDescription: '',
        hryvniaCost: 10,
        rewardTier: 1,
        coverUrl: ''
    });

    // Refs for auto-focusing inline fields
    const inlineNameRef = useRef(null);
    const inlineDescRef = useRef(null);
    const inlinePriceRef = useRef(null);
    const inlineTierRef = useRef(null);
    const inlineCoverRef = useRef(null);

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, reward: null });
    const [selectedTierGroup, setSelectedTierGroup] = useState('tier1');
    const [globalLevel, setGlobalLevel] = useState(1);
    const [skillLevels, setSkillLevels] = useState({});
    const [skills, setSkills] = useState([]);
    const [isRefilling, setIsRefilling] = useState(false);
    const { currencyName } = useSettings();
    const { backgroundMode } = useTheme();

    const handleContextMenu = (e, reward) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            reward
        });
    };

    useEffect(() => {
        const closeMenu = () => setContextMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

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

    const handleDeleteReward = async (rewardId) => {
        try {
            await repository.delete(rewardId);
            fetchData();
        } catch (err) {
            console.error("Failed to delete reward:", err);
        }
    };

    const handleRefill = async () => {
        if (isRefilling) return;
        setIsRefilling(true);
        try {
            await backbone.refillMarketplace();
            // Data will update via subscription
        } catch (error) {
            console.error("Refill failed:", error);
            alert(error.message);
        } finally {
            setTimeout(() => {
                setIsRefilling(false);
            }, 600);
        }
    };

    const startInlineEdit = (reward, focusField) => {
        setEditingRewardId(reward.id);
        setEditForm({
            name: reward.name || '',
            sensoryDescription: reward.metadata?.sensoryDescription || '',
            hryvniaCost: reward.metadata?.hryvniaCost || 10,
            rewardTier: reward.metadata?.rewardTier || 1,
            coverUrl: reward.metadata?.coverUrl || reward.metadata?.iconUrl || ''
        });
        
        setTimeout(() => {
            if (focusField === 'name' && inlineNameRef.current) {
                inlineNameRef.current.focus();
                inlineNameRef.current.select();
            } else if (focusField === 'price' && inlinePriceRef.current) {
                inlinePriceRef.current.focus();
                inlinePriceRef.current.select();
            } else if (focusField === 'tier' && inlineTierRef.current) {
                inlineTierRef.current.focus();
            } else if (focusField === 'cover' && inlineCoverRef.current) {
                inlineCoverRef.current.focus();
                inlineCoverRef.current.select();
            }
        }, 80);
    };

    const handleSaveInlineEdit = async (rewardId) => {
        if (!editForm.name.trim()) return;
        try {
            await repository.update(rewardId, {
                name: editForm.name.trim(),
                metadata: {
                    ...(marketplaceRewards.find(r => r.id === rewardId)?.metadata || {}),
                    sensoryDescription: editForm.sensoryDescription.trim(),
                    hryvniaCost: Number(editForm.hryvniaCost),
                    rewardTier: Number(editForm.rewardTier),
                    coverUrl: editForm.coverUrl.trim() || null
                }
            });
            setEditingRewardId(null);
            fetchData();
        } catch (err) {
            console.error('Failed to update reward inline:', err);
            alert('Failed to update reward: ' + err.message);
        }
    };

    const handleCancelInlineEdit = () => {
        setEditingRewardId(null);
    };

    if (loading) {
        return (
            <div className="marketplace-loading">
                <div className="loading-spinner"></div>
                <span>Loading your marketplace...</span>
            </div>
        );
    }

    const filteredRewards = marketplaceRewards.filter(reward => {
        const t = reward.metadata?.rewardTier || 1;
        if (selectedTierGroup === 'tier1') return t === 1;
        if (selectedTierGroup === 'tier2') return t === 2;
        if (selectedTierGroup === 'tier3') return t === 3;
        return true;
    });

    const gridAnimationKey = `${selectedTierGroup}-${filteredRewards.map(r => r.id).join(',')}`;

    return (
        <div className="marketplace-page">
            <header className="marketplace-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1>Marketplace</h1>
                        <button
                            className="btn btn-primary"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            Create Reward
                        </button>

                        <SegmentedControl
                                options={TIERS}
                                value={selectedTierGroup}
                                onChange={setSelectedTierGroup}
                                layoutPrefix="tier"
                                buttonSize={38}
                                fontSize="0.9rem"
                                activePadding="0 18px"
                            />

                        <BlurReveal speedReveal={2} className="tier-legend-text">
                            {selectedTierGroup === 'tier1' ? "Quick 5 minute reward to rest from a heavy task" :
                             selectedTierGroup === 'tier2' ? "Medium rewards, deserved after a long day of work" :
                             selectedTierGroup === 'tier3' ? "Big rewards, to celebrate your milestones and goals" : ""}
                        </BlurReveal>
                    </div>

                    <div className="hryvnia-card liquid-glass">
                        <Coins size={16} style={{ color: 'var(--color-accent)' }} />
                        <div className="hryvnia-details">
                            <span className="balance-value">{balance}</span>
                            <span className="balance-label">{currencyName}</span>
                        </div>
                    </div>
                </div>
            </header>

             <main className="marketplace-main">

                <AnimatePresence mode="wait">
                    <motion.div 
                        key={gridAnimationKey}
                        variants={gridContainerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="rewards-grid"
                    >
                        {filteredRewards.map(reward => {
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
                            const coverImage = reward.metadata?.coverUrl || reward.metadata?.iconUrl;
                            const isEditing = editingRewardId === reward.id;

                            const hoverAnimation = isLocked || isEditing ? {} : { y: tier === 1 ? -2 : tier === 3 ? -4 : -6 };

                            return (
                                 <motion.div 
                                     key={reward.id} 
                                     variants={cardVariants}
                                     whileHover={hoverAnimation}
                                     className={`reward-card liquid-glass tier-${tier || 1}-card ${coverImage ? 'has-cover-wallpaper' : ''} ${!canAfford ? 'insufficient' : ''} ${isLocked ? 'locked' : ''} ${isEditing ? 'editing' : ''}`}
                                     onContextMenu={(e) => !isEditing && handleContextMenu(e, reward)}
                                 >
                                 {coverImage && (
                                     <div 
                                         className="card-background-image" 
                                         style={{ backgroundImage: `url(${coverImage})` }} 
                                     />
                                 )}
                                 {coverImage && <div className="card-cover-overlay" />}
                                 <div className="card-shine" />
                                 <div className="card-glow" />
                                 {isLocked && (
                                     <div className="locked-overlay">
                                         <div className="lock-icon">🔒</div>
                                         <div className="lock-requirement">{requirementLabel}</div>
                                     </div>
                                 )}
                                 
                                 {isEditing ? (
                                     <div className="reward-content inline-edit-form">
                                         <div className="inline-edit-row">
                                             <input
                                                 ref={inlineNameRef}
                                                 type="text"
                                                 className="inline-edit-input inline-edit-name"
                                                 value={editForm.name}
                                                 onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                 placeholder="Reward Name"
                                                 required
                                                 onKeyDown={e => {
                                                     if (e.key === 'Enter') handleSaveInlineEdit(reward.id);
                                                     if (e.key === 'Escape') handleCancelInlineEdit();
                                                 }}
                                             />
                                         </div>
                                         <div className="inline-edit-row">
                                             <textarea
                                                 ref={inlineDescRef}
                                                 className="inline-edit-textarea inline-edit-description"
                                                 value={editForm.sensoryDescription}
                                                 onChange={e => setEditForm({ ...editForm, sensoryDescription: e.target.value })}
                                                 placeholder="ADHD-safe description"
                                                 rows={2}
                                                 onKeyDown={e => {
                                                     if (e.key === 'Escape') handleCancelInlineEdit();
                                                 }}
                                             />
                                         </div>
                                         <div className="inline-edit-row">
                                             <input
                                                 ref={inlineCoverRef}
                                                 type="text"
                                                 className="inline-edit-input inline-edit-cover"
                                                 value={editForm.coverUrl}
                                                 onChange={e => setEditForm({ ...editForm, coverUrl: e.target.value })}
                                                 placeholder="Cover image URL"
                                                 onKeyDown={e => {
                                                     if (e.key === 'Enter') handleSaveInlineEdit(reward.id);
                                                     if (e.key === 'Escape') handleCancelInlineEdit();
                                                 }}
                                             />
                                         </div>
                                         <div className="inline-edit-row">
                                             <select
                                                 ref={inlineTierRef}
                                                 className="inline-edit-select inline-edit-tier"
                                                 value={editForm.rewardTier}
                                                 onChange={e => setEditForm({ ...editForm, rewardTier: Number(e.target.value) })}
                                                 onKeyDown={e => {
                                                     if (e.key === 'Escape') handleCancelInlineEdit();
                                                 }}
                                             >
                                                 <option value={1}>Tier 1 (Micro-Resets)</option>
                                                 <option value={2}>Tier 2 (Mid-Resets)</option>
                                                 <option value={3}>Tier 3 (Epic Milestones)</option>
                                             </select>
                                         </div>
                                     </div>
                                 ) : (
                                     <div className="reward-content">
                                         <h3 className="reward-name">{reward.name}</h3>
                                         <p className="reward-description">
                                             {reward.metadata?.sensoryDescription || "No description available."}
                                         </p>
                                     </div>
                                 )}

                                 <div className="reward-footer">
                                     {isEditing ? (
                                         <>
                                             <div className="reward-cost editing-cost">
                                                 <Coins size={14} style={{ color: 'var(--color-accent)' }} />
                                                 <input
                                                     ref={inlinePriceRef}
                                                     type="number"
                                                     className="inline-edit-input inline-edit-cost-input"
                                                     value={editForm.hryvniaCost}
                                                     onChange={e => setEditForm({ ...editForm, hryvniaCost: e.target.value })}
                                                     min="0"
                                                     onKeyDown={e => {
                                                         if (e.key === 'Enter') handleSaveInlineEdit(reward.id);
                                                         if (e.key === 'Escape') handleCancelInlineEdit();
                                                     }}
                                                 />
                                             </div>
                                             <div className="inline-edit-actions">
                                                 <button 
                                                     className="btn btn-secondary inline-cancel-btn"
                                                     onClick={handleCancelInlineEdit}
                                                 >
                                                     Cancel
                                                 </button>
                                                 <button 
                                                     className="btn btn-primary inline-save-btn"
                                                     onClick={() => handleSaveInlineEdit(reward.id)}
                                                     disabled={!editForm.name.trim()}
                                                 >
                                                     Save
                                                 </button>
                                             </div>
                                         </>
                                     ) : (
                                         <>
                                             <div className="reward-cost">
                                                 <Coins size={14} style={{ color: 'var(--color-accent)' }} />
                                                 <span className="cost-value">{reward.metadata?.hryvniaCost || 0}</span>
                                             </div>
                                             <button
                                                 className={`btn btn-secondary buy-btn-full ${!canAfford || isLocked ? 'disabled' : ''}`}
                                                 onClick={() => !isLocked && handleBuy(reward.id)}
                                                 disabled={!canAfford || isPurchasing || isLocked}
                                             >
                                                 <span>
                                                     {isLocked ? 'Locked' : (isPurchasing ? 'Processing...' : (canAfford ? 'Buy' : `Insufficient ${currencyName}`))}
                                                 </span>
                                             </button>
                                         </>
                                     )}
                                 </div>
                             </motion.div>
                        );
                    })}
                    </motion.div>
                </AnimatePresence>

                <div className="marketplace-footer">
                    <button className={`refill-button ${isRefilling ? 'is-refilling' : ''}`} onClick={handleRefill}>
                        <NodeIcon iconUrl={SVG_ICONS.REFILL} size={16} />
                        Refill Marketplace
                    </button>
                    <div className="refill-info-wrapper">
                        <span className="refill-info-icon">?</span>
                        <div className="refill-tooltip">
                            <strong>How it works:</strong>
                            <p>We only show <em>8 rewards</em> so you don't get desensitized to them.</p>
                            <p>Refill the marketplace to see new ones.</p>
                            <p>This is better for ADHD + MDD brains, trust me bro.</p>
                        </div>
                    </div>
                </div>
            </main>

            <CreateRewardModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => fetchData()}
                defaultTier={
                    selectedTierGroup === 'tier1' ? 1 :
                    selectedTierGroup === 'tier2' ? 2 :
                    selectedTierGroup === 'tier3' ? 3 : 1
                }
            />


            <AnimatePresence>
                {contextMenu.visible && (
                    <motion.div 
                        className="marketplace-context-menu submenu-mockup"
                        style={{ 
                            position: 'fixed', 
                            top: contextMenu.y, 
                            left: contextMenu.x, 
                            zIndex: 100000 
                        }}
                        initial={{ opacity: 0, rotate: -3, scale: 0.95, transformOrigin: 'top left' }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: -3, scale: 0.95, transition: { duration: 0.15, ease: 'easeIn' } }}
                        transition={{ type: 'spring', stiffness: 700, damping: 20 }}
                        onClick={e => e.stopPropagation()}
                    >
                         <div className="submenu-item" onClick={() => {
                             startInlineEdit(contextMenu.reward, 'name');
                             setContextMenu({ ...contextMenu, visible: false });
                         }}>
                             <Pencil size={14} className="lucide" />
                             Rename
                         </div>
                         <div className="submenu-item" onClick={() => {
                             startInlineEdit(contextMenu.reward, 'price');
                             setContextMenu({ ...contextMenu, visible: false });
                         }}>
                             <Coins size={14} className="lucide" />
                             Edit price
                         </div>
                         <div className="submenu-item" onClick={() => {
                             startInlineEdit(contextMenu.reward, 'tier');
                             setContextMenu({ ...contextMenu, visible: false });
                         }}>
                             <Layers size={14} className="lucide" />
                             Edit tier
                         </div>
                         <div className="submenu-item" onClick={() => {
                             startInlineEdit(contextMenu.reward, 'cover');
                             setContextMenu({ ...contextMenu, visible: false });
                         }}>
                             <Image size={14} className="lucide" />
                             Add cover
                         </div>
                        <div className="submenu-item danger" onClick={() => {
                            handleDeleteReward(contextMenu.reward.id);
                            setContextMenu({ ...contextMenu, visible: false });
                        }}>
                            <Trash2 size={14} className="lucide" />
                            Delete reward
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MarketplacePage;

