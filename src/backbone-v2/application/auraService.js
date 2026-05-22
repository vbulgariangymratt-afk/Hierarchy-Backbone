import { NodeTypes } from '../domain/entities';
import { supabase } from '../../lib/supabase';

/**
 * Service for managing Skill Aura reinforcement.
 * Handles aura points, level calculations, and trace logging.
 */
export const AuraService = (hierarchyRepository) => {

    /**
     * Formula: auraLevel = floor(auraTotal / 12) + 1
     */
    const calculateLevel = (auraTotal) => Math.floor((auraTotal || 0) / 12) + 1;

    /**
     * Awards Hryvnia to the ROOT node metadata.
     * Logic matches HierarchyService for balance consistency.
     */
    const awardHryvniaBonus = async (amount) => {
        const val = Number(amount);
        if (isNaN(val) || val <= 0) return;

        // Fetch latest balance from cloud to prevent stale overwrites
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
        } : await hierarchyRepository.getById('ROOT');

        if (!rootNode) return;

        const currentBalance = rootNode.metadata?.hryvniaBalance || 0;
        const newBalance = currentBalance + val;

        await hierarchyRepository.update('ROOT', {
            metadata: { ...rootNode.metadata, hryvniaBalance: newBalance }
        });

        console.log(`[Aura Reward] +${val} Hryvnia awarded for Level Up`);
    };

    /**
     * Logs the level up event for historical timeline tracking.
     */
    const logLevelUp = async (skillId, oldLevel, newLevel) => {
        const root = await hierarchyRepository.getById('ROOT');
        if (!root) return;

        const todayStr = new Date().toLocaleDateString('en-CA');
        const dailyLevelUpLog = root.metadata?.dailyLevelUpLog || {};
        const entries = dailyLevelUpLog[todayStr] || [];

        entries.push({
            skillId,
            oldLevel,
            newLevel,
            timestamp: Date.now()
        });

        await hierarchyRepository.update('ROOT', {
            metadata: {
                ...root.metadata,
                dailyLevelUpLog: {
                    ...dailyLevelUpLog,
                    [todayStr]: entries
                }
            }
        });
    };

    const findSkillAncestor = async (nodeId) => {
        const node = await hierarchyRepository.getById(nodeId);
        if (!node) return null;
        if (node.type === NodeTypes.SKILL) return node;
        if (!node.parentId) return null;
        return await findSkillAncestor(node.parentId);
    };

    const service = {
        /**
         * Adds a specified amount of Aura to a skill.
         * Recalculates level and logs the transaction.
         */
        addAura: async (skillId, amount, reason) => {
            const skill = await hierarchyRepository.getById(skillId);
            if (!skill || skill.type !== NodeTypes.SKILL) {
                return null;
            }

            const currentAura = skill.metadata?.auraTotal || 0;
            const newAura = currentAura + amount;

            // Always calculate from auraTotal — never trust stored auraLevel as it may be stale
            const oldLevel = calculateLevel(currentAura);
            const newLevel = calculateLevel(newAura);

            const updates = {
                metadata: {
                    ...skill.metadata,
                    auraTotal: newAura,
                    auraLevel: newLevel
                }
            };

            await hierarchyRepository.update(skillId, updates);

            // Level Up Logic
            if (newLevel > oldLevel) {
                const levelsGained = newLevel - oldLevel;
                const bonus = levelsGained * 20;
                
                await awardHryvniaBonus(bonus);
                await logLevelUp(skillId, oldLevel, newLevel);

                window.dispatchEvent(new CustomEvent('skill-level-up', { 
                    detail: { skillId, newLevel, oldLevel, hryvniaAwarded: bonus } 
                }));
            }

            return { auraTotal: newAura, auraLevel: newLevel };
        },

        /**
         * Convenience method to award aura to the skill ancestor of any node.
         */
        awardAuraToAncestorSkill: async (nodeId, amount, reason) => {
            const skill = await findSkillAncestor(nodeId);
            if (skill) {
                return await service.addAura(skill.id, amount, reason);
            }
            return null;
        },

        getSkillAura: async (skillId) => {
            const skill = await hierarchyRepository.getById(skillId);
            if (!skill) return null;
            return {
                auraTotal: skill.metadata?.auraTotal || 0,
                auraLevel: skill.metadata?.auraLevel || calculateLevel(skill.metadata?.auraTotal || 0)
            };
        },

        getTotalAuraPoints: async () => {
            const allNodes = await hierarchyRepository.getAll();
            return allNodes
                .filter(n => n.type === NodeTypes.SKILL)
                .reduce((sum, skill) => sum + (skill.metadata?.auraTotal || 0), 0);
        },

        calculateLevel
    };

    return service;
};
