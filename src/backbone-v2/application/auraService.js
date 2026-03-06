import { NodeTypes } from '../domain/entities';

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
     * Finds the ancestor Skill for any given node ID.
     */
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
                console.warn(`AuraService: Node ${skillId} is not a valid Skill.`);
                return null;
            }

            const currentAura = skill.metadata?.auraTotal || 0;
            const newAura = currentAura + amount;

            const oldLevel = skill.metadata?.auraLevel || calculateLevel(currentAura);
            const newLevel = calculateLevel(newAura);

            const updates = {
                metadata: {
                    ...skill.metadata,
                    auraTotal: newAura,
                    auraLevel: newLevel
                }
            };

            await hierarchyRepository.update(skillId, updates);

            // Required trace logs
            console.log(`Aura: +${amount} (${reason}) → Skill: ${skill.name}`);

            if (newLevel > oldLevel) {
                console.log(`Aura Level Up → Skill: ${skill.name} → Level ${newLevel}`);
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
