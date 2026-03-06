import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Trash2, CheckCircle, Circle, FileText, Zap, Sparkles, Maximize2, Folder, Bot } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import IslandDetailModal from './islands/IslandDetailModal';
import FolderDetailModal from './FolderDetailModal';
import FlashcardReview from './FlashcardReview';
import WarheadChat from './WarheadChat';
import { getTodayString } from '../utils/dateUtils';

// Initial default topics (will be combined with dynamic topics from habits)
const DEFAULT_TOPICS = [
    'Adhd & depression',
    'ASPD & Sociopathy',
    'Stories from school',
    'Manifesting & spiritual',
    'Regular life'
];



const IslandNode = React.memo(({ habit, index, yPosition, isLocked, isDoneToday, toggleHabit, NODE_WIDTH, NODE_HEIGHT, ACTIVE_COLOR, columnIndex, onOpenDetail, onDelete }) => {
    const today = getTodayString();
    const isCompleted = Object.values(habit.history || {}).some(v => v === true);
    const Icon = isLocked ? Zap : (isDoneToday || isCompleted ? CheckCircle : Sparkles);
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'absolute',
                top: `${yPosition}px`,
                left: index % 2 === 0 ? '35%' : '65%',
                transform: 'translateX(-50%) translateZ(0)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                width: '140px',
                zIndex: onOpenDetail ? 10 : 1
            }}
        >
            {/* Detail Trigger Icon */}
            {!isLocked && (
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(habit); }}
                    style={{
                        position: 'absolute',
                        top: '0px',
                        right: '15px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '6px',
                        width: 'auto',
                        height: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        zIndex: 2,
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                >
                    <Maximize2 size={12} />
                </button>
            )}

            {/* Delete Trigger Icon */}
            {!isLocked && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // eslint-disable-next-line no-restricted-globals
                        if (confirm('Are you sure you want to delete this island?')) {
                            onDelete(habit.id);
                        }
                    }}
                    style={{
                        position: 'absolute',
                        top: '0px',
                        left: '15px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '6px',
                        width: 'auto',
                        height: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        zIndex: 2,
                        transition: 'all 0.2s ease',
                        opacity: isHovered ? 1 : 0,
                        pointerEvents: isHovered ? 'auto' : 'none'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.backgroundColor = 'rgba(255,0,0,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(255,0,0,0.1)'; }}
                >
                    <Trash2 size={12} />
                </button>
            )}
            <div
                onClick={() => !isLocked && toggleHabit(habit.id, today)}
                className={`glass-node ${isLocked ? 'locked' : ''} ${isDoneToday ? 'completed' : ''}`}
                style={{
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    backgroundColor: isLocked
                        ? 'rgba(0, 0, 0, 0.5)'
                        : (isDoneToday
                            ? 'rgba(16, 185, 129, 0.5)'
                            : (columnIndex % 2 === 0 ? 'rgba(195, 154, 107, 0.45)' : 'rgba(120, 120, 130, 0.45)')),
                    border: isDoneToday ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)',
                    backdropFilter: isDoneToday ? 'blur(12px)' : (isLocked ? 'blur(4px)' : 'blur(10px)'),
                    WebkitBackdropFilter: isDoneToday ? 'blur(12px)' : (isLocked ? 'blur(4px)' : 'blur(10px)'),
                    boxShadow: isLocked
                        ? '0 4px 0 rgba(0,0,0,0.3)'
                        : (isDoneToday
                            ? `0 8px 0 rgba(6, 78, 59, 0.5), inset 0 0 15px rgba(16, 185, 129, 0.3), inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`
                            : (columnIndex % 2 === 0
                                ? `0 8px 0 rgba(107, 82, 54, 0.5), inset 0 0 15px ${ACTIVE_COLOR}44, inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`
                                : `0 8px 0 rgba(63, 63, 70, 0.5), inset 0 0 15px ${ACTIVE_COLOR}44, inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`)),
                    transform: isDoneToday ? 'scale(1.1) translateY(0) translateZ(0)' : 'translateY(0) translateZ(0)',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
                }}
                onMouseDown={(e) => {
                    if (!isLocked) {
                        e.currentTarget.style.transform = isDoneToday ? 'scale(1.1) translateY(8px)' : 'translateY(8px)';
                        e.currentTarget.style.boxShadow = '0 0 0 transparent';
                    }
                }}
                onMouseUp={(e) => {
                    if (!isLocked) {
                        e.currentTarget.style.transform = isDoneToday ? 'scale(1.1) translateY(0)' : 'translateY(0)';
                        e.currentTarget.style.boxShadow = isDoneToday
                            ? `0 8px 0 rgba(6, 78, 59, 0.5), inset 0 0 15px rgba(16, 185, 129, 0.3), inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`
                            : (columnIndex % 2 === 0
                                ? `0 8px 0 rgba(107, 82, 54, 0.5), inset 0 0 15px ${ACTIVE_COLOR}44, inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`
                                : `0 8px 0 rgba(63, 63, 70, 0.5), inset 0 0 15px ${ACTIVE_COLOR}44, inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`);
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isLocked) {
                        e.currentTarget.style.transform = isDoneToday ? 'scale(1.1) translateY(0)' : 'translateY(0)';
                        e.currentTarget.style.boxShadow = isDoneToday
                            ? `0 8px 0 rgba(6, 78, 59, 0.5), inset 0 0 15px rgba(16, 185, 129, 0.3), inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`
                            : (columnIndex % 2 === 0
                                ? `0 8px 0 rgba(107, 82, 54, 0.5), inset 0 0 15px ${ACTIVE_COLOR}44, inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`
                                : `0 8px 0 rgba(63, 63, 70, 0.5), inset 0 0 15px ${ACTIVE_COLOR}44, inset 0 0 0 1px rgba(255,255,255,0.1), 0 15px 30px rgba(0,0,0,0.5)`);
                    }
                }}
            >
                <Icon
                    size={32}
                    color={isLocked ? 'rgba(255,255,255,0.3)' : '#ffffff'}
                    style={{ filter: isLocked ? 'grayscale(1)' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
                />
            </div>

            <div style={{ textAlign: 'center', width: '140px' }}>
                <span style={{
                    display: 'block',
                    color: isLocked ? 'var(--color-text-secondary)' : 'var(--color-text-main)',
                    fontWeight: '600',
                    fontSize: '13px',
                    lineHeight: '1.4',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}>
                    {habit.name}
                </span>
            </div>
        </div>
    );
});

