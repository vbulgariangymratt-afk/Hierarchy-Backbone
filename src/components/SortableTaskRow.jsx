import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Lock, Trash2, Timer, Gift, Zap, ArrowUpRight, Circle, CircleDot, Check, GripVertical } from 'lucide-react';
import { backbone, NodeTypes, TaskStatuses } from '../backbone-v2/index';

const getTaskStatusInfo = (task) => {
    const status = task.metadata?.status;
    if (status === TaskStatuses.DONE) return { symbol: <Check size={13} strokeWidth={2.5} />, colorClass: 'status-done' };
    if (status === TaskStatuses.IN_PROGRESS) return { symbol: <Circle size={8} fill="currentColor" strokeWidth={0} style={{ width: '6px', height: '6px', minWidth: '6px' }} />, colorClass: 'status-progress' };
    return { symbol: <Circle size={8} strokeWidth={2} style={{ width: '6px', height: '6px', minWidth: '6px' }} />, colorClass: 'status-todo' };
};

const SortableTaskRow = React.memo(({
    task,
    allNodes,
    expandedTaskIds,
    activeChallengeHighlight,
    skill,
    onToggleTask,
    onToggleTaskStatus,
    onAddToToday,
    onIncrementRepetition,
    onDeleteTask,
    isSelectingRewardForTaskId,
    onSetSelectingRewardForTaskId,
    onRemoveReward,
    onAttachReward,
    onSaveMVE,
    onStartCreatingReward
}) => {
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [draftName, setDraftName] = useState(task.name);
    const [mveDraft, setMveDraft] = useState(task.metadata?.mve || '');
    const [mveSaving, setMveSaving] = useState(false);
    const [showDepHint, setShowDepHint] = useState(false);
    const inputRef = useRef(null);
    const hintTimeoutRef = useRef(null);
    
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: task.id,
        data: { type: 'TASK', task }
    });

    const isNewUser = useMemo(() => {
        if (!allNodes) return false;
        let completedSessions = 0;
        allNodes.forEach(node => {
            if (node.type === 'TASK' && node.metadata?.sessions) {
                node.metadata.sessions.forEach(s => {
                    if (s.status === 'completed') completedSessions++;
                });
            }
        });
        return completedSessions === 0;
    }, [allNodes]);

    const hasAnyTodayTasks = useMemo(() => {
        if (!allNodes) return false;
        return allNodes.some(n => n.type === 'TASK' && n.metadata?.isToday);
    }, [allNodes]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        setIsEditing(true);
        setDraftName(task.name);
    };

    const handleSave = async () => {
        if (!isEditing) return;
        const trimmed = draftName.trim();
        if (trimmed && trimmed !== task.name) {
            try {
                await backbone.updateNode(task.id, { name: trimmed });
            } catch (err) {
                console.error("Failed to rename task:", err);
            }
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setDraftName(task.name);
            setIsEditing(false);
        }
    };

    const handleSaveMVE = async () => {
        const trimmed = mveDraft.trim();
        if (trimmed === (task.metadata?.mve || '')) return; // No change
        setMveSaving(true);
        try {
            await onSaveMVE(task.id, trimmed);
        } catch (err) {
            console.error('Failed to save MVE:', err);
        } finally {
            setMveSaving(false);
        }
    };

    const handleMveKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
        if (e.key === 'Escape') {
            setMveDraft(task.metadata?.mve || '');
            e.target.blur();
        }
    };

    const handleLockedClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setShowDepHint(true);
        if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = setTimeout(() => setShowDepHint(false), 3000);
    };

    const statusInfo = getTaskStatusInfo(task);
    const isDone = task.metadata?.status === TaskStatuses.DONE;
    const dependencyId = task.metadata?.dependsOnTaskId;
    const dependencyTask = dependencyId ? allNodes.find(n => n.id === dependencyId) : null;
    const isDependencyDone = !dependencyTask || dependencyTask.metadata?.status === TaskStatuses.DONE;
    const isLocked = dependencyId && !isDependencyDone;

    const isExpanded = expandedTaskIds.includes(task.id);
    const rewardId = task.metadata?.rewardId;
    const reward = rewardId ? allNodes.find(n => n.id === rewardId) : null;

    const isChallengeTarget = activeChallengeHighlight?.taskId === task.id;
    const challengeType = activeChallengeHighlight?.type;

    let contrastClass = '';
    if (isDone) {
        contrastClass = 'task-ghosted';
    } else if (isLocked) {
        contrastClass = 'task-locked';
    } else {
        contrastClass = 'task-high-contrast';
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            id={`task-${task.id}`}
            className={`task-row-container ${isExpanded ? 'is-expanded' : ''} ${isDragging ? 'is-dragging-ghost' : ''}`}
            {...attributes}
            {...listeners}
            onClick={(e) => { 
                console.log('[SortableTaskRow] clicked, isEditing:', isEditing, 'taskId:', task.id);
                if (!isEditing) {
                    e.stopPropagation(); 
                    console.log('[SortableTaskRow] calling onToggleTask with:', task.id);
                    onToggleTask(task.id); 
                }
            }}
        >
            <div
                className={`task-row ${contrastClass}`}
            >

                {skill?.metadata?.pinchState === 'PASSION' && !isDone && (
                    <button
                        className="task-safe-start-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            navigate(`/focus?taskId=${task.id}&safeSession=true`);
                        }}
                        title="Start 10-minute safe session"
                    >
                        <Timer size={13} style={{ marginRight: '4px' }} /> 10m
                    </button>
                )}
                {task.metadata?.itemType !== 'REPETITION' && (
                    <span
                        className={`task-status-symbol ${isLocked ? 'locked' : 'clickable'} ${statusInfo.colorClass}`}
                        onClick={(e) => {
                            if (isLocked) {
                                handleLockedClick(e);
                                return;
                            }
                            e.stopPropagation();
                            e.preventDefault();
                            onToggleTaskStatus(task);
                        }}
                        title={isLocked ? `Locked: Complete "${dependencyTask?.name}" first` : (isDone ? "Mark as Not Started" : "Mark as Done")}
                    >
                        {isLocked ? <Lock size={12} /> : statusInfo.symbol}
                    </span>
                )}
                <div className="task-name-text">
                    {isEditing ? (
                        <input
                            ref={inputRef}
                            className="task-inline-edit-input"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px solid var(--color-accent)',
                                color: 'inherit',
                                fontSize: 'inherit',
                                fontFamily: 'inherit',
                                width: '100%',
                                outline: 'none',
                                padding: '2px 0'
                            }}
                        />
                    ) : (
                        <span 
                            className="task-main-name" 
                            onDoubleClick={handleDoubleClick}
                        >
                            {task.name}
                        </span>
                    )}
                    {showDepHint && (
                        <div className="task-dependency-hint-float">
                            Need: <span className="dep-name">{dependencyTask?.name || 'Prerequisite'}</span>
                        </div>
                    )}
                    {isChallengeTarget && challengeType === 'MASTERY' && <span className="challenge-badge mastery">Mastery Check</span>}
                    {isChallengeTarget && challengeType === 'NEW_ANGLE' && <span className="challenge-badge new-angle">New Angle</span>}
                    {rewardId && <span className="task-reward-badge-collapsed" title={`Reward: ${reward?.name || 'Unknown'}`}><Gift size={12} /></span>}
                </div>

                <div className="task-actions-col">
                    {!isDone && !isLocked && (
                        <span
                            className={`task-today-badge ${task.metadata?.isToday ? 'active' : ''} ${task.metadata?.tomorrow ? 'tomorrow' : ''} ${isNewUser && !task.metadata?.isToday && !task.metadata?.tomorrow ? 'new-user-guide' : ''}`}
                            onClick={(e) => {
                                const isWillBeToday = !task.metadata?.isToday && !task.metadata?.tomorrow;
                                onAddToToday(e, task.id);
                                if (isWillBeToday && isNewUser && !hasAnyTodayTasks) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    window.dispatchEvent(new CustomEvent('trigger-focus-orb', {
                                        detail: {
                                            startX: rect.left + rect.width / 2,
                                            startY: rect.top + rect.height / 2
                                        }
                                    }));
                                }
                            }}
                        >
                            {task.metadata?.tomorrow ? 'Tomorrow' : (task.metadata?.isToday ? 'Today' : 'Add to Today')}
                        </span>
                    )}
                    {isLocked && (
                        <span 
                            className={`task-locked-badge ${showDepHint ? 'hint-active' : ''}`} 
                            onClick={handleLockedClick}
                            title={`Prerequisite: ${dependencyTask?.name}`}
                        >
                            <Lock size={10} strokeWidth={3} /> {showDepHint ? `NEED: ${dependencyTask?.name}` : 'LOCKED'}
                        </span>
                    )}
                    {task.metadata?.itemType === 'REPETITION' && (
                        <div className="task-repetition-ui">
                            <span className="task-repetition-progress">
                                {task.metadata.currentUnits || 0}{task.metadata.targetUnits > 0 ? ` / ${task.metadata.targetUnits}` : ''} {task.metadata.unitName || 'units'}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onIncrementRepetition(task.id);
                                }}
                                className="task-repetition-add-btn"
                                title="Increment progress"
                            >
                                +
                            </button>
                        </div>
                    )}
                </div>
                {dependencyId && !isLocked && <span className="task-dependency-icon" title={`Suggested next step after: ${dependencyTask?.name}`}><ArrowUpRight size={14} /></span>}

                <button
                    className="task-delete-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDeleteTask(task);
                    }}
                    title="Delete Task"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {isExpanded && (
                <div className="task-expanded-content" onClick={(e) => e.stopPropagation()}>
                    {rewardId ? (
                        <div className="reward-info-block">
                            {reward ? (
                                <>
                                    <div className="reward-main">
                                        <span className="reward-icon-inline"><Gift size={12} /></span>
                                        <span className="reward-name-inline">{reward.name}</span>
                                        <span className="reward-tier-inline">T{reward.metadata?.rewardTier || 1}</span>
                                    </div>
                                    <div className="reward-actions-inline">
                                        <button className="reward-action-btn" onClick={() => onSetSelectingRewardForTaskId(task.id)}>Change</button>
                                        <button className="reward-action-btn remove" onClick={() => onRemoveReward(task.id)}>Remove</button>
                                    </div>
                                </>
                            ) : (
                                <div className="reward-error">
                                    <span>Reward not found</span>
                                    <button className="reward-action-btn remove" onClick={() => onRemoveReward(task.id)}>Remove</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        isSelectingRewardForTaskId !== task.id && (
                            <button
                                className="attach-reward-trigger"
                                onClick={() => onSetSelectingRewardForTaskId(task.id)}
                            >
                                + Attach Micro Reward
                            </button>
                        )
                    )}

                    {isSelectingRewardForTaskId === task.id && (
                        <div className="reward-picker-inline">
                            <span className="picker-title-inline">Select Micro Reward</span>
                            <div className="reward-list-scroll">
                                {allNodes
                                    .filter(n => n.type === NodeTypes.REWARD && n.metadata?.rewardCategory === 'MARKETPLACE' && (n.metadata?.rewardTier === 1 || !n.metadata?.rewardTier))
                                    .map(r => (
                                        <div
                                            key={r.id}
                                            className="reward-pick-item"
                                            onClick={() => onAttachReward(task.id, r.id)}
                                        >
                                            <span className="pick-name">{r.name}</span>
                                            <span className={`tier-badge tier-${r.metadata?.rewardTier || 1}`}>T{r.metadata?.rewardTier || 1}</span>
                                        </div>
                                    ))}
                                {allNodes.filter(n => n.type === NodeTypes.REWARD && n.metadata?.rewardCategory === 'MARKETPLACE' && (n.metadata?.rewardTier === 1 || !n.metadata?.rewardTier)).length === 0 && (
                                    <div className="no-rewards-found">No Micro Resets found in Bank.</div>
                                )}
                            </div>
                            <div className="picker-actions-inline">
                                <button className="picker-create-btn" onClick={() => onStartCreatingReward(task.id)}>+ Create</button>
                                <button className="picker-close-btn" onClick={() => onSetSelectingRewardForTaskId(null)}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    const getDepStatus = (task, allNodes) => {
        if (!task.metadata?.dependsOnTaskId) return null;
        const dep = allNodes.find(n => n.id === task.metadata.dependsOnTaskId);
        return dep ? dep.metadata?.status : null;
    };

    const shouldSkipRender = (
        prev.isExpanded === next.isExpanded &&
        prev.task.id === next.task.id &&
        prev.task.name === next.task.name &&
        prev.task.updatedAt === next.task.updatedAt &&
        prev.task.metadata?.status === next.task.metadata?.status &&
        prev.task.metadata?.isToday === next.task.metadata?.isToday &&
        prev.task.metadata?.tomorrow === next.task.metadata?.tomorrow &&
        prev.task.metadata?.currentUnits === next.task.metadata?.currentUnits &&
        prev.task.metadata?.targetUnits === next.task.metadata?.targetUnits &&
        prev.task.metadata?.rewardId === next.task.metadata?.rewardId &&
        prev.task.metadata?.mve === next.task.metadata?.mve &&
        prev.isSelectingRewardForTaskId === next.isSelectingRewardForTaskId &&
        (prev.activeChallengeHighlight?.taskId === prev.task.id) === (next.activeChallengeHighlight?.taskId === next.task.id) &&
        prev.activeChallengeHighlight?.type === next.activeChallengeHighlight?.type &&
        prev.skill?.metadata?.pinchState === next.skill?.metadata?.pinchState &&
        getDepStatus(prev.task, prev.allNodes) === getDepStatus(next.task, next.allNodes)
    );
    return shouldSkipRender;
});

export default SortableTaskRow;
