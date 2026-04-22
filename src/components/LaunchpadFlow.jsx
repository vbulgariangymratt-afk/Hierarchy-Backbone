import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { backbone, NodeTypes, TaskStatuses, habitService, habitRepo } from '../backbone-v2/index';
import HabitCard from './HabitCard';
import { useSession } from '../context/SessionContext';
import { useSettings } from '../context/SettingsContext';
import { useBackboneStore } from '../store/backboneStore';
import { useShallow } from 'zustand/react/shallow';
import { getAspectStats, getAspectAvgTime, scoreLowEnergyTask, selectBestLowEnergyTask } from '../utils/taskScoring';
import { getSkillEngagementStatus } from '../utils/engagementUtils';
import './LaunchpadFlow.css';

/**
 * LaunchpadFlow - Phase 1 + Real Tasks
 * A full-screen overlay for morning onboarding.
 */
const LaunchpadFlow = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('action'); // 'energy' | 'action'
    // --- ZUSTAND SELECTORS ---
    const { allNodes, storeLoading } = useBackboneStore(useShallow(state => ({
        allNodes: state.nodes,
        storeLoading: state.loading
    })));

    const tasks = useBackboneStore(useShallow(state => 
        state.nodes.filter(n => 
            n.type === NodeTypes.TASK && 
            n.metadata?.status !== TaskStatuses.DONE
        )
    ));

    const { setEnergyLevel } = useSession();
    const { focusSlots, energyLevel, loading: settingsLoading, maintenanceSkillIds, maintenanceEnabled } = useSettings();
    const [isKeepAliveExpanded, setIsKeepAliveExpanded] = useState(false);
    const [habitTrigger, setHabitTrigger] = useState(0);

    // Initial expansion for low energy
    useEffect(() => {
        if (energyLevel <= 2 && !settingsLoading) {
            setIsKeepAliveExpanded(true);
        }
    }, [energyLevel, settingsLoading]);

    // Subscriber to habit repository for re-rendering
    useEffect(() => {
        const unsub = habitRepo?.subscribe?.(() => {
            setHabitTrigger(prev => prev + 1);
        });
        return () => unsub?.();
    }, []);

    // 1. Build HEURISTICS
    const nodeMap = useMemo(() => {
        return new Map(allNodes.map(n => [n.id, n]));
    }, [allNodes]);

    const aspectStats = useMemo(() => getAspectStats(allNodes), [allNodes]);

    const getSkillFromTask = useCallback((task, map) => {
        if (!task || typeof task === 'string') return null;
        const aspect = map.get(task.parentId);
        const objective = map.get(aspect?.parentId);
        return map.get(objective?.parentId);
    }, []);

    // Medium Energy Data Processing
    const activeSkills = useMemo(() => {
        return allNodes.filter(n => {
            if (n.type !== NodeTypes.SKILL) return false;
            // A skill is active if it is NOT sleeping
            if (n.metadata?.isSleeping) return false;
            if (n.metadata?.sleepUntil) {
                if (new Date(n.metadata.sleepUntil) > new Date()) return false;
            } else if (n.metadata?.status === 'SLEEPING') {
                return false;
            }
            return true;
        });
    }, [allNodes]);

    const skillMomentum = useMemo(() => {
        const counts = {};
        const fourDaysAgo = Date.now() - (4 * 24 * 60 * 60 * 1000);
        
        allNodes.forEach(node => {
            if (node.type === NodeTypes.TASK && node.metadata?.completedAt) {
                const compAt = new Date(node.metadata.completedAt).getTime();
                if (compAt >= fourDaysAgo) {
                    const skill = getSkillFromTask(node, nodeMap);
                    if (skill) {
                        counts[skill.id] = (counts[skill.id] || 0) + 1;
                    }
                }
            }
        });
        return counts;
    }, [allNodes, nodeMap]);

    const heroSkill = useMemo(() => {
        const explorational = activeSkills.filter(s => s.metadata?.identityTier === 'EXPLORATION');
        if (explorational.length === 0) return null;
        
        // Sort by momentum count, then by name
        return [...explorational].sort((a, b) => {
            const countA = skillMomentum[a.id] || 0;
            const countB = skillMomentum[b.id] || 0;
            if (countB !== countA) return countB - countA;
            return a.name.localeCompare(b.name);
        })[0];
    }, [activeSkills, skillMomentum]);

    const heroTask = useMemo(() => {
        if (!heroSkill) return null;
        const tasksForSkill = allNodes.filter(n => {
            if (n.type !== NodeTypes.TASK || n.metadata?.status === TaskStatuses.DONE) return false;
            const skill = getSkillFromTask(n, nodeMap);
            return skill?.id === heroSkill.id;
        });
        
        return [...tasksForSkill].sort((a, b) => {
            const sessionsA = a.metadata?.sessions?.length || 0;
            const sessionsB = b.metadata?.sessions?.length || 0;
            return sessionsA - sessionsB;
        })[0];
    }, [heroSkill, allNodes, nodeMap]);

    const [selectedSkills, setSelectedSkills] = useState([]);
    const [selectedExperiment, setSelectedExperiment] = useState(null);
    const [dumpedTasks, setDumpedTasks] = useState([]);
    const [dumpInput, setDumpInput] = useState("");
    const [selectedDraftTaskIds, setSelectedDraftTaskIds] = useState([]);
    const [lowEnergySafeStates, setLowEnergySafeStates] = useState({}); // { taskId: boolean }
    const [newAspectName, setNewAspectName] = useState("");
    const [initiationTask, setInitiationTask] = useState(null);
    const [highEnergyIndex, setHighEnergyIndex] = useState(0);
    const [energy2HabitIndex, setEnergy2HabitIndex] = useState(0);
    const [energy1HabitIndex, setEnergy1HabitIndex] = useState(0);
    const [energy1SubStep, setEnergy1SubStep] = useState('initial'); // 'initial', 'redirection', 'habits', 'skills', 'aspects', 'tasks'
    const [e1SkillIndex, setE1SkillIndex] = useState(0);
    const [e1AspectIndex, setE1AspectIndex] = useState(0);
    const [e1TaskIndex, setE1TaskIndex] = useState(0);
    const [e1SelectedSkillId, setE1SelectedSkillId] = useState(null);
    const [e1SelectedAspectId, setE1SelectedAspectId] = useState(null);
    const [energy2SubStep, setEnergy2SubStep] = useState('initial');
    const [e2SpotlightHabit, setE2SpotlightHabit] = useState(null);
    const [e2SkillIndex, setE2SkillIndex] = useState(0);
    const [e2AspectIndex, setE2AspectIndex] = useState(0);
    const [e2TaskIndex, setE2TaskIndex] = useState(0);
    const [e2SelectedSkillId, setE2SelectedSkillId] = useState(null);
    const [e2SelectedAspectId, setE2SelectedAspectId] = useState(null);
    const [isEnergy3Expanded, setIsEnergy3Expanded] = useState(false);
    const [energy3TaskIndex, setEnergy3TaskIndex] = useState(0);
    const [isEnergy3SwitchingSkill, setIsEnergy3SwitchingSkill] = useState(false);
    const [energy3SkillIndex, setEnergy3SkillIndex] = useState(0);
    const [energy3SkillOverride, setEnergy3SkillOverride] = useState(null);
    const [isEnergy3SwitchingHabit, setIsEnergy3SwitchingHabit] = useState(false);
    const [energy3HabitIndex, setEnergy3HabitIndex] = useState(0);
    const [isEnergy3ExplorePath, setIsEnergy3ExplorePath] = useState(false);
    const [e3ActiveSkillIndex, setE3ActiveSkillIndex] = useState(0);
    const [e3ActiveSelectedSkillId, setE3ActiveSelectedSkillId] = useState(null);
    const [e3ActiveAspectIndex, setE3ActiveAspectIndex] = useState(0);
    const [e3ActiveSelectedAspectId, setE3ActiveSelectedAspectId] = useState(null);
    const [e3ActiveTaskIndex, setE3ActiveTaskIndex] = useState(0);
    const [e3ActiveSubStep, setE3ActiveSubStep] = useState('skills');
    const [energy3SearchQuery, setEnergy3SearchQuery] = useState("");
    const [showEnergy3Search, setShowEnergy3Search] = useState(false);
    const [e5ActiveSkillIndex, setE5ActiveSkillIndex] = useState(0);

    // --- PREP FLOW STATE (Energy 4+: "Prepare everything for your future self") ---
    const [prepSubStep, setPrepSubStep] = useState('areas'); // 'areas' | 'skills' | 'experiments' | 'aspects' | 'task-input' | 'micro-action'
    const [prepSelectedArea, setPrepSelectedArea] = useState(null);
    const [prepSelectedSkill, setPrepSelectedSkill] = useState(null);
    const [prepSelectedExperiment, setPrepSelectedExperiment] = useState(null);
    const [prepSelectedAspect, setPrepSelectedAspect] = useState(null);
    const [prepNewTaskInput, setPrepNewTaskInput] = useState('');
    const [prepCreatedTask, setPrepCreatedTask] = useState(null); // task just created, waiting for micro-action
    const [prepMicroActionInput, setPrepMicroActionInput] = useState('');
    const [prepTasksAddedToAspect, setPrepTasksAddedToAspect] = useState([]); // track tasks added in current aspect session
    const [showFutureSelfToast, setShowFutureSelfToast] = useState(false);

    const toggleSkill = (skillId) => {
        setSelectedSkills(prev => {
            if (prev.includes(skillId)) {
                return prev.filter(id => id !== skillId);
            }
            if (prev.length < 4) {
                return [...prev, skillId];
            }
            return prev;
        });
    };

    const getSkillOrder = (skillId) => {
        const idx = selectedSkills.indexOf(skillId);
        return idx === -1 ? 0 : idx + 1;
    };

    const getTaskTime = (task) => {
        const sessions = task.metadata?.sessions || [];
        const completed = sessions.filter(s => s.status === 'completed');
        return completed.reduce((acc, s) => acc + (s.actualDuration || 0), 0);
    };

    const getAvgFriction = useCallback((habit) => {
        const completions = habit.completions || [];
        if (completions.length === 0) return 2; // Default to medium (score 2)
        const scores = { light: 1, medium: 2, heavy: 3 };
        const sum = completions.reduce((acc, c) => acc + (scores[c.friction] || 2), 0);
        return sum / completions.length;
    }, []);

    useEffect(() => {
        if (selectedSkills.length === 0) {
            setInitiationTask(null);
            return;
        }

        const firstSkillId = selectedSkills[0];
        
        // 1. Get all tasks for this skill (excluding completed)
        const tasksForSkill = allNodes.filter(node => {
            if (node.type !== NodeTypes.TASK) return false;
            if (node.metadata?.status === TaskStatuses.DONE) return false;
            const skill = getSkillFromTask(node, nodeMap);
            return skill?.id === firstSkillId;
        });

        if (tasksForSkill.length === 0) {
            setInitiationTask(null);
            return;
        }

        // 2. Group by Aspect and compute stats
        const aspectData = {}; 
        tasksForSkill.forEach(t => {
            const aspectId = t.parentId;
            if (!aspectData[aspectId]) aspectData[aspectId] = { durations: [], tasks: [] };
            aspectData[aspectId].tasks.push(t);
            
            const sessions = t.metadata?.sessions || [];
            sessions.forEach(s => {
                if (s.startTime && s.endTime) {
                    const d = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
                    if (d > 0) aspectData[aspectId].durations.push(d);
                }
            });
        });

        // 3. Compute Averages
        const stats = [];
        Object.keys(aspectData).forEach(aid => {
            const d = aspectData[aid].durations;
            // No sessions = high number but not infinity so they still appear
            const avg = d.length > 0 ? d.reduce((a, b) => a + b, 0) / d.length : 9999999;
            stats.push({ aspectId: aid, avg, tasks: aspectData[aid].tasks });
        });

        // 4. Sort aspects by speed (Fastest first)
        const sortedAspects = stats.sort((a, b) => a.avg - b.avg);
        
        console.log("Aspect stats:", sortedAspects);

        let selected = null;

        // 5. Pick from the fastest aspect that has a Today or In Progress task
        for (const stat of sortedAspects) {
            const ts = stat.tasks;
            
            // Priority 1: isToday
            const todayTask = ts.find(t => t.metadata?.isToday === true);
            if (todayTask) {
                selected = todayTask;
                break;
            }
            
            // Priority 2: IN_PROGRESS
            const inProgTask = ts.find(t => t.metadata?.status === TaskStatuses.IN_PROGRESS);
            if (inProgTask) {
                selected = inProgTask;
                break;
            }
        }

        // 6. Final fallback: pick from absolute fastest aspect first task
        if (!selected && sortedAspects.length > 0) {
            selected = sortedAspects[0].tasks[0];
        }

        console.log("Fastest aspect ID:", selected ? selected.parentId : "none");
        console.log("Selected task:", selected?.name);

        setInitiationTask(selected);
    }, [selectedSkills, allNodes, nodeMap]);

    const [selectedInitiationTask, setSelectedInitiationTask] = useState(null);
    const [showAlternatives, setShowAlternatives] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [lowEnergyTask, setLowEnergyTask] = useState(null);
    const [showLowEnergyAlternatives, setShowLowEnergyAlternatives] = useState(false);
    const [hoveredRecommendationId, setHoveredRecommendationId] = useState(null);




    const handleEnergy1SwapTask = () => {
        if (!lowEnergyTask) return;
        const currentSkill = getSkillFromTask(lowEnergyTask, nodeMap);
        if (!currentSkill) return;
        
        const tasksForSkill = allNodes.filter(n => {
            if (n.type !== NodeTypes.TASK || n.metadata?.status === TaskStatuses.DONE) return false;
            const s = getSkillFromTask(n, nodeMap);
            return s?.id === currentSkill.id;
        });

        const available = tasksForSkill.filter(t => t.id !== lowEnergyTask.id);
        if (available.length > 0) {
            const random = available[Math.floor(Math.random() * available.length)];
            setLowEnergyTask(random);
        }
    };



    const maintenanceHabitGroups = useMemo(() => {
        if (!maintenanceEnabled || !maintenanceSkillIds || maintenanceSkillIds.length === 0) return [];
        
        return maintenanceSkillIds.map(sid => {
            const skill = nodeMap.get(sid);
            if (!skill) return null;
            
            const allSkillHabits = habitService.getHabitsBySkill(sid) || [];
            // Filter habits that are NOT done today
            const dueHabits = allSkillHabits.filter(h => !habitService.getHabitProgress(h).isDone);
            
            if (dueHabits.length > 0 || allSkillHabits.length === 0) {
                return {
                    skill,
                    habits: dueHabits,
                    hasNoHabits: allSkillHabits.length === 0
                };
            }
            return null;
        }).filter(g => g !== null);
    }, [maintenanceEnabled, maintenanceSkillIds, nodeMap, habitTrigger, allNodes.length]);
    
    const energy2HabitsPool = useMemo(() => {
        const pool = maintenanceHabitGroups.flatMap(group => 
            group.habits.map(h => ({
                ...h,
                skillName: group.skill.name
            }))
        );
        // Sort by least friction completion on average
        return [...pool].sort((a, b) => getAvgFriction(a) - getAvgFriction(b));
    }, [maintenanceHabitGroups, getAvgFriction]);

    const energy1HabitsPool = useMemo(() => {
        const pool = maintenanceHabitGroups.flatMap(group => 
            group.habits.map(h => ({
                ...h,
                skillName: group.skill.name
            }))
        );
        // Sort by least friction completion on average
        return [...pool].sort((a, b) => getAvgFriction(a) - getAvgFriction(b));
    }, [maintenanceHabitGroups, getAvgFriction]);

    const handleHabitComplete = useCallback(async (habitId) => {
        try {
            await habitService.completeHabit(habitId);
            setHabitTrigger(prev => prev + 1);
        } catch (error) {
            console.error("Habit completion failed", error);
        }
    }, []);

    const lowEnergyFastTasks = useMemo(() => {
        if (energyLevel > 2) return [];
        
        // 1. Get ALL non-DONE tasks that are safe AND belong to CORE identity skills
        const filtered = allNodes.filter(n => {
            if (n.type !== NodeTypes.TASK || n.metadata?.status === TaskStatuses.DONE) return false;
            if (n.metadata?.isLowEnergySafe === false) return false; // Default to safe (only exclude if explicitly false)
            
            const skill = getSkillFromTask(n, nodeMap);
            return skill?.metadata?.identityTier === 'CORE';
        });

        // 2. Prioritize explicitly safe tasks (isLowEnergySafe === true) first
        const sorted = [...filtered].sort((a, b) => {
            const aSafe = a.metadata?.isLowEnergySafe === true ? 1 : 0;
            const bSafe = b.metadata?.isLowEnergySafe === true ? 1 : 0;
            return bSafe - aSafe;
        });

        console.log("Prioritized Low Energy pool (SAFE first):", sorted.length);
        return sorted;
    }, [energyLevel, allNodes, nodeMap]);

    const activeLowEnergyAlternatives = useMemo(() => {
        if (!lowEnergyFastTasks.length) return [];
        
        const currentId = lowEnergyTask?.id;
        const available = lowEnergyFastTasks.filter(t => t.id !== currentId);

        if (searchQuery) {
            const searched = available.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);
            console.log("Low energy search results:", searched.length);
            return searched;
        }

        // Priority for default 3: Today > In Progress > any
        const today = available.filter(t => t.metadata?.isToday);
        const inProgress = available.filter(t => !t.metadata?.isToday && t.metadata?.status === TaskStatuses.IN_PROGRESS);
        const rest = available.filter(t => !t.metadata?.isToday && t.metadata?.status !== TaskStatuses.IN_PROGRESS);

        const results = [...today, ...inProgress, ...rest].slice(0, 3);
        console.log("Alternative tasks (Low Energy):", results.length);
        return results;
    }, [lowEnergyFastTasks, lowEnergyTask, searchQuery]);

    const highEnergyTasks = useMemo(() => {
        const tasks = allNodes
            .filter(n => n.type === NodeTypes.TASK && n.metadata?.highEnergy === true && n.metadata?.status !== TaskStatuses.DONE);
        
        // Sort by most recent work (session endTime)
        return [...tasks].sort((a, b) => {
            const getLatestTime = (task) => {
                const sessions = task.metadata?.sessions || [];
                const completed = sessions.filter(s => s.status === 'completed' && s.endTime);
                if (completed.length === 0) return 0;
                return Math.max(...completed.map(s => s.endTime));
            };
            return getLatestTime(b) - getLatestTime(a);
        });
    }, [allNodes]);

    
    const tripleRecommendation = useMemo(() => {
        if (allNodes.length === 0) return [];
        
        const activeIds = focusSlots || [];
        const pendingTasks = allNodes.filter(n => 
            n.type === NodeTypes.TASK && 
            n.metadata?.status !== TaskStatuses.DONE
        );

        if (energy3SkillOverride) {
            // If we have an override, get 3 tasks from ONLY that skill
            const skillTasks = pendingTasks.filter(t => {
                const s = getSkillFromTask(t, nodeMap);
                return s?.id === energy3SkillOverride;
            });

            const tasksWithScores = skillTasks.map(t => {
                const stats = aspectStats.get(t.parentId);
                const rate = stats && stats.totalCount > 0 ? (stats.doneCount / stats.totalCount) : 0;
                const isToday = t.metadata?.isToday ? 1 : 0;
                const isInProgress = t.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
                const updatedAt = t.updatedAt || 0;
                return { task: t, rate, isToday, isInProgress, updatedAt };
            });

            tasksWithScores.sort((a, b) => {
                if (b.rate !== a.rate) return b.rate - a.rate;
                if (b.isToday !== a.isToday) return b.isToday - a.isToday;
                if (b.isInProgress !== a.isInProgress) return b.isInProgress - a.isInProgress;
                return b.updatedAt - a.updatedAt;
            });

            return tasksWithScores.slice(0, 3).map(c => c.task);
        }

        // Standard logic: 1 task per different skill
        const skillToTasks = new Map();
        pendingTasks.forEach(t => {
            const s = getSkillFromTask(t, nodeMap);
            if (s && activeIds.includes(s.id)) {
                if (!skillToTasks.has(s.id)) {
                    skillToTasks.set(s.id, []);
                }
                skillToTasks.get(s.id).push(t);
            }
        });

        const skillCandidates = [];
        skillToTasks.forEach((tasksInSkill, skillId) => {
            const tasksWithScores = tasksInSkill.map(t => {
                const stats = aspectStats.get(t.parentId);
                const rate = stats && stats.totalCount > 0 ? (stats.doneCount / stats.totalCount) : 0;
                const isToday = t.metadata?.isToday ? 1 : 0;
                const isInProgress = t.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
                const updatedAt = t.updatedAt || 0;
                return { task: t, rate, isToday, isInProgress, updatedAt };
            });

            tasksWithScores.sort((a, b) => {
                if (b.rate !== a.rate) return b.rate - a.rate;
                if (b.isToday !== a.isToday) return b.isToday - a.isToday;
                if (b.isInProgress !== a.isInProgress) return b.isInProgress - a.isInProgress;
                return b.updatedAt - a.updatedAt;
            });

            skillCandidates.push(tasksWithScores[0]);
        });

        skillCandidates.sort((a, b) => {
            if (b.rate !== a.rate) return b.rate - a.rate;
            if (b.isToday !== a.isToday) return b.isToday - a.isToday;
            return b.updatedAt - a.updatedAt;
        });

        return skillCandidates.slice(0, 3).map(c => c.task);
    }, [allNodes, focusSlots, nodeMap, getSkillFromTask, aspectStats, energy3SkillOverride]);
    
    const energy2Pool = useMemo(() => {
        const tasks = allNodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.isToday && n.metadata?.status !== TaskStatuses.DONE);
        // Sort by oldest first
        return tasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }, [allNodes]);

    const energy1Pool = useMemo(() => {
        const tasks = allNodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.isToday && n.metadata?.status !== TaskStatuses.DONE);
        // Sort by oldest first
        return tasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }, [allNodes]);

    // --- ENERGY 1-2 SPECIFIC TASK SELECTION ---
    useEffect(() => {
        if (energyLevel > 2) return;
        // Keep lowEnergyTask in sync with the primary pool task
        const pool = energyLevel === 1 ? energy1Pool : energy2Pool;
        if (pool && pool.length > 0) {
            setLowEnergyTask(pool[0]);
        }
    }, [energyLevel, energy1Pool, energy2Pool]);

    const activeFocusSkills = useMemo(() => {
        if (!focusSlots) return [];
        return focusSlots.map(id => nodeMap.get(id)).filter(s => !!s);
    }, [focusSlots, nodeMap]);

    const e1AspectsPool = useMemo(() => {
        if (!e1SelectedSkillId) return [];
        // Get aspects from active experiments inside this skill
        const aspects = allNodes.filter(n => {
            if (n.type !== NodeTypes.ASPECT) return false;
            const objective = nodeMap.get(n.parentId);
            if (!objective || objective.type !== NodeTypes.OBJECTIVE || objective.metadata?.status !== 'ACTIVE') return false;
            return objective.parentId === e1SelectedSkillId;
        });

        // Sort by lowest average task completion time
        return aspects.sort((a, b) => {
            const timeA = getAspectAvgTime(a.id, aspectStats);
            const timeB = getAspectAvgTime(b.id, aspectStats);
            return timeA - timeB;
        });
    }, [e1SelectedSkillId, allNodes, nodeMap, aspectStats]);

    const e1TasksPool = useMemo(() => {
        if (!e1SelectedAspectId) return [];
        const tasks = allNodes.filter(n => n.type === NodeTypes.TASK && n.parentId === e1SelectedAspectId && n.metadata?.status !== TaskStatuses.DONE);
        // Sort by IN_PROGRESS first
        return tasks.sort((a, b) => {
            const aProg = a.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
            const bProg = b.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
            return bProg - aProg;
        });
    }, [e1SelectedAspectId, allNodes]);

    const e2AspectsPool = useMemo(() => {
        if (!e2SelectedSkillId) return [];
        // Get aspects from active experiments inside this skill
        const aspects = allNodes.filter(n => {
            if (n.type !== NodeTypes.ASPECT) return false;
            const objective = nodeMap.get(n.parentId);
            if (!objective || objective.type !== NodeTypes.OBJECTIVE || objective.metadata?.status !== 'ACTIVE') return false;
            return objective.parentId === e2SelectedSkillId;
        });

        // Sort by lowest average task completion time
        return aspects.sort((a, b) => {
            const timeA = getAspectAvgTime(a.id, aspectStats);
            const timeB = getAspectAvgTime(b.id, aspectStats);
            return timeA - timeB;
        });
    }, [e2SelectedSkillId, allNodes, nodeMap, aspectStats]);

    const e2TasksPool = useMemo(() => {
        if (!e2SelectedAspectId) return [];
        const tasks = allNodes.filter(n => n.type === NodeTypes.TASK && n.parentId === e2SelectedAspectId && n.metadata?.status !== TaskStatuses.DONE);
        // Sort by IN_PROGRESS first
        return tasks.sort((a, b) => {
            const aProg = a.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
            const bProg = b.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
            return bProg - aProg;
        });
    }, [e2SelectedAspectId, allNodes]);

    const activeNonFocusSkills = useMemo(() => {
        const focusIds = focusSlots || [];
        const maintenanceIds = maintenanceSkillIds || [];
        return allNodes.filter(n => {
            if (n.type !== NodeTypes.SKILL) return false;
            if (n.metadata?.isSleeping) return false;
            if (n.metadata?.sleepUntil && new Date(n.metadata.sleepUntil) > new Date()) return false;
            if (n.metadata?.status === 'SLEEPING') return false;
            if (focusIds.includes(n.id)) return false;
            if (maintenanceIds.includes(n.id)) return false;
            return true;
        });
    }, [allNodes, focusSlots, maintenanceSkillIds]);

    const e5ActiveSkillTask = useMemo(() => {
        if (!activeNonFocusSkills.length) return null;
        const skill = activeNonFocusSkills[e5ActiveSkillIndex % activeNonFocusSkills.length];
        if (!skill) return null;
        
        const tasksForSkill = allNodes.filter(n => {
            if (n.type !== NodeTypes.TASK || n.metadata?.status === TaskStatuses.DONE) return false;
            const s = getSkillFromTask(n, nodeMap);
            return s?.id === skill.id;
        });
        
        return tasksForSkill[0] || null;
    }, [activeNonFocusSkills, e5ActiveSkillIndex, allNodes, nodeMap]);

    const e3ActiveAspectsPool = useMemo(() => {
        if (!e3ActiveSelectedSkillId) return [];
        const aspects = allNodes.filter(n => {
            if (n.type !== NodeTypes.ASPECT) return false;
            const objective = nodeMap.get(n.parentId);
            if (!objective || objective.type !== NodeTypes.OBJECTIVE || objective.metadata?.status !== 'ACTIVE') return false;
            return objective.parentId === e3ActiveSelectedSkillId;
        });
        return aspects.sort((a, b) => {
            const timeA = getAspectAvgTime(a.id, aspectStats);
            const timeB = getAspectAvgTime(b.id, aspectStats);
            return timeA - timeB;
        });
    }, [e3ActiveSelectedSkillId, allNodes, nodeMap, aspectStats]);

    const e3ActiveTasksPool = useMemo(() => {
        if (!e3ActiveSelectedAspectId) return [];
        const tasks = allNodes.filter(n => n.type === NodeTypes.TASK && n.parentId === e3ActiveSelectedAspectId && n.metadata?.status !== TaskStatuses.DONE);
        return tasks.sort((a, b) => {
            const aProg = a.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
            const bProg = b.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
            return bProg - aProg;
        });
    }, [e3ActiveSelectedAspectId, allNodes]);

    // --- PREP FLOW DATA ---
    // Life areas, sorted by recent task activity (most active first)
    const prepLifeAreas = useMemo(() => {
        const areas = allNodes.filter(n => n.type === NodeTypes.LIFE_AREA);
        // Count tasks completed in the last 30 days per area
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const activityCount = {};
        allNodes.forEach(n => {
            if (n.type !== NodeTypes.TASK) return;
            const completedAt = n.metadata?.completedAt ? new Date(n.metadata.completedAt).getTime() : null;
            if (!completedAt || now - completedAt > THIRTY_DAYS) return;
            // Walk up: task -> aspect -> objective -> skill -> area
            const aspect = nodeMap.get(n.parentId);
            const objective = nodeMap.get(aspect?.parentId);
            const skill = nodeMap.get(objective?.parentId);
            const area = nodeMap.get(skill?.parentId);
            if (area && area.type === NodeTypes.LIFE_AREA) {
                activityCount[area.id] = (activityCount[area.id] || 0) + 1;
            }
        });
        return [...areas].sort((a, b) => (activityCount[b.id] || 0) - (activityCount[a.id] || 0));
    }, [allNodes, nodeMap]);

    // Skills within a selected area — focus skills first, then active non-focus, then maintenance
    const prepSkillsForArea = useMemo(() => {
        if (!prepSelectedArea) return { focusSkills: [], activeSkills: [] };
        const focusIds = focusSlots || [];
        const maintenanceIds = maintenanceSkillIds || [];
        const skillsInArea = allNodes.filter(n => {
            if (n.type !== NodeTypes.SKILL) return false;
            if (n.parentId !== prepSelectedArea.id) return false;
            if (n.metadata?.isSleeping) return false;
            if (n.metadata?.sleepUntil && new Date(n.metadata.sleepUntil) > new Date()) return false;
            if (n.metadata?.status === 'SLEEPING') return false;
            return true;
        });
        const focusSkills = skillsInArea.filter(s => focusIds.includes(s.id));
        // Active = not sleeping, not focus, not maintenance
        const activeSkills = skillsInArea.filter(s => !focusIds.includes(s.id) && !maintenanceIds.includes(s.id));
        return { focusSkills, activeSkills };
    }, [prepSelectedArea, allNodes, focusSlots, maintenanceSkillIds]);

    // Experiments (OBJECTIVE nodes) within a selected skill — active at top, paused/sleeping below
    const prepExperimentsForSkill = useMemo(() => {
        if (!prepSelectedSkill) return { active: [], paused: [] };
        const objectives = allNodes.filter(n => n.type === NodeTypes.OBJECTIVE && n.parentId === prepSelectedSkill.id);
        const active = objectives.filter(o => o.metadata?.status === 'ACTIVE');
        const paused = objectives.filter(o => o.metadata?.status === 'SLEEPING' || o.metadata?.status === 'ROTATING' || (o.metadata?.status && o.metadata.status !== 'ACTIVE' && o.metadata.status !== 'ACHIEVED' && o.metadata.status !== 'ARCHIVED' && o.metadata.status !== 'COMPLETED'));
        return { active, paused };
    }, [prepSelectedSkill, allNodes]);

    // Aspects within a selected experiment
    const prepAspectsForExperiment = useMemo(() => {
        if (!prepSelectedExperiment) return [];
        return allNodes.filter(n => n.type === NodeTypes.ASPECT && n.parentId === prepSelectedExperiment.id);
    }, [prepSelectedExperiment, allNodes]);

    // Helper: reset prep flow back to start
    const resetPrepFlow = () => {
        setPrepSubStep('areas');
        setPrepSelectedArea(null);
        setPrepSelectedSkill(null);
        setPrepSelectedExperiment(null);
        setPrepSelectedAspect(null);
        setPrepNewTaskInput('');
        setPrepCreatedTask(null);
        setPrepMicroActionInput('');
        setPrepTasksAddedToAspect([]);
    };

    // Handler: create a task in the prep flow
    const handlePrepCreateTask = async () => {
        if (!prepNewTaskInput.trim() || !prepSelectedAspect) return;
        try {
            const newTask = await backbone.addNode({
                name: prepNewTaskInput.trim(),
                type: NodeTypes.TASK,
                parentId: prepSelectedAspect.id,
                metadata: {
                    status: TaskStatuses.NOT_STARTED,
                    createdAt: Date.now()
                }
            });
            setPrepCreatedTask(newTask);
            setPrepNewTaskInput('');
            setPrepSubStep('micro-action');
        } catch (err) {
            console.error('[PrepFlow] Create task error:', err);
        }
    };

    // Handler: save micro-action and return to task input (or aspects)
    const handlePrepSaveMicroAction = async () => {
        if (!prepCreatedTask) return;
        try {
            if (prepMicroActionInput.trim()) {
                await backbone.updateNode(prepCreatedTask.id, {
                metadata: { mve: prepMicroActionInput.trim() }
                });
            }
            setPrepTasksAddedToAspect(prev => [...prev, { ...prepCreatedTask, mve: prepMicroActionInput.trim() }]);
            setPrepCreatedTask(null);
            setPrepMicroActionInput('');
            // Return to task-input so they can add more tasks
            setPrepSubStep('task-input');
        } catch (err) {
            console.error('[PrepFlow] Save micro-action error:', err);
        }
    };

    const activeHighEnergySkills = useMemo(() => {
        return allNodes.filter(n => {
            if (n.type !== NodeTypes.SKILL) return false;
            // Dynamic sleep check: only include active skills
            if (n.metadata?.isSleeping) return false;
            if (n.metadata?.sleepUntil) {
                if (new Date(n.metadata.sleepUntil) > new Date()) return false;
            } else if (n.metadata?.status === 'SLEEPING') {
                return false;
            }
            return true;
        }).filter(skill => {
            // Only include skills that have at least one UNFINISHED high-energy task
            return allNodes.some(node => {
                if (node.type !== NodeTypes.TASK || node.metadata?.status === TaskStatuses.DONE) return false;
                const s = getSkillFromTask(node, nodeMap);
                return s?.id === skill.id && node.metadata?.highEnergy === true;
            });
        });
    }, [allNodes, nodeMap, getSkillFromTask]);

    const [selectedSkillOverride, setSelectedSkillOverride] = useState(null);
    const [showPleasureModal, setShowPleasureModal] = useState(false);
    const [pendingTask, setPendingTask] = useState(null);
    const [expandedMomentumSkillId, setExpandedMomentumSkillId] = useState(null);

    const getHighEnergyTasksForSkill = useCallback((skillId) => {
        return allNodes.filter(node => {
            if (node.type !== NodeTypes.TASK || node.metadata?.status === TaskStatuses.DONE || node.metadata?.highEnergy !== true) return false;
            const s = getSkillFromTask(node, nodeMap);
            return s?.id === skillId;
        }).sort((a, b) => {
            // prioritize tasks that are IN_PROGRESS first
            const aInProg = a.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
            const bInProg = b.metadata?.status === TaskStatuses.IN_PROGRESS ? 1 : 0;
            if (aInProg !== bInProg) return bInProg - aInProg;
            
            // then by updatedAt descending
            if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
            
            // then by createdAt descending
            return (b.createdAt || 0) - (a.createdAt || 0);
        }).slice(0, 3);
    }, [allNodes, nodeMap, getSkillFromTask]);

    const highEnergySelectionData = useMemo(() => {
        if (energyLevel < 4) return { skill: null, heroTask: null, filteredList: [] };

        // 1. HERO TASK logic: pick from globally sorted highEnergyTasks
        const heroTask = highEnergyTasks.length > 0 ? highEnergyTasks[0] : null;

        // 2. SAVED FOR HIGH ENERGY list: filter by skill if override is set, otherwise show all
        let filteredList = highEnergyTasks;
        if (selectedSkillOverride) {
            filteredList = highEnergyTasks.filter(t => {
                const s = getSkillFromTask(t, nodeMap);
                return s?.id === selectedSkillOverride;
            });
        }
        
        // 3. LOGS
        console.log("[HIGH ENERGY LAUNCHPAD] Total unfinished tasks with highEnergy === true globally:", highEnergyTasks.length);
        console.log("[HIGH ENERGY LAUNCHPAD] Tasks passing current display filter:", filteredList.length);
        console.log("[HIGH ENERGY LAUNCHPAD] Hero task chosen (most recent):", heroTask?.name || "None");
        console.log("[HIGH ENERGY LAUNCHPAD] Skills qualifying for momentum:", activeHighEnergySkills.map(s => s.name));

        const mostActiveSkill = selectedSkillOverride ? nodeMap.get(selectedSkillOverride) : null;

        return {
            skill: mostActiveSkill,
            heroTask,
            filteredList
        };
    }, [energyLevel, highEnergyTasks, nodeMap, selectedSkillOverride, activeHighEnergySkills, getSkillFromTask]);

    const handleStartTask = (task) => {
        if (!task) return;
        setPendingTask(task);
        setShowPleasureModal(true);
    };

    const confirmStartTask = (expectedPleasure) => {
        if (!pendingTask) return;
        console.log(`Starting task ${pendingTask.name} with expected pleasure: ${expectedPleasure}`);
        navigate('/focus', { state: { taskId: pendingTask.id, expectedPleasure, autoStart: true } });
    };

    const topActiveExperiments = useMemo(() => {
        const experiments = allNodes.filter(n =>
            n.type === NodeTypes.OBJECTIVE &&
            n.metadata?.status === "ACTIVE"
        );

        const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        const expWithMomentum = experiments.filter(exp => {
            const parentSkill = nodeMap.get(exp.parentId);
            const tier = parentSkill?.metadata?.identityTier;
            return tier === "CORE" || tier === "EXPLORATION";
        }).map(exp => {
            const tasksInExp = allNodes.filter(node => {
                if (node.type !== NodeTypes.TASK) return false;
                const aspect = nodeMap.get(node.parentId);
                return aspect?.parentId === exp.id;
            });

            const momentum = tasksInExp.filter(task => {
                if (!task.metadata?.completedAt) return false;
                const completedTime = new Date(task.metadata.completedAt).getTime();
                return (now - completedTime) <= FIVE_DAYS;
            }).length;

            return { ...exp, momentum };
        });

        const sorted = expWithMomentum.sort((a, b) => b.momentum - a.momentum).slice(0, 3);
        console.log("Top 3 High Energy experiments identified:", sorted.length);
        return sorted;
    }, [allNodes, nodeMap]);

    const handleBrainDump = async (e) => {
        if (e.key !== 'Enter' || !dumpInput.trim() || !selectedExperiment) return;

        try {
            // 1. Find or create default aspect
            let aspect = allNodes.find(n => n.type === NodeTypes.ASPECT && n.parentId === selectedExperiment.id);
            
            if (!aspect) {
                console.log("No aspect found for experiment, creating 'General' aspect.");
                aspect = await backbone.addNode({
                    name: "General",
                    type: NodeTypes.ASPECT,
                    parentId: selectedExperiment.id,
                    metadata: { status: "ACTIVE" }
                });
                setAllNodes(prev => [...prev, aspect]);
            }

            // 2. Create task
            const newTask = await backbone.addNode({
                name: dumpInput.trim(),
                type: NodeTypes.TASK,
                parentId: aspect.id,
                metadata: {
                    status: TaskStatuses.NOT_STARTED,
                    isDraft: true,
                    createdAt: Date.now()
                }
            });

            // 3. Update state
            setDumpedTasks(prev => [newTask, ...prev]);
            setAllNodes(prev => [...prev, newTask]);
            setDumpInput("");
            console.log("Brain Dump: Created task", newTask.id);
        } catch (err) {
            console.error("Brain Dump Error:", err);
        }
    };

    const handleAssignToAspect = async (aspectId) => {
        if (!selectedDraftTaskIds.length) return;

        try {
            const updatedNodes = [];
            for (const taskId of selectedDraftTaskIds) {
                // 1. Move to new aspect parent
                await backbone.moveNode(taskId, aspectId);

                // 2. Clear draft status and add low-energy safe flag
                const isLowEnergySafe = lowEnergySafeStates[taskId] !== false; // Default: true
                const updated = await backbone.updateNode(taskId, {
                    metadata: { 
                        isDraft: false,
                        isLowEnergySafe: isLowEnergySafe
                    }
                });
                updatedNodes.push(updated);
            }

            // Update allNodes state
            setAllNodes(prev => prev.map(n => {
                const match = updatedNodes.find(u => u.id === n.id);
                return match ? match : n;
            }));

            // Clear batch selection and tagging state
            setSelectedDraftTaskIds([]);
            setLowEnergySafeStates({});
            console.log(`Batch Categorization: Moved ${updatedNodes.length} tasks to aspect`, aspectId);
        } catch (err) {
            console.error("Assign to aspect error:", err);
        }
    };

    const handleCreateAndAssign = async () => {
        if (!newAspectName.trim() || !selectedExperiment) return;

        try {
            // 1. Create the new Aspect
            const newAspect = await backbone.addNode({
                name: newAspectName.trim(),
                type: NodeTypes.ASPECT,
                parentId: selectedExperiment.id,
                metadata: { status: "ACTIVE" }
            });

            // Update allNodes locally
            setAllNodes(prev => [...prev, newAspect]);

            // 2. Assign current selection to it
            await handleAssignToAspect(newAspect.id);

            setNewAspectName("");
        } catch (err) {
            console.error("Create and assign error:", err);
        }
    };

    const handleSelectAlternative = (task) => {
        setSelectedInitiationTask(task);
        setShowAlternatives(false);
        setSearchQuery("");
    };

    const primarySkillAlternatives = useMemo(() => {
        console.log("--- Initiation Search Debug ---");
        console.log("Selected skills:", selectedSkills);
        console.log("First skill ID:", selectedSkills?.[0]);
        console.log("All nodes:", allNodes.length);
        console.log("Search query:", searchQuery);

        if (selectedSkills.length === 0) return [];
        const firstSkillId = selectedSkills[0];
        
        const tasksForSkill = allNodes.filter(node => {
            if (node.type !== NodeTypes.TASK) return false;
            const skill = getSkillFromTask(node, nodeMap);
            return skill?.id === firstSkillId;
        });

        console.log("Tasks for first skill:", tasksForSkill.length);

        const currentId = selectedInitiationTask?.id || initiationTask?.id;

        // Clean: exclude DONE and current
        const cleanTasks = tasksForSkill.filter(n => {
            if (n.id === currentId) return false;
            if (n.metadata?.status === TaskStatuses.DONE) return false;
            return true;
        });

        const scopedTasks = cleanTasks.filter(n => {
            return n.metadata?.isToday === true || n.metadata?.status === TaskStatuses.IN_PROGRESS;
        });

        console.log("Search mode:", searchQuery ? "FULL SEARCH" : "SCOPED");
        console.log("Scoped tasks:", scopedTasks.length);

        let finalFiltered;
        if (searchQuery) {
            finalFiltered = cleanTasks.filter(task => {
                const text = (task.name + ' ' + (task.metadata?.notes || '')).toLowerCase();
                return text.includes(searchQuery.toLowerCase());
            });
        } else {
            finalFiltered = scopedTasks;
        }

        const displayTasks = finalFiltered.slice(0, 5);

        console.log("Final display tasks:", displayTasks.length);
        console.log("--- End Search Debug ---");
        return displayTasks;
    }, [selectedSkills, allNodes, nodeMap, selectedInitiationTask, initiationTask, searchQuery, tasks]);

    const handleStartPath = () => {
        if (!initiationTask) {
            navigate('/planning');
            return;
        }
        setStep('initiation');
    };

    const handleStartSprint = (specificTask) => {
        const task = specificTask || (energyLevel <= 2 ? lowEnergyTask : (selectedInitiationTask || initiationTask));
        if (!task) return;
        
        setEnergyLevel(energyLevel);
        navigate('/focus', { 
            state: { 
                taskId: task.id, 
                autoStart: true // Instant start for the sprint
            } 
        });
    };

    const handleCycleLowEnergyTask = () => {
        if (!lowEnergyFastTasks.length) return;
        const currentId = lowEnergyTask?.id;
        const available = lowEnergyFastTasks.filter(t => t.id !== currentId);
        if (available.length === 0) return;
        
        // Pick a random one from the available pool
        const random = available[Math.floor(Math.random() * available.length)];
        setLowEnergyTask(random);
    };

    const scoreLowEnergy = (task) => scoreLowEnergyTask(task, aspectStats);

    const getLowEnergyTasks = (ts) => [...ts].sort((a, b) => scoreLowEnergy(b) - scoreLowEnergy(a));
    const getMediumEnergyTasks = (ts) => ts.filter(t => t.metadata?.status === TaskStatuses.IN_PROGRESS);
    const getHighEnergyTasks = (ts) => ts.filter(t => t.metadata?.status === TaskStatuses.NOT_STARTED);
    const getHighEnergySavedTasks = (ts) => ts.filter(t => t.metadata?.highEnergy === true);
    
    const getTomorrowTasks = (ts) => ts.filter(t => t.metadata?.tomorrow === true);

    const getExplorationalTomorrowTasks = (ts, map) => {
        return ts.filter(task => {
            if (!task.metadata?.tomorrow) return false;
            const skill = getSkillFromTask(task, map);
            return skill?.metadata?.identityTier === "EXPLORATION";
        });
    };

    const getTaskForEnergy = (ts, val, map) => {
        if (ts.length === 0) return null;

        if (val >= 4) {
            const saved = getHighEnergySavedTasks(ts);
            if (saved.length > 0) return saved[0];
            
            const high = getHighEnergyTasks(ts);
            if (high.length > 0) return high[0];
        }

        if (val === 3) {
            // New logic: heroTask should probably be the priority for Energy 3
            if (heroTask) return heroTask;

            const explorational = getExplorationalTomorrowTasks(ts, map);
            if (explorational.length > 0) return explorational[0];

            const tomorrow = getTomorrowTasks(ts);
            if (tomorrow.length > 0) return tomorrow[0];

            const medium = getMediumEnergyTasks(ts);
            if (medium.length > 0) return medium[0];
        }

        if (val <= 2) {
            const low = getLowEnergyTasks(ts);
            if (low.length > 0) return low[0];
        }

        return ts[0]; // Fallback
    };

    const getSuggestion = (val) => {
        if (val <= 2) {
            return {
                title: "Let’s keep it very light",
                subtitle: "Just open something small",
                action: "Open a small task"
            };
        }

        if (val === 3) {
            return {
                title: "Let’s make some progress",
                subtitle: "Continue something familiar",
                action: "Continue your usual task"
            };
        }

        if (val >= 4) {
            return {
                title: "You’ve got energy today",
                subtitle: "Let’s tackle something meaningful",
                action: "Start a bigger task"
            };
        }
    };

    const handleSelectUsual = () => {
        const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        // 1. Filter tasks from last 5 days
        const recentTasks = allNodes.filter(node => {
            if (node.type !== NodeTypes.TASK) return false;
            
            if (node.metadata?.completedAt) {
                const compAt = new Date(node.metadata.completedAt).getTime();
                if (now - compAt < FIVE_DAYS) return true;
            }

            const sessions = node.metadata?.sessions || [];
            if (sessions.length > 0) {
                const lastSession = sessions[sessions.length - 1];
                if (lastSession?.endTime) {
                    const end = new Date(lastSession.endTime).getTime();
                    if (now - end < FIVE_DAYS) return true;
                }
            }
            return false;
        });

        console.log("Recent tasks:", recentTasks.length);

        // 2. Map tasks to skills and count activity
        const skillActivity = {};
        recentTasks.forEach(task => {
            const skill = getSkillFromTask(task, nodeMap);
            if (skill && skill.type === NodeTypes.SKILL) {
                skillActivity[skill.id] = (skillActivity[skill.id] || 0) + 1;
            }
        });

        console.log("Skill activity:", skillActivity);

        // 3. Sort by activity and take top 3
        const usualSkills = Object.entries(skillActivity)
            .sort((a, b) => b[1] - a[1]) // highest first
            .slice(0, 3)
            .map(([skillId]) => skillId);

        console.log("Selected usual skills:", usualSkills);

        if (usualSkills.length > 0) {
            setSelectedSkills(usualSkills);
        }
    };

    const handleContinue = () => {
        if (energyLevel <= 2) {
            // 1. FILTER LOW ENERGY TASKS (CORE ONLY)
            const filtered = allNodes.filter(n => {
                if (n.type !== NodeTypes.TASK || n.metadata?.status === TaskStatuses.DONE) return false;
                if (n.metadata?.isLowEnergySafe === false) return false; // Default to safe
                
                const skill = getSkillFromTask(n, nodeMap);
                return skill?.metadata?.identityTier === 'CORE';
            });

            // 2. SORT TO PRIORITIZE EXPLICITLY SAFE TASKS first
            const pool = [...filtered].sort((a, b) => {
                const aSafe = a.metadata?.isLowEnergySafe === true ? 1 : 0;
                const bSafe = b.metadata?.isLowEnergySafe === true ? 1 : 0;
                return bSafe - aSafe; // Safe FIRST (true -> 1, undefined/null -> 0)
            });

            if (pool.length > 0) {
                // Now Today/InProgress check will favor the first safe one found
                const selected = pool.find(t => t.metadata?.isToday && t.metadata?.isLowEnergySafe === true) || 
                                pool.find(t => t.metadata?.isToday) ||
                                pool.find(t => t.metadata?.status === TaskStatuses.IN_PROGRESS && t.metadata?.isLowEnergySafe === true) || 
                                pool.find(t => t.metadata?.status === TaskStatuses.IN_PROGRESS) ||
                                pool[0];
                
                console.log("Low energy selection (PRIORITIZED):", selected?.name);
                setLowEnergyTask(selected);
            }
            setStep('initiation');
        } else {
            setStep('action');
        }
    };

    const selectedTask = getTaskForEnergy(tasks, energyLevel, nodeMap);

    const handleAction = async () => {
        if (selectedTask) {
            console.log("LaunchpadFlow: Navigating to Focus with task ->", selectedTask.id);
            setEnergyLevel(energyLevel);
            
            // Mark task for Today so Backbone identifies it correctly
            console.log(`[DEBUG LaunchpadFlow] handleAction - patching metadata.isToday for ${selectedTask.id}`);
            await backbone.updateNode(selectedTask.id, {
                metadata: { isToday: true }
            });
            
            navigate('/focus', { state: { taskId: selectedTask.id, autoStart: true } });
        }
        navigate('/planning');
    };

    // Debug logs
    useEffect(() => {
        if (step === 'action') {
            console.log("LaunchpadFlow - Energy:", energyLevel);
            console.log("LaunchpadFlow - Aspect stats:", aspectStats);
            console.log("LaunchpadFlow - High energy saved tasks:", getHighEnergySavedTasks(tasks));
            console.log("LaunchpadFlow - Selected task:", selectedTask);
        }
    }, [step, energyLevel, selectedTask, tasks, aspectStats]);

    if (!allNodes || allNodes.length === 0) return null;

    const suggestion = getSuggestion(energyLevel);

    // MVE Logic
    const mve = selectedTask?.metadata?.mve;
    const displayTitle = selectedTask 
        ? (mve ? mve : `Start: ${selectedTask.name}`)
        : suggestion.title;
    
    const displaySubtitle = selectedTask
        ? (mve ? `Task: ${selectedTask.name}` : suggestion.subtitle)
        : suggestion.subtitle;

    const displayAction = selectedTask ? "Let's Go" : suggestion.action;

    return (
        <div className="launchpad-flow-overlay" onClick={() => navigate('/planning')}>
            <div className="launchpad-flow-container" onClick={(e) => e.stopPropagation()}>
                {/* Removed redundant energy step in favor of Sidebar selector */}

                {step === 'action' && (
                    <div className="flow-step action-step">
                        {energyLevel >= 4 ? (
<div className="launchpad-high-energy-container" style={{ textAlign: 'center', width: '100%', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

    {/* FUTURE SELF BUTTON (Top placement for Energy 5) */}
    {energyLevel === 5 && (
        <button
            className="future-self-btn"
            onClick={() => { resetPrepFlow(); setStep('prep-flow'); }}
            style={{ 
                marginBottom: '48px', 
                padding: '20px 48px', 
                background: 'linear-gradient(145deg, var(--alpha-medium) 0%, var(--alpha-low) 100%)', 
                border: '1px solid var(--color-border-active)', 
                borderRadius: '24px', 
                color: 'var(--text-primary)', 
                fontSize: '18px', 
                fontWeight: 700,
                cursor: 'pointer', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}
            onMouseEnter={(e) => { 
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'linear-gradient(145deg, var(--alpha-high) 0%, var(--alpha-medium) 100%)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => { 
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'linear-gradient(145deg, var(--alpha-medium) 0%, var(--alpha-low) 100%)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
            }}
        >
            <span style={{ opacity: 0.9 }}>🧠</span>
            <span>Prepare everything for your future self</span>
        </button>
    )}

    {/* HEADER */}
    <h1 style={{ fontSize: '32px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '64px', opacity: 0.9, padding: '0 40px', lineHeight: 1.3 }}>
        Best use of your energy right now based on your recent activity
    </h1>

    {/* 1. SPOTLIGHT CAROUSEL */}
    <div className="carousel-wrapper" style={{ position: 'relative', width: '100%', marginBottom: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {highEnergyTasks.length > 0 ? (
            <>
                {highEnergyTasks.length > 1 && (
                    <>
                        <button
                            onClick={() => setHighEnergyIndex(prev => (prev - 1 + highEnergyTasks.length) % highEnergyTasks.length)}
                            style={{ position: 'absolute', left: '-80px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '56px', cursor: 'pointer', fontWeight: 200 }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                        >‹</button>
                        <button
                            onClick={() => setHighEnergyIndex(prev => (prev + 1) % highEnergyTasks.length)}
                            style={{ position: 'absolute', right: '-80px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '56px', cursor: 'pointer', fontWeight: 200 }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                        >›</button>
                    </>
                )}

                {(() => {
                    const task = highEnergyTasks[highEnergyIndex];
                    const skill = getSkillFromTask(task, nodeMap);
                    const area = nodeMap.get(skill?.parentId);
                    return (
                        <div
                            className="featured-card liquid-glass"
                            style={{
                                width: '100%',
                                padding: '60px 40px',
                                borderRadius: '40px',
                                background: 'linear-gradient(145deg, var(--alpha-high) 0%, var(--alpha-low) 100%)',
                                border: '1px solid var(--color-border)',
                                boxShadow: '0 30px 60px rgba(0,0,0,0.4), inset 0 0 40px var(--alpha-low)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '16px'
                            }}
                        >
                            {/* HIGH ENERGY BADGE */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,200,50,0.12)', border: '1px solid rgba(255,200,50,0.25)', borderRadius: '20px', padding: '4px 14px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,200,50,0.8)' }}>
                                ⚡ High Energy Task
                            </div>

                            {/* AREA IDENTITY */}
                            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-tertiary)' }}>
                                {area?.name || skill?.name || 'Untitled Area'}
                            </div>

                            {/* DUAL LAYER */}
                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                Just open it for 2 minutes
                            </div>
                            <h2 style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                                {task.name}
                            </h2>

                            {/* SKILL NAME */}
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                {skill?.name || 'Untitled Skill'}
                            </div>

                            <button
                                className="flow-primary-btn"
                                onClick={() => handleStartTask(task)}
                                style={{ padding: '16px 60px', borderRadius: '20px', fontSize: '18px', fontWeight: 700, background: 'var(--alpha-low)', border: '1px solid var(--color-border)', marginTop: '16px' }}
                            >
                                Start
                            </button>
                        </div>
                    );
                })()}
            </>
        ) : (
            <div style={{ color: 'var(--text-tertiary)', fontSize: '15px' }}>No high energy tasks saved yet.</div>
        )}
    </div>

    {/* 2. TACTICAL OPTIONS */}
    {!isEnergy3ExplorePath && (
        <section style={{ width: '100%', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)', marginBottom: '32px' }}>
                Other tactical options
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tripleRecommendation.slice(0, energyLevel === 5 ? 3 : 2).map(task => {
                    const skill = getSkillFromTask(task, nodeMap);
                    const area = nodeMap.get(skill?.parentId);
                    return (
                        <button
                            key={task.id}
                            className="liquid-glass"
                            onClick={() => handleStartTask(task)}
                            style={{
                                width: '100%',
                                padding: '24px 32px',
                                borderRadius: '24px',
                                background: 'var(--alpha-low)',
                                border: '1px solid var(--color-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease, background 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = 'var(--alpha-medium)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--alpha-low)'; }}
                        >
                            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.4, color: 'var(--text-primary)' }}>
                                {area?.name || 'Untitled Area'}
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', opacity: 0.75 }}>
                                {task.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: 'fit-content', marginTop: '4px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {skill?.name || 'Untitled Skill'}
                                </div>

                                {/* AURA LEVEL INDICATOR - Energy 5 only */}
                                {energyLevel === 5 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '120px' }}>
                                        <div style={{ flex: 1, height: '3px', background: 'var(--color-border)', borderRadius: '1.5px', overflow: 'hidden', opacity: 0.5 }}>
                                            <div style={{ 
                                                width: `${((skill?.metadata?.auraTotal || 0) % 12) / 12 * 100}%`, 
                                                height: '100%', 
                                                background: 'linear-gradient(90deg, #60a5fa, #3b82f6)', 
                                                borderRadius: '1.5px'
                                            }} />
                                        </div>
                                        <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', opacity: 0.6 }}>
                                            Lv. {skill?.metadata?.auraLevel || (Math.floor((skill?.metadata?.auraTotal || 0) / 12) + 1)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    )}

    {/* ACTIVE (NON-FOCUS) SKILL TASK CARD - Energy 5 only */}
    {energyLevel === 5 && activeNonFocusSkills.length > 0 && e5ActiveSkillTask && (
        <section style={{ width: '100%', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                Active Potential
            </h3>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                {activeNonFocusSkills.length > 1 && (
                    <button
                        onClick={() => setE5ActiveSkillIndex(prev => (prev - 1 + activeNonFocusSkills.length) % activeNonFocusSkills.length)}
                        style={{ position: 'absolute', left: '-40px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '24px', cursor: 'pointer', zIndex: 2 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                    >‹</button>
                )}
                
                <button
                    className="liquid-glass"
                    onClick={() => handleStartTask(e5ActiveSkillTask)}
                    style={{
                        flex: 1,
                        padding: '24px 32px',
                        borderRadius: '24px',
                        background: 'linear-gradient(145deg, rgba(100, 100, 255, 0.05) 0%, rgba(100, 100, 255, 0.02) 100%)',
                        border: '1px solid rgba(100, 100, 255, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                    }}
                    onMouseEnter={(e) => { 
                        e.currentTarget.style.transform = 'translateY(-2px)'; 
                        e.currentTarget.style.background = 'linear-gradient(145deg, rgba(100, 100, 255, 0.1) 0%, rgba(100, 100, 255, 0.05) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(100, 100, 255, 0.4)';
                    }}
                    onMouseLeave={(e) => { 
                        e.currentTarget.style.transform = 'translateY(0)'; 
                        e.currentTarget.style.background = 'linear-gradient(145deg, rgba(100, 100, 255, 0.05) 0%, rgba(100, 100, 255, 0.02) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(100, 100, 255, 0.2)';
                    }}
                >
                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgb(100, 150, 255)', marginBottom: '4px' }}>
                        Active Potential
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {e5ActiveSkillTask.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: '8px' }}>
                        {nodeMap.get(e5ActiveSkillTask.parentId)?.name || 'Untitled Aspect'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                            {activeNonFocusSkills[e5ActiveSkillIndex % activeNonFocusSkills.length]?.name || 'Active Skill'}
                        </div>

                        {/* AURA LEVEL INDICATOR */}
                        {(() => {
                            const skill = activeNonFocusSkills[e5ActiveSkillIndex % activeNonFocusSkills.length];
                            const auraTotal = skill?.metadata?.auraTotal || 0;
                            const auraLevel = skill?.metadata?.auraLevel || (Math.floor(auraTotal / 12) + 1);
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px' }}>
                                    <div style={{ flex: 1, height: '3px', background: 'var(--color-border)', borderRadius: '1.5px', overflow: 'hidden', opacity: 0.5 }}>
                                        <div style={{ 
                                            width: `${(auraTotal % 12) / 12 * 100}%`, 
                                            height: '100%', 
                                            background: 'linear-gradient(90deg, #60a5fa, #3b82f6)', 
                                            borderRadius: '1.5px'
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', opacity: 0.6 }}>
                                        Lv. {auraLevel}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </button>

                {activeNonFocusSkills.length > 1 && (
                    <button
                        onClick={() => setE5ActiveSkillIndex(prev => (prev + 1) % activeNonFocusSkills.length)}
                        style={{ position: 'absolute', right: '-40px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '24px', cursor: 'pointer', zIndex: 2 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                    >›</button>
                )}
            </div>
        </section>
    )}

    {/* 3. PILOT LIGHT CHIPS */}
    {energy2HabitsPool.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
            {energy2HabitsPool.slice(0, 3).map(habit => (
                <button
                    key={habit.id}
                    onClick={() => handleHabitComplete(habit.id)}
                    style={{ background: 'var(--alpha-low)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--alpha-medium)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--alpha-low)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                    {habit.phases?.[habit.currentPhaseLevel]?.description || habit.then || habit.name}
                </button>
            ))}
        </div>
    )}

    {/* 4. TRIADIC REDIRECTION */}
    {!isEnergy3Expanded && !isEnergy3ExplorePath ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
            <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '16px', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setIsEnergy3Expanded(true)}
            >
                Not feeling this?
            </button>
            <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => console.log("Rest for now clicked")}
            >
                I actually just need to rest today
            </button>
        </div>
    ) : isEnergy3ExplorePath ? (
        <>
            {e3ActiveSubStep === 'skills' && (
                <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '24px' }}>
                    <button className="literal-target" onClick={() => setE3ActiveSkillIndex(p => (p - 1 + activeNonFocusSkills.length) % activeNonFocusSkills.length)}>‹</button>
                    <div
                        style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)' }}
                        onClick={() => { setE3ActiveSelectedSkillId(activeNonFocusSkills[e3ActiveSkillIndex].id); setE3ActiveSubStep('aspects'); }}
                    >
                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Optional · No Pressure</div>
                        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>{activeNonFocusSkills[e3ActiveSkillIndex]?.name}</h1>
                        <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Tap to explore</div>
                    </div>
                    <button className="literal-target" onClick={() => setE3ActiveSkillIndex(p => (p + 1) % activeNonFocusSkills.length)}>›</button>
                </div>
            )}
            {e3ActiveSubStep === 'aspects' && (
                <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '24px' }}>
                    <button className="literal-target" onClick={() => setE3ActiveAspectIndex(p => (p - 1 + e3ActiveAspectsPool.length) % e3ActiveAspectsPool.length)}>‹</button>
                    <div
                        style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)' }}
                        onClick={() => { setE3ActiveSelectedAspectId(e3ActiveAspectsPool[e3ActiveAspectIndex].id); setE3ActiveSubStep('tasks'); }}
                    >
                        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>{e3ActiveAspectsPool[e3ActiveAspectIndex]?.name}</h1>
                        <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Select Aspect</div>
                    </div>
                    <button className="literal-target" onClick={() => setE3ActiveAspectIndex(p => (p + 1) % e3ActiveAspectsPool.length)}>›</button>
                </div>
            )}
            {e3ActiveSubStep === 'tasks' && (
                <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '24px' }}>
                    <button className="literal-target" onClick={() => setE3ActiveTaskIndex(p => (p - 1 + e3ActiveTasksPool.length) % e3ActiveTasksPool.length)}>‹</button>
                    <div style={{ textAlign: 'center', width: '320px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>No Pressure · Stop Anytime</div>
                        <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '24px' }}>{e3ActiveTasksPool[e3ActiveTaskIndex]?.name}</h1>
                        <button className="flow-primary-btn" onClick={() => handleStartTask(e3ActiveTasksPool[e3ActiveTaskIndex])}>Start 2-Minute Sprint</button>
                    </div>
                    <button className="literal-target" onClick={() => setE3ActiveTaskIndex(p => (p + 1) % e3ActiveTasksPool.length)}>›</button>
                </div>
            )}
            <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline', marginTop: '32px' }}
                onClick={() => { setIsEnergy3ExplorePath(false); setE3ActiveSubStep('skills'); setE3ActiveSelectedSkillId(null); setE3ActiveSelectedAspectId(null); }}
            >
                ← Back
            </button>
            <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', marginTop: '8px' }}
                onClick={() => console.log("Rest for now clicked")}
            >
                I actually just need to rest today
            </button>
        </>
    ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginBottom: '32px' }}>
            <button
                className="flow-secondary-btn liquid-glass"
                style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '15px', color: 'var(--text-secondary)', background: 'var(--alpha-low)', border: '1px solid var(--color-border)' }}
                onClick={() => setIsEnergy3SwitchingSkill(true)}
            >
                Stay Focused — Switch skill
            </button>
            <button
                className="flow-secondary-btn liquid-glass"
                style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '15px', color: 'var(--text-secondary)', background: 'var(--alpha-low)', border: '1px solid var(--color-border)' }}
                onClick={() => { setIsEnergy3SwitchingHabit(true); setIsEnergy3Expanded(false); }}
            >
                Keep it Simple — Switch to habits
            </button>
            <button
                className="flow-secondary-btn liquid-glass"
                style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '15px', color: 'var(--text-secondary)', background: 'var(--alpha-low)', border: '1px solid var(--color-border)' }}
                onClick={() => { setIsEnergy3ExplorePath(true); setIsEnergy3Expanded(false); setE3ActiveSubStep('skills'); }}
            >
                Explore Something Else
            </button>
            <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', marginTop: '8px' }}
                onClick={() => console.log("Rest for now clicked")}
            >
                I actually just need to rest today
            </button>
        </div>
    )}

    {/* 5. FUTURE SELF BUTTON (Bottom placement for non-Energy 5) */}
    {energyLevel !== 5 && (
        <button
            className="future-self-btn"
            onClick={() => { resetPrepFlow(); setStep('prep-flow'); }}
            style={{ marginTop: 'auto', padding: '16px 32px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)', borderRadius: '20px', color: 'var(--text-tertiary)', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.border = '1px solid var(--color-border-active)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.border = '1px solid var(--color-border)'; }}
        >
            <span style={{ textDecoration: 'underline' }}>Prepare everything for your future self</span>
        </button>
    )}
</div>
                        ) : energyLevel === 3 ? (
                            <div className="recommended-focus-container" style={{ textAlign: 'center', width: '100%', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '600px', justifyContent: 'center' }}>
                                {isEnergy3SwitchingSkill ? (
                                    <div style={{ width: '100%', maxWidth: '400px' }}>
                                        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '40px', opacity: 0.9 }}>Switch Focus Skill</h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button
                                                className="literal-target"
                                                onClick={() => setEnergy3SkillIndex(p => (p - 1 + focusSlots.length) % focusSlots.length)}
                                            >‹</button>
                                            <div
                                                style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)' }}
                                                onClick={() => {
                                                    setEnergy3SkillOverride(focusSlots[energy3SkillIndex]);
                                                    setIsEnergy3SwitchingSkill(false);
                                                }}
                                            >
                                                <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>{nodeMap.get(focusSlots[energy3SkillIndex])?.name || 'Untitled Skill'}</h1>
                                                <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Select Skill</div>
                                            </div>
                                            <button
                                                className="literal-target"
                                                onClick={() => setEnergy3SkillIndex(p => (p + 1) % focusSlots.length)}
                                            >›</button>
                                        </div>
                                        <button
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '15px', cursor: 'pointer', fontWeight: 500, marginTop: '32px' }}
                                            onClick={() => setIsEnergy3SwitchingSkill(false)}
                                        >
                                            Back
                                        </button>
                                    </div>
                                ) : isEnergy3SwitchingHabit ? (
                                    <>
                                        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {energy2HabitsPool.length > 1 && (
                                                <button 
                                                    onClick={() => setEnergy3HabitIndex(prev => (prev - 1 + energy2HabitsPool.length) % energy2HabitsPool.length)}
                                                    style={{ position: 'absolute', left: '-30px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '32px', cursor: 'pointer', outline: 'none' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                                >
                                                    ‹
                                                </button>
                                            )}
                                            
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)' }}>
                                                    {energy2HabitsPool[energy3HabitIndex]?.skillName || "Habit"}
                                                </div>
                                                <h1 style={{ fontSize: '48px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1, wordWrap: 'break-word', maxWidth: '100%' }}>
                                                    {(() => {
                                                        const h = energy2HabitsPool[energy3HabitIndex];
                                                        return h?.phases?.[h?.currentPhaseLevel]?.description || h?.then || h?.target || "Ready to maintain?";
                                                    })()}
                                                </h1>
                                            </div>

                                            {energy2HabitsPool.length > 1 && (
                                                <button 
                                                    onClick={() => setEnergy3HabitIndex(prev => (prev + 1) % energy2HabitsPool.length)}
                                                    style={{ position: 'absolute', right: '-30px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '32px', cursor: 'pointer', outline: 'none' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                                                >
                                                    ›
                                                </button>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '32px' }}>
                                            <button 
                                                className="flow-primary-btn liquid-glass" 
                                                style={{ padding: '24px 60px', borderRadius: '24px', fontSize: '20px', fontWeight: 700, background: 'var(--alpha-low)', border: '1px solid var(--color-border)' }}
                                                onClick={() => {
                                                    const habit = energy2HabitsPool[energy3HabitIndex];
                                                    if (habit) handleHabitComplete(habit.id);
                                                }}
                                            >
                                                Complete
                                            </button>

                                            <button 
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '16px', cursor: 'pointer', textDecoration: 'underline', width: 'fit-content', margin: '0 auto' }}
                                                onClick={() => setIsEnergy3SwitchingHabit(false)}
                                            >
                                                Back
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h1 style={{ fontSize: '38px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '64px', opacity: 0.9 }}>Recommended focus</h1>
                                        
                                        {!isEnergy3ExplorePath && (
                                            <div className="recommendation-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                                                {tripleRecommendation.map((task, index) => {
                                                    const skill = getSkillFromTask(task, nodeMap);
                                                    const area = nodeMap.get(skill?.parentId);
                                                    const isHero = index === 0;

                                                    return (
                                                        <button
                                                            key={task.id}
                                                            className="recommendation-card liquid-glass"
                                                            onClick={() => handleStartTask(task)}
                                                            style={{
                                                                width: '100%',
                                                                padding: isHero ? '40px 32px' : '28px 24px',
                                                                borderRadius: '28px',
                                                                background: isHero ? 'var(--alpha-medium)' : 'var(--alpha-low)',
                                                                border: isHero ? '1px solid var(--color-border-active)' : '1px solid var(--color-border)',
                                                                textAlign: 'center',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '6px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                                textDecoration: 'none',
                                                                boxShadow: isHero ? '0 8px 32px rgba(0,0,0,0.3)' : 'none'
                                                            }}
                                                            onMouseEnter={() => setHoveredRecommendationId(task.id)}
                                                            onMouseLeave={() => setHoveredRecommendationId(null)}
                                                        >
                                                            {/* AREA IDENTITY LABEL */}
                                                            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', opacity: isHero ? 0.5 : 0.3, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                                {area?.name || skill?.name || 'Untitled Area'}
                                                            </div>

                                                            {/* TASK NAME */}
                                                            <div style={{ fontSize: isHero ? '26px' : '22px', fontWeight: isHero ? 700 : 600, color: 'var(--text-primary)', opacity: isHero ? 1 : 0.85, lineHeight: 1.2 }}>
                                                                {(hoveredRecommendationId === task.id && task.metadata?.mve) ? task.metadata.mve : task.name}
                                                            </div>

                                                            {/* SKILL LABEL */}
                                                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                                                {energy3SkillOverride
                                                                    ? (nodeMap.get(task.parentId)?.name || 'Untitled Aspect')
                                                                    : (skill?.name || 'Untitled Skill')}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* PILOT LIGHT CHIPS - always visible */}
                                        {energy2HabitsPool.length > 0 && (
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '32px' }}>
                                                {energy2HabitsPool.slice(0, 3).map(habit => (
                                                    <button
                                                        key={habit.id}
                                                        onClick={() => handleHabitComplete(habit.id)}
                                                        style={{ background: 'var(--alpha-low)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--alpha-medium)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--alpha-low)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                    >
                                                        {habit.phases?.[habit.currentPhaseLevel]?.description || habit.then || habit.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* NOT FEELING THIS */}
                                        {!isEnergy3Expanded && !isEnergy3ExplorePath ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '40px' }}>
                                                <button
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '16px', cursor: 'pointer', textDecoration: 'underline' }}
                                                    onClick={() => setIsEnergy3Expanded(true)}
                                                >
                                                    Not feeling this?
                                                </button>
                                                <button
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                                                    onClick={() => console.log("Rest for now clicked")}
                                                >
                                                    I need to rest for now
                                                </button>
                                            </div>
                                        ) : isEnergy3ExplorePath ? (
                                            <>
                                                {/* PATH C: EXPLORE SOMETHING ELSE */}
                                                {e3ActiveSubStep === 'skills' && (
                                                    <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '40px' }}>
                                                        <button
                                                            className="literal-target"
                                                            onClick={() => setE3ActiveSkillIndex(p => (p - 1 + activeNonFocusSkills.length) % activeNonFocusSkills.length)}
                                                        >‹</button>
                                                        <div
                                                            style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)', position: 'relative' }}
                                                            onClick={() => {
                                                                setE3ActiveSelectedSkillId(activeNonFocusSkills[e3ActiveSkillIndex].id);
                                                                setE3ActiveSubStep('aspects');
                                                            }}
                                                        >
                                                            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                                                Optional · No Pressure
                                                            </div>
                                                            <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>{activeNonFocusSkills[e3ActiveSkillIndex]?.name}</h1>
                                                            <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Tap to explore</div>
                                                        </div>
                                                        <button
                                                            className="literal-target"
                                                            onClick={() => setE3ActiveSkillIndex(p => (p + 1) % activeNonFocusSkills.length)}
                                                        >›</button>
                                                    </div>
                                                )}

                                                {e3ActiveSubStep === 'aspects' && (
                                                    <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '40px' }}>
                                                        <button
                                                            className="literal-target"
                                                            onClick={() => setE3ActiveAspectIndex(p => (p - 1 + e3ActiveAspectsPool.length) % e3ActiveAspectsPool.length)}
                                                        >‹</button>
                                                        <div
                                                            style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                            onClick={() => {
                                                                setE3ActiveSelectedAspectId(e3ActiveAspectsPool[e3ActiveAspectIndex].id);
                                                                setE3ActiveSubStep('tasks');
                                                            }}
                                                        >
                                                            <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0 }}>{e3ActiveAspectsPool[e3ActiveAspectIndex]?.name}</h1>
                                                            <div style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Select Aspect</div>
                                                        </div>
                                                        <button
                                                            className="literal-target"
                                                            onClick={() => setE3ActiveAspectIndex(p => (p + 1) % e3ActiveAspectsPool.length)}
                                                        >›</button>
                                                    </div>
                                                )}

                                                {e3ActiveSubStep === 'tasks' && (
                                                    <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '40px' }}>
                                                        <button
                                                            className="literal-target"
                                                            onClick={() => setE3ActiveTaskIndex(p => (p - 1 + e3ActiveTasksPool.length) % e3ActiveTasksPool.length)}
                                                        >‹</button>
                                                        <div style={{ textAlign: 'center', width: '320px' }}>
                                                            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                                                                No Pressure · Stop Anytime
                                                            </div>
                                                            <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '24px' }}>{e3ActiveTasksPool[e3ActiveTaskIndex]?.name}</h1>
                                                            <button
                                                                className="flow-primary-btn"
                                                                onClick={() => handleStartTask(e3ActiveTasksPool[e3ActiveTaskIndex])}
                                                            >
                                                                Start 2-Minute Sprint
                                                            </button>
                                                        </div>
                                                        <button
                                                            className="literal-target"
                                                            onClick={() => setE3ActiveTaskIndex(p => (p + 1) % e3ActiveTasksPool.length)}
                                                        >›</button>
                                                    </div>
                                                )}

                                                <button
                                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline', marginTop: '32px' }}
                                                    onClick={() => {
                                                        setIsEnergy3ExplorePath(false);
                                                        setE3ActiveSubStep('skills');
                                                        setE3ActiveSelectedSkillId(null);
                                                        setE3ActiveSelectedAspectId(null);
                                                    }}
                                                >
                                                    ← Back
                                                </button>

                                                <button
                                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', marginTop: '8px' }}
                                                    onClick={() => console.log("Rest for now clicked")}
                                                >
                                                    I need to rest for now
                                                </button>
                                            </>
                                        ) : (
                                            /* TRIADIC CHOICE */
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '32px' }}>
                                                {/* PATH A: Stay Focused */}
                                                <button
                                                    className="flow-secondary-btn liquid-glass"
                                                    style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '15px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease' }}
                                                    onClick={() => setIsEnergy3SwitchingSkill(true)}
                                                >
                                                    Stay Focused — Switch skill
                                                </button>

                                                {/* PATH B: Keep it Simple */}
                                                <button
                                                    className="flow-secondary-btn liquid-glass"
                                                    style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '15px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease' }}
                                                    onClick={() => {
                                                        setIsEnergy3SwitchingHabit(true);
                                                        setIsEnergy3Expanded(false);
                                                    }}
                                                >
                                                    Keep it Simple — Switch to habits
                                                </button>

                                                {/* PATH C: Explore */}
                                                <button
                                                    className="flow-secondary-btn liquid-glass"
                                                    style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '15px', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease' }}
                                                    onClick={() => {
                                                        setIsEnergy3ExplorePath(true);
                                                        setIsEnergy3Expanded(false);
                                                        setE3ActiveSubStep('skills');
                                                    }}
                                                >
                                                    Explore Something Else
                                                </button>


                                                <button
                                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', marginTop: '8px' }}
                                                    onClick={() => console.log("Rest for now clicked")}
                                                >
                                                    I need to rest for now
                                                </button>

                                                {/* Search Bar */}
                                                <div
                                                    style={{ marginTop: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: 'all 0.2s ease', cursor: 'text', pointerEvents: 'auto', width: '100%' }}
                                                    onClick={() => setShowEnergy3Search(true)}
                                                    onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(255, 255, 255, 0.4)'; const svg = e.currentTarget.querySelector('svg'); if (svg) svg.style.opacity = '0.7'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(255, 255, 255, 0.2)'; const svg = e.currentTarget.querySelector('svg'); if (svg) svg.style.opacity = '0.4'; }}
                                                >
                                                    <Search size={16} color="rgba(255, 255, 255, 0.4)" style={{ opacity: 0.4, transition: 'opacity 0.2s ease' }} />
                                                    <span style={{ color: 'rgba(255, 255, 255, 0.25)', fontSize: '14px', textAlign: 'left' }}>Search for a task...</span>
                                                </div>

                                                {showEnergy3Search && (
                                                    <div className="search-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '100px 20px' }} onClick={() => setShowEnergy3Search(false)}>
                                                        <div className="search-container" style={{ width: '100%', maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                                                            <div style={{ borderBottom: '1px solid #fff', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                                                                <Search size={24} color="#fff" />
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    placeholder="Type to search tasks..."
                                                                    value={energy3SearchQuery}
                                                                    onChange={(e) => setEnergy3SearchQuery(e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', outline: 'none', width: '100%' }}
                                                                />
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
                                                                {allNodes.filter(n => n.type === NodeTypes.TASK && n.metadata?.status !== TaskStatuses.DONE && n.name.toLowerCase().includes(energy3SearchQuery.toLowerCase())).slice(0, 10).map(task => (
                                                                    <button
                                                                        key={task.id}
                                                                        className="liquid-glass"
                                                                        style={{ width: '100%', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                                                                        onClick={() => handleStartTask(task)}
                                                                    >
                                                                        {task.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : energyLevel === 2 ? (
                            <div className="energy-2-flow" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '80vh', position: 'relative' }}>
                                
                                {/* IDENTITY ANCHOR */}
                                {(() => {
                                    let currentSkill = null;
                                    if (energy2SubStep === 'initial') {
                                        if (energy2Pool.length > 0) {
                                            currentSkill = getSkillFromTask(energy2Pool[0], nodeMap);
                                        } else if (energy2HabitsPool.length > 0) {
                                            currentSkill = nodeMap.get(energy2HabitsPool[0].parentId);
                                        }
                                    } else if (energy2SubStep === 'habits') {
                                        currentSkill = nodeMap.get(energy2HabitsPool[energy2HabitIndex]?.parentId);
                                    } else if (energy2SubStep === 'skills') {
                                        currentSkill = activeFocusSkills[e2SkillIndex];
                                    } else if (energy2SubStep === 'aspects') {
                                        currentSkill = nodeMap.get(e2SelectedSkillId);
                                    } else if (energy2SubStep === 'tasks') {
                                        currentSkill = nodeMap.get(e2SelectedSkillId);
                                    }

                                    if (!currentSkill) return null;
                                    return (
                                        <div className="identity-anchor" style={{ position: 'absolute', top: '-100px', width: '100%', textAlign: 'center', opacity: 0.8 }}>
                                            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Becoming</div>
                                            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {currentSkill.metadata?.identityAnchor || currentSkill.name}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* GO BACK ARROW */}
                                {energy2SubStep !== 'initial' && (
                                    <button 
                                        onClick={() => {
                                            if (energy2SubStep === 'redirection') setEnergy2SubStep('initial');
                                            else if (energy2SubStep === 'habits' || energy2SubStep === 'skills') setEnergy2SubStep('redirection');
                                            else if (energy2SubStep === 'aspects') setEnergy2SubStep('skills');
                                            else if (energy2SubStep === 'tasks') setEnergy2SubStep('aspects');
                                        }}
                                        style={{ position: 'absolute', top: '-40px', left: '0', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '24px', cursor: 'pointer' }}
                                    >
                                        ← Back
                                    </button>
                                )}

                                <div className="step-container" style={{ transition: 'opacity 0.3s ease', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {energy2SubStep === 'initial' && (() => {
                                        const inProgressTask = energy2Pool.find(t => t.metadata?.status === 'IN_PROGRESS');
                                        const spotlightTask = e2SpotlightHabit ? null : (inProgressTask || energy2Pool[0]);
                                        const spotlightHabit = e2SpotlightHabit || ((!inProgressTask && !energy2Pool[0]) ? energy2HabitsPool[0] : null);
                                        const isResume = !!inProgressTask;
                                        const pilotHabits = energy2HabitsPool.slice(0, 3);

                                        return (
                                            <div className="initiation-card liquid-glass" style={{ background: 'rgba(255,255,255,0.03)', padding: '60px 40px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '440px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>

                                                {/* SPOTLIGHT CARD */}
                                                {spotlightTask ? (
                                                    <>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                                                            {isResume && (
                                                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#63b3ed', marginBottom: '4px', width: 'fit-content', margin: '0 auto' }}>
                                                                    ▶ Resuming
                                                                </div>
                                                            )}
                                                            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)' }}>
                                                                {isResume ? 'In Progress' : "Today's Task"}
                                                            </div>
                                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                                {spotlightTask.metadata?.mve ? `Task: ${spotlightTask.name}` : "Just open it for 2 minutes"}
                                                            </div>
                                                            <h1 style={{ fontSize: '36px', fontWeight: 800, color: isResume ? '#63b3ed' : 'var(--text-primary)', margin: 0, lineHeight: 1.1 }}>
                                                                {spotlightTask.metadata?.mve || spotlightTask.name}
                                                            </h1>
                                                        </div>
                                                        <button
                                                            className="flow-primary-btn"
                                                            style={{ padding: '20px', borderRadius: '16px', fontSize: '18px', background: isResume ? 'rgba(99,179,237,0.2)' : undefined, border: isResume ? '1px solid rgba(99,179,237,0.3)' : undefined }}
                                                            onClick={() => navigate('/focus', { state: { taskId: spotlightTask.id, autoStart: true } })}
                                                        >
                                                            {isResume ? '▶ Resume' : 'Start 2-Minute Sprint'}
                                                        </button>
                                                    </>
                                                ) : spotlightHabit ? (
                                                    <>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)' }}>Maintenance Habit</div>
                                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Just open it for 2 minutes</div>
                                                            <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1 }}>
                                                                {spotlightHabit.phases?.[spotlightHabit.currentPhaseLevel]?.description || spotlightHabit.then || "Ready to maintain?"}
                                                            </h1>
                                                        </div>
                                                        <button
                                                            className="flow-primary-btn"
                                                            style={{ padding: '20px', borderRadius: '16px', fontSize: '18px' }}
                                                            onClick={() => { handleHabitComplete(spotlightHabit.id); setE2SpotlightHabit(null); }}
                                                        >
                                                            Complete Habit
                                                        </button>
                                                    </>
                                                ) : (
                                                    <h1 style={{ color: '#555' }}>All Clear</h1>
                                                )}

                                                {/* PILOT LIGHT CHIPS */}
                                                {pilotHabits.length > 1 && (
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        {pilotHabits.slice(1).map(habit => (
                                                            <button
                                                                key={habit.id}
                                                                onClick={() => setE2SpotlightHabit(habit)}
                                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '8px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                                                            >
                                                                {habit.phases?.[habit.currentPhaseLevel]?.description || habit.then || habit.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* ESCAPE HATCH */}
                                                <button
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}
                                                    onClick={() => setEnergy2SubStep('redirection')}
                                                >
                                                    Not feeling this?
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {energy2SubStep === 'redirection' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '320px', marginTop: '40px' }}>
                                            <button
                                                className="redirection-option-btn liquid-glass"
                                                onClick={() => setEnergy2SubStep('habits')}
                                                style={{ padding: '32px', borderRadius: '24px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)', color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                Maintenance habits
                                            </button>
                                            <button
                                                className="redirection-option-btn liquid-glass"
                                                onClick={() => setEnergy2SubStep('skills')}
                                                style={{ padding: '32px', borderRadius: '24px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)', color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                Focus skills
                                            </button>
                                            <button
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '14px', marginTop: '40px', textDecoration: 'underline', cursor: 'pointer' }}
                                                onClick={() => console.log("Rest for now clicked")}
                                            >
                                                I need to rest for now
                                            </button>
                                        </div>
                                    )}

                                    {energy2SubStep === 'habits' && (
                                        <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button
                                                className="literal-target"
                                                onClick={() => setEnergy2HabitIndex(p => (p - 1 + energy2HabitsPool.length) % energy2HabitsPool.length)}
                                            >‹</button>
                                            <div style={{ textAlign: 'center', width: '320px' }}>
                                                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', marginBottom: '24px' }}>
                                                    {energy2HabitsPool[energy2HabitIndex]?.phases?.[energy2HabitsPool[energy2HabitIndex]?.currentPhaseLevel]?.description || energy2HabitsPool[energy2HabitIndex]?.then || "Ready?"}
                                                </h1>
                                                <button className="flow-primary-btn" onClick={() => handleHabitComplete(energy2HabitsPool[energy2HabitIndex].id)}>Complete</button>
                                            </div>
                                            <button
                                                className="literal-target"
                                                onClick={() => setEnergy2HabitIndex(p => (p + 1) % energy2HabitsPool.length)}
                                            >›</button>
                                        </div>
                                    )}

                                    {energy2SubStep === 'skills' && (
                                        <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button
                                                className="literal-target"
                                                onClick={() => setE2SkillIndex(p => (p - 1 + activeFocusSkills.length) % activeFocusSkills.length)}
                                            >‹</button>
                                            <div
                                                style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}
                                                onClick={() => {
                                                    setE2SelectedSkillId(activeFocusSkills[e2SkillIndex].id);
                                                    setEnergy2SubStep('aspects');
                                                }}
                                            >
                                                {/* HEALTH DOT */}
                                                {(() => {
                                                    const skill = activeFocusSkills[e2SkillIndex];
                                                    if (!skill) return null;
                                                    const engagement = getSkillEngagementStatus(skill.id, allNodes, energy2HabitsPool);
                                                    console.log('Health dot debug:', skill.name, skill.id, engagement);
                                                    if (!engagement) return null;
                                                    return (
                                                        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                                                            <div className={`health-dot ${engagement.status}`} title={engagement.label} />
                                                        </div>
                                                    );
                                                })()}
                                                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>{activeFocusSkills[e2SkillIndex]?.name}</h1>
                                                <div style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Select Skill</div>
                                            </div>
                                            <button
                                                className="literal-target"
                                                onClick={() => setE2SkillIndex(p => (p + 1) % activeFocusSkills.length)}
                                            >›</button>
                                        </div>
                                    )}

                                    {energy2SubStep === 'aspects' && (
                                        <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button
                                                className="literal-target"
                                                onClick={() => setE2AspectIndex(p => (p - 1 + e2AspectsPool.length) % e2AspectsPool.length)}
                                            >‹</button>
                                            <div
                                                style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                onClick={() => {
                                                    setE2SelectedAspectId(e2AspectsPool[e2AspectIndex].id);
                                                    setEnergy2SubStep('tasks');
                                                }}
                                            >
                                                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>{e2AspectsPool[e2AspectIndex]?.name}</h1>
                                                <div style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Select Aspect</div>
                                            </div>
                                            <button
                                                className="literal-target"
                                                onClick={() => setE2AspectIndex(p => (p + 1) % e2AspectsPool.length)}
                                            >›</button>
                                        </div>
                                    )}

                                    {energy2SubStep === 'tasks' && (
                                        <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button
                                                className="literal-target"
                                                onClick={() => setE2TaskIndex(p => (p - 1 + e2TasksPool.length) % e2TasksPool.length)}
                                            >‹</button>
                                            <div style={{ textAlign: 'center', width: '320px' }}>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
                                                    {e2TasksPool[e2TaskIndex]?.metadata?.mve ? `Task: ${e2TasksPool[e2TaskIndex].name}` : "Just open it for 2 minutes"}
                                                </div>
                                                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', marginBottom: '24px' }}>{e2TasksPool[e2TaskIndex]?.metadata?.mve || e2TasksPool[e2TaskIndex]?.name}</h1>
                                                <button
                                                    className="flow-primary-btn"
                                                    onClick={() => navigate('/focus', { state: { taskId: e2TasksPool[e2TaskIndex].id, autoStart: true } })}
                                                >
                                                    Start 2-Minute Sprint
                                                </button>
                                            </div>
                                            <button
                                                className="literal-target"
                                                onClick={() => setE2TaskIndex(p => (p + 1) % e2TasksPool.length)}
                                            >›</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : energyLevel === 1 ? (
                            <div className="energy-1-flow" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '80vh', position: 'relative' }}>
                                
                                {/* IDENTITY ANCHOR */}
                                {(() => {
                                    let currentSkill = null;
                                    if (energy1SubStep === 'initial') {
                                        if (energy1Pool.length > 0) {
                                            currentSkill = getSkillFromTask(energy1Pool[0], nodeMap);
                                        } else if (energy1HabitsPool.length > 0) {
                                            currentSkill = nodeMap.get(energy1HabitsPool[0].parentId);
                                        }
                                    } else if (energy1SubStep === 'habits') {
                                        currentSkill = nodeMap.get(energy1HabitsPool[energy1HabitIndex]?.parentId);
                                    } else if (energy1SubStep === 'skills') {
                                        currentSkill = activeFocusSkills[e1SkillIndex];
                                    } else if (energy1SubStep === 'aspects') {
                                        currentSkill = nodeMap.get(e1SelectedSkillId);
                                    } else if (energy1SubStep === 'tasks') {
                                        currentSkill = nodeMap.get(e1SelectedSkillId);
                                    }

                                    if (!currentSkill) return null;
                                    return (
                                        <div className="identity-anchor" style={{ position: 'absolute', top: '-100px', width: '100%', textAlign: 'center', opacity: 0.8 }}>
                                            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Becoming</div>
                                            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {currentSkill.metadata?.identityAnchor || currentSkill.name}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* GO BACK ARROW */}
                                {energy1SubStep !== 'initial' && (
                                    <button 
                                        onClick={() => {
                                            if (energy1SubStep === 'redirection') setEnergy1SubStep('initial');
                                            else if (energy1SubStep === 'habits' || energy1SubStep === 'skills') setEnergy1SubStep('redirection');
                                            else if (energy1SubStep === 'aspects') setEnergy1SubStep('skills');
                                            else if (energy1SubStep === 'tasks') setEnergy1SubStep('aspects');
                                        }}
                                        style={{ position: 'absolute', top: '-40px', left: '0', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '24px', cursor: 'pointer' }}
                                    >
                                        ← Back
                                    </button>
                                )}

                                <div className="step-container" style={{ transition: 'opacity 0.3s ease', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {energy1SubStep === 'initial' && (
                                        <div className="initiation-card liquid-glass" style={{ background: 'rgba(255,255,255,0.03)', padding: '60px 40px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '440px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                                            {energy1Pool.length > 0 ? (
                                                <>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)' }}>
                                                            {energy1Pool[0].metadata?.mve ? `Task: ${energy1Pool[0].name}` : "Today's Task"}
                                                        </div>
                                                        <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1 }}>
                                                            {energy1Pool[0].metadata?.mve || energy1Pool[0].name}
                                                        </h1>
                                                    </div>
                                                    <button 
                                                        className="flow-primary-btn" 
                                                        style={{ padding: '20px', borderRadius: '16px', fontSize: '18px' }}
                                                        onClick={() => navigate('/focus', { state: { taskId: energy1Pool[0].id, autoStart: true } })}
                                                    >
                                                        Start 2-Minute Sprint
                                                    </button>
                                                </>
                                            ) : energy1HabitsPool.length > 0 ? (
                                                <>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)' }}>Maintenance Habit</div>
                                                        <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.1 }}>
                                                            {energy1HabitsPool[0].phases?.[energy1HabitsPool[0].currentPhaseLevel]?.description || energy1HabitsPool[0].then || "Ready to maintain?"}
                                                        </h1>
                                                    </div>
                                                    <button 
                                                        className="flow-primary-btn" 
                                                        style={{ padding: '20px', borderRadius: '16px', fontSize: '18px' }}
                                                        onClick={() => handleHabitComplete(energy1HabitsPool[0].id)}
                                                    >
                                                        Complete Habit
                                                    </button>
                                                </>
                                            ) : (
                                                <h1 style={{ color: '#555' }}>All Clear</h1>
                                            )}
                                            
                                            <button 
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}
                                                onClick={() => setEnergy1SubStep('redirection')}
                                            >
                                                Not feeling this?
                                            </button>
                                        </div>
                                    )}

                                    {energy1SubStep === 'redirection' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '320px', marginTop: '40px' }}>
                                            <button 
                                                className="redirection-option-btn liquid-glass"
                                                onClick={() => setEnergy1SubStep('habits')}
                                                style={{ padding: '32px', borderRadius: '24px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)', color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                Maintenance habits
                                            </button>
                                            <button 
                                                className="redirection-option-btn liquid-glass"
                                                onClick={() => setEnergy1SubStep('skills')}
                                                style={{ padding: '32px', borderRadius: '24px', background: 'var(--alpha-low)', border: '1px solid var(--color-border)', color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                Focus skills
                                            </button>
                                            <button 
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '14px', marginTop: '40px', textDecoration: 'underline', cursor: 'pointer' }}
                                                onClick={() => console.log("Rest for now clicked")}
                                            >
                                                I need to rest for now
                                            </button>
                                        </div>
                                    )}

                                    {energy1SubStep === 'habits' && (
                                        <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button 
                                                className="literal-target"
                                                onClick={() => setEnergy1HabitIndex(p => (p - 1 + energy1HabitsPool.length) % energy1HabitsPool.length)}
                                            >‹</button>
                                            
                                            <div style={{ textAlign: 'center', width: '320px' }}>
                                                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', marginBottom: '24px' }}>
                                                    {energy1HabitsPool[energy1HabitIndex]?.phases?.[energy1HabitsPool[energy1HabitIndex]?.currentPhaseLevel]?.description || energy1HabitsPool[energy1HabitIndex]?.then || "Ready?"}
                                                </h1>
                                                <button className="flow-primary-btn" onClick={() => handleHabitComplete(energy1HabitsPool[energy1HabitIndex].id)}>Complete</button>
                                            </div>

                                            <button 
                                                className="literal-target"
                                                onClick={() => setEnergy1HabitIndex(p => (p + 1) % energy1HabitsPool.length)}
                                            >›</button>
                                        </div>
                                    )}

                                    {energy1SubStep === 'skills' && (
                                        <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button 
                                                className="literal-target"
                                                onClick={() => setE1SkillIndex(p => (p - 1 + activeFocusSkills.length) % activeFocusSkills.length)}
                                            >‹</button>
                                            
                                            <div 
                                                style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                onClick={() => {
                                                    setE1SelectedSkillId(activeFocusSkills[e1SkillIndex].id);
                                                    setEnergy1SubStep('aspects');
                                                }}
                                            >
                                                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>{activeFocusSkills[e1SkillIndex]?.name}</h1>
                                                <div style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Select Skill</div>
                                            </div>

                                            <button 
                                                className="literal-target"
                                                onClick={() => setE1SkillIndex(p => (p + 1) % activeFocusSkills.length)}
                                            >›</button>
                                        </div>
                                    )}

                                    {energy1SubStep === 'aspects' && (
                                        <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button 
                                                className="literal-target"
                                                onClick={() => setE1AspectIndex(p => (p - 1 + e1AspectsPool.length) % e1AspectsPool.length)}
                                            >‹</button>
                                            
                                            <div 
                                                style={{ textAlign: 'center', width: '320px', cursor: 'pointer', padding: '40px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                onClick={() => {
                                                    setE1SelectedAspectId(e1AspectsPool[e1AspectIndex].id);
                                                    setEnergy1SubStep('tasks');
                                                }}
                                            >
                                                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>{e1AspectsPool[e1AspectIndex]?.name}</h1>
                                                <div style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Select Aspect</div>
                                            </div>

                                            <button 
                                                className="literal-target"
                                                onClick={() => setE1AspectIndex(p => (p + 1) % e1AspectsPool.length)}
                                            >›</button>
                                        </div>
                                    )}

                                    {energy1SubStep === 'tasks' && (
                                        <div className="initiation-card" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                            <button 
                                                className="literal-target"
                                                onClick={() => setE1TaskIndex(p => (p - 1 + e1TasksPool.length) % e1TasksPool.length)}
                                            >‹</button>
                                            
                                            <div style={{ textAlign: 'center', width: '320px' }}>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
                                                    {e1TasksPool[e1TaskIndex]?.metadata?.mve ? `Task: ${e1TasksPool[e1TaskIndex].name}` : "Just open it for 2 minutes"}
                                                </div>
                                                <h1 style={{ fontSize: '32px', color: 'var(--text-primary)', marginBottom: '24px' }}>{e1TasksPool[e1TaskIndex]?.metadata?.mve || e1TasksPool[e1TaskIndex]?.name}</h1>
                                                <button 
                                                    className="flow-primary-btn" 
                                                    onClick={() => navigate('/focus', { state: { taskId: e1TasksPool[e1TaskIndex].id, autoStart: true } })}
                                                >
                                                    Start 2-Minute Sprint
                                                </button>
                                            </div>

                                            <button 
                                                className="literal-target"
                                                onClick={() => setE1TaskIndex(p => (p + 1) % e1TasksPool.length)}
                                            >›</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="golden-action-card">
                                <h1 className="flow-title">{displayTitle}</h1>
                                <p className="flow-subtitle">{displaySubtitle}</p>
                                
                                <button className="flow-primary-btn" onClick={handleAction}>
                                    {displayAction}
                                </button>

                                <div className="secondary-options">
                                    {energyLevel >= 3 && (
                                        <button className="flow-secondary-btn small-subtle">
                                            Do something easier
                                        </button>
                                    )}
                                    {energyLevel === 3 && (
                                        <button className="flow-secondary-btn small-subtle">
                                            Try something different
                                        </button>
                                    )}
                                    <button className="flow-secondary-btn" onClick={() => navigate('/planning')}>
                                        Skip for now
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 'high-organize' && (
                    <div className="flow-step high-organize-step" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', textAlign: 'left' }}>
                        {(() => {
                            const draftTasks = allNodes.filter(n => 
                                n.type === NodeTypes.TASK && 
                                n.metadata?.isDraft === true &&
                                // Ensure they belong to the correct experiment (traverse through aspect)
                                nodeMap.get(n.parentId)?.parentId === selectedExperiment?.id
                            );

                            if (draftTasks.length === 0) {
                                return (
                                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                        <h1 className="flow-title" style={{ fontSize: '48px', marginBottom: '16px' }}>✨</h1>
                                        <h2 style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '12px' }}>You just made {dumpedTasks.length} tasks easier for your future self</h2>
                                        <p style={{ color: '#555', fontSize: '16px', marginBottom: '40px' }}>Your future self is going to love this on-ramp.</p>
                                        <button 
                                            className="flow-primary-btn" 
                                            onClick={() => setStep('action')}
                                            style={{ padding: '20px 48px' }}
                                        >
                                            Done for now
                                        </button>
                                    </div>
                                );
                            }

                            const currentBatch = draftTasks.slice(0, 5);
                            const experimentAspects = allNodes.filter(n => n.type === NodeTypes.ASPECT && n.parentId === selectedExperiment?.id);

                            return (
                                <>
                                    <header style={{ marginBottom: '40px' }}>
                                        <h1 className="flow-title" style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
                                            Let’s organize this for your future self
                                        </h1>
                                        <p style={{ color: '#555', fontSize: '15px' }}>Which of these belong together? ({draftTasks.length} remaining)</p>
                                    </header>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '40px' }}>
                                        {currentBatch.map(task => {
                                            const isSelected = selectedDraftTaskIds.includes(task.id);
                                            return (
                                                <div 
                                                    key={task.id} 
                                                    onClick={() => {
                                                        setSelectedDraftTaskIds(prev => 
                                                            isSelected ? prev.filter(id => id !== task.id) : [...prev, task.id]
                                                        );
                                                    }}
                                                    style={{ 
                                                        background: 'var(--alpha-low)', 
                                                        padding: '16px 20px', 
                                                        borderRadius: '16px', 
                                                        border: isSelected ? '1px solid var(--text-primary)' : '1px solid var(--color-border)', 
                                                        color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                                        fontSize: '15px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '16px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.1s ease'
                                                    }}
                                                >
                                                    <div style={{ 
                                                        width: '20px', 
                                                        height: '20px', 
                                                        borderRadius: '6px', 
                                                        border: '2px solid var(--color-border)',
                                                        background: isSelected ? 'var(--text-primary)' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {isSelected && <div style={{ width: '8px', height: '8px', background: '#000', borderRadius: '50%' }} />}
                                                    </div>
                                                    <span>{task.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {selectedDraftTaskIds.length > 0 && (
                                        <div style={{ background: 'var(--alpha-low)', padding: '24px', borderRadius: '24px', border: '1px solid var(--color-border)' }}>
                                            <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--color-border)' }}>
                                                <h3 style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Ready for your low-energy self?</h3>
                                                <p style={{ color: '#555', fontSize: '13px', marginBottom: '16px' }}>Keep it checked if this feels doable even when you're tired.</p>
                                                
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {selectedDraftTaskIds.map(taskId => {
                                                        const task = allNodes.find(n => n.id === taskId);
                                                        const isSafe = lowEnergySafeStates[taskId] !== false; // Default: true
                                                        return (
                                                            <div 
                                                                key={taskId} 
                                                                onClick={() => setLowEnergySafeStates(prev => ({ ...prev, [taskId]: !isSafe }))}
                                                                style={{ 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'space-between',
                                                                    padding: '12px 16px',
                                                                    background: 'var(--alpha-low)',
                                                                    borderRadius: '12px',
                                                                    cursor: 'pointer',
                                                                    border: '1px solid var(--color-border)'
                                                                }}
                                                            >
                                                                <span style={{ fontSize: '13px', color: isSafe ? 'var(--text-primary)' : 'var(--text-muted)' }}>{task?.name}</span>
                                                                <div style={{ 
                                                                    width: '36px', 
                                                                    height: '20px', 
                                                                    borderRadius: '20px', 
                                                                    background: isSafe ? 'var(--color-accent)' : 'var(--alpha-high)', 
                                                                    position: 'relative',
                                                                    transition: 'all 0.2s ease'
                                                                }}>
                                                                    <div style={{ 
                                                                        width: '14px', 
                                                                        height: '14px', 
                                                                        borderRadius: '50%', 
                                                                        background: isSafe ? '#000' : '#444', 
                                                                        position: 'absolute',
                                                                        top: '3px',
                                                                        left: isSafe ? '19px' : '3px',
                                                                        transition: 'all 0.2s ease'
                                                                    }} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <p style={{ color: '#555', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>
                                                Assign Category to {selectedDraftTaskIds.length} tasks
                                            </p>
                                            
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                                                {experimentAspects.map(aspect => (
                                                    <button 
                                                        key={aspect.id}
                                                        onClick={() => handleAssignToAspect(aspect.id)}
                                                        style={{
                                                            background: 'var(--alpha-low)',
                                                            border: '1px solid var(--color-border)',
                                                            borderRadius: '12px',
                                                            padding: '10px 16px',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '14px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {aspect.name}
                                                    </button>
                                                ))}
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input 
                                                    type="text"
                                                    placeholder="New category name..."
                                                    value={newAspectName}
                                                    onChange={(e) => setNewAspectName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAssign()}
                                                    style={{
                                                        flex: 1,
                                                        background: 'var(--alpha-low)',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: '12px',
                                                        padding: '12px 16px',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '14px',
                                                        outline: 'none'
                                                    }}
                                                />
                                                <button 
                                                    className="flow-secondary-btn"
                                                    onClick={handleCreateAndAssign}
                                                    style={{ padding: '0 20px', fontSize: '13px' }}
                                                >
                                                    Assign New
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}

                {step === 'high-refine' && (
                    <div className="flow-step high-refine-step" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', textAlign: 'left' }}>
                        <header style={{ marginBottom: '40px' }}>
                            <h1 className="flow-title" style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
                                You're becoming {(() => {
                                    const skill = nodeMap.get(selectedExperiment?.parentId);
                                    return skill?.metadata?.becoming || skill?.name || "someone great";
                                })()}. 
                                <br />Let's clear your mind.
                            </h1>
                            <p style={{ color: '#555', fontSize: '15px' }}>Add anything you're thinking about. No need to organize.</p>
                        </header>

                        <div style={{ marginBottom: '40px' }}>
                            <input 
                                autoFocus
                                type="text"
                                placeholder='Try "Draft...", "Just open...", "List..." '
                                value={dumpInput}
                                onChange={(e) => setDumpInput(e.target.value)}
                                onKeyDown={handleBrainDump}
                                style={{
                                    width: '100%',
                                    background: 'var(--alpha-low)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    color: 'var(--text-primary)',
                                    fontSize: '18px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s ease',
                                    boxShadow: 'var(--shadow-md)'
                                }}
                            />
                        </div>

                        {dumpedTasks.length > 0 && (
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '12px', 
                                marginBottom: '48px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                paddingRight: '8px'
                            }}>
                                {dumpedTasks.map(task => (
                                    <div key={task.id} style={{ 
                                        background: 'var(--alpha-low)', 
                                        padding: '16px 20px', 
                                        borderRadius: '12px', 
                                        border: '1px solid var(--color-border)', 
                                        color: 'var(--text-secondary)',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span>{task.name}</span>
                                        <span style={{ fontSize: '10px', opacity: 0.3 }}>DRAFT</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <button 
                                className="flow-primary-btn" 
                                style={{ width: '100%', padding: '18px' }}
                                onClick={() => setStep('high-organize')}
                            >
                                Done
                            </button>
                            <button 
                                className="flow-secondary-btn" 
                                onClick={() => setStep('high-organize')}
                            >
                                Skip, I already dumped
                            </button>
                        </div>
                    </div>
                )}

                {step === 'high-prep' && (
                    <div className="flow-step high-prep-step" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                        <header style={{ textAlign: 'center', marginBottom: '48px' }}>
                            <h1 className="flow-title" style={{ fontSize: '32px', marginBottom: '12px' }}>Where is the momentum right now?</h1>
                            <p className="flow-subtitle" style={{ color: '#555', fontSize: '15px' }}>Your future tired self will be grateful for an easier on-ramp.</p>
                        </header>

                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px' }}>
                            {topActiveExperiments.map(exp => (
                                <button 
                                    key={exp.id}
                                    className="experiment-prep-card"
                                    onClick={() => {
                                        setSelectedExperiment(exp);
                                        setStep('high-refine');
                                    }}
                                    style={{ 
                                        width: '100%', 
                                        background: 'var(--alpha-low)', 
                                        border: '1px solid var(--color-border)', 
                                        borderRadius: '24px', 
                                        padding: '32px 24px', 
                                        textAlign: 'left', 
                                        cursor: 'pointer', 
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <span style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 700 }}>{exp.name}</span>
                                    <span style={{ fontSize: '12px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {exp.momentum} tasks completed this week
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button 
                            className="flow-secondary-btn" 
                            style={{ fontSize: '14px', color: '#333' }}
                            onClick={() => setStep('action')}
                        >
                            Back to battery view
                        </button>
                    </div>
                )}

                {/* ============================================================
                     PREP FLOW — "Prepare everything for your future self"
                     Steps: areas → skills → experiments → aspects → task-input → micro-action
                ============================================================ */}
                {step === 'prep-flow' && (
                    <div className="flow-step" style={{ width: '100%', maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '70vh' }}>

                        {/* BACK BUTTON — always visible except on 'areas' */}
                        {prepSubStep !== 'areas' && (
                            <button
                                onClick={() => {
                                    if (prepSubStep === 'skills') { setPrepSubStep('areas'); setPrepSelectedArea(null); }
                                    else if (prepSubStep === 'experiments') { setPrepSubStep('skills'); setPrepSelectedSkill(null); }
                                    else if (prepSubStep === 'aspects') { setPrepSubStep('experiments'); setPrepSelectedExperiment(null); setPrepTasksAddedToAspect([]); }
                                    else if (prepSubStep === 'task-input') { setPrepSubStep('aspects'); setPrepSelectedAspect(null); setPrepTasksAddedToAspect([]); }
                                    else if (prepSubStep === 'micro-action') { setPrepSubStep('task-input'); setPrepCreatedTask(null); setPrepMicroActionInput(''); }
                                }}
                                style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '15px', cursor: 'pointer', padding: '0 0 32px 0', letterSpacing: '0.02em' }}
                            >
                                ← Back
                            </button>
                        )}

                        {/* STEP: AREAS */}
                        {prepSubStep === 'areas' && (
                            <>
                                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                                        Prepare for your future self
                                    </div>
                                    <h1 style={{ fontSize: '30px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                                        Which life area do you want to set up?
                                    </h1>
                                </div>
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {prepLifeAreas.map((area, idx) => (
                                        <button
                                            key={area.id}
                                            onClick={() => { setPrepSelectedArea(area); setPrepSubStep('skills'); }}
                                            style={{
                                                width: '100%',
                                                padding: idx === 0 ? '28px 32px' : '20px 32px',
                                                borderRadius: '20px',
                                                background: idx === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                                                border: idx === 0 ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
                                                color: '#fff',
                                                fontSize: idx === 0 ? '20px' : '17px',
                                                fontWeight: idx === 0 ? 700 : 500,
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 0.15s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = idx === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = idx === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'; }}
                                        >
                                            <span>{area.name}</span>
                                            {idx === 0 && <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '10px' }}>Most Active</span>}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '14px', cursor: 'pointer', marginTop: '32px' }}
                                    onClick={() => setStep('action')}
                                >
                                    ← Back to launchpad
                                </button>
                            </>
                        )}

                        {/* STEP: SKILLS */}
                        {prepSubStep === 'skills' && (() => {
                            const { focusSkills, activeSkills } = prepSkillsForArea;
                            const hasFocus = focusSkills.length > 0;
                            return (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '40px', width: '100%' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                                            {prepSelectedArea?.name}
                                        </div>
                                        <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#fff', margin: 0 }}>
                                            Which skill do you want to work on?
                                        </h1>
                                    </div>

                                    {hasFocus && (
                                        <>
                                            <div style={{ width: '100%', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>
                                                Focus Skills
                                            </div>
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                                                {focusSkills.map(skill => (
                                                    <button
                                                        key={skill.id}
                                                        onClick={() => { setPrepSelectedSkill(skill); setPrepSubStep('experiments'); }}
                                                        style={{
                                                            width: '100%', padding: '22px 28px', borderRadius: '18px',
                                                            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)',
                                                            color: '#fff', fontSize: '18px', fontWeight: 700, cursor: 'pointer',
                                                            textAlign: 'left', transition: 'all 0.15s ease'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                                    >
                                                        {skill.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {activeSkills.length > 0 && (
                                        <>
                                            {hasFocus && (
                                                <div style={{ width: '100%', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.25)', marginBottom: '10px' }}>
                                                    Active Skills
                                                </div>
                                            )}
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {activeSkills.map(skill => (
                                                    <button
                                                        key={skill.id}
                                                        onClick={() => { setPrepSelectedSkill(skill); setPrepSubStep('experiments'); }}
                                                        style={{
                                                            width: '100%', padding: '18px 28px', borderRadius: '18px',
                                                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                                            color: 'rgba(255,255,255,0.8)', fontSize: '16px', fontWeight: 500, cursor: 'pointer',
                                                            textAlign: 'left', transition: 'all 0.15s ease'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                                                    >
                                                        {skill.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {focusSkills.length === 0 && activeSkills.length === 0 && (
                                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '15px', textAlign: 'center', marginTop: '40px' }}>
                                            No active skills in this area.
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {/* STEP: EXPERIMENTS */}
                        {prepSubStep === 'experiments' && (() => {
                            const { active, paused } = prepExperimentsForSkill;
                            return (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '40px', width: '100%' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                                            {prepSelectedSkill?.name}
                                        </div>
                                        <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#fff', margin: 0 }}>
                                            Which experiment are you prepping for?
                                        </h1>
                                    </div>

                                    {active.length > 0 && (
                                        <>
                                            <div style={{ width: '100%', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>
                                                Active
                                            </div>
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                                                {active.map(exp => (
                                                    <button
                                                        key={exp.id}
                                                        onClick={() => { setPrepSelectedExperiment(exp); setPrepSubStep('aspects'); setPrepTasksAddedToAspect([]); }}
                                                        style={{
                                                            width: '100%', padding: '22px 28px', borderRadius: '18px',
                                                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                                                            color: '#fff', fontSize: '18px', fontWeight: 600, cursor: 'pointer',
                                                            textAlign: 'left', transition: 'all 0.15s ease'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                                    >
                                                        {exp.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {paused.length > 0 && (
                                        <>
                                            <div style={{ width: '100%', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.2)', marginBottom: '10px' }}>
                                                Paused
                                            </div>
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {paused.map(exp => (
                                                    <button
                                                        key={exp.id}
                                                        onClick={() => { setPrepSelectedExperiment(exp); setPrepSubStep('aspects'); setPrepTasksAddedToAspect([]); }}
                                                        style={{
                                                            width: '100%', padding: '18px 28px', borderRadius: '18px',
                                                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                                            color: 'rgba(255,255,255,0.5)', fontSize: '16px', fontWeight: 400, cursor: 'pointer',
                                                            textAlign: 'left', transition: 'all 0.15s ease'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                                                    >
                                                        {exp.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {active.length === 0 && paused.length === 0 && (
                                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '15px', textAlign: 'center', marginTop: '40px' }}>
                                            No experiments in this skill yet.
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {/* STEP: ASPECTS */}
                        {prepSubStep === 'aspects' && (
                            <>
                                <div style={{ textAlign: 'center', marginBottom: '40px', width: '100%' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                                        {prepSelectedExperiment?.name}
                                    </div>
                                    <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#fff', margin: 0 }}>
                                        Which aspect do you want to add tasks to?
                                    </h1>
                                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', marginTop: '10px' }}>
                                        Select an aspect, dump tasks — then come back to pick another.
                                    </p>
                                </div>

                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
                                    {prepAspectsForExperiment.map(aspect => {
                                        const tasksInAspect = prepTasksAddedToAspect.filter(t => {
                                            // highlight aspects we just added tasks to
                                            return false; // we track by aspect separately
                                        });
                                        return (
                                            <button
                                                key={aspect.id}
                                                onClick={() => { setPrepSelectedAspect(aspect); setPrepSubStep('task-input'); setPrepTasksAddedToAspect([]); }}
                                                style={{
                                                    width: '100%', padding: '22px 28px', borderRadius: '18px',
                                                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                                    color: '#fff', fontSize: '18px', fontWeight: 500, cursor: 'pointer',
                                                    textAlign: 'left', transition: 'all 0.15s ease',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                            >
                                                <span>{aspect.name}</span>
                                                <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.25)' }}>›</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {prepAspectsForExperiment.length === 0 && (
                                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '15px', textAlign: 'center', marginTop: '24px' }}>
                                        No aspects in this experiment yet.
                                    </div>
                                )}

                                <button
                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '14px', cursor: 'pointer', marginTop: '8px', textDecoration: 'underline' }}
                                    onClick={() => { setStep('action'); resetPrepFlow(); }}
                                >
                                    Done for now
                                </button>
                            </>
                        )}

                        {/* STEP: TASK INPUT */}
                        {prepSubStep === 'task-input' && (
                            <>
                                <div style={{ textAlign: 'center', marginBottom: '36px', width: '100%' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                        {prepSelectedExperiment?.name} · {prepSelectedAspect?.name}
                                    </div>
                                    <h1 style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                                        What is the next, physical concrete step?
                                    </h1>
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '10px' }}>
                                        Try to avoid vague words like “research” or “plan” and focus on concrete action verbs like: “Open, Write, Clean” etc..
                                    </p>
                                </div>

                                <div style={{ width: '100%', marginBottom: '24px' }}>
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Add a task..."
                                        value={prepNewTaskInput}
                                        onChange={(e) => setPrepNewTaskInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handlePrepCreateTask(); }}
                                        style={{
                                            width: '100%',
                                            background: 'var(--alpha-low)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '16px',
                                            padding: '20px 24px',
                                            color: 'var(--text-primary)',
                                            fontSize: '18px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s ease',
                                            boxSizing: 'border-box'
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                    />
                                </div>

                                {/* Tasks added in this session */}
                                {prepTasksAddedToAspect.length > 0 && (
                                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                                        {prepTasksAddedToAspect.map(t => (
                                            <div key={t.id} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '12px 20px', borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                                            }}>
                                                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>{t.name}</span>
                                                {t.mve && (
                                                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', maxWidth: '50%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>2min: {t.mve}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
                                    <button
                                        style={{
                                            padding: '14px 40px', borderRadius: '14px',
                                            background: prepNewTaskInput.trim() ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            color: prepNewTaskInput.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                                            fontSize: '16px', fontWeight: 600, cursor: 'pointer'
                                        }}
                                        onClick={handlePrepCreateTask}
                                        disabled={!prepNewTaskInput.trim()}
                                    >
                                        Add Task
                                    </button>
                                    <button
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => { 
                                            setPrepSubStep('aspects'); 
                                            setPrepSelectedAspect(null); 
                                            setShowFutureSelfToast(true);
                                            setTimeout(() => setShowFutureSelfToast(false), 3500);
                                        }}
                                    >
                                        Done with this aspect
                                    </button>
                                </div>
                            </>
                        )}

                        {/* STEP: MICRO-ACTION PROMPT */}
                        {prepSubStep === 'micro-action' && (
                            <>
                                <div style={{ textAlign: 'center', width: '100%', marginBottom: '48px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', marginBottom: '16px' }}>
                                        Task added ✓
                                    </div>
                                    <div style={{
                                        padding: '24px 32px', borderRadius: '20px',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                                        marginBottom: '32px'
                                    }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>New Task</div>
                                        <div style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>{prepCreatedTask?.name}</div>
                                    </div>
                                    <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                                        What is the 2-minute version of this for when you're tired?
                                    </h2>
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                                        A tiny on-ramp your future self can actually start.
                                    </p>
                                </div>

                                <div style={{ width: '100%', marginBottom: '24px' }}>
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="e.g. Just open the doc for 2 mins..."
                                        value={prepMicroActionInput}
                                        onChange={(e) => setPrepMicroActionInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handlePrepSaveMicroAction(); }}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: '16px',
                                            padding: '20px 24px',
                                            color: '#fff',
                                            fontSize: '17px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s ease',
                                            boxSizing: 'border-box'
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
                                    <button
                                        style={{
                                            padding: '14px 40px', borderRadius: '14px',
                                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
                                            color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer'
                                        }}
                                        onClick={handlePrepSaveMicroAction}
                                    >
                                        Done
                                    </button>
                                    <button
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={handlePrepSaveMicroAction}
                                    >
                                        Skip, no 2-minute version
                                    </button>
                                </div>
                            </>
                        )}

                    </div>
                )}

                {step === 'initiation' && (
                    <div className="flow-step initiation-step">
                        <div className="initiation-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '440px', minHeight: '420px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
                            {(!showAlternatives && !showLowEnergyAlternatives) ? (
                                <>

                                    {/* --- LEGACY ENERGY 3+ LOGIC --- */}
                                    {energyLevel >= 3 && (
                                        <>
                                            <h2 style={{ fontSize: '16px', color: '#666', marginBottom: '24px', fontWeight: 500 }}>
                                                To fuel your path toward <span style={{ color: '#aaa', fontWeight: 700 }}>{nodeMap.get(selectedSkills[0])?.name}</span>, let's get a tiny win
                                            </h2>
                                            
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.2 }}>
                                                    {selectedInitiationTask?.name || initiationTask?.name}
                                                </h1>
                                                <p style={{ color: '#444', fontSize: '13px', marginBottom: '32px', fontWeight: 600, letterSpacing: '0.02em' }}>
                                                    ⏱️ ~2 MIN SPRINT
                                                </p>
                                            </div>

                                            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '32px', fontWeight: 500 }}>Does this feel doable right now?</h3>

                                            <button 
                                                className="flow-primary-btn" 
                                                style={{ width: '100%', marginBottom: '16px', padding: '18px', fontSize: '18px' }}
                                                onClick={handleStartSprint}
                                            >
                                                Start 2-Minute Sprint
                                            </button>

                                            <button 
                                                className="flow-secondary-btn" 
                                                style={{ fontSize: '14px', color: '#555', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                                onClick={() => setShowAlternatives(true)}
                                            >
                                                Choose a different task
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div style={{ textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    {energyLevel <= 2 ? (
                                        <div style={{ textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                            <p style={{ fontSize: '12px', color: '#555', marginBottom: '20px', textAlign: 'center', fontWeight: 500 }}>
                                                These are quick wins based on what you usually complete fastest.
                                            </p>
                                            

                                            
                                            <div style={{ flex: 1, display: 'grid', gap: '10px', alignContent: 'start' }}>
                                                {activeLowEnergyAlternatives.length > 0 ? (
                                                    activeLowEnergyAlternatives.map(alt => {
                                                        const isToday = alt.metadata?.isToday === true;
                                                        const isInProgress = alt.metadata?.status === TaskStatuses.IN_PROGRESS;
                                                        const skill = getSkillFromTask(alt, nodeMap);
                                                        const isCore = skill?.metadata?.identityTier === 'CORE';

                                                        return (
                                                            <button 
                                                                key={alt.id}
                                                                className="flow-task-btn"
                                                                onClick={() => {
                                                                    setLowEnergyTask(alt);
                                                                    setShowLowEnergyAlternatives(false);
                                                                    setSearchQuery("");
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#fff'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#888'; }}
                                                            >
                                                                <span style={{ fontWeight: 500 }}>{alt.name}</span>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    {isCore && (
                                                                        <span style={{ fontSize: '9px', background: 'rgba(100,100,100,0.1)', border: '1px solid rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#444', fontWeight: 800 }}>Core</span>
                                                                    )}
                                                                    {isToday && (
                                                                        <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', fontWeight: 700 }}>Today</span>
                                                                    )}
                                                                    {isInProgress && (
                                                                        <span style={{ fontSize: '9px', background: '#222', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', fontWeight: 700 }}>In Progress</span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <p style={{ fontSize: '14px', color: '#444', textAlign: 'center', marginTop: '40px' }}>Try a different word.</p>
                                                )}
                                            </div>

                                            <button 
                                                className="flow-secondary-btn" 
                                                style={{ fontSize: '14px', color: '#444', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: '24px', width: '100%', textAlign: 'center' }}
                                                onClick={() => { setShowLowEnergyAlternatives(false); setSearchQuery(""); }}
                                            >
                                                Back to suggestion
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <input 
                                                type="text"
                                                autoFocus
                                                placeholder="Search tasks..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                style={{ 
                                                    background: 'rgba(255,255,255,0.05)', 
                                                    border: '1px solid #222', 
                                                    borderRadius: '12px', 
                                                    padding: '12px 16px', 
                                                    color: '#fff', 
                                                    fontSize: '14px', 
                                                    width: '100%', 
                                                    marginBottom: '24px',
                                                    outline: 'none',
                                                    backdropFilter: 'blur(10px)',
                                                    opacity: 0.8
                                                }}
                                            />
                                            
                                            <div style={{ flex: 1, display: 'grid', gap: '10px', alignContent: 'start' }}>
                                                {primarySkillAlternatives.length > 0 ? (
                                                    primarySkillAlternatives.map(alt => {
                                                        const isToday = alt.metadata?.isToday === true;
                                                        const isInProgress = alt.metadata?.status === TaskStatuses.IN_PROGRESS;

                                                        return (
                                                            <button 
                                                                key={alt.id}
                                                                className="flow-task-btn"
                                                                onClick={() => handleSelectAlternative(alt)}
                                                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#fff'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#888'; }}
                                                            >
                                                                <span style={{ fontWeight: 500 }}>{alt.name}</span>
                                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                                    {isToday && (
                                                                        <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', fontWeight: 700 }}>Today</span>
                                                                    )}
                                                                    {isInProgress && (
                                                                        <span style={{ fontSize: '9px', background: '#222', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', fontWeight: 700 }}>In Progress</span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <p style={{ fontSize: '14px', color: '#444', textAlign: 'center', marginTop: '40px' }}>No matching tasks. Try another word.</p>
                                                )}
                                            </div>

                                            <button 
                                                className="flow-secondary-btn" 
                                                style={{ fontSize: '14px', color: '#444', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: '24px', width: '100%', textAlign: 'center' }}
                                                onClick={() => { setShowAlternatives(false); setSearchQuery(""); }}
                                            >
                                                Back to suggestion
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* MAINTENANCE / KEEP IT ALIVE SECTION */}
                        <section className="keep-it-alive-section" style={{ marginTop: 'auto', paddingTop: '40px' }}>
                            <header 
                                className={`keep-it-alive-header ${isKeepAliveExpanded ? 'is-expanded' : ''}`}
                                onClick={() => setIsKeepAliveExpanded(!isKeepAliveExpanded)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: 0.6 }}
                            >
                                <span className="toggle-chevron" style={{ transform: isKeepAliveExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>‣</span>
                                <span className="keep-it-alive-title" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keep It Alive</span>
                            </header>
                            
                            {isKeepAliveExpanded && (
                                <div className="keep-it-alive-content" style={{ marginTop: '16px' }}>
                                    {maintenanceHabitGroups.length > 0 ? (
                                        maintenanceHabitGroups.map(group => (
                                            <div key={group.skill.id} className="keep-it-alive-group" style={{ marginBottom: '16px' }}>
                                                <div className="keep-it-alive-skill-name" style={{ fontSize: '11px', color: '#444', fontWeight: 600, marginBottom: '8px' }}>
                                                    {group.skill.name}
                                                </div>
                                                <div className="keep-it-alive-habit-list">
                                                    {!group.hasNoHabits ? (
                                                        group.habits.map(habit => (
                                                            <HabitCard 
                                                                key={habit.id}
                                                                habit={habit}
                                                                onComplete={handleHabitComplete}
                                                                onToggleActive={() => {}}
                                                                onOpenEvolution={() => {}}
                                                            />
                                                        ))
                                                    ) : (
                                                        <div className="keep-it-alive-placeholder" style={{ fontSize: '13px', color: '#333', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                                                            Open this skill for 2 minutes
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="everything-is-alive-message" style={{ color: '#333', fontSize: '13px', padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                                            Everything is alive today.
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>

            {/* PLEASURE PREDICTION MODAL */}
            {showPleasureModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '24px', color: '#fff', marginBottom: '8px' }}>How much do you expect to enjoy this?</h2>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>Estimate the pleasure or satisfaction of completing {pendingTask?.name}.</p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '40px' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                <button
                                    key={num}
                                    onClick={() => {
                                        setShowPleasureModal(false);
                                        confirmStartTask(num);
                                    }}
                                    style={{ 
                                        background: '#222', 
                                        border: '1px solid #333', 
                                        color: '#fff', 
                                        padding: '16px 0', 
                                        borderRadius: '12px', 
                                        fontSize: '18px', 
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#222'}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>

                        <button 
                            style={{ background: 'transparent', border: 'none', color: '#444', fontSize: '14px', cursor: 'pointer' }}
                            onClick={() => setShowPleasureModal(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {/* FUTURE SELF TOAST */}
            {showFutureSelfToast && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10001,
                    background: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '20px 40px',
                    borderRadius: '100px',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                    pointerEvents: 'none',
                    textAlign: 'center',
                    animation: 'prepToastFadeInOut 3.5s forwards'
                }}>
                    Your future self will thank you
                </div>
            )}
        </div>
    );
};

export default LaunchpadFlow;
