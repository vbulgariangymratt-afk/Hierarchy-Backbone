import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { NodeTypes, TaskStatuses } from '../backbone-v2/index';

const getTaskStatusInfo = (task) => {
    const status = task.metadata?.status;
    if (status === TaskStatuses.DONE) return { symbol: '✓', colorClass: 'status-done' };
    if (status === TaskStatuses.IN_PROGRESS) return { symbol: '◉', colorClass: 'status-progress' };
    return { symbol: '☐', colorClass: 'status-todo' };
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
    onAttachReward
}) => {
    const navigate = useNavigate();
    
    // Dragging disabled
    const attributes = {};
    const listeners = {};
    const setNodeRef = null;
    const isDragging = false;
    const style = {};

    const statusInfo = getTaskStatusInfo(task);
    const isDone = task.metadata?.status === TaskStatuses.DONE;
    const dependencyId = task.metadata?.dependsOnTaskId;
    const dependencyTask = dependencyId ? allNodes.find(n => n.id === dependencyId) : null;
    const isExpanded = expandedTaskIds.includes(task.id);
    const rewardId = task.metadata?.rewardId;
    const reward = rewardId ? allNodes.find(n => n.id === rewardId) : null;

    const isChallengeTarget = activeChallengeHighlight?.taskId === task.id;
    const challengeType = activeChallengeHighlight?.type;

    let contrastClass = '';
    if (isDone) {
        contrastClass = 'task-ghosted';
    } else {
        contrastClass = 'task-high-contrast';
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            id={`task-${task.id}`}
            className={`task-row-container ${isExpanded ? 'is-expanded' : ''} ${isDragging ? 'is-dragging-ghost' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleTask(task.id); }}
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
                        ⏱ 10m
                    </button>
                )}
                {task.metadata?.itemType !== 'REPETITION' && (
                    <span
                        className={`task-status-symbol clickable ${statusInfo.colorClass}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onToggleTaskStatus(task);
                        }}
                        title={isDone ? "Mark as Not Started" : "Mark as Done"}
                    >
                        {statusInfo.symbol}
                    </span>
                )}
                <div className="task-name-text">
                    <span className="task-main-name">{task.name}</span>
                    {isChallengeTarget && challengeType === 'MASTERY' && <span className="challenge-badge mastery">Mastery Check</span>}
                    {isChallengeTarget && challengeType === 'NEW_ANGLE' && <span className="challenge-badge new-angle">New Angle</span>}
                    {rewardId && <span className="task-reward-badge-collapsed" title={`Reward: ${reward?.name || 'Unknown'}`}>🍬</span>}
                </div>

                <div className="task-actions-col">
                    {!isDone && (
                        <span
                            className={`task-today-badge ${task.metadata?.isToday ? 'active' : ''}`}
                            onClick={(e) => onAddToToday(e, task.id)}
                        >
                            Today
                        </span>
                    )}
                    {task.metadata?.itemType === 'REPETITION' && (
                        <div className="task-repetition-ui">
                            <span className="task-repetition-progress">
                                {task.metadata.currentUnits || 0} / {task.metadata.targetUnits || 0} {task.metadata.unitName || 'units'}
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
                {dependencyId && <span className="task-dependency-icon" title={`Suggested next step after: ${dependencyTask?.name}`}>↗</span>}

                <button
                    className="task-delete-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDeleteTask(task);
                    }}
                    title="Delete Task"
                >
                    🗑️
                </button>
            </div>

            {isExpanded && (
                <div className="task-expanded-content" onClick={(e) => e.stopPropagation()}>
                    <div className="micro-reward-section">
                        <span className="expanded-label-small">Micro Reward</span>
                        {rewardId ? (
                            <div className="reward-info-block">
                                {reward ? (
                                    <>
                                        <div className="reward-main">
                                            <span className="reward-icon-inline">🍬</span>
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
                            <button
                                className="attach-reward-trigger"
                                onClick={() => onSetSelectingRewardForTaskId(task.id)}
                            >
                                + Attach Micro Reward
                            </button>
                        )}
                    </div>

                    {isSelectingRewardForTaskId === task.id && (
                        <div className="reward-picker-overlay" onClick={() => onSetSelectingRewardForTaskId(null)}>
                            <div className="reward-picker-container" onClick={(e) => e.stopPropagation()}>
                                <h4 className="picker-title">Select Micro Reward</h4>
                                <div className="reward-list-scroll">
                                    {allNodes
                                        .filter(n => n.type === NodeTypes.REWARD && n.metadata?.rewardCategory === 'TASK')
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
                                    {allNodes.filter(n => n.type === NodeTypes.REWARD && n.metadata?.rewardCategory === 'TASK').length === 0 && (
                                        <div className="no-rewards-found">No Micro Rewards found in Bank.</div>
                                    )}
                                </div>
                                <button className="picker-close-btn" onClick={() => onSetSelectingRewardForTaskId(null)}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    return (
        prev.task.id === next.task.id &&
        prev.task.name === next.task.name &&
        prev.task.updatedAt === next.task.updatedAt &&
        prev.task.metadata?.status === next.task.metadata?.status &&
        prev.task.metadata?.isToday === next.task.metadata?.isToday &&
        prev.task.metadata?.currentUnits === next.task.metadata?.currentUnits &&
        prev.task.metadata?.targetUnits === next.task.metadata?.targetUnits &&
        prev.task.metadata?.rewardId === next.task.metadata?.rewardId &&
        prev.isSelectingRewardForTaskId === next.isSelectingRewardForTaskId &&
        prev.expandedTaskIds.includes(prev.task.id) === next.expandedTaskIds.includes(next.task.id) &&
        (prev.activeChallengeHighlight?.taskId === prev.task.id) === (next.activeChallengeHighlight?.taskId === next.task.id) &&
        prev.activeChallengeHighlight?.type === next.activeChallengeHighlight?.type &&
        prev.skill?.metadata?.pinchState === next.skill?.metadata?.pinchState
    );
});

export default SortableTaskRow;
