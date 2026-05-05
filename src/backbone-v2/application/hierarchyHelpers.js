import { ValidParentMap, NodeTypes, ObjectiveStatuses } from '../domain/entities';

const LOCK_THRESHOLD_DAYS = 7;

export const validateRelation = async (repository, type, parentId) => {
    const allowedParents = ValidParentMap[type];

    if (!allowedParents) {
        throw new Error(`Unknown node type: ${type}`);
    }

    // Normalize parentId to null if it's essentially empty
    const normalizedParentId = parentId === 'null' || parentId === undefined ? null : parentId;

    if (normalizedParentId === null) {
        if (!allowedParents.includes(null)) {
            throw new Error(`${type} must have a parent.`);
        }
        return;
    }

    const parent = await repository.getById(normalizedParentId);
    if (!parent) {
        const allNodes = await repository.getAll();
        const allIds = allNodes.map(n => n.id);
        console.error(`HierarchyService [Parent Not Found]: Looking for ${normalizedParentId}. Existing IDs in repo:`, allIds);
        throw new Error(`Parent node with ID ${normalizedParentId} not found. (Current Repo Size: ${allIds.length})`);
    }

    if (!allowedParents.includes(parent.type) && !allowedParents.includes(parent.id)) {
        throw new Error(`Node of type ${type} cannot be a child of ${parent.id} [${parent.type}]. Allowed parents: ${allowedParents.join(', ')}`);
    }
};

export const isLocked = async (repository, nodeId, visited = new Set()) => {
    if (!nodeId || visited.has(nodeId)) return false;
    const node = await repository.getById(nodeId);
    if (!node) return false;

    visited.add(nodeId);

    // 1. Direct lock check (Manual Overrides)
    if (node.metadata?.locked) return true;

    // 2. Sequential Unlocking (Removed)
    // System has shifted from linear completion model to parallel engagement model.
    // Tasks are no longer blocked by their order index relative to incomplete siblings.

    // 3. Recursive parent check (Objective lock, area lock, etc.)
    if (node.parentId) {
        return await isLocked(repository, node.parentId, visited);
    }

    return false;
};

export const checkAutoLock = (node) => {
    if (node.type === NodeTypes.OBJECTIVE &&
        node.metadata?.status === ObjectiveStatuses.ACHIEVED &&
        node.metadata?.achievedAt &&
        !node.metadata?.locked) {

        const daysSinceAchieved = (Date.now() - node.metadata.achievedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceAchieved >= LOCK_THRESHOLD_DAYS) {
            return {
                ...node,
                metadata: { ...node.metadata, locked: true },
                updatedAt: Date.now()
            };
        }
    }
    return node;
};

export const findSkillAncestor = async (repository, id) => {
    const node = await repository.getById(id);
    if (!node) return null;
    if (node.type === NodeTypes.SKILL) return node;
    if (!node.parentId) return null;
    return await findSkillAncestor(repository, node.parentId);
};

export const findObjectiveAncestor = async (repository, id) => {
    const node = await repository.getById(id);
    if (!node) return null;
    if (node.type === NodeTypes.OBJECTIVE) return node;
    if (!node.parentId) return null;
    return await findObjectiveAncestor(repository, node.parentId);
};

export const findAspectAncestor = async (repository, id) => {
    const node = await repository.getById(id);
    if (!node) return null;
    if (node.type === NodeTypes.ASPECT) return node;
    if (!node.parentId) return null;
    return await findAspectAncestor(repository, node.parentId);
};

export const recalculateObjectiveAccumulation = async (repository, objectiveId) => {
    if (!objectiveId) return;
    const objective = await repository.getById(objectiveId);
    if (!objective || objective.type !== NodeTypes.OBJECTIVE) return;

    const allNodes = await repository.getAll();
    const aspects = allNodes.filter(n => n.parentId === objectiveId && n.type === NodeTypes.ASPECT);

    const totalMetric = aspects.reduce((sum, aspect) => sum + (aspect.metadata?.accumulatedMetric || 0), 0);

    await repository.update(objectiveId, {
        metadata: {
            ...objective.metadata,
            masterAccumulatedMetric: totalMetric
        }
    });
};

export function buildTree(nodes, parentId = null, visited = new Set()) {
    // If parentId is undefined, treat it as null to match root nodes, 
    // BUT only if this is the top-level call. 
    // Actually, it's safer to always use null for roots and ensure IDs exist.
    const targetParentId = parentId === undefined ? null : parentId;

    return nodes
        .filter(node => (node.parentId ?? null) === targetParentId)
        .map(node => {
            // Safety: If node has no ID, it cannot have children
            if (!node.id) {
                console.warn(`[Backbone] Found node without ID during tree build: ${node.name}. Skipping children.`);
                return { ...node, children: [] };
            }

            // Self-reference or circular reference protection
            if (node.id === (node.parentId ?? null) || visited.has(node.id)) {
                console.warn(`[Backbone] Circular or self-referential path detected at node: ${node.id}. breaking recursion.`);
                return { ...node, children: [] };
            }

            const nextVisited = new Set(visited);
            nextVisited.add(node.id);

            return {
                ...node,
                children: buildTree(nodes, node.id, nextVisited)
            };
        });
}
