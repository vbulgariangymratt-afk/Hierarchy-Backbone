/**
 * @typedef {Object} HierarchyNode
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} type - Node type (AREA, PROJECT, TASK, etc.)
 * @property {string|null} parentId - ID of the parent node
 * @property {Object} metadata - Additional properties specific to the node type
 * @property {number} createdAt - Timestamp
 * @property {number} updatedAt - Timestamp
 */

export const NodeTypes = {
    LIFE_AREA: 'LIFE_AREA',
    SKILL: 'SKILL',
    OBJECTIVE: 'OBJECTIVE',
    ASPECT: 'ASPECT',
    TASK: 'TASK',
    HABIT: 'HABIT',
    REWARD: 'REWARD',
    REWARD_VAULT: 'REWARD_VAULT',
    SCHEDULED_REST: 'SCHEDULED_REST'
};

export const IdentityTiers = {
    CORE: 'CORE',
    EXPLORATION: 'EXPLORATION',
    OPTIONAL: 'OPTIONAL'
};

export const TaskStatuses = {
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE'
};

export const ObjectiveStatuses = {
    NOT_STARTED: 'NOT_STARTED',
    ACTIVE: 'ACTIVE',
    SLEEPING: 'SLEEPING',
    ROTATING: 'ROTATING',
    ACHIEVED: 'ACHIEVED',
    ARCHIVED: 'ARCHIVED',
    COMPLETED: 'COMPLETED'
};

// AspectStatuses removed as Aspects are non-linear.


/**
 * Defines which node types are allowed to be parents of a given node type.
 * A null value means the node can be a root (no parent).
 */
export const ValidParentMap = {
    [NodeTypes.LIFE_AREA]: [null],
    [NodeTypes.SKILL]: [NodeTypes.LIFE_AREA],
    [NodeTypes.OBJECTIVE]: [NodeTypes.SKILL],
    [NodeTypes.ASPECT]: [NodeTypes.OBJECTIVE],
    [NodeTypes.TASK]: [NodeTypes.ASPECT],
    [NodeTypes.REWARD]: [NodeTypes.REWARD_VAULT],
    [NodeTypes.REWARD_VAULT]: [null, NodeTypes.REWARD_VAULT, 'ROOT'],
    [NodeTypes.SCHEDULED_REST]: ['ROOT']
};



/**
 * Factory function for creating a new hierarchy node
 */
export const createNode = ({ id, name, type, parentId = null, metadata = {} }) => ({
    id: id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name,
    type,
    parentId,
    metadata,
    createdAt: Date.now(),
    updatedAt: Date.now()
});
