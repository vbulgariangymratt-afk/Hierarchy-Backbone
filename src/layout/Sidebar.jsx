import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { backbone, repository, habitService, habitRepo } from '../backbone-v2/index';
import { useTheme } from '../context/ThemeContext';
import NodeIcon from '../components/NodeIcon';
import { useSettings, SLOT_ROLES } from '../context/SettingsContext';
import { supabase } from '../lib/supabase';
import { getSkillEngagementStatus } from '../utils/engagementUtils';
import { formatDuration } from '../utils/timeUtils';
import HabitEvolutionGauge from '../components/habits/HabitEvolutionGauge';
import HealthTooltip from '../components/HealthTooltip';
import SidebarSpotlightCard from '../components/sidebar/SidebarSpotlightCard';
import { useBackboneStore } from '../store/backboneStore';
import { useShallow } from 'zustand/react/shallow';
import './Sidebar.css';
import { Coins, LayoutDashboard, ShoppingBag, BookOpen, Calendar, Target, Edit3, Settings, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';



// final refresh
const SVG_ICONS = {
    LAUNCHPAD: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpolyline points='9 22 9 12 15 12 15 22'/%3E%3C/svg%3E",
    MARKETPLACE: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'/%3E%3Cpath d='M3 6h18'/%3E%3Cpath d='M16 10a4 4 0 0 1-8 0'/%3E%3C/svg%3E",
    JOURNAL: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'/%3E%3C/svg%3E",
    SETTINGS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E",
    SUN: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3Cpath d='M12 2v2'/%3E%3Cpath d='M12 20v2'/%3E%3Cpath d='m4.93 4.93 1.41 1.41'/%3E%3Cpath d='m17.66 17.66 1.41 1.41'/%3E%3Cpath d='M2 12h2'/%3E%3Cpath d='M20 12h2'/%3E%3Cpath d='m6.34 17.66-1.41 1.41'/%3E%3Cpath d='m19.07 4.93-1.41 1.41'/%3E%3C/svg%3E",
    MOON: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'/%3E%3C/svg%3E",
    TIMELINE: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='4' rx='2' ry='2'/%3E%3Cline x1='16' x2='16' y1='2' y2='6'/%3E%3Cline x1='8' x2='8' y1='2' y2='6'/%3E%3Cline x1='3' x2='21' y1='10' y2='10'/%3E%3Cpath d='m9 16 2 2 4-4'/%3E%3C/svg%3E",

    PLUS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='12' y1='5' x2='12' y2='19'/%3E%3Cline x1='5' y1='12' x2='19' y2='12'/%3E%3C/svg%3E",
    PLANNING: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'/%3E%3C/svg%3E",
    FOCUS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Cline x1='12' y1='2' x2='12' y2='5'/%3E%3Cline x1='12' y1='19' x2='12' y2='22'/%3E%3Cline x1='2' y1='12' x2='5' y2='12'/%3E%3Cline x1='19' y1='12' x2='22' y2='12'/%3E%3C/svg%3E",
    WALLPAPER: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E"
};

const Sidebar = ({ onSkillClick }) => {
    const navigate = useNavigate();
    const { theme, themePreference, setTheme, backgroundMode, setBackgroundMode } = useTheme();

    
    // --- ZUSTAND SELECTORS ---
    const { 
        allNodes, 
        engagementMap, 
        loading: storeLoading 
    } = useBackboneStore(useShallow(state => ({
        allNodes: state.nodes,
        engagementMap: state.engagementMap,
        loading: state.loading
    })));

    const rootNode = useBackboneStore(state => state.nodes.find(n => n.id === 'ROOT'));
    
    const lifeAreas = useMemo(() => 
        allNodes.filter(n => n.type === 'LIFE_AREA'), 
    [allNodes]);

    const isFocusMode = !!rootNode?.metadata?.focusModeEntryAt;
    const hryvniaBalance = rootNode?.metadata?.hryvniaBalance || 0;

    // --- LOCAL UI STATE ---
    const [isAreasExpanded, setIsAreasExpanded] = useState(true);
    const [sectionTitle, setSectionTitle] = useState("Life Areas");
    const [isAddingArea, setIsAddingArea] = useState(false);
    const [newAreaName, setNewAreaName] = useState('');
    const [editingIconNode, setEditingIconNode] = useState(null);
    const [tempIconUrl, setTempIconUrl] = useState('');
    const [completingHabitId, setCompletingHabitId] = useState(null);
    const [pinnedSpotlightIds, setPinnedSpotlightIds] = useState([]);
    
    const [isScrolling, setIsScrolling] = useState(false);
    const [glowingNodeId, setGlowingNodeId] = useState(null);
    const scrollTimeoutRef = useRef(null);

    // --- QUICK CAPTURE STATE & HANDLERS ---
    const [showCapture, setShowCapture] = useState(false);
    const [captures, setCaptures] = useState([]);
    const [captureInput, setCaptureInput] = useState('');
    const capturePopoverRef = useRef(null);
    const captureInputRef = useRef(null);

    const loadCaptures = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('quick_captures')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                setCaptures(data || []);
            } else {
                const guest = localStorage.getItem('guest_quick_captures');
                setCaptures(guest ? JSON.parse(guest) : []);
            }
        } catch (e) {
            console.error('Failed to load quick captures:', e);
            const guest = localStorage.getItem('guest_quick_captures');
            setCaptures(guest ? JSON.parse(guest) : []);
        }
    }, []);

    const saveCaptureItem = useCallback(async (content) => {
        if (!content || !content.trim()) return;
        const trimmed = content.trim();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('quick_captures')
                    .insert([{ user_id: user.id, content: trimmed }])
                    .select();
                if (error) throw error;
                if (data && data[0]) {
                    setCaptures(prev => [data[0], ...prev]);
                }
            } else {
                const guest = localStorage.getItem('guest_quick_captures') || '[]';
                const parsed = JSON.parse(guest);
                const newItem = { id: `guest-${Date.now()}`, content: trimmed, created_at: new Date().toISOString() };
                const updated = [newItem, ...parsed];
                localStorage.setItem('guest_quick_captures', JSON.stringify(updated));
                setCaptures(updated);
            }
        } catch (e) {
            console.error('Failed to save quick capture item:', e);
            const guest = localStorage.getItem('guest_quick_captures') || '[]';
            const parsed = JSON.parse(guest);
            const newItem = { id: `guest-${Date.now()}`, content: trimmed, created_at: new Date().toISOString() };
            const updated = [newItem, ...parsed];
            localStorage.setItem('guest_quick_captures', JSON.stringify(updated));
            setCaptures(updated);
        }
    }, []);

    const deleteCaptureItem = useCallback(async (id) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && !String(id).startsWith('guest-')) {
                const { error } = await supabase
                    .from('quick_captures')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                setCaptures(prev => prev.filter(c => c.id !== id));
            } else {
                const guest = localStorage.getItem('guest_quick_captures') || '[]';
                const parsed = JSON.parse(guest);
                const updated = parsed.filter(c => c.id !== id);
                localStorage.setItem('guest_quick_captures', JSON.stringify(updated));
                setCaptures(updated);
            }
        } catch (e) {
            console.error('Failed to delete quick capture item:', e);
            const guest = localStorage.getItem('guest_quick_captures') || '[]';
            const parsed = JSON.parse(guest);
            const updated = parsed.filter(c => c.id !== id);
            localStorage.setItem('guest_quick_captures', JSON.stringify(updated));
            setCaptures(updated);
        }
    }, []);

    const handleCloseCapture = useCallback(() => {
        if (captureInput.trim()) {
            saveCaptureItem(captureInput);
            setCaptureInput('');
        }
        setShowCapture(false);
    }, [captureInput, saveCaptureItem]);

    useEffect(() => {
        loadCaptures();
    }, [loadCaptures]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (capturePopoverRef.current && !capturePopoverRef.current.contains(event.target) && !event.target.closest('.capture-toggle-btn')) {
                handleCloseCapture();
            }
        };

        if (showCapture) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCapture, handleCloseCapture]);

    // --- CUSTOM CHIME SOUND ---
    const playChime = useCallback(() => {
        try {
            const audio = new Audio('/Level-up%20chime.mp3');
            audio.volume = 0.4;
            audio.play().catch(err => console.warn('Audio play interrupted or blocked:', err));
        } catch (err) {
            console.warn('Audio initialization failed:', err);
        }
    }, []);


    const handleScroll = useCallback(() => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrolling(false);
        }, 1200); // Hide after 1.2s of inactivity
    }, []);

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, []);

    const { 
        focusSlots, 
        maintenanceSkillIds,
        maintenanceEnabled,
        guidedSlotRoles, 
        energyLevel, 
        updateEnergyLevel,
        currencyName
    } = useSettings();

    // --- LEVEL UP LISTENER ---
    useEffect(() => {
        const handleLevelUp = (e) => {
            const { skillId } = e.detail;
            const skill = allNodes.find(n => n.id === skillId);
            if (!skill) return;

            // Determine Target: Skill (if focus/maintenance) or Area (parent)
            // Use nullish coalescing to harden against uninitialized settings
            const isFocus = (focusSlots ?? []).includes(skillId);
            const isMaintenance = (maintenanceSkillIds ?? []).includes(skillId);

            let targetId = skillId;
            if (!isFocus && !isMaintenance) {
                targetId = skill.parentId;
            }

            // Trigger Animation & Sound immediately for perfect sync
            setGlowingNodeId(targetId);
            playChime();
            
            // Clear after animation duration (2.1s + buffer)
            setTimeout(() => setGlowingNodeId(null), 2200);
        };

        window.addEventListener('skill-level-up', handleLevelUp);
        return () => window.removeEventListener('skill-level-up', handleLevelUp);
    }, [allNodes, focusSlots, maintenanceSkillIds, playChime]);


    const [isMaintenanceExpanded, setIsMaintenanceExpanded] = useState(() => {
        return localStorage.getItem('sidebar_maintenance_expanded') === 'true';
    });

    // --- DERIVED MAINTENANCE DATA ---
    const { maintenanceSkills, allMaintenanceHabits } = useMemo(() => {
        if (!maintenanceEnabled || !maintenanceSkillIds?.length) {
            return { maintenanceSkills: [], allMaintenanceHabits: [] };
        }

        const skills = maintenanceSkillIds
            .map(id => allNodes.find(n => n.id === id))
            .filter(Boolean);

        const allHabits = allNodes.filter(n => n.type === 'HABIT');
        const habitList = [];
        
        maintenanceSkillIds.forEach(skillId => {
            const linked = allHabits.filter(h =>
                (h.linkedSkillIds && h.linkedSkillIds.includes(skillId)) ||
                h.linkedSkillId === skillId
            );
            linked.forEach(h => {
                if (!habitList.find(x => x.id === h.id)) {
                    habitList.push({ ...h, _maintenanceSkillId: skillId });
                }
            });
        });

        return { maintenanceSkills: skills, allMaintenanceHabits: habitList };
    }, [allNodes, maintenanceSkillIds, maintenanceEnabled]);

    // Resolve slot skill names from the in-memory nodes list
    const slotSkills = useMemo(() => {
        const skillMap = {};
        focusSlots.forEach(id => {
            const node = allNodes.find(n => n.id === id);
            if (node) skillMap[id] = node;
        });
        return skillMap;
    }, [allNodes, focusSlots]);