const IslandRoad = React.memo(({ habits, toggleHabit, columnIndex, onOpenDetail, onDelete }) => {
    if (habits.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px 0', opacity: 0.5 }}>
                <div style={{ width: '1px', height: '100px', background: 'linear-gradient(to bottom, transparent, var(--color-border))' }} />
                <span style={{ fontSize: '12px', fontStyle: 'italic' }}>Empty path</span>
            </div>
        );
    }

    const NODE_WIDTH = 120;
    const NODE_HEIGHT = 88;
    const ROW_HEIGHT = 210;

    const yPositions = habits.reduce((acc, habit, i) => {
        if (i === 0) acc.push(0);
        else {
            const prevHabit = habits[i - 1];
            const gap = prevHabit.name.length > 30 ? ROW_HEIGHT + 30 : ROW_HEIGHT;
            acc.push(acc[i - 1] + gap);
        }
        return acc;
    }, []);

    const TOTAL_HEIGHT = yPositions.length > 0 ? yPositions[yPositions.length - 1] + ROW_HEIGHT : 0;

    let ACTIVE_COLOR;
    if (columnIndex % 2 === 0) {
        ACTIVE_COLOR = '#c39a6b';
    } else {
        ACTIVE_COLOR = '#8e8e93';
    }
    const today = getTodayString();

    return (
        <div style={{ position: 'relative', width: '100%', height: `${TOTAL_HEIGHT + 100}px`, marginTop: '40px' }}>
            {habits.slice(0, -1).map((_, i) => {
                const startX = i % 2 === 0 ? 35 : 65;
                const endX = i % 2 === 0 ? 65 : 35;
                const startY = yPositions[i] + (NODE_HEIGHT / 2);
                const endY = yPositions[i + 1] + (NODE_HEIGHT / 2);
                const isLongText = habits[i].name.length > 30;
                const tStart = isLongText ? 0.52 : 0.47;
                const tStep = isLongText ? 0.11 : 0.12;
                const tValues = [tStart, tStart + tStep, tStart + (tStep * 2)];

                return (
                    <React.Fragment key={`connector-${i}`}>
                        {tValues.map((t, dotIndex) => {
                            const left = startX + (endX - startX) * t;
                            const top = startY + (endY - startY) * t;
                            let size = dotIndex === 1 ? 28 : 18;
                            return (
                                <div
                                    key={`dot-${i}-${dotIndex}`}
                                    style={{
                                        position: 'absolute',
                                        left: `${left}%`,
                                        top: `${top}px`,
                                        width: `${size}px`,
                                        height: `${size}px`,
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2), inset 0 0 5px rgba(255,255,255,0.1)',
                                        transform: 'translate(-50%, -50%) translateZ(0)',
                                        zIndex: 0
                                    }}
                                />
                            );
                        })}
                    </React.Fragment>
                );
            })}

            {habits.map((habit, index) => {
                const isPreviousCompleted = index === 0 || Object.values(habits[index - 1].history || {}).some(v => v === true);
                const isDoneToday = habit.history && habit.history[today];
                return (
                    <IslandNode
                        key={habit.id}
                        habit={habit}
                        index={index}
                        yPosition={yPositions[index]}
                        isLocked={!isPreviousCompleted}
                        isDoneToday={isDoneToday}
                        toggleHabit={toggleHabit}
                        NODE_WIDTH={NODE_WIDTH}
                        NODE_HEIGHT={NODE_HEIGHT}
                        ACTIVE_COLOR={ACTIVE_COLOR}
                        columnIndex={columnIndex}
                        onOpenDetail={onOpenDetail}
                        onDelete={onDelete}
                    />
                );
            })}
        </div>
    );
});

