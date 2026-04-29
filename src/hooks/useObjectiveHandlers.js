import { useState, useCallback } from 'react';
import { backbone, NodeTypes, ObjectiveStatuses } from '../backbone-v2/index';

/**
 * Custom hook to manage objective-related state and handlers.
 */
export const useObjectiveHandlers = ({
    id,
    objectives,
    allNodes,
    fetchData,
    activeExperimentLimit
}) => {
    // Expansion State
    const [expandedObjectiveIds, setExpandedObjectiveIds] = useState([]);

    const [isCreatingObjective, setIsCreatingObjective] = useState(false);

    // Editing State
    const [editingObjectiveId, setEditingObjectiveId] = useState(null);
    const [objectiveEditForm, setObjectiveEditForm] = useState(null);

    // Deletion State
    const [objectiveToDelete, setObjectiveToDelete] = useState(null);

    // Modal/Pending States
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [isConfirmSleepModalOpen, setIsConfirmSleepModalOpen] = useState(false);
    const [pendingSleepObj, setPendingSleepObj] = useState(null);

    const handleStatusUpdate = useCallback(async (obj, newStatus) => {
        const now = Date.now();
        const metadata = { ...obj.metadata };
        const oldStatus = obj.metadata?.status || (obj.metadata?.isSleeping ? 'SLEEPING' : (obj.metadata?.isArchived ? 'COMPLETED' : 'ACTIVE'));
        
        // Timer Logic: If we were paused/sleeping and are now resuming, shift activatedAt forward
        if (newStatus === 'ACTIVE' && (oldStatus === 'SLEEPING' || oldStatus === 'ROTATING')) {
            if (metadata.deactivatedAt && metadata.activatedAt) {
                const pauseDuration = now - metadata.deactivatedAt;
                metadata.activatedAt = metadata.activatedAt + pauseDuration;
            }
        }

        if (newStatus === 'ACTIVE') {
            const activeInSkill = objectives.filter(o => o.metadata?.isActive === true).length;
            const limit = typeof activeExperimentLimit === 'number' ? activeExperimentLimit : 1;
            if (activeInSkill >= limit && !obj.metadata?.isActive) {
                setIsLimitModalOpen(true);
                return;
            }
            metadata.status = 'ACTIVE';
            metadata.isActive = true;
            metadata.isSleeping = false;
            metadata.isArchived = false;
            if (!metadata.activatedAt) metadata.activatedAt = now;
            metadata.deactivatedAt = null;
        } else if (newStatus === 'SLEEPING') {
            metadata.status = 'SLEEPING';
            metadata.isActive = false;
            metadata.isSleeping = true;
            metadata.isArchived = false;
            metadata.deactivatedAt = now;
        } else if (newStatus === 'COMPLETED') {
            metadata.status = 'COMPLETED';
            metadata.isActive = false;
            metadata.isSleeping = false;
            metadata.isArchived = true;
            metadata.completedAt = now;
            metadata.deactivatedAt = now;
        } else if (newStatus === 'ROTATING') {
            metadata.status = 'ROTATING';
            metadata.isActive = false;
            metadata.isSleeping = false;
            metadata.isArchived = false;
            metadata.deactivatedAt = now;
        }

        try {
            await backbone.updateNode(obj.id, { metadata });
            fetchData();
        } catch (error) {
            console.error("Failed to update objective status:", error);
        }
    }, [objectives, fetchData, activeExperimentLimit]);

    // handleCreateObjective is now managed by ObjectiveCreationForm component

    const handleStartEditObjective = useCallback((obj) => {
        setEditingObjectiveId(obj.id);
        setObjectiveEditForm({
            theme: obj.metadata?.theme || '',
            durationInDays: obj.metadata?.durationInDays ?? '',
            accumulationType: obj.metadata?.accumulationType || 'minutes',
            mve: obj.metadata?.mve || '',
            wish: obj.metadata?.wish || '',
            outcome: obj.metadata?.outcome || '',
            iconUrl: obj.metadata?.iconUrl || ''
        });
    }, []);

    const handleSaveObjectiveEdit = useCallback(async (objId) => {
        if (!objectiveEditForm) return;
        try {
            const sanitizedForm = {
                ...objectiveEditForm,
                durationInDays: (objectiveEditForm.durationInDays === '' || objectiveEditForm.durationInDays === null) 
                    ? null 
                    : parseInt(objectiveEditForm.durationInDays)
            };
            await backbone.updateNode(objId, {
                metadata: {
                    ...allNodes.find(n => n.id === objId)?.metadata,
                    ...sanitizedForm
                }
            });
            setEditingObjectiveId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to save objective edit:", error);
        }
    }, [objectiveEditForm, allNodes, fetchData]);

    const handleDeleteObjective = useCallback((obj) => {
        setObjectiveToDelete(obj);
    }, []);

    const confirmDeleteObjective = useCallback(async () => {
        if (!objectiveToDelete) return;
        const idToDelete = objectiveToDelete.id;
        setObjectiveToDelete(null);
        try {
            await backbone.deleteNode(idToDelete);
            setEditingObjectiveId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to delete objective:", error);
        }
    }, [objectiveToDelete, fetchData]);

    const handleUpdateObjectiveName = useCallback(async (objId, name) => {
        try {
            await backbone.updateNode(objId, { name });
            fetchData();
        } catch (error) {
            console.error("Failed to update objective name:", error);
        }
    }, [fetchData]);

    const toggleObjective = useCallback((objId) => {
        setExpandedObjectiveIds(prev =>
            prev.includes(objId) ? prev.filter(id => id !== objId) : [...prev, objId]
        );
    }, []);

    const performObjectiveToggle = useCallback(async (obj) => {
        const isCurrentlyActive = obj.metadata?.isActive === true || (!obj.metadata?.isActive && !obj.metadata?.isSleeping && !obj.metadata?.isArchived);
        const nextIsActive = !isCurrentlyActive;
        const nextStatus = nextIsActive ? ObjectiveStatuses.ACTIVE : ObjectiveStatuses.SLEEPING;
        const now = Date.now();

        try {
            await backbone.updateNode(obj.id, {
                metadata: {
                    status: nextStatus,
                    isActive: nextStatus === 'ACTIVE',
                    isSleeping: nextStatus === 'SLEEPING',
                    isArchived: false,
                    [nextStatus === 'ACTIVE' ? 'activatedAt' : 'deactivatedAt']: now
                }
            });
            fetchData();
        } catch (error) {
            console.error("Failed to toggle objective status:", error);
        }
    }, [fetchData]);

    const handleToggleObjectiveStatus = useCallback(async (e, obj) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        const isCurrentlyActive = obj.metadata?.isActive === true || (!obj.metadata?.isActive && !obj.metadata?.isSleeping && !obj.metadata?.isArchived);

        if (!isCurrentlyActive) {
            const activeInSkill = objectives.filter(o => o.metadata?.isActive === true).length;
            const limit = typeof activeExperimentLimit === 'number' ? activeExperimentLimit : 1;
            if (activeInSkill >= limit) {
                setIsLimitModalOpen(true);
                return;
            }
        } else {
            const activatedAt = obj.metadata?.activatedAt;
            if (activatedAt) {
                const daysActive = Math.floor((Date.now() - activatedAt) / (24 * 60 * 60 * 1000));
                if (daysActive < 14) {
                    setPendingSleepObj(obj);
                    setIsConfirmSleepModalOpen(true);
                    return;
                }
            }
        }

        await performObjectiveToggle(obj);
    }, [objectives, activeExperimentLimit, performObjectiveToggle, setIsLimitModalOpen, setIsConfirmSleepModalOpen, setPendingSleepObj]);

    return {
        // State
        expandedObjectiveIds,
        setExpandedObjectiveIds,
        isCreatingObjective,
        setIsCreatingObjective,
        isLimitModalOpen,
        setIsLimitModalOpen,
        isConfirmSleepModalOpen,
        setIsConfirmSleepModalOpen,
        pendingSleepObj,
        setPendingSleepObj,
        objectiveToDelete,
        setObjectiveToDelete,
        editingObjectiveId,
        setEditingObjectiveId,
        objectiveEditForm,
        setObjectiveEditForm,

        // Handlers
        handleStatusUpdate,
        handleStartEditObjective,
        handleSaveObjectiveEdit,
        handleDeleteObjective,
        confirmDeleteObjective,
        handleUpdateObjectiveName,
        toggleObjective,
        handleToggleObjectiveStatus,
        performObjectiveToggle
    };
};

export default useObjectiveHandlers;
