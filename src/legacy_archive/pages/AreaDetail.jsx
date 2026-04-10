import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, BookOpen, Trash2, Check, Maximize2, Clipboard, Image } from 'lucide-react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import SkillContent from '../components/SkillContent';
import SubCalendar from '../components/SubCalendar';
import AreaTaskSchedule from '../components/AreaTaskSchedule';
import FinanceResources from '../components/FinanceResources';
import HabitCard from '../components/HabitCard';
import BeliefsTable from '../components/BeliefsTable';

const variants = {
    enter: (direction) => ({
        x: direction > 0 ? '100%' : direction < 0 ? '-100%' : 0,
        opacity: 1
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1
    },
    exit: (direction) => ({
        zIndex: 0,
        x: direction < 0 ? '100%' : direction > 0 ? '-100%' : 0,
        opacity: 1
    })
};

const AreaDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();


    // HOT BODY HOVER STYLES
    const hotBodyHoverStyles = `
        .hot-body-card .hot-body-habit-list {
            /* Hidden State - Pre-warmed for instant glass rendering */
            opacity: 0.01;
            visibility: hidden;
            max-height: 0;
            overflow: hidden;
            pointer-events: none;
            transition: opacity 0.3s ease, max-height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), margin-top 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
            z-index: 20;
            will-change: opacity, max-height;
            transform: translateZ(0); /* Force GPU thread */
        }
        
        .hot-body-card:hover .hot-body-habit-list {
            opacity: 1;
            visibility: visible;
            max-height: 500px;
            margin-top: 16px;
            pointer-events: auto;
        }

        .hot-body-habit-pill {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 10px 16px;
            transition: background 0.2s ease, transform 0.2s ease;
            transform: translateZ(0); /* Force GPU layer */
        }

        .hot-body-habit-pill:hover {
            background: rgba(0, 0, 0, 0.5);
            border-color: rgba(255, 255, 255, 0.25);
            transform: scale(1.02);
        }

        .hot-body-card .skill-cover-img {
            transition: filter 0.3s ease;
            height: 100% !important;
            min-height: 400px !important; 
        }

        .hot-body-card:hover .skill-cover-img {
            filter: brightness(0.8);
        }

        /* Title Animation */
        .hot-body-card .hot-body-title-container {
            transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
            transform: translateY(0);
        }
    `;
    const { state, addSkill, deleteSkill, deleteArea, updateArea, updateSkill, reorderSkills, addBeliefTopic, toggleHabit } = useStore();

    // Date helpers for HabitCard
    const getAdjustedDate = () => {
        const now = new Date();
        now.setHours(now.getHours() - 4);
        return now;
    };
    const adjustedNow = getAdjustedDate();
    const currentYear = adjustedNow.getFullYear();
    const currentMonth = adjustedNow.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(currentYear, currentMonth, i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        days.push(`${year}-${month}-${day}`);
    }
    const getTodayString = () => {
        const d = getAdjustedDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const todayString = getTodayString();

    // Icon Edit State
    const [isEditingIcon, setIsEditingIcon] = useState(false);
    const [iconInput, setIconInput] = useState("");

    // Side view selection for Spiritual
    const [selectedSkillId, setSelectedSkillId] = useState(null);
    const [activeSpiritualTab, setActiveSpiritualTab] = useState('beliefs');
    const [direction, setDirection] = useState(0);
    // REMOVED: const [hoveredSkillId, setHoveredSkillId] = useState(null); - Causes Safari re-render flicker
    const [focusedCardId, setFocusedCardId] = useState(null);
    const [isBeliefsHovered, setIsBeliefsHovered] = useState(false);
    const showBackgrounds = state.showBackgrounds !== false;

    const area = state.areas[id];

    // Get skills for this area (Memoized to prevent infinite loop in useEffect)
    const skills = React.useMemo(() => {
        if (!area) return [];
        const isLight = state.themeMode === 'light';
        const targetIds = (isLight && area.skillIdsLight) ? area.skillIdsLight : area.skillIds;
        return targetIds.map(skillId => state.skills[skillId]).filter(Boolean);
    }, [area, state.skills, state.themeMode]);

    // Auto-select first skill for Spiritual if none selected
    useEffect(() => {
        if (area?.name === 'Spiritual' && skills.length > 0 && !selectedSkillId) {
            setSelectedSkillId(skills[0].id);
        }
    }, [area, skills, selectedSkillId]);

    // Guard clause if area deleted or not found
    if (!area) return <div style={{ padding: '2rem' }}>Area not found</div>;

    const handleAddSkill = () => {
        const name = prompt("Enter new Skill name (e.g., 'Running')");
        if (name) {
            const icon = prompt("Enter an Icon URL or Emoji (optional)", "🎯");
            addSkill(id, name, icon || "🎯");
        }
    };

    const handleIconClick = () => {
        setIconInput(area.icon);
        setIsEditingIcon(true);
    };

    const handleSaveIcon = () => {
        if (iconInput) {
            updateArea(id, { icon: iconInput });
        }
        setIsEditingIcon(false);
    };

    const handleDeleteArea = () => {
        if (confirm('Are you sure you want to delete this Area? This cannot be undone.')) {
            deleteArea(id);
            navigate('/');
        }
    }

    // Image Paste Logic
    const [pastingSkillId, setPastingSkillId] = useState(null);

    useEffect(() => {
        if (!pastingSkillId) return;

        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64 = event.target.result;
                        const targetField = state.themeMode === 'light' ? 'coverLight' : 'cover';
                        updateSkill(pastingSkillId, { [targetField]: base64 });
                        setPastingSkillId(null); // Stop listening
                    };
                    reader.readAsDataURL(blob);
                    e.preventDefault(); // Prevent default paste behavior
                    return; // Stop checking other items
                }
            }
            // If we got here, maybe they pasted a URL?
            const pastedText = e.clipboardData?.getData('text');
            if (pastedText && (pastedText.startsWith('http') || pastedText.startsWith('data:'))) {
                const targetField = state.themeMode === 'light' ? 'coverLight' : 'cover';
                updateSkill(pastingSkillId, { [targetField]: pastedText });
                setPastingSkillId(null);
                e.preventDefault();
            }
        };

        // Add listener
        window.addEventListener('paste', handlePaste);

        // Click outside to cancel
        const createClickListener = (e) => {
            // small delay to avoid immediate trigger from the button click
            setTimeout(() => {
                const handleClick = () => {
                    setPastingSkillId(null);
                    window.removeEventListener('click', handleClick);
                };
                window.addEventListener('click', handleClick);
            }, 100);
        };
        // actually, let's just make clicking anywhere else cancel it, but we need to cleanup properly.
        // Easiest is just a cleanup function in useEffect + click listener on window

        const handleClickAnywhere = (e) => {
            // If we clicked strictly outside, we cancel. But since the button stops propagation, we might need to be careful.
            // Simplest: The user clicks the button -> activates mode. 
            // If they click anything else -> deactivate.
            if (!e.target.closest('.paste-trigger-btn')) {
                setPastingSkillId(null);
            }
        };

        window.addEventListener('click', handleClickAnywhere);

        return () => {
            window.removeEventListener('paste', handlePaste);
            window.removeEventListener('click', handleClickAnywhere);
        };
    }, [pastingSkillId, updateSkill]);

    const isSpiritual = area?.name === 'Spiritual';
    const isFinance = area?.name === 'Finance' || area?.name === 'Latte app';

    return (
        <div key={id} className="area-detail" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {area?.name === 'Hot body' && <style>{hotBodyHoverStyles}</style>}
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: isFinance ? 'var(--spacing-md)' : 'var(--spacing-xl)', position: 'relative' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(128,128,128,0.2)',
                        borderRadius: '50%',
                        color: 'var(--color-text-secondary)',
                        marginRight: 'var(--spacing-lg)',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                >
                    <ArrowLeft size={18} />
                </button>

                {/* Icon Section with Spotlight Glow */}
                <div style={{ marginRight: 'var(--spacing-md)', display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '100px',
                        height: '100px',
                        background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
                        opacity: 0.2,
                        filter: 'blur(20px)',
                        zIndex: 0,
                        pointerEvents: 'none'
                    }} />

                    {isEditingIcon ? (
                        <div style={{ display: 'flex', gap: '8px', zIndex: 1 }}>
                            <input
                                autoFocus
                                type="text"
                                value={iconInput}
                                onChange={(e) => setIconInput(e.target.value)}
                                placeholder="Paste URL or Emoji..."
                                style={{
                                    padding: '8px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-primary)',
                                    fontSize: '1rem',
                                    width: '200px',
                                    background: 'var(--color-bg-secondary)',
                                    color: 'var(--color-text-main)'
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveIcon();
                                    if (e.key === 'Escape') setIsEditingIcon(false);
                                }}
                            />
                            <button onClick={handleSaveIcon} className="btn btn-primary" style={{ padding: '4px 12px' }}>Save</button>
                            <button onClick={() => setIsEditingIcon(false)} className="btn" style={{ padding: '4px 12px' }}>X</button>
                        </div>
                    ) : (
                        <div
                            onClick={handleIconClick}
                            title="Click to change icon"
                            style={{
                                fontSize: '3.5rem',
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                position: 'relative',
                                zIndex: 1,
                                filter: 'drop-shadow(0 0 15px rgba(0,0,0,0.3))'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1) rotate(0deg)'}
                        >
                            {(area.icon?.startsWith('http') || area.icon?.startsWith('data:')) ?
                                <img src={area.icon} alt={area.name} style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
                                : area.icon
                            }
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflow: 'hidden' }}>
                    <h1 style={{
                        fontSize: '3rem',
                        fontWeight: '800',
                        lineHeight: '1.2',
                        color: '#fff',
                        letterSpacing: '-0.03em',
                        margin: 0
                    }}>
                        {area.name}
                    </h1>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '4px 12px',
                        borderRadius: '100px',
                        width: 'fit-content',
                        border: '1px solid rgba(128,128,128,0.1)'
                    }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            boxShadow: '0 0 8px var(--color-primary)'
                        }} />
                        <span style={{
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '12px',
                            fontWeight: '600',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}>
                            {skills.length} {area.name === 'Languages' ? 'LANGUAGES' : 'SKILLS'}
                        </span>
                    </div>
                </div>
            </div>


            {/* Layout Container */}
            {!isFinance ? (
                <div style={{
                    display: 'flex',
                    flexDirection: isSpiritual ? 'column' : 'column',
                    gap: isSpiritual ? 'var(--spacing-xl)' : '0',
                    flex: 1,
                    minHeight: 0,
                    overflowY: isSpiritual ? 'auto' : 'visible'
                }}>
                    {isSpiritual ? (
                        /* Spiritual Dashboard Layout */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '40px' }}>
                            <LayoutGroup id="spiritual-group">

                                {/* 1. Manifesting & Beliefs (Tasks) - Tabbed View */}
                                <motion.div
                                    layout
                                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                                    onMouseEnter={() => setIsBeliefsHovered(true)}
                                    onMouseLeave={() => setIsBeliefsHovered(false)}
                                    style={{
                                        background: showBackgrounds ? 'rgba(0, 0, 0, 0.1)' : '#1e1e1e',
                                        backdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                                        borderRadius: '24px',
                                        padding: '24px',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        marginBottom: 'var(--spacing-xl)',
                                        boxShadow: !showBackgrounds
                                            ? (isBeliefsHovered
                                                ? '0 30px 60px -12px rgba(0,0,0,0.7), 0 18px 36px -18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)'
                                                : '0 20px 40px -12px rgba(0,0,0,0.5), 0 12px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)')
                                            : (isBeliefsHovered ? '0 40px 80px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.2)'),
                                        transform: isBeliefsHovered ? 'translateY(-2px) scale(1.002)' : 'translateY(0) scale(1)',
                                        willChange: 'transform, box-shadow'
                                    }}>
                                    {/* Header (Matching AreaTaskSchedule style) */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '12px',
                                        marginBottom: '24px',
                                        paddingBottom: '16px',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        {/* Tabs (Pill Style) - Now only Beliefs */}
                                        <div style={{ display: 'flex', gap: '8px', background: 'none' }}>
                                            <button
                                                onClick={() => {
                                                    if (activeSpiritualTab !== 'beliefs') {
                                                        setDirection(-1);
                                                        setActiveSpiritualTab('beliefs');
                                                    }
                                                }}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '99px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    letterSpacing: '0.05em',
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    color: activeSpiritualTab === 'beliefs' ? '#fff' : 'rgba(255,255,255,0.4)',
                                                    background: activeSpiritualTab === 'beliefs' ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                    border: activeSpiritualTab === 'beliefs' ? '1px solid rgba(128,128,128,0.2)' : 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                SUBCONSCIOUS BELIEFS
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (activeSpiritualTab !== 'desires') {
                                                        setDirection(1);
                                                        setActiveSpiritualTab('desires');
                                                    }
                                                }}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '99px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    letterSpacing: '0.05em',
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    color: activeSpiritualTab === 'desires' ? '#fff' : 'rgba(255,255,255,0.4)',
                                                    background: activeSpiritualTab === 'desires' ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                    border: activeSpiritualTab === 'desires' ? '1px solid rgba(128,128,128,0.2)' : 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                LIFE DESIRES
                                            </button>
                                        </div>

                                        {/* Action Buttons */}
                                        <button
                                            onClick={() => {
                                                const name = prompt("Enter new Belief Topic:");
                                                if (name) addBeliefTopic(name, '🏷️', '#ffffff');
                                            }}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '12px',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid rgba(128, 128, 128, 0.2)',
                                                color: 'rgba(255,255,255,0.8)',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                                e.currentTarget.style.color = '#fff';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                                            }}
                                        >
                                            <Plus size={14} /> ADD OBJECTIVE
                                        </button>
                                    </div>

                                    <div style={{ position: 'relative', overflow: 'hidden' }}>
                                        <AnimatePresence initial={false} custom={direction} mode="popLayout">
                                            <motion.div
                                                key={activeSpiritualTab}
                                                custom={direction}
                                                variants={variants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                transition={{
                                                    x: { type: "spring", stiffness: 300, damping: 30 },
                                                    opacity: { duration: 0 }
                                                }}
                                                style={{ width: '100%' }}
                                            >
                                                {activeSpiritualTab === 'beliefs' ? (
                                                    <BeliefsTable />
                                                ) : (
                                                    <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', minHeight: '300px' }}>
                                                        <div style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>Life Desires</div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                                            {Object.values(state.desires || {}).map(desire => (
                                                                <div key={desire.id} style={{
                                                                    padding: '20px',
                                                                    background: 'rgba(255,255,255,0.05)',
                                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                                    borderRadius: '16px',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '12px'
                                                                }}>
                                                                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'white' }}>{desire.targetDescription}</div>
                                                                    <div style={{ display: 'flex', gap: '12px', opacity: 0.6, fontSize: '11px' }}>
                                                                        <span>Vividness: {desire.vividness}/10</span>
                                                                        <span>Frequency: {desire.frequency}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {Object.keys(state.desires || {}).length === 0 && (
                                                                <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No desires found. Start manifesting in the Desires tracker!</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </motion.div>

                                {/* 2. SATS Schedule (Replacing General Wellbeing) */}
                                <motion.div
                                    layout
                                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                                    style={{ marginBottom: 'var(--spacing-xl)' }}
                                >
                                    <SubCalendar areaId={id} />
                                </motion.div>

                                {/* 3. Powers (Skills) */}
                                <motion.div
                                    layout
                                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                                >
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '1.5rem' }}>🔮</span> Powers
                                    </h2>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', paddingTop: '10px' }}>
                                        {skills.filter(s => ['remote viewing', 'aura viewing', 'speed'].some(key => s.name.toLowerCase().includes(key))).map((skill, index) => {
                                            const currentCover = state.themeMode === 'light' ? skill.coverLight : skill.cover;
                                            return (
                                                <div
                                                    key={skill.id}
                                                    onClick={() => navigate(`/skill/${skill.id}`)}
                                                    style={{
                                                        width: '280px',
                                                        backgroundColor: showBackgrounds ? 'var(--color-bg-card)' : '#1e1e1e',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: 'var(--radius-md)',
                                                        position: 'relative',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        cursor: 'pointer',
                                                        overflow: 'hidden',
                                                        height: '200px',
                                                        boxShadow: showBackgrounds
                                                            ? '0 10px 30px rgba(0,0,0,0.2)'
                                                            : '0 20px 40px -12px rgba(0,0,0,0.5), 0 12px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)',
                                                        transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                                    }}
                                                    className="hover-trigger"
                                                >
                                                    {(currentCover?.startsWith('http') || currentCover?.startsWith('data:')) ? (
                                                        <>
                                                            <img src={currentCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: skill.coverPosition || '50% 50%' }} referrerPolicy="no-referrer" />
                                                            <div style={{
                                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                                background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
                                                                padding: '20px'
                                                            }}>
                                                                <h3 style={{ color: 'white', fontWeight: '600', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{skill.name}</h3>
                                                                {/* Habit List Integration for Spiritual Powers */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                                                                    {Object.values(state.habits || {})
                                                                        .filter(h => (h.skillIds || (h.skillId ? [h.skillId] : [])).includes(skill.id))
                                                                        .filter(h => h.name && h.name.trim().length > 0)
                                                                        .map(habit => {
                                                                            const isCompleted = habit.history?.[todayString];
                                                                            return (
                                                                                <div key={habit.id}
                                                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHabit(habit.id, todayString); }}
                                                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                                                                                    <span style={{
                                                                                        fontSize: '11px',
                                                                                        color: '#ffffff',
                                                                                        fontWeight: '600',
                                                                                        flex: 1,
                                                                                        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                                                                                        overflow: 'hidden',
                                                                                        textOverflow: 'ellipsis',
                                                                                        whiteSpace: 'nowrap',
                                                                                        minWidth: 0
                                                                                    }}>
                                                                                        {habit.name}
                                                                                    </span>
                                                                                    <div className="liquid-glass" style={{
                                                                                        width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                        border: '1px solid rgba(128,128,128,0.3)',
                                                                                        color: isCompleted ? '#ef4444' : 'rgba(255,255,255,0.4)',
                                                                                        background: isCompleted ? 'rgba(127, 29, 29, 0.4)' : 'rgba(255,255,255,0.05)',
                                                                                        flexShrink: 0
                                                                                    }}>
                                                                                        <Check size={10} strokeWidth={3} />
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: '8px' }}>
                                                            <h3 style={{ color: 'white', fontWeight: '600' }}>{skill.name}</h3>
                                                            {/* Habit List Integration for Spiritual Powers (No-Cover) */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {Object.values(state.habits || {})
                                                                    .filter(h => (h.skillIds || (h.skillId ? [h.skillId] : [])).includes(skill.id))
                                                                    .filter(h => h.name && h.name.trim().length > 0)
                                                                    .map(habit => {
                                                                        const isCompleted = habit.history?.[todayString];
                                                                        return (
                                                                            <div key={habit.id}
                                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHabit(habit.id, todayString); }}
                                                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                                                                                <span style={{
                                                                                    fontSize: '11px',
                                                                                    color: 'rgba(255,255,255,0.6)',
                                                                                    fontWeight: '600',
                                                                                    flex: 1,
                                                                                    overflow: 'hidden',
                                                                                    textOverflow: 'ellipsis',
                                                                                    whiteSpace: 'nowrap',
                                                                                    minWidth: 0
                                                                                }}>
                                                                                    {habit.name}
                                                                                </span>
                                                                                <div className="liquid-glass" style={{
                                                                                    width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                    border: '1px solid rgba(128,128,128,0.2)',
                                                                                    color: isCompleted ? '#ef4444' : 'rgba(255,255,255,0.2)',
                                                                                    background: isCompleted ? 'rgba(127, 29, 29, 0.3)' : 'rgba(255,255,255,0.03)',
                                                                                    flexShrink: 0
                                                                                }}>
                                                                                    <Check size={10} strokeWidth={3} />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        </div>
                                                    )}


                                                    {/* Actions Overlay */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        display: 'flex',
                                                        gap: '2px',
                                                        zIndex: 10,
                                                        opacity: focusedCardId === skill.id ? 1 : 0,
                                                        pointerEvents: focusedCardId === skill.id ? 'auto' : 'none',
                                                        transform: focusedCardId === skill.id ? 'translateY(0)' : 'translateY(-5px)',
                                                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
                                                    }} className="action-buttons">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault(); e.stopPropagation();
                                                                // Cycle positions: Center -> Top -> Top-Mid -> Bottom-Mid -> Bottom -> Center
                                                                const positions = ['50% 50%', '50% 0%', '50% 25%', '50% 75%', '50% 100%'];
                                                                const currentPos = skill.coverPosition || '50% 50%';
                                                                const currentIndex = positions.indexOf(currentPos);
                                                                const nextPos = positions[(currentIndex + 1) % positions.length];
                                                                updateSkill(skill.id, { coverPosition: nextPos });
                                                            }}
                                                            style={{
                                                                background: 'rgba(0, 0, 0, 0.3)',
                                                                backdropFilter: 'blur(8px)',
                                                                WebkitBackdropFilter: 'blur(8px)',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                borderRadius: '8px',
                                                                padding: '6px',
                                                                cursor: 'pointer',
                                                                minWidth: '24px',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: 'white'
                                                            }}
                                                            title="Cycle Image Position"
                                                        >
                                                            <Maximize2 size={12} />
                                                        </button>
                                                        <button
                                                            className="paste-trigger-btn"
                                                            onClick={(e) => {
                                                                e.preventDefault(); e.stopPropagation();
                                                                // Toggle paste mode
                                                                setPastingSkillId(pastingSkillId === skill.id ? null : skill.id);
                                                            }}
                                                            style={{
                                                                background: pastingSkillId === skill.id ? 'var(--color-primary)' : 'rgba(0, 0, 0, 0.3)',
                                                                backdropFilter: 'blur(8px)',
                                                                WebkitBackdropFilter: 'blur(8px)',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                borderRadius: '8px',
                                                                padding: '6px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                minWidth: '24px',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: 'white'
                                                            }}
                                                            title="Click then Paste (Ctrl+V) an image or URL"
                                                        >
                                                            {pastingSkillId === skill.id ? <Clipboard size={12} /> : <Image size={12} />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault(); e.stopPropagation();
                                                                if (confirm('Delete skill?')) deleteSkill(skill.id, id);
                                                            }}
                                                            style={{
                                                                background: 'rgba(0, 0, 0, 0.3)',
                                                                backdropFilter: 'blur(8px)',
                                                                WebkitBackdropFilter: 'blur(8px)',
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                borderRadius: '8px',
                                                                color: 'var(--color-danger)',
                                                                padding: '6px',
                                                                cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Add Skill Button specifically for Powers? Or just rely on top button? */}
                                    </div>
                                </motion.div>

                                {/* Show other skills just in case */}
                                {(() => {
                                    const handledNames = ['wellbeing', 'manifesting', 'subconscious', 'remote viewing', 'aura viewing', 'speed'];
                                    const remainingSkills = skills.filter(s => !handledNames.some(name => s.name.toLowerCase().includes(name)));

                                    if (remainingSkills.length === 0) return null;

                                    return (
                                        <div style={{ marginTop: '20px', opacity: 0.7 }}>
                                            <h3 style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Other Skills</h3>
                                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                {remainingSkills.map(s => (
                                                    <div key={s.id} onClick={() => navigate(`/skill/${s.id}`)} style={{ padding: '8px 16px', background: 'var(--color-bg-secondary)', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--color-border)' }}>
                                                        {s.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                            </LayoutGroup>
                        </div>
                    ) : (
                        /* Standard Layout for other non-finance areas (Languages etc) */
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            flex: 1,
                            minHeight: 0
                        }}>
                            {/* Standard skill list logic... */}
                            {/* I need to preserve the standard layout logic for Languages here! */}
                            {/* The logic was:
                           Left Panel (Skills List) - full width for Languages
                           Inside Left Panel:
                              Skills Grid
                              AreaTaskSchedule (Languages only)
                              SubCalendar (Languages only)
                        */}
                            <div style={{
                                width: '100%',
                                flex: 'none',
                                flexShrink: 0,
                                overflowY: 'auto',
                                paddingRight: '0'
                            }}>
                                {!isSpiritual && !isFinance && area.name !== 'Languages' && area.name !== 'Hot body' && (
                                    <h2 style={{
                                        fontSize: 'var(--font-size-lg)',
                                        borderBottom: '1px solid var(--color-border)',
                                        paddingBottom: 'var(--spacing-sm)',
                                        marginBottom: 'var(--spacing-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <BookOpen size={20} />
                                        Skills & Knowledge
                                    </h2>
                                )}

                                <div style={{
                                    display: 'flex',
                                    gap: 'var(--spacing-md)',
                                    alignItems: 'flex-start',
                                    paddingTop: '10px',
                                    paddingBottom: 'var(--spacing-md)'
                                }}>
                                    {[0, 1, 2, 3, 4].map(colIndex => (
                                        <div key={colIndex} style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 'var(--spacing-md)'
                                        }}>
                                            {(() => {
                                                const allItems = [
                                                    { type: 'add' },
                                                    ...skills.map(s => ({ type: 'skill', skill: s }))
                                                ];
                                                return allItems.filter((_, idx) => idx % 5 === colIndex).map((item) => {
                                                    if (item.type === 'add') {
                                                        return (
                                                            <div key="add-skill-card">
                                                                <button
                                                                    onClick={handleAddSkill}
                                                                    style={{
                                                                        width: '100%',
                                                                        minHeight: '80px',
                                                                        borderRadius: '8px',
                                                                        background: state.showBackgrounds !== false ? 'rgba(255, 255, 255, 0.02)' : '#1e1e1e',
                                                                        border: '1px dashed rgba(128, 128, 128, 0.2)',
                                                                        color: 'rgba(255, 255, 255, 0.4)',
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        gap: '8px',
                                                                        padding: '16px',
                                                                        transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                                                                        cursor: 'pointer',
                                                                        outline: 'none',
                                                                        transform: 'translateY(0)',
                                                                        boxShadow: state.showBackgrounds !== false ? '0 10px 30px rgba(0,0,0,0.1)' : '0 10px 30px -10px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.02)'
                                                                    }}
                                                                    className="hover-trigger"
                                                                >
                                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                                                                        <Plus size={18} />
                                                                    </div>
                                                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600' }}>Add New Skill</span>
                                                                </button>
                                                            </div>
                                                        );
                                                    }

                                                    const skill = item.skill;
                                                    const currentCover = state.themeMode === 'light' ? skill.coverLight : skill.cover;
                                                    const hasCover = (currentCover?.startsWith('http') || currentCover?.startsWith('data:'));

                                                    return (
                                                        <div
                                                            key={skill.id}
                                                            className={`skill-card-container hover-trigger ${area.name === 'Hot body' ? 'hot-body-card' : ''}`}
                                                            style={{
                                                                backgroundColor: state.showBackgrounds !== false ? 'var(--color-bg-card)' : '#1e1e1e',
                                                                borderRadius: '8px',
                                                                position: 'relative',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                cursor: 'pointer',
                                                                overflow: 'hidden',
                                                                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                                                isolation: 'isolate',
                                                                border: '1px solid var(--color-border)',
                                                                transform: 'translateY(0)',
                                                            }}
                                                            onClick={(e) => {
                                                                if (focusedCardId === skill.id) {
                                                                    navigate(`/skill/${skill.id}`);
                                                                } else {
                                                                    setFocusedCardId(skill.id);
                                                                }
                                                            }}
                                                        >
                                                            {hasCover ? (
                                                                <div style={{ position: 'relative', width: '100%', lineHeight: 0, overflow: 'hidden', borderRadius: '8px' }}>
                                                                    <img
                                                                        className="skill-cover-img"
                                                                        src={currentCover}
                                                                        alt=""
                                                                        style={{
                                                                            width: '100%',
                                                                            height: 'auto',
                                                                            display: 'block',
                                                                            minHeight: '260px',
                                                                            objectFit: 'cover',
                                                                            transition: 'transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                                                            transform: 'scale(1)'
                                                                        }}
                                                                    />
                                                                    <div className="hot-body-title-container" style={{
                                                                        position: 'absolute',
                                                                        top: 0, left: 0, right: 0, bottom: 0,
                                                                        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0) 100%)',
                                                                        display: 'flex',
                                                                        alignItems: 'flex-end',
                                                                        padding: '24px'
                                                                    }}>
                                                                        <div style={{ width: '100%' }}>
                                                                            <h3 style={{ fontWeight: '600', color: 'white', fontSize: '18px', letterSpacing: '-0.02em', marginBottom: '4px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                                                                                {skill.name}
                                                                            </h3>
                                                                            {/* Habit List Integration */}
                                                                            {area.name === 'Hot body' && (
                                                                                <div className="hot-body-habit-list" style={{ padding: '8px 0 0', lineHeight: '1.4' }}>
                                                                                    {(() => {
                                                                                        const skillHabits = Object.values(state.habits || {})
                                                                                            .filter(h => (h.skillIds || (h.skillId ? [h.skillId] : [])).includes(skill.id))
                                                                                            .filter(h => h.name && h.name.trim().length > 0);

                                                                                        const total = skillHabits.length;
                                                                                        const completed = skillHabits.filter(h => h.history?.[todayString]).length;
                                                                                        const percent = total > 0 ? (completed / total) * 100 : 0;
                                                                                        const radius = 8;
                                                                                        const circumference = 2 * Math.PI * radius;
                                                                                        const strokeDashoffset = circumference - (percent / 100) * circumference;

                                                                                        return (
                                                                                            <div style={{ width: '100%' }}>
                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>
                                                                                                        {Math.round(percent)}% READY
                                                                                                    </span>
                                                                                                    <div style={{ position: 'relative', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                                        <svg width="16" height="16" style={{ transform: 'rotate(-90deg)' }}>
                                                                                                            <circle cx="8" cy="8" r={radius} fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                                                                                                            <circle cx="8" cy="8" r={radius} fill="transparent" stroke="#D4B07B" strokeWidth="2" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                                                                                                        </svg>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                                                                                    {skillHabits.map(habit => {
                                                                                                        const isCompleted = habit.history?.[todayString];
                                                                                                        return (
                                                                                                            <div key={habit.id} className="hot-body-habit-pill" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHabit(habit.id, todayString); }} style={{
                                                                                                                display: 'flex',
                                                                                                                alignItems: 'center',
                                                                                                                gap: '12px',
                                                                                                                borderRadius: '16px', // Better for multi-line than 99px
                                                                                                                padding: '12px 16px', // Slightly more vertical breathing room
                                                                                                                width: '100%',
                                                                                                                boxSizing: 'border-box'
                                                                                                            }}>
                                                                                                                <span style={{
                                                                                                                    fontSize: '13px',
                                                                                                                    lineHeight: '1.4', // Reset inherited lineHeight 0
                                                                                                                    color: isCompleted ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)',
                                                                                                                    textDecoration: isCompleted ? 'line-through' : 'none',
                                                                                                                    flex: 1,
                                                                                                                    textAlign: 'left'
                                                                                                                }}>
                                                                                                                    {habit.name}
                                                                                                                </span>
                                                                                                                <div style={{ width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(128,128,128,0.3)', background: isCompleted ? 'rgba(212, 176, 123, 0.5)' : 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
                                                                                                                    {isCompleted && <Check size={11} color="#D4B07B" strokeWidth={3} />}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        );
                                                                                                    })}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div style={{ padding: '24px' }}>
                                                                    <h3 style={{ fontWeight: '600', color: 'white', fontSize: '18px', marginBottom: '4px' }}>{skill.name}</h3>
                                                                </div>
                                                            )}

                                                            {/* Actions Overlay */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '8px',
                                                                right: '8px',
                                                                display: 'flex',
                                                                gap: '4px',
                                                                zIndex: 10,
                                                                opacity: focusedCardId === skill.id ? 1 : 0,
                                                                pointerEvents: focusedCardId === skill.id ? 'auto' : 'none',
                                                                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                                                transform: focusedCardId === skill.id ? 'translateY(0)' : 'translateY(-5px)'
                                                            }} className="action-buttons">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault(); e.stopPropagation();
                                                                        const cover = prompt("Paste Cover Image URL:");
                                                                        if (cover) {
                                                                            const targetField = state.themeMode === 'light' ? 'coverLight' : 'cover';
                                                                            updateSkill(skill.id, { [targetField]: cover });
                                                                        }
                                                                    }}
                                                                    style={{ background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: 'white', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                >
                                                                    <Image size={12} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault(); e.stopPropagation();
                                                                        if (confirm('Delete skill?')) deleteSkill(skill.id, id);
                                                                    }}
                                                                    style={{ background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: 'var(--color-danger)', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    ))}
                                </div>

                                {/* Task Schedule for Languages and Hot body */}
                                <LayoutGroup id="standard-stack">
                                    {area.name === 'Languages' && (
                                        <motion.div layout transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }} style={{ marginBottom: 'var(--spacing-md)' }}>
                                            <AreaTaskSchedule areaId={id} />
                                        </motion.div>
                                    )}

                                    {/* Sub Calendar for Languages (show at bottom) */}
                                    {area.name === 'Languages' && (
                                        <motion.div layout transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }} style={{ flexShrink: 0, paddingTop: 'var(--spacing-md)' }}>
                                            <SubCalendar filterAreaId={id} />
                                        </motion.div>
                                    )}
                                </LayoutGroup>
                            </div>
                        </div>
                    )
                    }
                </div >
            ) : (
                /* Finance Stacked Layout */
                <LayoutGroup id={`${id}-stack`}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        overflowY: 'auto',
                        gap: '40px',
                        paddingBottom: '60px',
                        paddingRight: '8px',
                        scrollbarWidth: 'thin'
                    }}>
                        <motion.div layout transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }} style={{ flexShrink: 0 }}>
                            <AreaTaskSchedule areaId={id} />
                        </motion.div>
                        <motion.div layout transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }} style={{ flexShrink: 0 }}>
                            <SubCalendar filterAreaId={id} />
                        </motion.div>
                    </div>
                </LayoutGroup>
            )
            }
        </div >
    );
};

export default AreaDetail;