const SkillContent = ({ skillId }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        state,
        addObjective, deleteObjective,
        addTask, toggleTask, deleteTask,
        addHabit, deleteHabit, toggleHabit,
        addResource, deleteResource,
        addFlashcardFolder, deleteFlashcardFolder
    } = useStore();

    const skill = (state.skills || {})[skillId];
    const area = (state.areas || {})[skill?.areaId];

    // Calculate goals and habits stably
    const objectives = React.useMemo(() => (skill?.objectiveIds || [])
        .map(objId => state.objectives[objId])
        .filter(Boolean), [skill?.objectiveIds, state.objectives]);

    const habits = React.useMemo(() => (skill?.habitIds || [])
        .map(hId => state.habits[hId])
        .filter(Boolean), [skill?.habitIds, state.habits]);

    // Calculate topics and filtered habits at top level (Rules of Hooks)
    const allTopics = React.useMemo(() => {
        if (area?.name !== 'Languages') return [];
        const customTopics = [...new Set(habits.map(h => h.category).filter(c => c && !DEFAULT_TOPICS.includes(c)))];
        return [...DEFAULT_TOPICS, ...customTopics];
    }, [habits, area?.name]);

    const habitsByTopic = React.useMemo(() => {
        const map = {};
        allTopics.forEach(topic => {
            map[topic] = habits.filter(h => h.category === topic);
        });
        return map;
    }, [allTopics, habits]);

    const [selectedHabit, setSelectedHabit] = React.useState(null);
    const [selectedFolder, setSelectedFolder] = React.useState(null); // New state
    const [isReviewing, setIsReviewing] = React.useState(false);

    // Aggregate all flashcards for this skill (Languages)
    const allSkillCards = React.useMemo(() => {
        if (area?.name !== 'Languages') return [];
        const islandCards = habits.flatMap(h => (h.cards || []).map(c => ({ ...c, sourceId: h.id, sourceType: 'island', sourceName: h.name })));
        const skillFolders = Object.values(state.flashcardFolders || {}).filter(f => f.skillId === skillId);
        const folderCards = skillFolders.flatMap(f => (f.cards || []).map(c => ({ ...c, sourceId: f.id, sourceType: 'folder', sourceName: f.name })));
        return [...islandCards, ...folderCards];
    }, [habits, state.flashcardFolders, area?.name, skillId]);

    const dueCards = React.useMemo(() => {
        const now = new Date();
        return allSkillCards.filter(c => new Date(c.nextReview) <= now);
    }, [allSkillCards]);

    const totalCardsCount = React.useMemo(() => {
        return allSkillCards.length;
    }, [allSkillCards]);

    if (!skill) return <div style={{ padding: '20px', color: 'var(--color-text-secondary)' }}>Select a skill to view details</div>;

    // Determine active tab from URL or default
    const activeTab = searchParams.get('tab') || (area?.name === 'Languages' ? 'islands' : 'objectives');

    const setActiveTab = (tabName) => {
        setSearchParams({ tab: tabName });
    };

    const handleAddObjective = () => {
        const title = prompt("What's your new objective? (e.g., 'Read 5 books', 'Reach $1k profit')");
        if (title) addObjective(skillId, title);
    };

    const handleAddTask = (objectiveId) => {
        const title = prompt("Add a task for this objective:");
        if (title) addTask(objectiveId, title);
    };

    const handleAddHabit = () => {
        const name = prompt("Enter new topic (e.g., 'Greeting People', 'Ordering Coffee')");
        if (name) addHabit([skillId], name);
    };

    const handleAddHabitColumn = (column) => {
        const name = prompt(`Add new island to "${column}":`);
        if (!name) return;

        // Find all language skills to keep them in sync structurally
        const languageSkills = Object.values(state.skills).filter(s => {
            const area = state.areas[s.areaId];
            return area && area.name === 'Languages';
        });

        if (languageSkills.length === 0) {
            // Fallback if something is wrong, just add to current
            addHabit([skillId], name, column);
        } else {
            // Add to all language skills
            languageSkills.forEach(s => {
                addHabit([s.id], name, column);
            });
        }
    };

    const handleAddTopic = () => {
        const topicName = prompt("What's the name of the new topic/column?");
        if (!topicName) return;

        const habitName = prompt(`Starting island name for "${topicName}"?`);
        if (!habitName) return;

        // Find all language skills to keep them in sync structurally
        const languageSkills = Object.values(state.skills).filter(s => {
            const area = state.areas[s.areaId];
            return area && area.name === 'Languages';
        });

        if (languageSkills.length === 0) {
            addHabit([skillId], habitName, topicName);
        } else {
            languageSkills.forEach(s => {
                addHabit([s.id], habitName, topicName);
            });
        }
    };

    const getLast14Days = () => {
        const dates = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    };

    const last14Days = getLast14Days();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* TABS NAVIGATION */}
            <div style={{
                display: 'flex',
                gap: '24px',
                paddingBottom: '0'
            }}>
                {area?.name === 'Languages' ? (
                    <>
                        <div className="tabs-navigation" style={{ display: 'flex', gap: '40px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px', padding: '0 10px' }}>
                            <button
                                onClick={() => setSearchParams({ tab: 'islands' })}
                                style={{
                                    padding: '16px 0', background: 'none', border: 'none',
                                    borderBottom: activeTab === 'islands' ? '2px solid #c39a6b' : '2px solid transparent',
                                    color: activeTab === 'islands' ? '#fff' : 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer', fontWeight: '800', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
                                    textShadow: activeTab === 'islands' ? '0 0 20px rgba(195, 154, 107, 0.4)' : 'none',
                                    transition: 'all 0.3s ease',
                                    display: 'flex', gap: '8px', alignItems: 'center'
                                }}
                            >
                                <Calendar size={14} /> The Path
                            </button>
                            <button
                                onClick={() => setSearchParams({ tab: 'flashcards' })}
                                style={{
                                    padding: '16px 0', background: 'none', border: 'none',
                                    borderBottom: activeTab === 'flashcards' ? '2px solid #c39a6b' : '2px solid transparent',
                                    color: activeTab === 'flashcards' ? '#fff' : 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer', fontWeight: '800', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
                                    textShadow: activeTab === 'flashcards' ? '0 0 20px rgba(195, 154, 107, 0.4)' : 'none',
                                    transition: 'all 0.3s ease',
                                    display: 'flex', gap: '8px', alignItems: 'center'
                                }}
                            >
                                <Zap size={14} /> Practice Hub
                            </button>
                            <button
                                onClick={() => setSearchParams({ tab: 'resources' })}
                                style={{
                                    padding: '16px 0', background: 'none', border: 'none',
                                    borderBottom: activeTab === 'resources' ? '2px solid #c39a6b' : '2px solid transparent',
                                    color: activeTab === 'resources' ? '#fff' : 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer', fontWeight: '800', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
                                    textShadow: activeTab === 'resources' ? '0 0 20px rgba(195, 154, 107, 0.4)' : 'none',
                                    transition: 'all 0.3s ease',
                                    display: 'flex', gap: '8px', alignItems: 'center'
                                }}
                            >
                                <FileText size={14} /> Resources
                            </button>
                            <button
                                onClick={() => setSearchParams({ tab: 'warhead' })}
                                style={{
                                    padding: '16px 0', background: 'none', border: 'none',
                                    borderBottom: activeTab === 'warhead' ? '2px solid #c39a6b' : '2px solid transparent',
                                    color: activeTab === 'warhead' ? '#fff' : 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer', fontWeight: '800', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
                                    textShadow: activeTab === 'warhead' ? '0 0 20px rgba(195, 154, 107, 0.4)' : 'none',
                                    transition: 'all 0.3s ease',
                                    display: 'flex', gap: '8px', alignItems: 'center'
                                }}
                            >
                                <Sparkles size={14} /> Warhead
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setActiveTab('objectives')}
                            style={{ padding: '8px 0', background: 'none', border: 'none', borderBottom: activeTab === 'objectives' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'objectives' ? 'var(--color-primary)' : 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: '500', display: 'flex', gap: '6px', alignItems: 'center' }}
                        >
                            <Target size={16} /> Objectives
                        </button>
                        <button
                            onClick={() => setActiveTab('habits')}
                            style={{ padding: '8px 0', background: 'none', border: 'none', borderBottom: activeTab === 'habits' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'habits' ? 'var(--color-primary)' : 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: '500', display: 'flex', gap: '6px', alignItems: 'center' }}
                        >
                            <Calendar size={16} /> Habits
                        </button>
                    </>
                )}
            </div>

            {/* CONTENT SECTIONS */}
            <div className="tab-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {activeTab === 'objectives' && area?.name !== 'Languages' && (
                    <div className="objectives-section">
                        <button
                            onClick={handleAddObjective}
                            className="primary-button liquid-glass"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: 'var(--radius-md)', color: 'var(--color-text-main)', marginBottom: 'var(--spacing-lg)', width: '100%', justifyContent: 'center', cursor: 'pointer',
                                background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                        >
                            <Plus size={18} /> Add New Objective
                        </button>

                        {objectives.length === 0 && (
                            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No objectives yet. Set a goal!</p>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            {objectives.map(obj => {
                                const tasks = (obj.taskIds || []).map(tid => state.tasks[tid]).filter(Boolean);
                                return (
                                    <div key={obj.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-bg-card)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                                            <h3 style={{ fontSize: 'var(--font-size-lg)' }}>{obj.title}</h3>
                                            <button onClick={() => deleteObjective(obj.id, skillId)} style={{ color: 'var(--color-text-secondary)', opacity: 0.5, border: 'none', background: 'none', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px' }}>
                                            {tasks.map(task => (
                                                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <button onClick={() => toggleTask(task.id)} style={{ background: 'none', border: 'none', color: task.isCompleted ? 'var(--color-success)' : 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                                        {task.isCompleted ? <CheckCircle size={20} /> : <Circle size={20} />}
                                                    </button>
                                                    <span style={{ textDecoration: task.isCompleted ? 'line-through' : 'none', color: task.isCompleted ? 'var(--color-text-secondary)' : 'var(--color-text-main)', flex: 1 }}>{task.title}</span>
                                                    <span style={{ fontSize: '10px', color: 'var(--color-accent)', fontWeight: 'bold' }}>+{task.rewardValue} ₴</span>
                                                    <button onClick={() => deleteTask(task.id, obj.id)} style={{ border: 'none', background: 'none', color: 'var(--color-text-secondary)', opacity: 0.3, cursor: 'pointer' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => handleAddTask(obj.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', border: 'none', background: 'none', padding: '4px', cursor: 'pointer' }}>
                                                <Plus size={14} /> Add Task
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {(activeTab === 'islands' || (activeTab === 'habits' && area?.name !== 'Languages')) && (
                    <div className="habits-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        {area?.name !== 'Languages' && (
                            <button
                                onClick={handleAddHabit}
                                className="primary-button liquid-glass"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: 'var(--radius-md)', color: 'var(--color-text-main)', marginBottom: 'var(--spacing-lg)', width: '100%', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                    background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)'
                                }}
                            >
                                <Plus size={18} /> Add New Habit
                            </button>
                        )}

                        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '10px' }}>
                            {habits.length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '40px' }}>No {area?.name === 'Languages' ? 'islands' : 'habits'} yet.</p>
                            )}

                            {area?.name === 'Languages' ? (
                                <div style={{
                                    display: 'flex',
                                    gap: '60px',
                                    overflowX: 'auto',
                                    paddingBottom: '40px',
                                    paddingTop: '12px',
                                    paddingLeft: '20px',
                                    paddingRight: '300px',
                                    WebkitOverflowScrolling: 'touch',
                                    minHeight: '600px',
                                    scrollSnapType: 'x proximity'
                                }}>
                                    {allTopics.map((column, colIndex) => (
                                        <div key={column} style={{
                                            flex: '0 0 280px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            borderRight: '1px solid rgba(255,255,255,0.05)',
                                            scrollSnapAlign: 'start'
                                        }}>
                                            <h4 style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--color-text-secondary)', fontSize: '13px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}>{column}</h4>

                                            <IslandRoad
                                                habits={habitsByTopic[column] || []}
                                                toggleHabit={toggleHabit}
                                                columnIndex={colIndex}
                                                onOpenDetail={setSelectedHabit}
                                                onDelete={(habitId) => deleteHabit(habitId, skillId)}
                                            />

                                            <button
                                                onClick={() => handleAddHabitColumn(column)}
                                                className="liquid-glass"
                                                style={{
                                                    marginTop: '20px',
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    width: '32px',
                                                    height: '32px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    color: 'var(--color-primary)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                                    flexShrink: 0
                                                }}
                                                title={`Add to ${column}`}
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Add Topic Button */}
                                    <div style={{ flex: '0 0 200px', minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '60px', scrollSnapAlign: 'start', marginRight: '400px' }}>
                                        <button
                                            onClick={handleAddTopic}
                                            className="liquid-glass"
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: 'var(--radius-lg)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                background: 'rgba(255,255,255,0.02)',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                                                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                            }}
                                            onMouseEnter={e => { if (e.currentTarget) e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)'; }}
                                            onMouseLeave={e => { if (e.currentTarget) e.currentTarget.style.transform = 'scale(1) rotate(0deg)'; }}
                                        >
                                            <Plus size={24} />
                                            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>TOPIC</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                    {habits.map(habit => (
                                        <div key={habit.id} style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <span style={{ fontWeight: '600' }}>{habit.name}</span>
                                                <button onClick={() => deleteHabit(habit.id, skillId)} style={{ border: 'none', background: 'none', opacity: 0.5, cursor: 'pointer' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
                                                {last14Days.map(date => {
                                                    const isDone = habit.history && habit.history[date];
                                                    const isToday = date === getTodayString();
                                                    return (
                                                        <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                            <div
                                                                onClick={() => toggleHabit(habit.id, date)}
                                                                title={date}
                                                                style={{
                                                                    width: 'var(--habit-square-size, 24px)', height: 'var(--habit-square-size, 24px)', borderRadius: '4px', backgroundColor: isDone ? 'var(--color-success)' : 'var(--color-bg-secondary)', border: isToday ? '1px solid var(--color-primary)' : '1px solid transparent', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isDone ? 1 : 0.5
                                                                }}
                                                            >
                                                                {isDone && <CheckCircle size={14} color="white" />}
                                                            </div>
                                                            <span style={{ fontSize: '9px', color: 'var(--color-text-secondary)' }}>{date.slice(8)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'flashcards' && area?.name === 'Languages' && (
                    <div className="flashcards-tab" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '20px' }}>
                        {isReviewing ? (
                            <FlashcardReview
                                dueCards={dueCards}
                                onFinish={() => setIsReviewing(false)}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', width: '100%' }}>
                                {/* Top Stats & Primary Action */}
                                <div className="flashcard-stats" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '30px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', gap: '40px' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', opacity: 0.5, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Due Now</div>
                                            <div style={{ fontSize: '32px', fontWeight: '800', color: dueCards.length > 0 ? '#c39a6b' : '#fff' }}>{dueCards.length}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', opacity: 0.5, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Cards</div>
                                            <div style={{ fontSize: '32px', fontWeight: '800' }}>{totalCardsCount}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsReviewing(true)}
                                        disabled={dueCards.length === 0}
                                        style={{
                                            padding: '16px 40px',
                                            borderRadius: '20px',
                                            background: dueCards.length > 0 ? 'linear-gradient(135deg, #c39a6b, #8b6b4a)' : 'rgba(255,255,255,0.05)',
                                            border: 'none',
                                            color: dueCards.length > 0 ? 'white' : 'rgba(255,255,255,0.2)',
                                            fontWeight: '800',
                                            fontSize: '14px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            cursor: dueCards.length > 0 ? 'pointer' : 'default',
                                            boxShadow: dueCards.length > 0 ? '0 10px 30px rgba(113, 89, 61, 0.3)' : 'none',
                                            transition: 'all 0.3s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}
                                    >
                                        <Zap size={18} /> Start Session
                                    </button>
                                </div>

                                {/* Folders Section */}
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Folder size={20} color="#c39a6b" /> Practice Folders
                                        </h3>
                                        <button
                                            onClick={() => {
                                                const name = prompt("Folder Name?");
                                                if (name) addFlashcardFolder(skillId, name);
                                            }}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', padding: '8px 16px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Plus size={14} /> New Folder
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                        {Object.values(state.flashcardFolders || {}).filter(f => f.skillId === skillId).map(folder => {
                                            const folderDueCount = (folder.cards || []).filter(c => new Date(c.nextReview) <= new Date()).length;
                                            return (
                                                <div key={folder.id} className="liquid-glass" style={{ padding: '24px', borderRadius: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div>
                                                            <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{folder.name}</div>
                                                            <div style={{ fontSize: '12px', opacity: 0.5 }}>{(folder.cards || []).length} cards</div>
                                                        </div>
                                                        {folderDueCount > 0 && (
                                                            <div style={{ padding: '4px 8px', borderRadius: '8px', background: 'rgba(195, 154, 107, 0.2)', color: '#c39a6b', fontSize: '10px', fontWeight: '800' }}>
                                                                {folderDueCount} DUE
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                                                        <button
                                                            onClick={() => setSelectedFolder(folder)}
                                                            style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                                                        >
                                                            Open
                                                        </button>
                                                        <button
                                                            onClick={() => { if (confirm("Delete folder? Cards will be lost.")) deleteFlashcardFolder(folder.id); }}
                                                            style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,0,0,0.05)', border: 'none', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                {/* Islands as Folders Section */}
                                <section>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Bot size={20} color="#c39a6b" /> Island Phrasebooks
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                        {habits.map(habit => {
                                            const habitDueCount = (habit.cards || []).filter(c => new Date(c.nextReview) <= new Date()).length;
                                            return (
                                                <div
                                                    key={habit.id}
                                                    className="liquid-glass"
                                                    onClick={() => setSelectedHabit(habit)}
                                                    style={{ padding: '24px', borderRadius: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', transition: 'all 0.2s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div>
                                                            <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{habit.name}</div>
                                                            <div style={{ fontSize: '12px', opacity: 0.5 }}>{(habit.cards || []).length} phrases</div>
                                                        </div>
                                                        {habitDueCount > 0 && (
                                                            <div style={{ padding: '4px 8px', borderRadius: '8px', background: 'rgba(195, 154, 107, 0.2)', color: '#c39a6b', fontSize: '10px', fontWeight: '800' }}>
                                                                {habitDueCount} DUE
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4, fontSize: '11px' }}>
                                                        <Sparkles size={12} /> Click to manage contextual phrases
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'resources' && area?.name === 'Languages' && (
                    <div className="resources-section">
                        <button
                            onClick={() => {
                                const title = prompt("Resource Title?");
                                if (title) {
                                    const url = prompt("URL?");
                                    addResource(skillId, title, url);
                                }
                            }}
                            className="primary-button liquid-glass"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: 'var(--radius-md)', color: 'var(--color-text-main)', marginBottom: 'var(--spacing-lg)', width: '100%', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: '500'
                            }}
                        >
                            <Plus size={18} /> Add New Resource
                        </button>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {(skill.resources || []).map(resource => (
                                <div key={resource.id} className="resource-item liquid-glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 'var(--radius-md)', cursor: resource.url ? 'pointer' : 'default' }} onClick={() => resource.url && window.open(resource.url, '_blank')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden' }}>
                                        <FileText size={16} />
                                        <span style={{ fontSize: '14px' }}>{resource.title}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) deleteResource(resource.id, skillId); }} style={{ background: 'none', border: 'none', opacity: 0.3, cursor: 'pointer' }}><Trash2 size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'warhead' && area?.name === 'Languages' && (
                    <div className="warhead-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <WarheadChat mode="embedded" />
                    </div>
                )}
            </div>

            {selectedHabit && (
                <IslandDetailModal
                    habit={selectedHabit}
                    onClose={() => setSelectedHabit(null)}
                />
            )}
            {selectedFolder && (
                <FolderDetailModal
                    folder={selectedFolder}
                    onClose={() => setSelectedFolder(null)}
                />
            )}
        </div>
    );
};

export default SkillContent;