;

    // ---------------------------------------------------------------------------
    // PILOT LIGHT DRAWER — compute spotlight and pilot light habits
    // ---------------------------------------------------------------------------
    const { spotlightHabits, pilotLightHabits, skillsWithNoHabits, skillCompletionMap, displayMaintenanceSkills } = useMemo(() => {
        if (!maintenanceEnabled || (allMaintenanceHabits.length === 0 && maintenanceSkills.length === 0)) {
            return { spotlightHabits: [], pilotLightHabits: [], skillsWithNoHabits: [], skillCompletionMap: {}, displayMaintenanceSkills: [] };
        }

        // Hide completed habits from the drawer unless still due
        const dueHabits = allMaintenanceHabits.filter(h => !habitService.getHabitProgress(h).isDone);
        
        // Track completion status for each skill (if all its habits are done)
        const skillCompletionMap = {};
        maintenanceSkills.forEach(skill => {
            const habits = allMaintenanceHabits.filter(h => 
                (h.linkedSkillIds && h.linkedSkillIds.includes(skill.id)) ||
                h.linkedSkillId === skill.id
            );
            
            if (habits.length === 0) {
                skillCompletionMap[skill.id] = false;
            } else {
                skillCompletionMap[skill.id] = habits.every(h => habitService.getHabitProgress(h).isDone);
            }
        });

        // Skills that have absolutely NO habits at all (use full list for check)
        const skillsWithNoHabits = maintenanceSkills.filter(
            skill => !allMaintenanceHabits.some(h => h._maintenanceSkillId === skill.id)
        );

        // Sorting Logic for Display: Unfinished skills first
        const displayMaintenanceSkills = [...maintenanceSkills].sort((a, b) => {
            const aDone = skillCompletionMap[a.id] ? 1 : 0;
            const bDone = skillCompletionMap[b.id] ? 1 : 0;
            return aDone - bDone;
        });

        if (dueHabits.length === 0) {
            return { spotlightHabits: [], pilotLightHabits: [], skillsWithNoHabits, skillCompletionMap, displayMaintenanceSkills };
        }

        // --- Use dueHabits for the rest of the sorting/picking logic ---
        const sorted = [...dueHabits].sort((a, b) => {
            const aTs = a.lastCompletedAt ? new Date(a.lastCompletedAt).getTime() : 0;
            const bTs = b.lastCompletedAt ? new Date(b.lastCompletedAt).getTime() : 0;
            return aTs - bTs; // ascending => most neglected first
        });

        // Pinned habits first (promoted from pilot light) — up to 3 total spotlight slots
        const pinned = pinnedSpotlightIds
            .map(id => dueHabits.find(h => h.id === id))
            .filter(Boolean)
            .slice(0, 3);

        const pinnedIds = new Set(pinned.map(h => h.id));
        const remaining = sorted.filter(h => !pinnedIds.has(h.id));

        // Fill remaining spotlight slots:
        const available = remaining;
        const mostNeglected = available[0] ? [available[0]] : [];
        const mostNeglectedId = mostNeglected[0]?.id;

        const afterNeglected = available.filter(h => h.id !== mostNeglectedId);
        const recentlyCompleted = [...afterNeglected].sort((a, b) => {
            const aTs = a.lastCompletedAt ? new Date(a.lastCompletedAt).getTime() : 0;
            const bTs = b.lastCompletedAt ? new Date(b.lastCompletedAt).getTime() : 0;
            return bTs - aTs; // descending
        });

        const slotsLeft = 3 - pinned.length;
        const autoSpotlight = [];
        if (slotsLeft > 0 && mostNeglected.length > 0) autoSpotlight.push(mostNeglected[0]);
        const recentSlots = Math.max(0, slotsLeft - autoSpotlight.length);
        const recentPick = recentlyCompleted.slice(0, recentSlots);
        autoSpotlight.push(...recentPick);

        let spotlightHabits = [...pinned, ...autoSpotlight].slice(0, 3);
        
        if (energyLevel <= 2) {
            spotlightHabits = spotlightHabits.slice(0, 2);
        }

        const spotlightIds = new Set(spotlightHabits.map(h => h.id));
        const pilotLightHabits = allMaintenanceHabits.filter(h => !spotlightIds.has(h.id));

        return { spotlightHabits, pilotLightHabits, skillsWithNoHabits, skillCompletionMap, displayMaintenanceSkills };
    }, [allMaintenanceHabits, maintenanceSkills, maintenanceEnabled, pinnedSpotlightIds, energyLevel]);

    // Group pilot lights by skill ID
    const pilotLightsBySkill = useMemo(() => {
        const map = {};
        maintenanceSkills.forEach(s => { map[s.id] = []; });
        pilotLightHabits.forEach(h => {
            const sid = h._maintenanceSkillId;
            if (map[sid]) map[sid].push(h);
        });
        return map;
    }, [pilotLightHabits, maintenanceSkills]);

    const promoteToSpotlight = (habitId) => {
        setPinnedSpotlightIds(prev => {
            if (prev.includes(habitId)) return prev;
            // Keep at most 3 pinned; drop oldest pin if needed
            const next = [habitId, ...prev].slice(0, 3);
            return next;
        });
    };


    const toggleMode = async () => {
        const newMode = !isFocusMode;
        await backbone.trackFocusMode(newMode);

        if (newMode) {
            navigate('/focus');
        } else {
            navigate('/launchpad');
        }
    };

    const handleCreateArea = async (e) => {
        if (e.key !== 'Enter') return;
        const name = newAreaName.trim();
        if (!name) return;
        try {
            await backbone.addNode({
                id: Math.random().toString(36).substr(2, 9),
                name,
                type: 'LIFE_AREA',
                parentId: null,
                metadata: {}
            });
        } catch (err) {
            console.error('Failed to create area:', err);
        } finally {
            setNewAreaName('');
            setIsAddingArea(false);
        }
    };

    const handleIconClick = (e, node) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingIconNode(node);
        setTempIconUrl(node.metadata?.iconUrl || '');
    };

    const handleHabitComplete = useCallback(async (habitId) => {
        try {
            setCompletingHabitId(habitId);
            await habitService.completeHabit(habitId);
            // Remove from pinned spotlight if it's there, to let auto-sort take over
            setPinnedSpotlightIds(prev => prev.filter(id => id !== habitId));
            setTimeout(() => setCompletingHabitId(null), 700);
            // habitRepo.subscribe in useEffect handles the data update
        } catch (err) {
            console.error("Failed to complete maintenance habit:", err);
            setCompletingHabitId(null);
        }
    }, [habitService]);

    const toggleMaintenance = () => {
        const newState = !isMaintenanceExpanded;
        setIsMaintenanceExpanded(newState);
        localStorage.setItem('sidebar_maintenance_expanded', newState);
    };

    const handleSaveIcon = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!editingIconNode) return;

        try {
            await backbone.updateNode(editingIconNode.id, {
                metadata: {
                    ...editingIconNode.metadata,
                    iconUrl: tempIconUrl.trim() || null
                }
            });
            setEditingIconNode(null);
        } catch (err) {
            console.error('Failed to update icon:', err);
        }
    };

    return (
        <aside className={`sidebar ${backgroundMode}-mode ${isFocusMode ? 'mode-focus' : 'mode-planning'} energy-level-${energyLevel} ${energyLevel <= 2 ? 'low-energy-ghosting' : ''}`} data-tauri-drag-region>
            <div className={`sidebar-scroll-content ${isScrolling ? 'is-scrolling' : ''}`} onScroll={handleScroll}>
                <div className="sidebar-top">
                    {energyLevel > 1 && (
                        <div className="mode-toggle-row">
                            <button
                                className="btn btn-ghost focus-toggle-btn"
                                onClick={toggleMode}
                                disabled={storeLoading}
                            >
                                <div className="btn-icon mode-toggle-icon">
                                    {isFocusMode ? <Target size={14} /> : <ClipboardList size={14} />}
                                </div>
                                <span className="btn-text">
                                    {isFocusMode ? 'Planning' : 'Focus'}
                                </span>
                            </button>
                            <button
                                className={`btn btn-ghost capture-toggle-btn ${showCapture ? 'active' : ''}`}
                                style={{ position: 'relative' }}
                                onClick={() => {
                                    if (showCapture) {
                                        handleCloseCapture();
                                    } else {
                                        setShowCapture(true);
                                    }
                                }}
                            >
                                <div className="btn-icon mode-toggle-icon">
                                    <Edit3 size={14} />
                                </div>
                                <span className="btn-text">Capture</span>
                                {captures.length > 0 && (
                                    <span className="capture-badge">
                                        {captures.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                    
                    {/* Energy Level Selector */}
                    <div className="energy-selector-container">
                        <div className="energy-label">Energy</div>
                        <motion.div className="energy-pills" layout>
                            {[1, 2, 3, 4, 5].map(level => {
                                const isActive = energyLevel === level;
                                return (
                                    <motion.button
                                        key={level}
                                        className={`energy-pill ${isActive ? 'active' : ''}`}
                                        onClick={() => updateEnergyLevel(level)}
                                        title={`Set Energy to ${level}`}
                                        layout /* Enables smooth spring layout tracking for width and position shifts */
                                        transition={{
                                            layout: {
                                                type: "spring",
                                                damping: 20,
                                                stiffness: 230,
                                                mass: 1.2
                                            }
                                        }}
                                        style={{ position: 'relative' }}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="energy-active-indicator"
                                                className="energy-active-pill"
                                                transition={{
                                                    type: "spring",
                                                    damping: 20,
                                                    stiffness: 230,
                                                    mass: 1.2
                                                }}
                                            />
                                        )}
                                        <motion.div className="energy-pill-content" layout>
                                            <span className="energy-pill-label">{level}</span>
                                        </motion.div>
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    </div>

                    <nav className="sidebar-nav">
                        {!isFocusMode ? (
                            /* PLANNING MODE SIDEBAR CONTENT */
                            <>
                                <NavLink to="/launchpad" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                    <span className="btn-icon">
                                        <LayoutDashboard size={16} />
                                    </span>
                                    <span className="btn-text">Launchpad</span>
                                </NavLink>


                                {energyLevel >= 3 && (
                                    <NavLink to="/marketplace" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                        <span className="btn-icon">
                                            <ShoppingBag size={16} />
                                        </span>
                                        <span className="btn-text">Marketplace</span>
                                    </NavLink>
                                )}

                                <NavLink to="/calendar" className={({ isActive }) => `nav-item timeline-nav ${isActive ? 'active' : ''}`}>
                                    <span className="btn-icon">
                                        <Calendar size={16} />
                                    </span>
                                    <span className="btn-text">Timeline</span>
                                </NavLink>


                                {/* FOCUS SLOTS SECTION (Partially visible in Energy 2, hidden in Energy 1) */}
                                {energyLevel >= 3 && (
                                    <div className={`sidebar-section focus-slots-section ${energyLevel === 2 ? 'ghosted-focus' : ''}`}>
                                        <div className="section-title-container">
                                            <span className="section-title-static">Focus</span>
                                            <Link 
                                                to="/focus-center" 
                                                className="header-action-btn"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Manage Focus Slots"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="3"></circle>
                                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                                </svg>
                                            </Link>
                                        </div>
                                        <div className="section-content">
                                            {focusSlots
                                                .map((slotId, idx) => ({ slotId, idx }))
                                                .filter(({ slotId }) => !!slotId)
                                                .map(({ slotId, idx }) => {
                                                    const skill = slotSkills[slotId];
                                                    const role = SLOT_ROLES[idx];
                                                    
                                                    // Compute engagement status from pre-computed map
                                                    const engagement = slotId ? engagementMap[slotId] : null;

                                                    return (
                                                        <div 
                                                            key={idx} 
                                                            className={`nav-item slot-nav-item ${glowingNodeId === slotId ? 'aura-glow-active' : ''}`}
                                                            onClick={() => {
                                                                if (onSkillClick) onSkillClick(skill);
                                                                else navigate(`/skill/${slotId}`);
                                                            }}
                                                        >
                                                            {/* Standardized Icon Rail Wrapper for Dots */}
                                                            <span className="btn-icon">
                                                                {engagement ? (
                                                                    <HealthTooltip engagement={engagement}>
                                                                        <div className={`health-dot ${engagement.status}`} />
                                                                    </HealthTooltip>
                                                                ) : (
                                                                    /* Empty Slot Placeholder Icon space holder */
                                                                    <div className="dot-placeholder" />
                                                                )}
                                                            </span>
                                                            <span className="btn-text">
                                                                {skill?.name}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            {/* Emojis and manage button removed for header relocation */}
                                        </div>
                                    </div>
                                )}

                                {/* KEEP IT ALIVE — Pilot Light Drawer */}
                                {energyLevel > 1 && maintenanceEnabled && maintenanceSkillIds.length > 0 && (
                                    <div className="sidebar-section maintenance-section">
                                        <div
                                            className="section-title-container"
                                            onClick={toggleMaintenance}
                                        >
                                            <span className="section-title-static">Keep it alive</span>
                                            <Link 
                                                to="/maintenance-center" 
                                                className="header-action-btn"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Manage Maintenance Skills"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="3"></circle>
                                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                                </svg>
                                            </Link>
                                        </div>

                                        {/* Pilot Light Drawer forced expanded in low energy */}
                                        {(isMaintenanceExpanded || energyLevel <= 2) && (
                                            <div className="pilot-drawer">

                                                {/* ── SPOTLIGHT ── */}
                                                {spotlightHabits.length > 0 && (
                                                    <div className="pilot-spotlight-list">
                                                        {spotlightHabits.map(h => (
                                                            <SidebarSpotlightCard 
                                                                key={h.id}
                                                                habit={h}
                                                                skill={maintenanceSkills.find(s => s.id === h._maintenanceSkillId)}
                                                                isCompleting={completingHabitId === h.id}
                                                                onNavigate={navigate}
                                                                onComplete={handleHabitComplete}
                                                            />
                                                        ))}
                                                    </div>
                                                )}


                                                {maintenanceSkills.map(skill => {
                                                    const isSkillDone = skillCompletionMap[skill.id];
                                                    const skillPilots = pilotLightsBySkill[skill.id] || [];
                                                    const hasNoHabits = skillsWithNoHabits.some(s => s.id === skill.id);
                                                    // Skip rendering this group if it has neither pilots nor no-habits fallback
                                                    // (all its habits are in spotlight)
                                                    const inSpotlight = spotlightHabits.filter(h => h._maintenanceSkillId === skill.id);
                                                    if (!hasNoHabits && skillPilots.length === 0 && inSpotlight.length > 0) return null;

                                                    // Don't render a pilot group if all habits are in spotlight and there's no fallback
                                                    if (!hasNoHabits && skillPilots.length === 0) return null;

                                                    return (
                                                        <div key={skill.id} className="pilot-skill-group">
                                                            <div
                                                                className={`pilot-skill-label ${glowingNodeId === skill.id ? 'aura-glow-active' : ''}`}
                                                                onClick={() => navigate(`/skill/${skill.id}`)}
                                                            >
                                                                <span className="btn-icon">
                                                                    {(() => {
                                                                        const engagement = engagementMap[skill.id];
                                                                        if (!engagement) return <div className="dot-placeholder" />;
                                                                        return (
                                                                            <HealthTooltip engagement={engagement}>
                                                                                <div className={`health-dot ${engagement.status}`} />
                                                                            </HealthTooltip>
                                                                        );
                                                                    })()}
                                                                </span>
                                                                <span className="btn-text">{skill.name}</span>
                                                            </div>

                                                            {!hasNoHabits && skillPilots.length > 0 && (
                                                                <div className="pilot-chips">
                                                                    {skillPilots.map(h => {
                                                                        const prog = habitService.getHabitProgress(h);
                                                                        return (
                                                                            <button
                                                                                key={h.id}
                                                                                className={`pilot-chip ${prog.isDone ? 'done' : ''}`}
                                                                                title={`Promote to spotlight: ${h.ifTrigger}`}
                                                                                onClick={() => promoteToSpotlight(h.id)}
                                                                            >
                                                                                <span className="pilot-chip-name">{h.ifTrigger}</span>
                                                                                <HabitEvolutionGauge habitId={h.id} compact={true} />
                                                                                {prog.isDone && <span className="pilot-chip-check">✓</span>}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* ── ALL DONE STATE ── */}
                                                {spotlightHabits.length === 0 && pilotLightHabits.length === 0 && skillsWithNoHabits.length === 0 && (
                                                    <div className="maintenance-all-done">
                                                        {energyLevel <= 2 && maintenanceSkills.length > 0 ? (
                                                            <div className="low-energy-instruction">
                                                                <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Open: {maintenanceSkills[0].name}</div>
                                                            </div>
                                                        ) : (
                                                            "Everything is alive today."
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Collapsible Life Areas Section */}
                                {energyLevel >= 4 && (
                                    <div className="sidebar-section life-areas-section">
                                        <div
                                            className="section-title-container"
                                            onClick={() => setIsAreasExpanded(!isAreasExpanded)}
                                        >
                                            <span className="section-title-static">Life areas</span>
                                        </div>

                                        {isAreasExpanded && (
                                            <div className="section-content">
                                                {lifeAreas
                                                    .filter(area => area.name !== 'System Root')
                                                    .map(area => (
                                                    <NavLink
                                                        key={area.id}
                                                        to={`/area/${area.id}`}
                                                        className={({ isActive }) => `nav-item area-item ${isActive ? 'active' : ''} ${glowingNodeId === area.id ? 'aura-glow-active' : ''}`}
                                                    >
                                                        <div
                                                            role="button"
                                                            tabIndex={0}
                                                            className="btn-icon editable-icon-trigger"
                                                            title="Click to change icon"
                                                            onClick={(e) => handleIconClick(e, area)}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            style={{ border: 'none', background: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <NodeIcon
                                                                iconUrl={area.metadata?.iconUrl}
                                                                defaultIcon="🌐"
                                                            />
                                                            {editingIconNode?.id === area.id && (
                                                                <div className="icon-edit-popover" onClick={e => e.stopPropagation()}>
                                                                    <div className="popover-header">Change Icon</div>
                                                                    <input
                                                                        autoFocus
                                                                        className="popover-input"
                                                                        placeholder="Paste icon URL..."
                                                                        value={tempIconUrl}
                                                                        onChange={e => setTempIconUrl(e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') handleSaveIcon(e);
                                                                            if (e.key === 'Escape') setEditingIconNode(null);
                                                                        }}
                                                                    />
                                                                    <div className="popover-preview">
                                                                        <NodeIcon iconUrl={tempIconUrl} size={24} />
                                                                    </div>
                                                                    <div className="popover-actions">
                                                                        <button className="confirm-btn" onClick={handleSaveIcon}>Save</button>
                                                                        <button className="cancel-btn" onClick={() => setEditingIconNode(null)}>Cancel</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="btn-text">{area.name}</span>
                                                        {area.isActive && (
                                                            <span className="area-dot" title="Active in Launchpad"></span>
                                                        )}
                                                    </NavLink>
                                                ))}

                                                <button
                                                    className="nav-item new-area-btn"
                                                    onClick={() => navigate('/create-life-area')}
                                                >
                                                    <span className="btn-icon">
                                                        <NodeIcon iconUrl={SVG_ICONS.PLUS} size={14} />
                                                    </span>
                                                    <span className="btn-text">New Area</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            /* FOCUS MODE SIDEBAR CONTENT (Refined) */
                            <div className="focus-sidebar-placeholder">
                                <div className="nav-item active">
                                    <span className="btn-icon">
                                        <div className="health-dot active" />
                                    </span>
                                    <span className="btn-text">Active Session</span>
                                </div>
                                <p className="placeholder-hint">Focus mode active...</p>
                            </div>
                        )}
                    </nav>
                </div>

            </div>

            {showCapture && (
                <div className="quick-capture-popover" ref={capturePopoverRef}>
                    <div className="quick-capture-header">
                        <h4>Quick Capture</h4>
                    </div>
                    <div className="quick-capture-input-row">
                        <input
                            ref={captureInputRef}
                            type="text"
                            className="quick-capture-input"
                            placeholder="Capture an idea..."
                            value={captureInput}
                            onChange={(e) => setCaptureInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    saveCaptureItem(captureInput);
                                    setCaptureInput('');
                                }
                            }}
                            autoFocus
                        />
                        <button 
                            className="quick-capture-add-btn"
                            onClick={() => {
                                saveCaptureItem(captureInput);
                                setCaptureInput('');
                                if (captureInputRef.current) captureInputRef.current.focus();
                            }}
                        >
                            Add
                        </button>
                    </div>
                    <div className="quick-capture-list scrollbar-hidden">
                        {captures.length === 0 ? (
                            <div className="quick-capture-empty">No items captured yet.</div>
                        ) : (
                            captures.map(item => (
                                <div className="quick-capture-item" key={item.id}>
                                    <span className="quick-capture-item-text">{item.content}</span>
                                    <button 
                                        className="quick-capture-item-delete"
                                        onClick={() => deleteCaptureItem(item.id)}
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
