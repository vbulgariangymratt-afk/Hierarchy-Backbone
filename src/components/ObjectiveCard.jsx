import React from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Pencil, Moon, ChevronRight } from 'lucide-react';
import NodeIcon from './NodeIcon';
import SortableTaskRow from './SortableTaskRow';
import DroppableAspect from './DroppableAspect';
import { NodeTypes, TaskStatuses } from '../backbone-v2/index';

/**
 * ObjectiveCard Component
 * Extracted from SkillPage.jsx's renderObjective function.
 * Renders a single objective (experiment) with its aspects and tasks.
 */
const ObjectiveCard = ({
    obj,
    energyLevel,
    isExpanded,
    isSleeping,
    aspects,
    timeInfo,
    accType,
    isMVECompletedToday,
    isEditing,
    objectiveEditForm,
    setObjectiveEditForm,
    handleUpdateObjectiveName,
    handleSaveObjectiveEdit,
    handleDeleteObjective,
    setEditingObjectiveId,
    setAspectToDelete,
    handleStatusUpdate,
    toggleObjective,
    inlineEditingNodeId,
    inlineDraftName,
    setInlineDraftName,
    handleSaveInlineEdit,
    handleInlineKeyDown,
    handleStartInlineEdit,
    inlineInputRef,
    navigate,
    handleLogPulse,
    showCompletedTasks,
    activeChallengeHighlight,
    skill,
    expandedTaskIds,
    toggleTask,
    handleToggleTaskStatus,
    handleAddToToday,
    handleIncrementRepetition,
    setTaskToDelete,
    isSelectingRewardForTaskId,
    setIsSelectingRewardForTaskId,
    handleRemoveReward,
    handleAttachReward,
    handleSaveMVE,
    creatingTaskForAspectId,
    setCreatingTaskForAspectId,
    newTaskName,
    setNewTaskName,
    newTaskItemType,
    setNewTaskItemType,
    newTaskUnitName,
    setNewTaskUnitName,
    newTaskTargetUnits,
    setNewTaskTargetUnits,
    newTaskDependencyId,
    setNewTaskDependencyId,
    handleCreateTask,
    aspectShowMoreIds,
    setAspectShowMoreIds,
    toggleAspect,
    creatingAspectForObjId,
    setCreatingAspectForObjId,
    newAspectName,
    setNewAspectName,
    handleCreateAspect,
    collapsedCompletedAspects,
    setCollapsedCompletedAspects,
    macOSSpring,
    getChildren,
    allNodes,
    mveFocusTask
}) => {
    if (isEditing) {
        return (
            <div className="experiment-edit-container" key={obj.id}>
                <div className="edit-grid">
                    <div className="edit-field">
                        <label>Experiment Title</label>
                        <input
                            className="edit-input"
                            value={obj.name}
                            onChange={(e) => handleUpdateObjectiveName(obj.id, e.target.value)}
                        />
                    </div>
                    <div className="edit-field">
                        <label>Theme</label>
                        <input
                            className="edit-input"
                            value={objectiveEditForm?.theme}
                            onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, theme: e.target.value })}
                        />
                    </div>
                    <div className="edit-field">
                        <label>Duration (Days)</label>
                        <input
                            type="number"
                            className="edit-input"
                            value={objectiveEditForm?.durationInDays}
                            onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, durationInDays: e.target.value })}
                        />
                    </div>
                    <div className="edit-field">
                        <label>Accumulation Unit</label>
                        <input
                            className="edit-input"
                            placeholder="eg: minutes, reps, pages..."
                            value={objectiveEditForm?.accumulationType}
                            onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, accumulationType: e.target.value })}
                        />
                    </div>
                    <div className="edit-field full-width">
                        <label>Wish</label>
                        <input
                            className="edit-input"
                            placeholder="What do I want?"
                            value={objectiveEditForm?.wish}
                            onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, wish: e.target.value })}
                        />
                    </div>
                    <div className="edit-field full-width">
                        <label>Outcome</label>
                        <input
                            className="edit-input"
                            placeholder="What does success look like?"
                            value={objectiveEditForm?.outcome}
                            onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, outcome: e.target.value })}
                        />
                    </div>
                    <div className="edit-field full-width">
                        <label>Icon URL (notionicons.so)</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                                className="edit-input"
                                placeholder="https://notionicons.so/icon/..."
                                value={objectiveEditForm?.iconUrl}
                                style={{ flex: 1 }}
                                onChange={(e) => setObjectiveEditForm({ ...objectiveEditForm, iconUrl: e.target.value })}
                            />
                            {objectiveEditForm?.iconUrl && (
                                <div className="icon-preview" style={{ width: '32px', height: '32px', background: 'var(--alpha-low)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)' }}>
                                    <img src={objectiveEditForm.iconUrl} alt="preview" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                </div>
                            )}
                        </div>
                    </div>
                    {aspects.length > 0 && (
                        <div className="edit-field full-width" style={{ marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '16px', gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', opacity: 0.6, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Experiment Aspects</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {aspects.map(aspect => {
                                    const aspectTasks = getChildren(aspect.id, NodeTypes.TASK);
                                    return (
                                        <div key={aspect.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--alpha-low)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{aspect.name}</span>
                                                <span style={{ fontSize: '10px', fontWeight: '800', opacity: 0.5, background: 'var(--alpha-med)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{aspectTasks.length} {aspectTasks.length === 1 ? 'task' : 'tasks'}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setAspectToDelete(aspect)}
                                                style={{ 
                                                    padding: '6px 14px', 
                                                    background: 'rgba(239, 68, 68, 0.08)', 
                                                    color: '#ef4444', 
                                                    border: '1px solid rgba(239, 68, 68, 0.12)', 
                                                    borderRadius: '8px', 
                                                    fontSize: '11px', 
                                                    fontWeight: '700', 
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                <div className="edit-actions">
                    <div className="edit-left">
                        <button className="save-btn" onClick={() => handleSaveObjectiveEdit(obj.id)}>Save Changes</button>
                        <button className="cancel-btn" onClick={() => setEditingObjectiveId(null)}>Cancel</button>
                    </div>
                    <button className="delete-experiment-btn" onClick={() => handleDeleteObjective(obj)}>Delete Experiment</button>
                </div>
            </div>
        );
    }

    return (
        <motion.div 
            layout={energyLevel > 2 ? "position" : false}
            key={obj.id}
            transition={macOSSpring}
        >
            <div className={`objective-container ${isSleeping ? 'is-sleeping' : 'is-focused'} ${obj.metadata?.burnoutRisk ? 'burnout-risk-border' : ''}`}>
                {energyLevel >= 3 && (
                    <div 
                        className="objective-header" 
                        onClick={() => !isSleeping && toggleObjective(obj.id)}
                        style={{
                            paddingBottom: energyLevel >= 5 ? '12px' : '24px',
                            borderBottom: energyLevel >= 5 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                            position: 'relative'
                        }}
                    >
                        <div className="objective-header-left" style={{ display: 'flex', alignItems: 'flex-start', marginLeft: '-38px' }}>
                            <span className={`objective-toggle-icon ${isExpanded && !isSleeping ? 'expanded' : ''}`} style={{ marginTop: '2px', marginRight: '8px' }}>
                                {isSleeping ? <Moon size={16} /> : (obj.metadata?.iconUrl ? <NodeIcon iconUrl={obj.metadata.iconUrl} size={18} /> : <ChevronRight size={18} />)}
                            </span>
                            <div className="objective-title-stack" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {inlineEditingNodeId === obj.id ? (
                                    <input
                                        ref={inlineInputRef}
                                        value={inlineDraftName}
                                        onChange={e => setInlineDraftName(e.target.value)}
                                        onBlur={() => handleSaveInlineEdit(obj.id)}
                                        onKeyDown={e => handleInlineKeyDown(e, obj.id)}
                                        onClick={e => e.stopPropagation()}
                                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-primary)', color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none' }}
                                    />
                                ) : (
                                    <span className="objective-title-static" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.01em' }} onDoubleClick={(e) => { e.stopPropagation(); handleStartInlineEdit(obj.id, obj.name); }}>{obj.name}</span>
                                )}
                                {energyLevel >= 5 && (
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', opacity: 0.8, lineHeight: '1.4', maxWidth: '500px' }}>
                                        {obj.metadata?.wish || "Something worth doing."}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="objective-action-strip" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            {energyLevel >= 4 && (
                                <button
                                    onClick={() => handleStartEditObjective(obj)}
                                    className="experiment-edit-pill"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.04)',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        flexShrink: 0
                                    }}
                                >
                                    <Pencil size={11} strokeWidth={2.5} />
                                </button>
                            )}
                            <div className="experiment-progress-strip" style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px', 
                                background: 'rgba(255, 255, 255, 0.03)', 
                                height: '28px',
                                padding: '0 12px', 
                                borderRadius: '6px', 
                                fontSize: '11px', 
                                fontWeight: '600', 
                                color: 'var(--text-secondary)',
                                border: '1px solid rgba(255, 255, 255, 0.04)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)'
                            }}>
                                {timeInfo && (
                                    <span className="day-info" style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                                        Day {timeInfo.days}{obj.metadata?.durationInDays ? `/${obj.metadata.durationInDays}d` : ''}
                                    </span>
                                )}
                            </div>

                            <div className="objective-status-actions">
                                <select 
                                    className="objective-status-selector"
                                    value={obj.metadata?.status || (obj.metadata?.isSleeping ? 'SLEEPING' : (obj.metadata?.isArchived ? 'COMPLETED' : 'ACTIVE'))}
                                    onChange={(e) => handleStatusUpdate(obj, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="SLEEPING">Sleeping</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="ROTATING">Paused</option>
                                </select>
                                
                                <button 
                                    className="trash-experiment-btn"
                                    title="Delete Experiment"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteObjective(obj);
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {energyLevel > 2 && (
                    <AnimatePresence mode="wait">
                        {isExpanded && !isSleeping && (
                            <motion.div 
                                key="experiment-content-expanded"
                                className="objective-content"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={macOSSpring}
                                style={{ overflow: 'visible' }}
                            >
                                <div style={{ overflow: 'visible' }}>
                                    {energyLevel >= 5 && (
                                        <div className="experiment-display-card">
                                            <AnimatePresence mode="wait">
                                                <motion.div 
                                                    key="analytical-box"
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="woop-box"
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '40px', padding: '12px 0 24px 0' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                            <div style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                                                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Your wish:</span>
                                                                <span style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>{obj.metadata?.wish || "the wish goes here"}</span>
                                                            </div>

                                                            <div style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                                                <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>Core outcome:</span>
                                                                <span style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>{obj.metadata?.outcome || "outcome goes here"}</span>
                                                            </div>
                                                        </div>

                                                        <span style={{ 
                                                            background: 'rgba(255, 255, 255, 0.05)', 
                                                            padding: '4px 10px', 
                                                            borderRadius: '6px', 
                                                            fontFamily: 'monospace', 
                                                            fontSize: '12px', 
                                                            color: 'var(--text-secondary)',
                                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                                            whiteSpace: 'nowrap'
                                                        }}>{obj.metadata?.theme || 'Feedback and adjustment'}</span>
                                                    </div>
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>

                                <AnimatePresence>
                                    {(energyLevel >= 3 || (obj.metadata?.mveCompletedAt && new Date(obj.metadata.mveCompletedAt).toDateString() === new Date().toDateString())) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 20 }}
                                            transition={macOSSpring}
                                        >
                                            <div className="masonry-columns-wrapper" style={{ display: 'flex', gap: '24px', paddingTop: '8px', flexWrap: 'wrap' }}>
                                                {(() => {
                                                    const leftColumn = [];
                                                    const rightColumn = [];
                                                    let leftHeight = 0;
                                                    let rightHeight = 0;

                                                    const sortedAspects = [...aspects].sort((a, b) => {
                                                        const aTasks = getChildren(a.id, NodeTypes.TASK);
                                                        const bTasks = getChildren(b.id, NodeTypes.TASK);
                                                        const aToday = aTasks.some(t => t.metadata?.isToday);
                                                        const bToday = bTasks.some(t => t.metadata?.isToday);
                                                        if (aToday && !bToday) return -1;
                                                        if (!aToday && bToday) return 1;
                                                        const aFixes = aTasks.filter(t => t.metadata?.status === TaskStatuses.DONE).length;
                                                        const bFixes = bTasks.filter(t => t.metadata?.status === TaskStatuses.DONE).length;
                                                        return bFixes - aFixes;
                                                    });

                                                    const aspectsToRender = energyLevel === 3 
                                                        ? (creatingTaskForAspectId 
                                                            ? [...new Set([...sortedAspects.slice(0, 2), aspects.find(a => a.id === creatingTaskForAspectId)].filter(Boolean))]
                                                            : sortedAspects.slice(0, 2))
                                                        : sortedAspects;

                                                    const pendingAspects = aspectsToRender.filter(a => {
                                                        const tasks = getChildren(a.id, NodeTypes.TASK);
                                                        return tasks.length === 0 || tasks.some(t => t.metadata?.status !== TaskStatuses.DONE) || creatingTaskForAspectId === a.id;
                                                    });
                                                    const completedAspects = aspectsToRender.filter(a => {
                                                        const tasks = getChildren(a.id, NodeTypes.TASK);
                                                        return tasks.length > 0 && tasks.every(t => t.metadata?.status === TaskStatuses.DONE) && creatingTaskForAspectId !== a.id;
                                                    });
                                                    const isCompletedAspectsExpanded = collapsedCompletedAspects[obj.id] === true;
                                                    
                                                    const aspectsForMasonry = energyLevel >= 4 
                                                        ? (creatingTaskForAspectId 
                                                            ? [...new Set([...pendingAspects, aspects.find(a => a.id === creatingTaskForAspectId)].filter(Boolean))]
                                                            : pendingAspects)
                                                        : aspectsToRender;

                                                    aspectsForMasonry.forEach(aspect => {
                                                        const isCreatingTask = creatingTaskForAspectId === aspect.id;
                                                        const rawAspectTasks = getChildren(aspect.id, NodeTypes.TASK);
                                                        const aspectTasks = showCompletedTasks 
                                                            ? rawAspectTasks 
                                                            : rawAspectTasks.filter(t => t.metadata?.status !== TaskStatuses.DONE);
                                                        const isNoveltyHighlighted = window.unexploredAspectIds?.includes(aspect.id);
                                                        const firstIncompleteTask = aspectTasks.find(t => t.metadata?.status !== TaskStatuses.DONE);
                                                        const visibleTasksCount = aspectShowMoreIds.includes(aspect.id) ? aspectTasks.length : Math.min(aspectTasks.length, 5);
                                                        const estimatedHeight = 110 + (visibleTasksCount * 45) + 30;

                                                        const aspectElement = (
                                                            <DroppableAspect
                                                                key={aspect.id}
                                                                aspect={aspect}
                                                                aspectTasks={aspectTasks}
                                                                isNoveltyHighlighted={isNoveltyHighlighted}
                                                                isExpanded={aspectShowMoreIds.includes(aspect.id)}
                                                                isEditing={inlineEditingNodeId === aspect.id}
                                                                onToggleAspect={toggleAspect}
                                                            >
                                                                <div className="aspect-card-internal">
                                                                    <div className="aspect-header">
                                                                        <div className="aspect-title-group">
                                                                            {inlineEditingNodeId === aspect.id ? (
                                                                                <input
                                                                                    ref={inlineInputRef}
                                                                                    autoFocus
                                                                                    value={inlineDraftName}
                                                                                    onChange={e => setInlineDraftName(e.target.value)}
                                                                                    onBlur={() => handleSaveInlineEdit(aspect.id)}
                                                                                    onKeyDown={e => handleInlineKeyDown(e, aspect.id)}
                                                                                    onClick={e => e.stopPropagation()}
                                                                                    style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-accent)', color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none', width: '100%' }}
                                                                                />
                                                                            ) : (
                                                                                <span 
                                                                                    className="aspect-name" 
                                                                                    onDoubleClick={(e) => { e.stopPropagation(); handleStartInlineEdit(aspect.id, aspect.name); }}
                                                                                    style={{ cursor: 'text', userSelect: 'none', color: 'var(--text-primary)', fontWeight: 600 }}
                                                                                >{aspect.name}</span>
                                                                            )}
                                                                            <span className="aspect-task-count" style={{ display: 'inline-flex', gap: '3px', color: 'var(--text-secondary)' }}>
                                                                                {(() => {
                                                                                    const aspectTasksForCount = getChildren(aspect.id, NodeTypes.TASK);
                                                                                    const doneInAspect = aspectTasksForCount.filter(t => t.metadata?.status === TaskStatuses.DONE).length;
                                                                                    let aVal = 0;
                                                                                    if (accType === 'minutes') {
                                                                                        aVal = aspectTasksForCount.reduce((sum, t) => sum + (t.metadata?.sessions || []).reduce((sSum, s) => s.status === 'completed' ? sSum + Math.round((s.actualDuration || 0) / 60) : sSum, 0), 0);
                                                                                    } else if (accType === 'reps') {
                                                                                        aVal = aspectTasksForCount.reduce((sum, t) => sum + (t.metadata?.currentUnits || 0), 0);
                                                                                    } else if (accType === 'sessions') {
                                                                                        aVal = aspectTasksForCount.reduce((sum, t) => sum + (t.metadata?.sessions || []).filter(s => s.status === 'completed').length, 0);
                                                                                    } else {
                                                                                        aVal = doneInAspect;
                                                                                    }
                                                                                    return <>{aVal} {accType} &bull; {doneInAspect} logs</>;
                                                                                })()}
                                                                            </span>
                                                                        </div>
                                                                        <div className="aspect-header-right">
                                                                            {isNoveltyHighlighted && firstIncompleteTask && (
                                                                                <button
                                                                                    className="novelty-sprint-btn"
                                                                                    onClick={(e) => { e.stopPropagation(); handleAddToToday(firstIncompleteTask); }}
                                                                                >
                                                                                    Sprint
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {isCreatingTask && <div style={{ height: '0px', marginBottom: '16px' }} />}
                                                                    <div className="aspect-tasks">
                                                                        <AnimatePresence>
                                                                            {aspectTasks.slice(0, visibleTasksCount).map(task => (
                                                                                <SortableTaskRow 
                                                                                    key={task.id}
                                                                                    task={task}
                                                                                    allNodes={allNodes}
                                                                                    isExpanded={expandedTaskIds.includes(task.id)}
                                                                                    expandedTaskIds={expandedTaskIds}
                                                                                    activeChallengeHighlight={activeChallengeHighlight}
                                                                                    skill={skill}
                                                                                    onToggleTask={toggleTask}
                                                                                    onToggleTaskStatus={handleToggleTaskStatus}
                                                                                    onAddToToday={handleAddToToday}
                                                                                    onIncrementRepetition={handleIncrementRepetition}
                                                                                    onDeleteTask={setTaskToDelete}
                                                                                    isSelectingRewardForTaskId={isSelectingRewardForTaskId}
                                                                                    onSetSelectingRewardForTaskId={setIsSelectingRewardForTaskId}
                                                                                    onRemoveReward={handleRemoveReward}
                                                                                    onAttachReward={handleAttachReward}
                                                                                    onSaveMVE={handleSaveMVE}
                                                                                />
                                                                            ))}
                                                                        </AnimatePresence>
                                                                    </div>
                                                                    {aspectTasks.length > 5 && (
                                                                        <div style={{ textAlign: 'center', marginTop: '4px' }}>
                                                                            <button
                                                                                className="show-all-tasks-btn"
                                                                                onClick={(e) => { e.stopPropagation(); setAspectShowMoreIds(prev => prev.includes(aspect.id) ? prev.filter(id => id !== aspect.id) : [...prev, aspect.id]); }}
                                                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', opacity: 0.7 }}
                                                                            >
                                                                                {aspectShowMoreIds.includes(aspect.id) ? 'Show fewer tasks' : 'Show all tasks'}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    <button className="add-task-btn" onClick={(e) => { e.stopPropagation(); setCreatingTaskForAspectId(aspect.id); setNewTaskItemType('FINITE'); }}>
                                                                        + Add Task
                                                                    </button>
                                                                </div>
                                                            </DroppableAspect>
                                                        );

                                                        if (leftHeight <= rightHeight) {
                                                            leftColumn.push(aspectElement);
                                                            leftHeight += estimatedHeight;
                                                        } else {
                                                            rightColumn.push(aspectElement);
                                                            rightHeight += estimatedHeight;
                                                        }
                                                    });

                                                    const addAspectElement = creatingAspectForObjId === obj.id ? (
                                                        <motion.div layout="position" key="add-aspect-btn" className="aspect-card creation-card" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                autoFocus
                                                                className="inline-creation-input"
                                                                placeholder="Aspect name..."
                                                                value={newAspectName}
                                                                onChange={(e) => setNewAspectName(e.target.value)}
                                                                onKeyDown={(e) => handleCreateAspect(e, obj.id)}
                                                                onBlur={() => setCreatingAspectForObjId(null)}
                                                            />
                                                        </motion.div>
                                                    ) : (
                                                        <motion.button layout="position" key="add-aspect-btn" className="add-aspect-btn" onClick={(e) => { e.stopPropagation(); setCreatingAspectForObjId(obj.id); }} transition={macOSSpring}>
                                                            + Add Aspect
                                                        </motion.button>
                                                    );

                                                    if (leftHeight <= rightHeight) leftColumn.push(addAspectElement);
                                                    else rightColumn.push(addAspectElement);

                                                    return (
                                                        <>
                                                            <div className="masonry-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>{leftColumn}</div>
                                                            <div className="masonry-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>{rightColumn}</div>
                                                            {energyLevel >= 4 && completedAspects.length > 0 && (
                                                                <div style={{ width: '100%', marginTop: '8px' }}>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setCollapsedCompletedAspects(prev => ({ ...prev, [obj.id]: !prev[obj.id] })); }}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}
                                                                    >
                                                                        <span style={{ fontSize: '12px', transition: 'transform 0.2s', display: 'inline-block', transform: isCompletedAspectsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                                            <ChevronRight size={14} />
                                                                        </span>
                                                                        Completed Aspects ({completedAspects.length})
                                                                    </button>
                                                                    {isCompletedAspectsExpanded && (
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
                                                                            {completedAspects.map(aspect => {
                                                                                const allTasks = getChildren(aspect.id, NodeTypes.TASK);
                                                                                return (
                                                                                    <div key={aspect.id} style={{ flex: '1 1 300px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '16px 20px', opacity: 0.6 }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                                            <span style={{ fontSize: '14px', fontWeight: '700' }}>{aspect.name}</span>
                                                                                            <span style={{ fontSize: '11px' }}>{allTasks.length} done</span>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </motion.div>
    );
};

export default ObjectiveCard;
