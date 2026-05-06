import { NodeTypes } from '../domain/entities';
import { supabase } from '../../lib/supabase';

export const RewardService = (repository) => {

    const awardHryvnia = async (amount, label = "Hryvnia") => {
        const val = Number(amount);
        if (isNaN(val) || val <= 0) return { awarded: 0, before: 0, after: 0 };

        // [CRITICAL SAFETY GUARD]: Always fetch latest balance from Supabase directly to prevent stale master overwrites
        const { data: cloudRoot } = await supabase
            .from('nodes')
            .select('*')
            .eq('id', 'ROOT')
            .single();

        let rootNode = cloudRoot ? {
            id: cloudRoot.id,
            name: cloudRoot.name,
            type: cloudRoot.type,
            parentId: cloudRoot.parent_id,
            metadata: cloudRoot.metadata,
            createdAt: cloudRoot.created_at,
            updatedAt: cloudRoot.updated_at
        } : await repository.getById('ROOT');

        const currentBalance = rootNode?.metadata?.hryvniaBalance || 0;
        const newBalance = currentBalance + val;

        if (rootNode) {
            await repository.update('ROOT', {
                metadata: { ...rootNode.metadata, hryvniaBalance: newBalance }
            });
        } else {
            console.log(`[${label}] ROOT missing during award, creating fresh.`);
            await repository.save({
                id: 'ROOT',
                name: 'System Root',
                type: NodeTypes.LIFE_AREA,
                metadata: {
                    hryvniaBalance: newBalance,
                    dailyCompletions: {},
                    dailyAreaLog: {},
                    activeMarketplace: [],
                    marketplaceLastRefilledAt: 0,
                    lastHryvniaSpendDate: null
                },
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }


        return { awarded: val, before: currentBalance, after: newBalance };
    };

    const ensureRewardVaultSetup = async () => {
        const allNodes = await repository.getAll();

        // 1. Create REWARD_BANK if it doesn't exist
        let bank = await repository.getById('REWARD_BANK');
        if (!bank) {
            await repository.save({
                id: 'REWARD_BANK',
                name: 'Reward Bank',
                type: NodeTypes.REWARD_VAULT,
                parentId: 'ROOT', // Created under ROOT
                metadata: {},
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            console.log("HierarchyService [Setup]: Created REWARD_BANK under ROOT");
        } else {
        }

        // 2. Migrate existing REWARD nodes to REWARD_BANK
        const rewards = allNodes.filter(n => n.type === NodeTypes.REWARD);
        let migratedCount = 0;
        for (const r of rewards) {
            if (r.parentId !== 'REWARD_BANK') {
                await repository.update(r.id, { parentId: 'REWARD_BANK' });
                migratedCount++;
            }
        }

        if (migratedCount > 0) {
            console.log(`HierarchyService [Migration]: Migrated ${migratedCount} rewards to REWARD_BANK`);
        }

        // 3. Remove legacy container nodes
        const legacyIds = ['REWARD_VAULT', 'SMALL_REWARDS', 'MEDIUM_REWARDS', 'LARGE_REWARDS'];
        for (const id of legacyIds) {
            const node = allNodes.find(n => n.id === id);
            if (node) {
                await repository.delete(id);
                console.log(`HierarchyService [Cleanup]: Removed legacy container ${id}`);
            }
        }


        // 4. Reward Categorization Migration
        const rootNode = await repository.getById('ROOT');
        const activeMarketplace = rootNode?.metadata?.activeMarketplace || [];
        const taskRewardIds = new Set(allNodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.rewardId).map(n => n.metadata.rewardId));

        for (const r of rewards) {
            const inMarketplace = activeMarketplace.some(item => (item.rewardId || item) === r.id);
            const inTasks = taskRewardIds.has(r.id);

            if (inMarketplace && inTasks) {
                console.error(`AMBIGUITY DETECTED: Reward ${r.id} (${r.name}) is both in Marketplace and Task-linked. Safety override applied.`);
                // We'll prioritize TASK category as it's more specific, or just skip categorization for now
            }

            let category = r.metadata?.rewardCategory;
            if (!category) {
                if (inMarketplace) {
                    category = 'MARKETPLACE';
                } else if (inTasks) {
                    category = 'TASK';
                }
            }

            if (category && r.metadata?.rewardCategory !== category) {
                await repository.update(r.id, {
                    metadata: { ...r.metadata, rewardCategory: category }
                });
                console.log(`Assigned rewardCategory: ${category} to reward ${r.id} (${r.name})`);
            } else if (!category) {
                console.log(`LOG: Ambiguity - Reward ${r.id} (${r.name}) has no usage and no explicit category. Skipping assignment.`);
            }
        }
    };

    const refillMarketplace = async () => {
        const allNodes = await repository.getAll();
        const rootNode = await repository.getById('ROOT');
        const unlockedTier = rootNode?.metadata?.unlockedRewardTier || 1;

        const bankRewards = allNodes.filter(n =>
            n.type === NodeTypes.REWARD &&
            n.parentId === 'REWARD_BANK' &&
            n.metadata?.rewardCategory === 'MARKETPLACE' &&
            (n.metadata?.rewardTier || 1) <= unlockedTier
        );

        // Shuffle and pick up to 8 unique items
        const shuffled = [...bankRewards].sort(() => 0.5 - Math.random());
        const selectedItems = shuffled.slice(0, 8).map(r => ({
            rewardId: r.id,
            addedAt: Date.now()
        }));

        if (rootNode) {
            await repository.update('ROOT', {
                metadata: {
                    ...rootNode.metadata,
                    activeMarketplace: selectedItems,
                    marketplaceLastRefilledAt: Date.now()
                }
            });
        }
    };

    const initializeMarketplace = async () => {
        let rootNode = await repository.getById('ROOT');
        if (!rootNode) return;

        let metadata = rootNode.metadata || {};
        let marketplace = metadata.activeMarketplace || [];

        // Migration: string[] -> {rewardId, addedAt}[]
        if (marketplace.length > 0 && typeof marketplace[0] === 'string') {
            console.log("HierarchyService [Migration]: Migrating activeMarketplace to new structure");
            marketplace = marketplace.map(id => ({ rewardId: id, addedAt: Date.now() }));
            metadata.activeMarketplace = marketplace;
            await repository.update('ROOT', { metadata });
            rootNode = await repository.getById('ROOT');
        }

        // Ensure all new metadata fields exist
        if (metadata.activeMarketplace === undefined ||
            metadata.marketplaceLastRefilledAt === undefined ||
            metadata.lastHryvniaSpendDate === undefined ||
            metadata.unlockedRewardTier === undefined) {

            rootNode = await repository.update('ROOT', {
                metadata: {
                    ...metadata,
                    activeMarketplace: metadata.activeMarketplace || [],
                    marketplaceLastRefilledAt: metadata.marketplaceLastRefilledAt || 0,
                    lastHryvniaSpendDate: metadata.lastHryvniaSpendDate !== undefined ? metadata.lastHryvniaSpendDate : null,
                    unlockedRewardTier: metadata.unlockedRewardTier || 1
                }
            });
        }

        if (rootNode.metadata.activeMarketplace.length < 8) {
            await refillMarketplace();
        }
    };

    return {
        awardHryvnia,
        ensureRewardVaultSetup,
        refillMarketplace,
        initializeMarketplace,

        redeemReward: async (rewardId) => {
            console.log("REDEEM ATTEMPT:", rewardId);
            const reward = await repository.getById(rewardId);
            if (!reward || reward.type !== NodeTypes.REWARD) throw new Error("Reward not found");

            if (reward.metadata?.rewardCategory !== 'MARKETPLACE') {
                throw new Error(`Safeguard: Reward "${reward.name}" is not a MARKETPLACE reward and cannot be redeemed for Hryvnia.`);
            }

            const cost = reward.metadata?.hryvniaCost || 0;
            let rootNode = await repository.getById('ROOT');
            const currentBalance = rootNode?.metadata?.hryvniaBalance || 0;
            console.log("Current balance:", rootNode?.metadata?.hryvniaBalance);
            console.log("Reward cost:", reward.metadata?.hryvniaCost);

            if (currentBalance >= cost) {
                const newBalance = currentBalance - cost;
                await repository.update('ROOT', {
                    metadata: {
                        ...rootNode.metadata,
                        hryvniaBalance: newBalance,
                        lastHryvniaSpendDate: Date.now()
                    }
                });

                console.log(`[Reward Redeemed] -${cost} Hryvnia: ${reward.name}`);
                console.log(`Remaining balance: ${newBalance}`);

                await repository.update(rewardId, {
                    metadata: { ...reward.metadata, lastRedeemedAt: Date.now() }
                });
                return true;
            } else {
                console.log("Not enough Hryvnia");
                return false;
            }
        },

        claimMicroReward: async (taskId) => {
            const task = await repository.getById(taskId);
            if (!task) throw new Error("Task not found");

            if (task.metadata?.rewardId) {
                const reward = await repository.getById(task.metadata.rewardId);
                if (reward && reward.metadata?.rewardCategory !== 'TASK') {
                    throw new Error(`Safeguard: Reward "${reward.name}" linked to task "${task.name}" is not a TASK reward.`);
                }
            }

            await repository.update(taskId, {
                metadata: { ...task.metadata, lastMicroRewardClaimedAt: Date.now() }
            });
            return true;
        },

        rotateMarketplace: async (count = 2) => {
            const rootNode = await repository.getById('ROOT');
            if (!rootNode) return;

            let marketplace = [...(rootNode.metadata?.activeMarketplace || [])];
            // Sort by addedAt ascending (oldest first)
            marketplace.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

            // Remove oldest
            const removed = marketplace.splice(0, count);
            const currentIds = marketplace.map(m => m.rewardId);

            // Select new ones
            const allNodes = await repository.getAll();
            const unlockedTier = rootNode?.metadata?.unlockedRewardTier || 1;
            const availableRewards = allNodes.filter(n =>
                n.type === NodeTypes.REWARD &&
                n.parentId === 'REWARD_BANK' &&
                n.metadata?.rewardCategory === 'MARKETPLACE' &&
                (n.metadata?.rewardTier || 1) <= unlockedTier &&
                !currentIds.includes(n.id)
            );

            const shuffled = availableRewards.sort(() => 0.5 - Math.random());
            const newSelections = shuffled.slice(0, count).map(r => ({
                rewardId: r.id,
                addedAt: Date.now()
            }));

            // Combine and update
            const updatedMarketplace = [...marketplace, ...newSelections];

            await repository.update('ROOT', {
                metadata: {
                    ...rootNode.metadata,
                    activeMarketplace: updatedMarketplace
                }
            });

            console.log(`Marketplace rotated: removed ${removed.length}, added ${newSelections.length}`);
        },

        checkNoveltyDecay: async () => {
            const rootNode = await repository.getById('ROOT');
            const lastSpend = rootNode?.metadata?.lastHryvniaSpendDate;
            if (!lastSpend) return false;

            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            return (Date.now() - lastSpend) > sevenDaysMs;
        },

        getHryvniaBalance: async () => {
            const rootNode = await repository.getById('ROOT');
            return rootNode?.metadata?.hryvniaBalance || 0;
        }
    };
};
