import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Lock, Trash2, Timer, Gift, Zap, ArrowUpRight } from 'lucide-react';
import { backbone, NodeTypes, TaskStatuses } from '../backbone-v2/index';

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
    onAttachReward,
    onSaveMVE
}) => {
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [draftName, setDraftName] = useState(task.name);
    const [mveDraft, setMveDraft] = useState(task.metadata?.mve || '');
    const [mveSaving, setMveSaving] = useState(false);
    const [showDepHint, setShowDepHint] = useState(false);
    const inputRef = useRef(null);
    const hintTimeoutRef = useRef(null);
    
    // Dragging disabled
    const attributes = {};
    const listeners = {};
    const setNodeRef = null;
    const isDragging = false;
    const style = {};

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
                            className={`task-today-badge ${task.metadata?.isToday ? 'active' : ''} ${task.metadata?.tomorrow ? 'tomorrow' : ''}`}
                            onClick={(e) => onAddToToday(e, task.id)}
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

                    {/* ── MVE Section ── */}
                    <div className="task-submenu-section">
                        <span className="expanded-label-small"><Zap size={11} strokeWidth={2.5} style={{ marginRight: '4px' }} /> Min. Viable Effort</span>
                        <input
                            className="mve-input"
                            type="text"
                            value={mveDraft}
                            onChange={(e) => setMveDraft(e.target.value)}
                            onBlur={handleSaveMVE}
                            onKeyDown={handleMveKeyDown}
                            placeholder="e.g. Just open the file for 2 min…"
                        />
                        {mveSaving && <span className="mve-saving-indicator">Saving…</span>}
                    </div>

                    {/* ── Micro Reward Section ── */}
                    <div className="task-submenu-section micro-reward-section">
                        <span className="expanded-label-small"><Gift size={11} strokeWidth={2.5} style={{ marginRight: '4px' }} /> Micro Reward</span>
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
        prev.skill?.metadata?.pinchState === next.skill?.metadata?.pinchState
    );
    console.log('[Memo] prev.isExpanded:', prev.isExpanded, 'next.isExpanded:', next.isExpanded, 'skipping render:', shouldSkipRender);
    return shouldSkipRender;
});

export default SortableTaskRow;
