import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { backbone, NodeTypes, TaskStatuses } from '../backbone-v2/index';
import { useSession } from '../context/SessionContext';
import { useSettings } from '../context/SettingsContext';
import { useBackboneStore } from '../store/backboneStore';
import { useShallow } from 'zustand/react/shallow';
import { getAspectStats, scoreLowEnergyTask } from '../utils/taskScoring';
import './LaunchpadFlow.css';

/**
 * LaunchpadFlow - Phase 1 + Real Tasks
 * A full-screen overlay for morning onboarding.
 */
const LaunchpadFlow = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('energy'); // 'energy' | 'action'
    const [energy, setEnergy] = useState(3);
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
    const { focusSlots, loading: settingsLoading } = useSettings();

    // 1. Build HEURISTICS
    const nodeMap = useMemo(() => {
        return new Map(allNodes.map(n => [n.id, n]));
    }, [allNodes]);

    const aspectStats = useMemo(() => getAspectStats(allNodes), [allNodes]);

    const getSkillFromTask = useCallback((task, map) => {
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

    const lowEnergyFastTasks = useMemo(() => {
        if (energy > 2) return [];
        
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
    }, [energy, allNodes, nodeMap]);

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
        if (energy < 4) return { skill: null, heroTask: null, filteredList: [] };

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
    }, [energy, highEnergyTasks, nodeMap, selectedSkillOverride, activeHighEnergySkills, getSkillFromTask]);

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

    const handleStartSprint = () => {
        const task = energy <= 2 ? lowEnergyTask : (selectedInitiationTask || initiationTask);
        if (!task) return;
        
        setEnergyLevel(energy);
        navigate('/focus', { 
            state: { 
                taskId: task.id, 
                autoStart: true // Instant start for the sprint
            } 
        });
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
        if (energy <= 2) {
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

    const selectedTask = getTaskForEnergy(tasks, energy, nodeMap);

    const handleAction = async () => {
        if (selectedTask) {
            console.log("LaunchpadFlow: Navigating to Focus with task ->", selectedTask.id);
            setEnergyLevel(energy);
            
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
            console.log("LaunchpadFlow - Energy:", energy);
            console.log("LaunchpadFlow - Aspect stats:", aspectStats);
            console.log("LaunchpadFlow - High energy saved tasks:", getHighEnergySavedTasks(tasks));
            console.log("LaunchpadFlow - Selected task:", selectedTask);
        }
    }, [step, energy, selectedTask, tasks, aspectStats]);

    if (!allNodes || allNodes.length === 0) return null;

    const suggestion = getSuggestion(energy);

    // Micro-Action Logic
    const microAction = selectedTask?.metadata?.microAction;
    const displayTitle = selectedTask 
        ? (microAction ? microAction : `Start: ${selectedTask.name}`)
        : suggestion.title;
    
    const displaySubtitle = selectedTask
        ? (microAction ? `Task: ${selectedTask.name}` : suggestion.subtitle)
        : suggestion.subtitle;

    const displayAction = selectedTask ? "Let's Go" : suggestion.action;

    return (
        <div className="launchpad-flow-overlay">
            <div className="launchpad-flow-container">
                {step === 'energy' && (
                    <div className="flow-step energy-step">
                        <h1 className="flow-title">How’s your energy today?</h1>
                        <div className="energy-selector">
                            {[1, 2, 3, 4, 5].map((num) => (
                                <button
                                    key={num}
                                    className={`energy-btn ${energy === num ? 'selected' : ''}`}
                                    onClick={() => setEnergy(num)}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                        <button className="flow-primary-btn" onClick={handleContinue}>
                            Continue
                        </button>
                    </div>
                )}

                {step === 'action' && (
                    <div className="flow-step action-step">
                        {energy >= 4 ? (
                            <div className="high-energy-view" style={{ textAlign: 'left', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                                <header style={{ marginBottom: '40px', textAlign: 'center' }}>
                                    <h1 className="flow-title" style={{ fontSize: '24px', color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
                                        Your battery is full. Let’s build something your future self will thank you for.
                                    </h1>
                                </header>
                                {/* 1. HERO EXECUTION CARD */}
                                {(() => {
                                    const { heroTask } = highEnergySelectionData;
                                    return (
                                        <div style={{ marginBottom: '48px' }}>
                                            <div className="hero-execution-card" style={{ 
                                                background: '#fff', 
                                                padding: '40px 32px', 
                                                borderRadius: '24px', 
                                                marginBottom: '16px',
                                                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                                textAlign: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '24px'
                                            }}>
                                                <div>
                                                    <h3 style={{ color: '#000', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px', opacity: 0.5 }}>
                                                        {heroTask ? 'Best use of your energy right now' : 'Strategic Planning'}
                                                    </h3>
                                                    <p style={{ color: '#000', fontSize: '12px', fontWeight: 500, margin: '0 0 16px 0', opacity: 0.4 }}>
                                                        {heroTask ? 'Based on your recent activity' : "Use this energy to make your future low-energy self unstoppable."}
                                                    </p>
                                                    <h2 style={{ color: '#000', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                                                        {heroTask?.name || "Nothing saved for High Energy yet"}
                                                    </h2>
                                                </div>

                                                <button 
                                                    className="flow-primary-btn" 
                                                    style={{ background: '#000', color: '#fff', width: '100%', padding: '20px', borderRadius: '16px', fontSize: '18px', fontWeight: 700 }}
                                                    onClick={() => heroTask ? handleStartTask(heroTask) : setStep('high-prep')}
                                                >
                                                    {heroTask ? 'Start' : 'Help My Future Self (Start Breakdown)'}
                                                </button>
                                            </div>
                                            {heroTask ? (
                                                <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', opacity: 0.6, margin: 0 }}>This is the best place to push forward right now.</p>
                                            ) : (
                                                <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', opacity: 0.6, margin: 0 }}>Tip: In Focus Mode, tap 'Save for when I have more energy' to send tasks here.</p>
                                            )}
                                        </div>
                                    );
                                })()}                                   {/* 2. SAVED FOR HIGH ENERGY */}
                                <section style={{ marginBottom: '48px' }}>
                                    <h3 style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 700 }}>Saved for High Energy</h3>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {(() => {
                                            const { filteredList } = highEnergySelectionData;
                                            return filteredList.length > 0 ? (
                                                filteredList.map(task => (
                                                    <div 
                                                        key={task.id} 
                                                        style={{ background: '#111', padding: '16px', borderRadius: '16px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                                        onClick={() => handleStartTask(task)}
                                                    >
                                                        <span style={{ color: '#eee', fontWeight: 500 }}>{task.name}</span>
                                                        <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: '#666', padding: '4px 8px', borderRadius: '6px' }}>High Energy</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ background: '#111', padding: '24px', borderRadius: '16px', border: '1px dashed #222', textAlign: 'center' }}>
                                                    <p style={{ color: '#444', fontSize: '14px', margin: 0 }}>No other tasks saved for high energy yet</p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </section>

                                {/* 3. BUILD MOMENTUM (SKILLS) */}
                                <section style={{ marginBottom: '48px' }}>
                                    <h3 style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 700 }}>Build Momentum</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {activeHighEnergySkills.map(skill => {
                                            const isExpanded = expandedMomentumSkillId === skill.id;
                                            return (
                                                <div key={skill.id} style={{ gridColumn: isExpanded ? 'span 2' : 'span 1' }}>
                                                    <div 
                                                        style={{ 
                                                            background: '#111', 
                                                            padding: '16px', 
                                                            borderRadius: '16px', 
                                                            border: isExpanded ? '2px solid #fff' : '1px solid #222', 
                                                            textAlign: 'center', 
                                                            cursor: 'pointer',
                                                            opacity: expandedMomentumSkillId && !isExpanded ? 0.3 : 1,
                                                            transition: 'all 0.2s ease',
                                                            boxShadow: isExpanded ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'
                                                        }}
                                                        onClick={() => {
                                                            console.log("Expanding momentum skill:", skill.name);
                                                            setExpandedMomentumSkillId(prev => prev === skill.id ? null : skill.id);
                                                        }}
                                                    >
                                                        <span style={{ color: isExpanded ? '#fff' : '#888', fontWeight: 500 }}>{skill.name}</span>
                                                    </div>
                                                    
                                                    {isExpanded && (
                                                        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid #1a1a1a' }}>
                                                            <div style={{ marginBottom: '16px' }}>
                                                                <h4 style={{ color: '#fff', fontSize: '16px', margin: '0 0 4px 0' }}>Ready to fuel {skill.name}?</h4>
                                                                <p style={{ color: '#444', fontSize: '12px', margin: 0 }}>Since you're at 100%, these will have the biggest impact:</p>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {(() => {
                                                                    const tasks = getHighEnergyTasksForSkill(skill.id);
                                                                    console.log(`Found ${tasks.length} tasks for skill ${skill.name}`);
                                                                    return tasks.length > 0 ? (
                                                                        tasks.map(t => (
                                                                            <div 
                                                                                key={t.id}
                                                                                onClick={() => handleStartTask(t)}
                                                                                style={{ 
                                                                                    background: '#000', 
                                                                                    padding: '12px 16px', 
                                                                                    borderRadius: '12px', 
                                                                                    border: '1px solid #222',
                                                                                    display: 'flex', 
                                                                                    justifyContent: 'space-between', 
                                                                                    alignItems: 'center', 
                                                                                    cursor: 'pointer' 
                                                                                }}
                                                                            >
                                                                                <span style={{ color: '#eee', fontSize: '14px', fontWeight: 500 }}>{t.name}</span>
                                                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                                    {t.metadata?.status === TaskStatuses.IN_PROGRESS && (
                                                                                        <span style={{ fontSize: '9px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>In Progress</span>
                                                                                    )}
                                                                                    <span style={{ fontSize: '9px', color: '#666', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>High Energy</span>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', margin: '8px 0' }}>No high energy tasks available here.</p>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                {/* 4. PLANNING ACTION */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '64px', borderTop: '1px solid #1a1a1a', paddingTop: '32px' }}>
                                    <button 
                                        className="flow-secondary-btn" 
                                        style={{ width: '100%', padding: '16px', fontSize: '14px', color: '#444', background: 'transparent', border: '1px solid #222' }}
                                        onClick={() => setStep('high-prep')}
                                    >
                                        Prepare everything for your future low energy self
                                    </button>
                                </div>
                            </div>
                        ) : energy === 3 ? (
                            <div className="medium-energy-skill-selection" style={{ textAlign: 'left' }}>
                                <header className="selection-header" style={{ marginBottom: '32px' }}>
                                    <h1 className="flow-title" style={{ fontSize: '32px' }}>Becoming {heroSkill?.name || '...'}</h1>
                                </header>

                                {heroSkill && (
                                    <div className="hero-skill-card" style={{ background: '#111', padding: '24px', borderRadius: '16px', border: '1px solid #333', marginBottom: '24px' }}>
                                        <div style={{ marginBottom: '20px' }}>
                                            <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#fff' }}>{heroSkill.name}</h2>
                                            <p style={{ margin: 0, color: '#888', fontSize: '15px' }}>Just do: {heroTask?.name || 'Set a task'}</p>
                                        </div>
                                        <button 
                                            className="flow-primary-btn" 
                                            style={{ width: '100%' }}
                                            onClick={() => console.log("Start hero task navigation would go here:", heroTask?.id)}
                                        >
                                            Start
                                        </button>
                                    </div>
                                )}

                                <button 
                                    className="flow-secondary-btn" 
                                    style={{ width: '100%', textAlign: 'center', background: '#222', padding: '12px', borderRadius: '12px', textDecoration: 'none', color: '#888', marginBottom: '32px', fontSize: '14px', fontWeight: 600 }}
                                    onClick={handleSelectUsual}
                                >
                                    Select the usual
                                </button>

                                <div className="active-skills-group">
                                    <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#555', marginBottom: '16px', letterSpacing: '0.05em' }}>All Active Skills</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {activeSkills.slice(0, 6).map(s => {
                                            const order = getSkillOrder(s.id);
                                            const isSelected = order > 0;
                                            return (
                                                <div 
                                                    key={s.id} 
                                                    onClick={() => toggleSkill(s.id)}
                                                    style={{ 
                                                        background: isSelected ? '#1a1a1a' : '#111', 
                                                        padding: '12px', 
                                                        borderRadius: '12px', 
                                                        border: isSelected ? '1px solid #fff' : '1px solid #222', 
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        position: 'relative',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '14px', color: isSelected ? '#fff' : '#888', fontWeight: isSelected ? 700 : 500 }}>{s.name}</span>
                                                    {order > 0 ? (
                                                        <span style={{ 
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            background: '#fff', 
                                                            color: '#000', 
                                                            fontSize: '11px', 
                                                            width: '20px',
                                                            height: '20px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderRadius: '50%', 
                                                            fontWeight: 800,
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                                            zIndex: 2
                                                        }}>
                                                            {order}
                                                        </span>
                                                    ) : (
                                                        skillMomentum[s.id] > 0 && (
                                                            <span style={{ background: '#3b82f6', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '6px', fontWeight: 700 }}>{skillMomentum[s.id]}</span>
                                                        )
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ marginTop: '32px' }}>
                                    <button 
                                        className="flow-primary-btn" 
                                        style={{ 
                                            width: '100%', 
                                            opacity: selectedSkills.length > 0 ? 1 : 0.5,
                                            cursor: selectedSkills.length > 0 ? 'pointer' : 'not-allowed',
                                            transform: 'scale(1)',
                                            transition: 'transform 0.1s ease, opacity 0.2s ease'
                                        }}
                                        disabled={selectedSkills.length === 0}
                                        onClick={handleStartPath}
                                    >
                                        Start with this path
                                    </button>
                                </div>

                                <div className="secondary-options" style={{ marginTop: '24px' }}>
                                    <button className="flow-secondary-btn" onClick={() => navigate('/planning')} style={{ width: '100%' }}>
                                        Skip for now
                                    </button>
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
                                    {energy >= 3 && (
                                        <button className="flow-secondary-btn small-subtle">
                                            Do something easier
                                        </button>
                                    )}
                                    {energy === 3 && (
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
                                        <h2 style={{ fontSize: '28px', color: '#fff', marginBottom: '12px' }}>You just made {dumpedTasks.length} tasks easier for your future self</h2>
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
                                        <h1 className="flow-title" style={{ fontSize: '28px', color: '#fff', fontWeight: 600, marginBottom: '8px' }}>
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
                                                        background: isSelected ? 'rgba(255,255,255,0.08)' : '#0a0a0a', 
                                                        padding: '16px 20px', 
                                                        borderRadius: '16px', 
                                                        border: isSelected ? '1px solid #444' : '1px solid #1a1a1a', 
                                                        color: isSelected ? '#fff' : '#666',
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
                                                        border: '2px solid #333',
                                                        background: isSelected ? '#fff' : 'transparent',
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
                                        <div style={{ background: '#111', padding: '24px', borderRadius: '24px', border: '1px solid #222' }}>
                                            <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #222' }}>
                                                <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Ready for your low-energy self?</h3>
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
                                                                    background: '#0a0a0a',
                                                                    borderRadius: '12px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <span style={{ fontSize: '13px', color: isSafe ? '#ccc' : '#444' }}>{task?.name}</span>
                                                                <div style={{ 
                                                                    width: '36px', 
                                                                    height: '20px', 
                                                                    borderRadius: '20px', 
                                                                    background: isSafe ? '#fff' : '#222', 
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
                                                            background: '#222',
                                                            border: 'none',
                                                            borderRadius: '12px',
                                                            padding: '10px 16px',
                                                            color: '#fff',
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
                                                        background: '#000',
                                                        border: '1px solid #333',
                                                        borderRadius: '12px',
                                                        padding: '12px 16px',
                                                        color: '#fff',
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
                            <h1 className="flow-title" style={{ fontSize: '28px', color: '#fff', fontWeight: 600, marginBottom: '8px' }}>
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
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid #222',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    color: '#fff',
                                    fontSize: '18px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s ease',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
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
                                        background: '#0a0a0a', 
                                        padding: '16px 20px', 
                                        borderRadius: '12px', 
                                        border: '1px solid #1a1a1a', 
                                        color: '#888',
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
                                        background: '#111', 
                                        border: '1px solid #222', 
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
                                    <span style={{ fontSize: '20px', color: '#fff', fontWeight: 700 }}>{exp.name}</span>
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

                {step === 'initiation' && (
                    <div className="flow-step initiation-step">
                        <div className="initiation-card" style={{ background: '#111', padding: '40px', borderRadius: '24px', border: '1px solid #333', maxWidth: '440px', minHeight: '420px', margin: '0 auto', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
                            {(!showAlternatives && !showLowEnergyAlternatives) ? (
                                <>
                                    <h2 style={{ fontSize: '16px', color: '#666', marginBottom: '24px', fontWeight: 500 }}>
                                        {energy <= 2 
                                            ? "Let's keep it very light. Just 2 minutes." 
                                            : <>To fuel your path toward <span style={{ color: '#aaa', fontWeight: 700 }}>{nodeMap.get(selectedSkills[0])?.name}</span>, let's get a tiny win</>
                                        }
                                    </h2>
                                    
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <h1 style={{ fontSize: '28px', color: '#fff', marginBottom: '8px', lineHeight: 1.2 }}>
                                            {energy <= 2 ? lowEnergyTask?.name : (selectedInitiationTask?.name || initiationTask?.name)}
                                        </h1>
                                        <p style={{ color: '#444', fontSize: '13px', marginBottom: '32px', fontWeight: 600, letterSpacing: '0.02em' }}>
                                            {energy <= 2 ? "⏱️ 2 min only" : "⏱️ ~2 MIN SPRINT"}
                                        </p>
                                    </div>

                                    <h3 style={{ fontSize: '20px', color: '#fff', marginBottom: '32px', fontWeight: 500 }}>Does this feel doable right now?</h3>

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
                                        onClick={() => energy <= 2 ? setShowLowEnergyAlternatives(true) : setShowAlternatives(true)}
                                    >
                                        {energy <= 2 ? "I wanna do something else" : "Choose a different task"}
                                    </button>
                                </>
                            ) : (
                                <div style={{ textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    {energy <= 2 ? (
                                        <div style={{ textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                            <p style={{ fontSize: '12px', color: '#555', marginBottom: '20px', textAlign: 'center', fontWeight: 500 }}>
                                                These are quick wins based on what you usually complete fastest.
                                            </p>
                                            
                                            <input 
                                                type="text"
                                                autoFocus
                                                placeholder="Search fast tasks..."
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
                                                {activeLowEnergyAlternatives.length > 0 ? (
                                                    activeLowEnergyAlternatives.map(alt => {
                                                        const isToday = alt.metadata?.isToday === true;
                                                        const isInProgress = alt.metadata?.status === TaskStatuses.IN_PROGRESS;
                                                        const skill = getSkillFromTask(alt, nodeMap);
                                                        const isCore = skill?.metadata?.identityTier === 'CORE';

                                                        return (
                                                            <button 
                                                                key={alt.id}
                                                                style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '14px', color: '#888', textAlign: 'left', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
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
                                                                style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '14px', color: '#888', textAlign: 'left', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
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
        </div>
    );
};

export default LaunchpadFlow;
