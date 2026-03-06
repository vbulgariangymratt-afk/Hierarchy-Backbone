import React from 'react';
import { Check, Trash2, Tag, Image, Target } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const HabitCard = ({ habit, skills, days, todayString, onDragStart, onDragEnd, hideSkills = false, gridCols = 16, squareSize = '10px', justifyContent = 'flex-start' }) => {
    const { state, toggleHabit, updateHabit, deleteHabit, incrementHabitIntegration, setLoggingSats } = useStore();
    const [showSkillSelector, setShowSkillSelector] = React.useState(false);

    const PHASES = [
        { label: 'Seed', icon: '🌱', color: 'rgba(255,255,255,0.45)' },
        { label: 'Sprout', icon: '🌿', color: 'rgba(255,255,255,0.55)' },
        { label: 'Mature', icon: '🌳', color: 'rgba(255,255,255,0.7)' },
        { label: 'Baseline', icon: '💎', color: 'var(--color-primary)' }
    ];

    const currentPhase = PHASES[habit.integrationLevel || 0];
    const stability = habit.stabilityScore || 0;
    const targets = [7, 14, 21, 1]; // Requirements for Seed, Sprout, Mature
    const currentTarget = targets[habit.integrationLevel || 0] || 7;
    const stabilityPercent = Math.min((stability / currentTarget) * 100, 100);
    const isReadyToLevel = stability >= currentTarget && (habit.integrationLevel || 0) < 3;
    const isLightMode = state.themeMode === 'light';
    const showBackgrounds = state.showBackgrounds !== false;
    const coverImage = isLightMode ? habit.coverLight : habit.cover;
    const hasCover = coverImage?.startsWith('http') || coverImage?.startsWith('data:');


    const toggleSkill = (skillId) => {
        const currentSkillIds = habit.skillIds || (habit.skillId ? [habit.skillId] : []);
        const newSkillIds = currentSkillIds.includes(skillId)
            ? currentSkillIds.filter(id => id !== skillId)
            : [...currentSkillIds, skillId];
        updateHabit(habit.id, { skillIds: newSkillIds });
    };

    const HabitHistoryGrid = ({ emptyColor, borderColor }) => {
        const target = habit.targetDailyCount || 1;

        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent, gap: '8px', width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, ${squareSize})`, gap: '2px', width: 'fit-content' }}>
                    {days.map(date => {
                        const isFuture = date > todayString;
                        const val = habit.history?.[date];
                        const count = val === true ? 1 : (Number(val) || 0);
                        const isCompleted = count >= target;
                        const progress = Math.min(count / target, 1);
                        const isToday = date === todayString;

                        return (
                            <div
                                key={date}
                                title={`${date}${target > 1 ? ` (${count}/${target})` : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isFuture) {
                                        if (habit.linkedSatsId && date === todayString) {
                                            setLoggingSats({ type: habit.linkedSatsType || 'manifestations', id: habit.linkedSatsId, habitId: habit.id });
                                        } else {
                                            toggleHabit(habit.id, date);
                                        }
                                    }
                                }}
                                style={{
                                    width: squareSize,
                                    height: squareSize,
                                    borderRadius: '3px',
                                    backgroundColor: count > 0 ? 'var(--color-primary)' : emptyColor,
                                    border: count > 0 ? '1px solid rgba(255,255,255,0.1)' : (showBackgrounds ? 'none' : '1px solid rgba(255,255,255,0.03)'),
                                    cursor: isFuture ? 'default' : 'pointer',
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: count > 0 ? (0.4 + (0.6 * progress)) : 1,
                                    transition: 'opacity 0.3s ease, background-color 0.3s ease, border-color 0.3s ease',
                                    transform: count > 0 ? 'scale(1)' : 'scale(1)',
                                    willChange: 'opacity'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isFuture) {
                                        e.currentTarget.style.transform = 'scale(1.15)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                {isToday && count < target && (
                                    <svg width="10" height="10" style={{ position: 'absolute' }}>
                                        <line x1="2" y1="2" x2="8" y2="8" stroke="rgba(150,150,150,0.5)" strokeWidth="1" />
                                        <line x1="8" y1="2" x2="2" y2="8" stroke="rgba(150,150,150,0.5)" strokeWidth="1" />
                                    </svg>
                                )}
                            </div>
                        );
                    })}
                </div>
                {(() => {
                    const val = habit.history?.[todayString];
                    const count = val === true ? 1 : (Number(val) || 0);
                    const isComplete = count >= target;

                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (habit.linkedSatsId) {
                                    setLoggingSats({ type: habit.linkedSatsType || 'manifestations', id: habit.linkedSatsId, habitId: habit.id });
                                } else {
                                    toggleHabit(habit.id, todayString);
                                }
                            }}
                            className="liquid-glass"
                            style={{
                                width: '24px', height: '24px', borderRadius: '50%', padding: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginLeft: '8px',
                                border: '1px solid rgba(0,0,0,0.1)',
                                color: count > 0 ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)',
                                background: count > 0 ? `rgba(195, 154, 107, ${0.4 * (count / target)})` : 'rgba(255,255,255,0.02)',
                                transition: 'all 0.15s ease-out',
                                boxShadow: 'none',
                                flexShrink: 0,
                                cursor: 'pointer',
                                transform: 'scale(1)'
                            }}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.85)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            {isComplete ? <Check size={14} strokeWidth={3} /> : (
                                count > 0 ? <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{count}</span> : <Check size={14} strokeWidth={3} />
                            )}
                        </button>
                    );
                })()}
            </div>
        );
    };

    const [isSelected, setIsSelected] = React.useState(false);

    return (
        <div
            draggable={!!onDragStart}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => setIsSelected(!isSelected)}
            style={{
                marginBottom: '16px',
                borderRadius: '24px',
                position: 'relative',
                overflow: 'hidden',
                cursor: onDragStart ? 'grab' : 'pointer',
                backgroundColor: !showBackgrounds ? '#1e1e1e' : 'transparent',
                backdropFilter: showBackgrounds ? 'blur(10px)' : 'none',
                WebkitBackdropFilter: showBackgrounds ? 'blur(10px)' : 'none',
                willChange: 'transform, box-shadow',
                transform: 'translateZ(0) translateY(0)',
                breakInside: 'avoid',
                WebkitColumnBreakInside: 'avoid',
                border: '1px solid rgba(255,255,255,0.05)'
            }}
            className={`hover-trigger liquid-glass`}
        >
            {hasCover ? (
                <div style={{ position: 'relative', minHeight: '100px', backgroundColor: showBackgrounds ? 'transparent' : 'transparent', border: 'none', borderRadius: '24px', overflow: 'hidden' }}>
                    <img src={coverImage} alt="" style={{ width: '100%', minHeight: '100px', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                        position: 'absolute', bottom: '52px', left: 0, right: 0,
                        padding: '0 12px 6px',
                        zIndex: 2, // Promote above background
                        pointerEvents: 'none' // Text shouldn't block clicks if layout changes
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{
                                fontSize: '8px', fontWeight: '800', background: 'rgba(0,0,0,0.5)',
                                color: currentPhase.color, padding: '2px 8px', borderRadius: '10px',
                                border: `1px solid rgba(255,255,255,0.1)`, textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {currentPhase.icon} {currentPhase.label}
                            </span>
                        </div>
                        <h3 style={{ color: 'white', fontWeight: '600', marginBottom: 0 }}>{habit.name}</h3>
                    </div>

                    {/* Gradient & Glass Overlay (Background for Text/Grid) */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: '100px', // Explicit height to cover text + grid area
                        background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
                        backdropFilter: showBackgrounds ? 'blur(4px)' : 'none',
                        zIndex: 1,
                        pointerEvents: 'none',
                        maskImage: 'linear-gradient(to top, black 40%, transparent 100%)', // Harder fade for cleaner look
                        WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)'
                    }} />

                    {/* Fixed Bottom History Grid Container */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '12px',
                        zIndex: 2, // Promote above background
                    }}>
                        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <HabitHistoryGrid emptyColor="rgba(255,255,255,0.15)" borderColor="1px solid rgba(255,255,255,0.1)" />
                            {(habit.integrationLevel || 0) < 3 && (
                                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '2.5px', overflow: 'hidden' }}>
                                    <div style={{ width: `${stabilityPercent}%`, height: '100%', background: 'rgba(255,255,255,0.5)', transition: 'width 0.5s ease-out' }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{
                            fontSize: '9px', fontWeight: '800', background: 'rgba(255,255,255,0.03)',
                            color: 'var(--color-text-secondary)', padding: '3px 10px', borderRadius: '6px',
                            border: `1px solid rgba(255,255,255,0.05)`, textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            {currentPhase.icon} {currentPhase.label}
                        </span>
                    </div>
                    <h3 style={{ fontWeight: '600', marginBottom: '8px' }}>{habit.name}</h3>
                    {!hideSkills && (
                        <div className="hide-until-hover" style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {skills.map(skill => (
                                <span key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                    {skill.icon || '🎯'} {skill.name}
                                </span>
                            ))}
                            {skills.length === 0 && <span>No Skill</span>}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <HabitHistoryGrid emptyColor="rgba(128,128,128,0.1)" borderColor="1px solid var(--color-border)" />
                        {(habit.integrationLevel || 0) < 3 && (
                            <div style={{ width: '100%', height: '5px', background: 'rgba(128,128,128,0.1)', borderRadius: '2.5px', overflow: 'hidden' }}>
                                <div style={{ width: `${stabilityPercent}%`, height: '100%', background: 'var(--color-text-secondary)', opacity: 0.5, transition: 'width 0.5s ease-out' }} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Level Up Button - Always visible when ready */}
            {isReadyToLevel && (
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    zIndex: 11
                }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); incrementHabitIntegration(habit.id); }}
                        style={{
                            background: 'linear-gradient(135deg, var(--color-primary) 0%, rgba(195, 154, 107, 0.8) 100%)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '12px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: '700',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 4px 12px rgba(195, 154, 107, 0.4), 0 0 20px rgba(195, 154, 107, 0.3)',
                            animation: 'pulse 2s infinite',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(195, 154, 107, 0.6), 0 0 30px rgba(195, 154, 107, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(195, 154, 107, 0.4), 0 0 20px rgba(195, 154, 107, 0.3)';
                        }}
                    >
                        <span style={{ fontSize: '14px' }}>⚡</span>
                        Level Up!
                    </button>
                </div>
            )}

            {/* Action Buttons */}
            <div style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                display: 'flex',
                gap: '4px',
                zIndex: 10,
                opacity: isSelected ? 1 : 0,
                pointerEvents: isSelected ? 'auto' : 'none',
                transition: 'opacity 0.2s',
                transform: isSelected ? 'translateY(0)' : 'translateY(-5px)'
            }} className="action-buttons">
                <button
                    onClick={(e) => { e.stopPropagation(); setShowSkillSelector(!showSkillSelector); }}
                    style={{
                        background: showSkillSelector ? 'var(--color-primary)' : 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white'
                    }}
                    title="Select Skills"
                ><Tag size={12} /></button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        const newCover = prompt("Cover Image URL:");
                        if (newCover) {
                            const field = isLightMode ? 'coverLight' : 'cover';
                            updateHabit(habit.id, { [field]: newCover });
                        }
                    }}
                    style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white'
                    }}
                ><Image size={12} /></button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        const current = habit.targetDailyCount || 1;
                        const newTarget = prompt("Set Daily Goal (e.g., 1, 2, 3):", current);
                        if (newTarget && !isNaN(newTarget)) {
                            updateHabit(habit.id, { targetDailyCount: parseInt(newTarget) });
                        }
                    }}
                    style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white'
                    }}
                    title="Set Daily Goal"
                ><Target size={12} /></button>
                <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteHabit(habit.id); }}
                    style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        color: 'var(--color-danger)',
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                ><Trash2 size={12} /></button>
            </div>

            {/* Skill Selector Popup */}
            {showSkillSelector && (
                <div
                    style={{
                        position: 'absolute',
                        top: '40px',
                        right: '6px',
                        width: '220px',
                        background: 'rgba(20, 20, 20, 0.95)',
                        backdropFilter: 'blur(15px)',
                        border: '1px solid rgba(128, 128, 128, 0.3)',
                        borderRadius: '12px',
                        padding: '12px',
                        zIndex: 100,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                    className="skill-selector-popup"
                    onClick={e => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Associate Skills
                        </div>
                        <button
                            onClick={() => setShowSkillSelector(false)}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                        >
                            <span style={{ fontSize: '11px' }}>Done</span>
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {Object.values(state.skills).map(skill => {
                            const currentSkillIds = habit.skillIds || (habit.skillId ? [habit.skillId] : []);
                            const isSelected = currentSkillIds.includes(skill.id);
                            return (
                                <button
                                    key={skill.id}
                                    onClick={() => toggleSkill(skill.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid transparent',
                                        background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                                        color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: '13px',
                                        transition: 'all 0.2s',
                                        fontWeight: isSelected ? '600' : '400'
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                            e.currentTarget.style.color = '#fff';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                                        }
                                    }}
                                >
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '6px',
                                        background: isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px',
                                        transition: 'all 0.2s'
                                    }}>
                                        {skill.icon || '🎯'}
                                    </div>
                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{skill.name}</span>
                                    {isSelected && <Check size={14} color="var(--color-primary)" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HabitCard;
