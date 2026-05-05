import { NodeTypes, ObjectiveStatuses } from '../domain/entities';
import { supabase } from '../../lib/supabase';
import { checkAutoLock } from './hierarchyHelpers';

export const LifecycleService = (repository, deps = {}) => {
    const {
        ensureRewardVaultSetup,
        initializeMarketplace,
        createDailyRestSuggestion,
        checkDailyReset
    } = deps;

    const checkExpirations = async () => {
        // Disabled auto-archiving as per Step 2 of the new Expiry Flow.
        // We now handle this via UI prompts in SkillPage.jsx.
        console.log("[Lifecycle] Expiration check skipped (Handled by UI)");
    };

    const completeObjective = async (objectiveId) => {
        const obj = await repository.getById(objectiveId);
        if (!obj) return null;
        return await repository.update(objectiveId, {
            metadata: {
                ...obj.metadata,
                status: ObjectiveStatuses.COMPLETED,
                isActive: false,
                completedAt: Date.now()
            }
        });
    };

    const extendObjective = async (objectiveId, extraDays = 7) => {
        const obj = await repository.getById(objectiveId);
        if (!obj) return null;
        const currentDays = obj.metadata?.durationInDays || 14;
        return await repository.update(objectiveId, {
            metadata: {
                ...obj.metadata,
                durationInDays: currentDays + extraDays
            }
        });
    };

    const resumeCooldownEarly = async (skillId) => {
        const skill = await repository.getById(skillId);
        if (!skill || skill.type !== NodeTypes.SKILL) throw new Error("Invalid Skill");

        const allNodes = await repository.getAll();
        const activeSkillsCount = allNodes.filter(n => n.type === NodeTypes.SKILL && n.metadata?.isActive).length;

        if (activeSkillsCount >= 4) {
            console.log("ACTIVE LIMIT BLOCKED: 4 skills already active");
            throw new Error("ACTIVE_LIMIT_REACHED");
        }

        console.log(`Cooldown Broken Early → ${skill.name}`);

        return await repository.update(skillId, {
            metadata: {
                ...skill.metadata,
                cooldownActive: false,
                cooldownStart: null,
                cooldownEnd: null,
                isActive: true,
                activatedAt: Date.now()
            },
            updatedAt: Date.now()
        });
    };

    const startManualCooldown = async (skillId) => {
        const skill = await repository.getById(skillId);
        if (!skill || skill.type !== NodeTypes.SKILL) throw new Error("Invalid Skill");

        console.log("Manual Cooldown Activated →", skill.name);

        return await repository.update(skillId, {
            metadata: {
                ...skill.metadata,
                cooldownActive: true,
                cooldownStart: Date.now(),
                cooldownEnd: Date.now() + (5 * 24 * 60 * 60 * 1000),
                isActive: false,
                fatigueSuggested: false
            },
            updatedAt: Date.now()
        });
    };

    const sleepSkill = async (skillId, days = null) => {
        const skill = await repository.getById(skillId);
        if (!skill || skill.type !== NodeTypes.SKILL) throw new Error("Invalid Skill");

        const metadata = { ...(skill.metadata || {}) };
        
        if (days) {
            const sleepUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
            metadata.sleepUntil = sleepUntil;
            metadata.isSleeping = false; 
        } else {
            // Indefinite sleep
            metadata.isSleeping = true;
            metadata.sleepUntil = null;
        }

        // Sync fallback status fields if needed for other parts of the app
        metadata.status = 'SLEEPING';
        metadata.isActive = false;

        console.log(`HierarchyService: Skill ${skill.name} put to sleep. Indefinite: ${!days}, Until: ${metadata.sleepUntil}`);

        // Update skill
        await repository.update(skillId, {
            metadata,
            updatedAt: Date.now()
        });

        // Cascade to objectives
        const allNodes = await repository.getAll();
        const childObjectives = allNodes.filter(n => n.parentId === skillId && n.type === NodeTypes.OBJECTIVE);
        
        for (const obj of childObjectives) {
            await repository.update(obj.id, {
                metadata: {
                    ...(obj.metadata || {}),
                    status: 'SLEEPING',
                    isActive: false,
                    deactivatedAt: Date.now()
                },
                updatedAt: Date.now()
            });
        }

        return true;
    };

    const wakeSkill = async (skillId) => {
        const skill = await repository.getById(skillId);
        if (!skill || skill.type !== NodeTypes.SKILL) throw new Error("Invalid Skill");

        console.log(`HierarchyService: Waking up skill ${skill.name}`);

        await repository.update(skillId, {
            metadata: {
                ...skill.metadata,
                isSleeping: false,
                sleepUntil: null,
                status: 'ACTIVE',
                isActive: true
            },
            updatedAt: Date.now()
        });

        // Cascade wake to objectives? 
        // Most systems only wake on manual interaction, but let's keep it simple for now and just wake the skill.
        // Requirement 7 says "Wake Up button that clears sleep state", nothing about objectives, 
        // but for balance we might want to wake objectives as ACTIVE if they were not achieved.
        
        const allNodes = await repository.getAll();
        const childObjectives = allNodes.filter(n => n.parentId === skillId && n.type === NodeTypes.OBJECTIVE);
        
        for (const obj of childObjectives) {
            if (obj.metadata?.status === 'SLEEPING') {
                await repository.update(obj.id, {
                    metadata: {
                        ...(obj.metadata || {}),
                        status: 'ACTIVE',
                        isActive: true
                    },
                    updatedAt: Date.now()
                });
            }
        }

        return true;
    };

    const initialize = async () => {
        if (repository.initialize) {
            await repository.initialize();

            // 1. Structural Safeguard: Ensure ROOT exists
            let rootNode = await repository.getById('ROOT');
            if (!rootNode) {
                // [GUARD 1]: Check if user is authenticated before creating nodes or resetting balance
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    console.warn("HierarchyService: No user authenticated. Aborting ROOT initialization to prevent balance reset.");
                    return; // Early return: wait for reloadAllData() post-login
                }

                // [CRITICAL SAFETY GUARD]: Before creating a new ROOT, verify it doesn't exist in Supabase
                const { data: existingRoot, error } = await supabase
                    .from('nodes')
                    .select('*')
                    .eq('id', 'ROOT')
                    .single();

                if (existingRoot) {
                    console.log("HierarchyService [Setup]: ROOT restored from cloud.");
                    await repository.save({
                        id: existingRoot.id,
                        name: existingRoot.name,
                        type: existingRoot.type,
                        parentId: existingRoot.parent_id,
                        metadata: existingRoot.metadata,
                        createdAt: existingRoot.created_at,
                        updatedAt: existingRoot.updated_at
                    });
                } else if (!error || error.code === 'PGRST116') { // PGRST116 = No Rows Found
                    // [GUARD 2]: Only initialize fresh ROOT if cloud definitely lacks it
                    console.log("HierarchyService [Setup]: ROOT genuinely missing, initializing fresh.");
                    await repository.save({
                        id: 'ROOT',
                        name: 'System Root',
                        type: NodeTypes.LIFE_AREA,
                        metadata: {
                            hryvniaBalance: 0,
                            dailyCompletions: {},
                            dailyAreaLog: {},
                            activeMarketplace: [],
                            marketplaceLastRefilledAt: 0,
                            lastHryvniaSpendDate: null,
                            unlockedRewardTier: 1
                        },
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                } else {
                    console.error("HierarchyService: Supabase query failed. Aborting ROOT initialization to prevent balance reset.", error);
                }
                console.log("HierarchyService [Setup]: ROOT node confirmed");
            }

            // 2. Structural Safeguard: Ensure REWARD_BANK exists
            let bankNode = await repository.getById('REWARD_BANK');
            if (!bankNode) {
                await repository.save({
                    id: 'REWARD_BANK',
                    name: 'Reward Bank',
                    type: NodeTypes.REWARD_VAULT,
                    parentId: 'ROOT',
                    metadata: {},
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
                console.log("HierarchyService [Setup]: REWARD_BANK node confirmed");
            }

            if (ensureRewardVaultSetup) await ensureRewardVaultSetup();
            if (initializeMarketplace) await initializeMarketplace();
            if (createDailyRestSuggestion) await createDailyRestSuggestion();
            await checkExpirations();

            // Run maintenance tasks once during boot
            if (checkDailyReset) await checkDailyReset();

            // Setup daily reset check heartbeat (every 5 minutes for long-running sessions)
            setInterval(() => {
                if (checkDailyReset) checkDailyReset();
            }, 5 * 60 * 1000);

            const allNodes = await repository.getAll();
            for (const node of allNodes) {
                const updated = checkAutoLock(node);
                if (updated !== node) {
                    await repository.update(node.id, updated);
                }
            }
        }
    };

    return {
        initialize,
        checkExpirations,
        completeObjective,
        extendObjective,
        resumeCooldownEarly,
        startManualCooldown,
        sleepSkill,
        wakeSkill
    };
};
