// LEGACY SYSTEM – DO NOT EXTEND – WILL BE REMOVED
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getTodayString, getDateString } from '../utils/dateUtils';
import { initialAreas, initialAreaOrder } from '../data/areas/initialAreas';
import { initialSkills } from '../data/activities/initialSkills';
import { initialHabits } from '../data/habits/initialHabits';
import { initialObjectives } from '../data/activities/initialObjectives';
import { initialTasks } from '../data/activities/initialTasks';
import { initialTimeBlocks } from '../data/activities/initialTimeblocks';
import { initialRewards } from '../data/gamification/initialRewards';
import { initialJournal } from '../data/community/initialJournal';
import { initialAvailableMeds } from '../data/meds/initialMeds';
import { initialTrackers } from '../data/trackers/initialTrackers';
import { initialWealthItems } from '../data/finance/initialWealth';
import { initialBeliefs, initialBeliefTopics, initialManifestations, initialDesires } from '../data/beliefs/initialBeliefs';
import { initialLogs } from '../data/core/initialLogs';
import { initialCoreState } from '../data/core/initialCore';
import { initialRoutineTemplates } from '../data/core/routineTemplates';
import { initialChatSessions } from '../data/community/initialChat';
import { initialFlashcardFolders } from '../data/activities/initialFlashcards';

const generateId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) { }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Initial empty state
const initialState = {
    ...initialCoreState,
    areas: initialAreas,
    areaOrder: initialAreaOrder,
    skills: initialSkills,
    habits: initialHabits,
    objectives: initialObjectives,
    tasks: initialTasks,
    timeBlocks: initialTimeBlocks,
    rewards: initialRewards,
    journal: initialJournal,
    availableMeds: initialAvailableMeds,
    trackers: initialTrackers,
    wealthItems: initialWealthItems,
    beliefs: initialBeliefs,
    beliefTopics: initialBeliefTopics,
    manifestations: initialManifestations,
    desires: initialDesires,
    logs: initialLogs,
    routineTemplates: initialRoutineTemplates,
    chatSessions: initialChatSessions,
    flashcardFolders: initialFlashcardFolders,
    warheadPrompt: null, // New: for interactive safeguards
    activeLoggingSats: null
};

// Action Types
const ACTIONS = {
    ADD_AREA: 'ADD_AREA',
    DELETE_AREA: 'DELETE_AREA',
    UPDATE_AREA: 'UPDATE_AREA',
    REORDER_AREAS: 'REORDER_AREAS', // New
    ADD_SKILL: 'ADD_SKILL',
    DELETE_SKILL: 'DELETE_SKILL',
    UPDATE_SKILL: 'UPDATE_SKILL',
    REORDER_SKILLS: 'REORDER_SKILLS', // New
    ADD_OBJECTIVE: 'ADD_OBJECTIVE',
    DELETE_OBJECTIVE: 'DELETE_OBJECTIVE',
    UPDATE_OBJECTIVE: 'UPDATE_OBJECTIVE', // New
    ADD_TASK: 'ADD_TASK',
    DELETE_TASK: 'DELETE_TASK',
    TOGGLE_TASK: 'TOGGLE_TASK',
    ADD_HABIT: 'ADD_HABIT',
    DELETE_HABIT: 'DELETE_HABIT',
    UPDATE_HABIT: 'UPDATE_HABIT', // New
    TOGGLE_HABIT: 'TOGGLE_HABIT',
    ADD_REWARD: 'ADD_REWARD',
    DELETE_REWARD: 'DELETE_REWARD',
    UPDATE_REWARD: 'UPDATE_REWARD', // New
    REDEEM_REWARD: 'REDEEM_REWARD',
    UPDATE_JOURNAL: 'UPDATE_JOURNAL', // New
    UPDATE_BACKGROUND: 'UPDATE_BACKGROUND',
    UPDATE_USER_PROFILE: 'UPDATE_USER_PROFILE',
    REORDER_REWARDS: 'REORDER_REWARDS', // New
    ADD_AVAILABLE_MED: 'ADD_AVAILABLE_MED', // New
    ADD_RESOURCE: 'ADD_RESOURCE',
    DELETE_RESOURCE: 'DELETE_RESOURCE',
    UPDATE_RESOURCE: 'UPDATE_RESOURCE',
    UPDATE_TASK: 'UPDATE_TASK',
    UPDATE_TRACKER: 'UPDATE_TRACKER',
    ADD_TRACKER: 'ADD_TRACKER',
    DELETE_TRACKER: 'DELETE_TRACKER',
    ADD_WEALTH_ITEM: 'ADD_WEALTH_ITEM',
    DELETE_WEALTH_ITEM: 'DELETE_WEALTH_ITEM',
    UPDATE_WEALTH_ITEM: 'UPDATE_WEALTH_ITEM',
    UPDATE_HABIT_CONTENT: 'UPDATE_HABIT_CONTENT', // New: for notes and cards
    REVIEW_CARD: 'REVIEW_CARD', // New: for SRS updates
    ADD_BELIEF: 'ADD_BELIEF',
    DELETE_BELIEF: 'DELETE_BELIEF',
    UPDATE_BELIEF: 'UPDATE_BELIEF',
    ADD_SATS_SESSION: 'ADD_SATS_SESSION',
    ADD_BELIEF_TOPIC: 'ADD_BELIEF_TOPIC',
    DELETE_BELIEF_TOPIC: 'DELETE_BELIEF_TOPIC',
    UPDATE_BELIEF_TOPIC: 'UPDATE_BELIEF_TOPIC',
    ADD_BELIEF_TASK: 'ADD_BELIEF_TASK',
    DELETE_BELIEF_TASK: 'DELETE_BELIEF_TASK',
    ADD_MANIFESTATION: 'ADD_MANIFESTATION',
    DELETE_MANIFESTATION: 'DELETE_MANIFESTATION',
    UPDATE_MANIFESTATION: 'UPDATE_MANIFESTATION',
    ADD_MANIFESTATION_SESSION: 'ADD_MANIFESTATION_SESSION',
    ADD_DESIRE: 'ADD_DESIRE',
    DELETE_DESIRE: 'DELETE_DESIRE',
    UPDATE_DESIRE: 'UPDATE_DESIRE',
    ADD_DESIRE_SESSION: 'ADD_DESIRE_SESSION',
    ADD_DESIRE_TASK: 'ADD_DESIRE_TASK',
    DELETE_DESIRE_TASK: 'DELETE_DESIRE_TASK',
    REORDER_HABITS: 'REORDER_HABITS',
    TOGGLE_THEME: 'TOGGLE_THEME', // New
    TOGGLE_BACKGROUNDS: 'TOGGLE_BACKGROUNDS', // New
    SET_LOADED: 'SET_LOADED',
    LOAD_STATE: 'LOAD_STATE',
    SET_API_KEY: 'SET_API_KEY',
    SET_WARHEAD_INSTRUCTIONS: 'SET_WARHEAD_INSTRUCTIONS', // New
    ADD_WARHEAD_MEMORY: 'ADD_WARHEAD_MEMORY', // New
    CREATE_CHAT_SESSION: 'CREATE_CHAT_SESSION', // New
    ADD_MESSAGE_TO_SESSION: 'ADD_MESSAGE_TO_SESSION', // New
    SET_ACTIVE_SESSION: 'SET_ACTIVE_SESSION', // New
    DELETE_SESSION: 'DELETE_SESSION', // New
    ADD_TIME_BLOCK: 'ADD_TIME_BLOCK', // New
    DELETE_TIME_BLOCK: 'DELETE_TIME_BLOCK', // New
    UPDATE_TIME_BLOCK: 'UPDATE_TIME_BLOCK', // New
    UPDATE_ROUTINE_TEMPLATE: 'UPDATE_ROUTINE_TEMPLATE', // New
    INCREMENT_HABIT_INTEGRATION: 'INCREMENT_HABIT_INTEGRATION', // New: for progressive habits
    ADD_FLASHCARD_FOLDER: 'ADD_FLASHCARD_FOLDER',
    DELETE_FLASHCARD_FOLDER: 'DELETE_FLASHCARD_FOLDER',
    UPDATE_FLASHCARD_FOLDER: 'UPDATE_FLASHCARD_FOLDER',
    ADD_FLASHCARD_TO_FOLDER: 'ADD_FLASHCARD_TO_FOLDER',
    DELETE_FLASHCARD_FROM_FOLDER: 'DELETE_FLASHCARD_FROM_FOLDER',
    MOVE_FLASHCARD: 'MOVE_FLASHCARD', // Move between folder and island or between folders
    SET_LOGGING_SATS: 'SET_LOGGING_SATS',
    ADJUST_TASK_TIME: 'ADJUST_TASK_TIME', // New: for interactive corrections
    SET_WARHEAD_PROMPT: 'SET_WARHEAD_PROMPT', // New: for interactive safeguards
};

// Reducer Function
function appReducer(state, action) {
    switch (action.type) {
        case ACTIONS.SET_LOADED:
            return { ...state, isLoaded: true };
        case ACTIONS.LOAD_STATE: {
            const payload = action.payload || {};
            const incomingTasks = payload.tasks || {};
            const currentTasks = state.tasks || {};

            // --- ROBUST STATE MERGING (Prevent "State Lock" and Data Loss) ---
            // We merge by key to ensure local-only items (not yet synced) are preserved.
            // Cloud data still "wins" for existing keys to ensure synchronization.

            const mergeState = (local, incoming) => {
                const merged = { ...incoming, ...local };
                return merged;
            };

            const finalTasks = mergeState(currentTasks, incomingTasks);
            const finalSkills = mergeState(state.skills || {}, payload.skills || {});
            const finalAreas = mergeState(state.areas || {}, payload.areas || {});
            const finalObjectives = mergeState(state.objectives || {}, payload.objectives || {});
            const finalHabits = mergeState(state.habits || {}, payload.habits || {});
            const finalBeliefs = mergeState(state.beliefs || {}, payload.beliefs || {});
            const finalManifestations = mergeState(state.manifestations || {}, payload.manifestations || {});
            const finalDesires = mergeState(state.desires || {}, payload.desires || {});

            // Log if we are preserving local-only tasks
            const localOnlyCount = Object.keys(currentTasks).filter(id => !incomingTasks[id]).length;
            if (localOnlyCount > 0) {
                console.log(`📡 LOAD_STATE: Preserving ${localOnlyCount} local-only tasks while syncing cloud.`);
            }

            // --- CASA'S PERSISTENT DATA FIXES ---


            // 2. Reorder Languages skills: move Cantonese to top, English to bottom (User Request)
            // In light mode: swap Ukrainian and English positions
            const targetAreaId = '67a95806-2ae1-4f6d-9c82-60ca3d3af512';
            const englishId = 'e3430e22-ce18-45e1-a4f7-7bedf23f5b76';
            const cantoneseId = '7d89d177-37ae-4f2e-84c9-b02283de13cc';
            const ukrainianId = '61a2b8c8-0b92-4443-9cbf-4b90e5d37a5c';
            const languagesArea = finalAreas[targetAreaId] || Object.values(finalAreas).find(a => a.name === 'Languages');

            if (languagesArea) {
                // Dark mode order: Cantonese, ..., Ukrainian, ..., English
                const darkModeIds = languagesArea.skillIds;
                if (Array.isArray(darkModeIds) && darkModeIds.includes(englishId) && darkModeIds.includes(cantoneseId)) {
                    const filtered = darkModeIds.filter(id => id !== englishId && id !== cantoneseId);
                    languagesArea.skillIds = [
                        cantoneseId,
                        ...filtered,
                        englishId
                    ];
                }

                // Light mode order: Cantonese, ..., English, ..., Ukrainian (swap English and Ukrainian)
                const lightModeIds = languagesArea.skillIdsLight;
                if (Array.isArray(lightModeIds) && lightModeIds.includes(englishId) && lightModeIds.includes(cantoneseId) && lightModeIds.includes(ukrainianId)) {
                    const filtered = lightModeIds.filter(id => id !== englishId && id !== cantoneseId && id !== ukrainianId);
                    languagesArea.skillIdsLight = [
                        cantoneseId,
                        ...filtered,
                        englishId,
                        ukrainianId
                    ];
                }
            }

            // 3. Move "Latte" skill to "Latte app" area and cleanup duplicates/bad data
            const financeArea = Object.values(finalAreas).find(a => a.name === 'Finance' || a.name === 'Finances');
            const latteArea = Object.values(finalAreas).find(a => a.name === 'Latte app' || a.name === 'Latte' || a.name === 'Latte App');

            if (latteArea) {
                // Find all skills that look like "Latte"
                const latteSkills = Object.values(finalSkills).filter(s => s && s.name && s.name.toLowerCase() === 'latte');

                if (latteSkills.length > 0) {
                    // Pick the "best" one (e.g. one with objectives or the first one)
                    latteSkills.sort((a, b) => (b.objectiveIds?.length || 0) - (a.objectiveIds?.length || 0));
                    const canonicalLatteSkill = latteSkills[0];

                    // Ensure it's in the Latte app area
                    canonicalLatteSkill.areaId = latteArea.id;

                    // Update latteArea skillIds
                    if (!latteArea.skillIds.includes(canonicalLatteSkill.id)) {
                        latteArea.skillIds = [canonicalLatteSkill.id];
                    }
                    latteArea.skillIdsLight = [...(latteArea.skillIds || [])];

                    // Remove from Finance if it was there
                    if (financeArea && financeArea.skillIds) {
                        financeArea.skillIds = financeArea.skillIds.filter(id => id !== canonicalLatteSkill.id);
                    }

                    // Delete other duplicate "Latte" skills and re-link their objectives
                    latteSkills.slice(1).forEach(dup => {
                        // Re-link any objectives pointing to this duplicate
                        Object.values(payload.objectives || {}).forEach(obj => {
                            if (obj.skillId === dup.id) {
                                obj.skillId = canonicalLatteSkill.id;
                            }
                        });
                        delete finalSkills[dup.id];
                    });
                }
            }

            // 3.5 Re-link Habits to correct Skills (Data Recovery)
            const perfectTeethId = '999c0cc8-8ee0-4f87-b8b5-85558f8a91e2';
            const perfectSkinId = '688c81af-1ef8-4a35-95bd-b0dc16954fe2';

            Object.values(finalHabits).forEach(h => {
                const name = h.name?.toLowerCase() || '';
                if (name.includes('brush your teeth')) {
                    h.skillIds = [perfectTeethId];
                } else if (name.includes('wash face') || name.includes("dani's bath")) {
                    h.skillIds = [perfectSkinId];
                }
            });


            // 4. Wipe Routine Templates & Future Blocks (User Request: Stop auto-filling and clear "junk")
            const finalRoutineTemplates = {
                work1: [],
                work2: [],
                light: []
            };

            const finalTimeBlocks = { ...(payload.timeBlocks || {}) };
            const todayStr = getTodayString();
            const autoFilledTitles = [
                'Morning routine', 'English', 'Testing manifestation session',
                'SATS belief rewiring session', 'Due diligence', 'Ukrainian',
                'Cantonese', 'Russian', 'Arabic'
            ];

            Object.entries(finalTimeBlocks).forEach(([id, block]) => {
                if (block.scheduledDate >= todayStr && autoFilledTitles.includes(block.title)) {
                    delete finalTimeBlocks[id];
                }
            });

            // 5. Purge Mock SATS Data (One-time Cleanup)
            Object.keys(finalManifestations).forEach(id => {
                const m = finalManifestations[id];
                if (m.target === "Main Goal" && (m.sessions || []).some(s => s.method === 'sats-lullaby')) {
                    console.log("🧹 Purging mock SATS manifestation...");
                    delete finalManifestations[id];
                }
            });

            const hasAnySessions = [
                ...Object.values(finalManifestations),
                ...Object.values(finalDesires),
                ...Object.values(payload.beliefs || {})
            ].some(m => (m.sessions || []).length > 0);

            console.log(`[SATS Debug] Manifests: ${Object.keys(finalManifestations).length}, Desires: ${Object.keys(finalDesires).length}, Any Sessions: ${hasAnySessions}`);

            // 5. Cleanup stale schedules for recurring tasks (User Request: return to Unscheduled)
            Object.values(finalTasks).forEach(t => {
                if (!t.scheduledDate || t.scheduledDate >= todayStr || t.isCompleted) return;

                // Robustly identify if this task belongs to a recurring area
                let skillId = t.skillId;
                let areaId = t.areaId;
                if (!skillId && t.objectiveId && payload.objectives && payload.objectives[t.objectiveId]) {
                    skillId = payload.objectives[t.objectiveId].skillId;
                }
                if (!areaId && skillId && payload.skills && payload.skills[skillId]) {
                    areaId = payload.skills[skillId].areaId;
                }

                const area = areaId ? (payload.areas && payload.areas[areaId]) : null;
                const isLanguageTask = area?.name === 'Languages';
                const isLatteTask = area?.name === 'Latte app';

                if (t.isRecurring || isLanguageTask || isLatteTask) {
                    console.log(`🧹 Cleaning stale schedule for: ${t.title} (${t.scheduledDate})`);
                    t.scheduledDate = null;
                    t.startTime = null;
                }
            });

            // 6. Time Calculation Fix: Sanitize Outlier Logs (> 8 hours)
            // This fixes the "13h bug" caused by forgotten timers.
            // We assume nobody legitimately works > 8 hours straight without a toggle/stop.
            try {
                const MAX_VALID_SESSION_HOURS = 12;
                if (payload.logs && Array.isArray(payload.logs)) {
                    const initialLogCount = payload.logs.length;
                    payload.logs = payload.logs.filter(log => {
                        if (!log || typeof log !== 'object') return false;
                        const durationInHours = (parseFloat(log.duration || log.sessionDuration) || 0) / 3600;
                        const isOutlier = durationInHours > MAX_VALID_SESSION_HOURS;
                        if (isOutlier) {
                            console.log(`🧹 Removing outlier log: ${log.type} (${durationInHours.toFixed(1)}h) - ${log.taskTitle || 'Untitled'}`);
                            return false;
                        }
                        return true;
                    });
                    if (payload.logs.length < initialLogCount) {
                        console.log(`✨ Removed ${initialLogCount - payload.logs.length} outlier logs to fix daily stats.`);
                    }
                }
            } catch (err) {
                console.error("⚠️ Error sanitizing logs:", err);
            }

            return {
                ...initialState,
                ...payload,
                areas: finalAreas,
                skills: finalSkills,
                objectives: finalObjectives,
                habits: finalHabits,
                beliefs: finalBeliefs,
                manifestations: finalManifestations,
                desires: finalDesires,
                tasks: finalTasks,
                trackers: { ...initialState.trackers, ...(payload.trackers || {}) },
                userProfile: { ...initialState.userProfile, ...(payload.userProfile || {}) },
                areaOrder: payload.areaOrder || [],
                themeMode: payload.themeMode || 'dark',
                showBackgrounds: payload.showBackgrounds !== undefined ? payload.showBackgrounds : true,
                backgroundsLight: payload.backgroundsLight || {},
                apiKey: payload.apiKey || '',
                warheadInstructions: payload.warheadInstructions || '',
                warheadMemory: payload.warheadMemory || [],
                chatSessions: payload.chatSessions || {},
                activeSessionId: payload.activeSessionId || null,
                timeBlocks: finalTimeBlocks,
                routineTemplates: finalRoutineTemplates,
                lastRoutineSyncDate: payload.lastRoutineSyncDate || null,
                flashcardFolders: payload.flashcardFolders || {},
                isLoaded: true
            };
        }

        case 'MANUAL_SAVE_TRIGGER':
            return { ...state, manualSavePing: state.manualSavePing + 1 };
        case ACTIONS.ADD_AREA: {
            const { id, name, icon, color } = action.payload;
            return {
                ...state,
                areas: {
                    ...state.areas,
                    [id]: { id, name, icon, color, skillIds: [] }
                },
                areaOrder: [...state.areaOrder, id]
            };
        }
        case ACTIONS.DELETE_AREA: {
            const newAreas = { ...state.areas };
            delete newAreas[action.payload];
            return {
                ...state,
                areas: newAreas,
                areaOrder: state.areaOrder.filter(id => id !== action.payload)
            };
        }

        case ACTIONS.SET_API_KEY:
            return {
                ...state,
                apiKey: action.payload
            };

        case ACTIONS.SET_WARHEAD_INSTRUCTIONS:
            return {
                ...state,
                warheadInstructions: action.payload
            };

        case ACTIONS.ADD_WARHEAD_MEMORY:
            return {
                ...state,
                warheadMemory: [...(state.warheadMemory || []), action.payload]
            };

        case ACTIONS.CREATE_CHAT_SESSION: {
            const { id, title, initialMessage } = action.payload;
            return {
                ...state,
                chatSessions: {
                    ...state.chatSessions,
                    [id]: { id, title, messages: initialMessage ? [initialMessage] : [], updatedAt: new Date().toISOString() }
                },
                activeSessionId: id
            };
        }

        case ACTIONS.ADD_MESSAGE_TO_SESSION: {
            const { sessionId, message } = action.payload;
            const session = state.chatSessions[sessionId];
            if (!session) return state;

            // Prevent duplicates
            if (session.messages.some(m => m.id === message.id)) {
                return state;
            }

            return {
                ...state,
                chatSessions: {
                    ...state.chatSessions,
                    [sessionId]: {
                        ...session,
                        messages: [...session.messages, message],
                        updatedAt: new Date().toISOString()
                    }
                }
            };
        }

        case ACTIONS.SET_ACTIVE_SESSION:
            return { ...state, activeSessionId: action.payload };

        case ACTIONS.DELETE_SESSION: {
            const newSessions = { ...state.chatSessions };
            delete newSessions[action.payload];
            return {
                ...state,
                chatSessions: newSessions,
                activeSessionId: state.activeSessionId === action.payload ? null : state.activeSessionId
            };
        }

        case ACTIONS.TOGGLE_THEME: {
            return {
                ...state,
                themeMode: state.themeMode === 'light' ? 'dark' : 'light'
            };
        }
        case ACTIONS.TOGGLE_BACKGROUNDS: {
            return {
                ...state,
                showBackgrounds: !state.showBackgrounds
            };
        }

        case ACTIONS.REORDER_AREAS: {
            return {
                ...state,
                areaOrder: action.payload // payload is the new areaIds array
            };
        }
        case ACTIONS.UPDATE_AREA: {
            const { id, updates } = action.payload;
            return {
                ...state,
                areas: {
                    ...state.areas,
                    [id]: { ...state.areas[id], ...updates }
                }
            };
        }
        case ACTIONS.ADD_SKILL: {
            const { id, areaId, name, icon } = action.payload;

            const currentArea = state.areas[areaId];
            return {
                ...state,
                skills: {
                    ...state.skills,
                    [id]: { id, areaId, name, icon, habitIds: [], objectiveIds: [], resources: [] }
                },
                areas: {
                    ...state.areas,
                    [areaId]: {
                        ...currentArea,
                        skillIds: [...currentArea.skillIds, id],
                        skillIdsLight: currentArea.skillIdsLight ? [...currentArea.skillIdsLight, id] : undefined
                    }
                }
            };
        }

        case ACTIONS.DELETE_SKILL: {
            const { id, areaId } = action.payload;
            const newSkills = { ...state.skills };
            delete newSkills[id];

            const targetArea = state.areas[areaId];
            return {
                ...state,
                skills: newSkills,
                areas: {
                    ...state.areas,
                    [areaId]: {
                        ...targetArea,
                        skillIds: targetArea.skillIds.filter(skillId => skillId !== id),
                        skillIdsLight: targetArea.skillIdsLight ? targetArea.skillIdsLight.filter(skillId => skillId !== id) : undefined
                    }
                }
            };
        }

        case ACTIONS.UPDATE_SKILL: {
            const { id, updates } = action.payload;
            return {
                ...state,
                skills: {
                    ...state.skills,
                    [id]: { ...state.skills[id], ...updates }
                }
            };
        }
        case ACTIONS.REORDER_SKILLS: {
            const { areaId, skillIds } = action.payload;

            const isLightMode = state.themeMode === 'light';
            return {
                ...state,
                areas: {
                    ...state.areas,
                    [areaId]: {
                        ...state.areas[areaId],
                        [isLightMode ? 'skillIdsLight' : 'skillIds']: skillIds
                    }
                }
            };
        }
        case ACTIONS.ADD_RESOURCE: {
            const { id, skillId, title, url } = action.payload;
            const currentResources = state.skills[skillId].resources || [];
            return {
                ...state,
                skills: {
                    ...state.skills,
                    [skillId]: {
                        ...state.skills[skillId],
                        resources: [...currentResources, { id, title, url, createdAt: new Date().toISOString() }]
                    }
                }
            };
        }
        case ACTIONS.DELETE_RESOURCE: {
            const { id, skillId } = action.payload;
            return {
                ...state,
                skills: {
                    ...state.skills,
                    [skillId]: {
                        ...state.skills[skillId],
                        resources: state.skills[skillId].resources.filter(r => r.id !== id)
                    }
                }
            };
        }
        case ACTIONS.UPDATE_RESOURCE: {
            const { id, skillId, updates } = action.payload;
            const currentResources = state.skills[skillId]?.resources || [];
            return {
                ...state,
                skills: {
                    ...state.skills,
                    [skillId]: {
                        ...state.skills[skillId],
                        resources: currentResources.map(r => r.id === id ? { ...r, ...updates } : r)
                    }
                }
            };
        }
        case ACTIONS.ADD_OBJECTIVE: {
            const { id, skillId, title } = action.payload;
            const skill = state.skills[skillId];
            if (!skill) return state; // Safety check

            const currentObjectiveIds = skill.objectiveIds || [];

            return {
                ...state,
                objectives: {
                    ...state.objectives,
                    [id]: { id, skillId, title, taskIds: [], isCompleted: false }
                },
                skills: {
                    ...state.skills,
                    [skillId]: {
                        ...skill,
                        objectiveIds: [...currentObjectiveIds, id]
                    }
                }
            };
        }
        case ACTIONS.DELETE_OBJECTIVE: {
            const { id, skillId } = action.payload;
            const newObjectives = { ...state.objectives };
            delete newObjectives[id];

            const skill = state.skills[skillId];
            const currentObjectiveIds = skill?.objectiveIds || [];

            return {
                ...state,
                objectives: newObjectives,
                skills: {
                    ...state.skills,
                    [skillId]: {
                        ...skill,
                        objectiveIds: currentObjectiveIds.filter(objId => objId !== id)
                    }
                }
            };
        }
        case ACTIONS.UPDATE_OBJECTIVE: {
            const { id, updates } = action.payload;
            return {
                ...state,
                objectives: {
                    ...state.objectives,
                    [id]: { ...state.objectives[id], ...updates }
                }
            };
        }
        case ACTIONS.ADD_TASK: {
            const { id, objectiveId, title } = action.payload;
            const objective = objectiveId ? state.objectives[objectiveId] : null;

            // Create the task
            const newState = {
                ...state,
                tasks: {
                    ...state.tasks,
                    [id]: {
                        id, objectiveId, title,
                        isCompleted: false,
                        rewardValue: 10,
                        difficulty: action.payload.difficulty || 'Trivial',
                        growthType: action.payload.growthType || 'Financial',
                        status: action.payload.status || 'not-started',
                        totalInProgressTime: 0,
                        lastStartedAt: null,
                        // Automatic Recurring detection by Area
                        isRecurring: (function () {
                            if (action.payload.isRecurring) return true;
                            const obj = objectiveId ? state.objectives[objectiveId] : null;
                            const skill = obj ? state.skills[obj.skillId] : null;
                            const area = skill ? state.areas[skill.areaId] : null;
                            const areaName = area?.name;
                            return areaName === 'Latte app' || areaName === 'Languages';
                        })(),
                        // Atomic Scheduling
                        scheduledDate: action.payload.scheduledDate || null,
                        startTime: action.payload.startTime || null,
                        duration: action.payload.duration || null
                    }
                }
            };

            // Only update objective if it exists
            if (objective) {
                const currentTaskIds = objective.taskIds || [];
                newState.objectives = {
                    ...state.objectives,
                    [objectiveId]: {
                        ...objective,
                        taskIds: [...currentTaskIds, id]
                    }
                };
            }

            return newState;
        }
        case ACTIONS.DELETE_TASK: {
            const { id, objectiveId } = action.payload;
            const newTasks = { ...state.tasks };
            delete newTasks[id];
            return {
                ...state,
                tasks: newTasks,
                objectives: {
                    ...state.objectives,
                    [objectiveId]: {
                        ...state.objectives[objectiveId],
                        taskIds: state.objectives[objectiveId].taskIds.filter(taskId => taskId !== id)
                    }
                }
            };
        }
        case ACTIONS.TOGGLE_TASK: {
            const { id, date } = action.payload;
            const task = state.tasks[id];
            if (!task) return state;

            const isNowCompleted = !task.isCompleted;
            const timestamp = Date.now();

            let currencyChange = 0;
            let finalUpdates = {
                isCompleted: isNowCompleted,
                status: isNowCompleted ? 'done' : 'not-started'
            };

            // 1. Stop timer if completing
            if (task.status === 'in-progress' && isNowCompleted && task.lastStartedAt) {
                const elapsed = (timestamp - task.lastStartedAt) / 1000;
                finalUpdates.totalInProgressTime = (task.totalInProgressTime || 0) + elapsed;
                finalUpdates.lastStartedAt = null;
                // Capture this session's time for logs
                finalUpdates.sessionDuration = elapsed;
            }

            // 2. Completion Rewards
            if (isNowCompleted) {
                finalUpdates.completedAt = date || getTodayString();

                // Reward Formula
                const totalSeconds = finalUpdates.totalInProgressTime || task.totalInProgressTime || 0;
                const hours = totalSeconds / 3600;

                const BASE_RATE = 30;
                const DIFF_MULT = { 'Trivial': 1, 'Easy': 1.2, 'Medium': 1.5, 'Hard': 2, 'Very Hard': 3, 'Boss': 5 }[task.difficulty || 'Trivial'] || 1;
                const GROWTH_MULT = { 'Regular life task': 1, 'Booster': 1.1, 'Learned something new': 1.3, 'New & outside comfort zone': 1.5, 'Important progress': 2, 'This really drives results': 3 }[task.growthType || 'Regular life task'] || 1;

                const timeReward = Math.round(hours * BASE_RATE * DIFF_MULT * GROWTH_MULT);
                const baseReward = task.rewardValue || (5 * DIFF_MULT); // Use existing rewardValue as fallback
                const reward = Math.max(timeReward, baseReward);

                if (reward > 0) {
                    currencyChange += reward;
                    finalUpdates.earnedReward = reward;
                }
            } else {
                // Un-completing
                finalUpdates.completedAt = null;
                if (task.earnedReward) {
                    currencyChange -= task.earnedReward;
                    finalUpdates.earnedReward = null;
                }
            }

            return {
                ...state,
                tasks: {
                    ...state.tasks,
                    [id]: { ...task, ...finalUpdates }
                },
                currency: state.currency + currencyChange,
                logs: [
                    ...(state.logs || []),
                    {
                        id: generateId(),
                        type: 'TASK_TOGGLED',
                        taskId: id,
                        taskTitle: task.title,
                        isCompleted: isNowCompleted,
                        timestamp: new Date().toISOString(),
                        sessionDuration: finalUpdates.sessionDuration || 0 // Store just this session's time
                    }
                ]
            };
        }
        case ACTIONS.UPDATE_TASK: {
            const { id, updates, timestamp = Date.now() } = action.payload;
            const task = state.tasks[id];
            if (!task) return state;

            let finalUpdates = { ...updates };
            let currencyChange = 0;
            let sessionDuration = 0;

            // 1. Handle Status Transitions for Timer
            if (task.status === 'in-progress' && 'status' in updates && updates.status !== 'in-progress' && task.lastStartedAt) {
                let elapsed = (timestamp - task.lastStartedAt) / 1000;

                // DEEP SAFETY NET: Cap extreme multi-day "Forgotten Timers" (> 24 hours) to 12 hours
                // This replaces the old restrictive 2h cap.
                if (elapsed > 24 * 3600) {
                    console.log(`⚠️ Deep Safety Net: Capping ${elapsed / 3600}h session to 12h for task "${task.title}"`);
                    elapsed = 12 * 3600;
                }

                finalUpdates.totalInProgressTime = (task.totalInProgressTime || 0) + elapsed;
                finalUpdates.lastStartedAt = null;
                sessionDuration = elapsed;

                // 1.1 Create a log for this timer session
                const sessionLog = {
                    id: generateId(),
                    type: 'TASK_TIMER_SESSION',
                    taskId: id,
                    taskTitle: task.title,
                    timestamp: getTodayString(),
                    duration: elapsed
                };

                // We'll append this to the logs later or return it here if needed
                // Since this is a reducer, we'll accumulate it in a temporary logs array
                if (!finalUpdates._logs) finalUpdates._logs = [];
                finalUpdates._logs.push(sessionLog);
            }

            if (updates.status === 'in-progress' && task.status !== 'in-progress') {
                finalUpdates.lastStartedAt = timestamp;
            }

            // 2. Sync isCompleted with status
            // Handle both 'done' and 'completed' status values
            if ((updates.status === 'done' || updates.status === 'completed') &&
                task.status !== 'done' && task.status !== 'completed') {
                finalUpdates.isCompleted = true;
                finalUpdates.completedAt = getTodayString();

                // Reward Formula
                const totalSeconds = finalUpdates.totalInProgressTime || task.totalInProgressTime || 0;
                const hours = totalSeconds / 3600;

                const BASE_RATE = 30;
                const DIFF_MULT = { 'Trivial': 1, 'Easy': 1.2, 'Medium': 1.5, 'Hard': 2, 'Very Hard': 3, 'Boss': 5 }[task.difficulty || 'Trivial'] || 1;
                const GROWTH_MULT = { 'Regular life task': 1, 'Booster': 1.1, 'Learned something new': 1.3, 'New & outside comfort zone': 1.5, 'Important progress': 2, 'This really drives results': 3 }[task.growthType || 'Regular life task'] || 1;

                const timeReward = Math.round(hours * BASE_RATE * DIFF_MULT * GROWTH_MULT);
                const baseReward = task.rewardValue || (5 * DIFF_MULT);
                const reward = Math.max(timeReward, baseReward);

                if (reward > 0) {
                    currencyChange += reward;
                    finalUpdates.earnedReward = reward;
                }
            } else if ((task.status === 'done' || task.status === 'completed') &&
                'status' in updates &&
                updates.status !== 'done' && updates.status !== 'completed') {
                finalUpdates.isCompleted = false;
                finalUpdates.completedAt = null;

                if (task.earnedReward) {
                    currencyChange -= task.earnedReward;
                    finalUpdates.earnedReward = null;
                }
            }

            // 3. Handle Recurring or Language/Latte Completion Time Reset & Rewards
            // Robustly identify if this task belongs to a recurring area
            let skillId = task.skillId;
            let areaId = task.areaId;

            // If task doesn't have skillId directly, check objective
            if (!skillId && task.objectiveId && state.objectives[task.objectiveId]) {
                skillId = state.objectives[task.objectiveId].skillId;
            }
            // If task doesn't have areaId directly, check skill
            if (!areaId && skillId && state.skills[skillId]) {
                areaId = state.skills[skillId].areaId;
            }

            const areaName = areaId ? state.areas[areaId]?.name : null;
            const isLanguageTask = areaName === 'Languages';
            const isLatteTask = areaName === 'Latte app';
            const isLogicalRecurring = task.isRecurring || isLanguageTask || isLatteTask;

            if (isLogicalRecurring && updates.timesCompleted > (task.timesCompleted || 0)) {
                // If the timer was stopped in the same update (handled in Step 1), 
                // we should NOT count that duration again here.
                // Step 1 already added it to finalUpdates.totalInProgressTime.
                const totalTimeAtCompletion = (finalUpdates.totalInProgressTime !== undefined ? finalUpdates.totalInProgressTime : (task.totalInProgressTime || 0));

                // Add rewards for recurring completion
                const hours = totalTimeAtCompletion / 3600;
                const BASE_RATE = 30;
                const DIFF_MULT = { 'Trivial': 1, 'Easy': 1.2, 'Medium': 1.5, 'Hard': 2, 'Very Hard': 3, 'Boss': 5 }[task.difficulty || 'Trivial'] || 1;
                const GROWTH_MULT = { 'Regular life task': 1, 'Booster': 1.1, 'Learned something new': 1.3, 'New & outside comfort zone': 1.5, 'Important progress': 2, 'This really drives results': 3 }[task.growthType || 'Regular life task'] || 1;

                const timeReward = Math.round(hours * BASE_RATE * DIFF_MULT * GROWTH_MULT);
                const baseReward = task.rewardValue || (5 * DIFF_MULT);
                const reward = Math.max(timeReward, baseReward);

                if (reward > 0) {
                    currencyChange += reward;
                }

                finalUpdates.lifetimeTime = (task.lifetimeTime || 0) + totalTimeAtCompletion;
                finalUpdates.totalInProgressTime = 0;
                finalUpdates.scheduledDate = null;
                finalUpdates.startTime = null;
                finalUpdates.completedAt = getTodayString(); // Explicit local logical date

                // Completion Log Logic
                // If Step 1 added a TASK_TIMER_SESSION for this status change, 
                // we'll just keep that one and NOT add a TASK_COMPLETED_SESSION if the duration is the same.
                // However, to be safe and provide a clear history, we'll convert the last timer log 
                // into a 'COMPLETED' log if it happened at the same time.
                const lastTimerLog = finalUpdates._logs?.find(l => l.type === 'TASK_TIMER_SESSION');

                const completionLog = {
                    id: generateId(),
                    type: 'TASK_COMPLETED_SESSION',
                    taskId: id,
                    taskTitle: task.title,
                    timestamp: finalUpdates.completedAt,
                    duration: lastTimerLog ? 0 : totalTimeAtCompletion // prevent double counting if timer was JUST stopped
                };

                // Remove the timer log if we are logging completion with total time instead?
                // Actually, let's just make completionLog have duration 0 if a timer log was already created.
                // This ensures the Focus Tracker (which sums all logs) gets the correct total.

                return {
                    ...state,
                    tasks: {
                        ...state.tasks,
                        [id]: { ...task, ...finalUpdates }
                    },
                    currency: state.currency + currencyChange,
                    logs: [...(state.logs || []), ...(finalUpdates._logs || []), completionLog]
                };
            }

            return {
                ...state,
                tasks: {
                    ...state.tasks,
                    [id]: { ...task, ...finalUpdates }
                },
                currency: state.currency + currencyChange,
                logs: [...(state.logs || []), ...(finalUpdates._logs || [])]
            };
        }
        case ACTIONS.ADJUST_TASK_TIME: {
            const { taskId, stopTimeStr } = action.payload; // stopTimeStr is ISO or timestamp
            const task = state.tasks[taskId];
            if (!task || task.status !== 'in-progress' || !task.lastStartedAt) return state;

            const stopTimestamp = new Date(stopTimeStr).getTime();
            const startTimestamp = task.lastStartedAt;
            let elapsed = (stopTimestamp - startTimestamp) / 1000;

            if (elapsed < 0) elapsed = 0;

            // Log this session immediately as it's been "caught" by Warhead
            const sessionLog = {
                id: generateId(),
                type: 'TASK_TIMER_SESSION',
                taskId: taskId,
                taskTitle: task.title,
                timestamp: getTodayString(),
                duration: elapsed
            };

            return {
                ...state,
                tasks: {
                    ...state.tasks,
                    [taskId]: {
                        ...task,
                        status: 'not-started',
                        lastStartedAt: null,
                        totalInProgressTime: (task.totalInProgressTime || 0) + elapsed
                    }
                },
                logs: [...(state.logs || []), sessionLog],
                warheadPrompt: null // Clear prompt after adjustment
            };
        }
        case ACTIONS.SET_WARHEAD_PROMPT: {
            return {
                ...state,
                warheadPrompt: action.payload // { taskId, title, startTime } or null
            };
        }
        case ACTIONS.ADD_HABIT: {
            const { id, skillIds, name, category } = action.payload;
            // Handle single skillId for backward compatibility or simplistic inputs
            const skillsToUpdate = Array.isArray(skillIds) ? skillIds : (action.payload.skillId ? [action.payload.skillId] : []);

            const newSkills = { ...state.skills };
            skillsToUpdate.forEach(sId => {
                if (newSkills[sId]) {
                    newSkills[sId] = {
                        ...newSkills[sId],
                        habitIds: [...newSkills[sId].habitIds, id]
                    };
                }
            });

            return {
                ...state,
                habits: {
                    ...state.habits,
                    [id]: {
                        id,
                        skillIds: skillsToUpdate,
                        name,
                        category: category || 'integrating',
                        targetDailyCount: action.payload.targetDailyCount || 1,
                        integrationLevel: 0, // 0: Seed, 1: Growing, 2: Mature, 3: Baseline
                        stabilityScore: 0,
                        history: {},
                        streak: 0
                    }
                },
                skills: newSkills
            };
        }
        case ACTIONS.DELETE_HABIT: {
            const { id } = action.payload;
            const habit = state.habits[id];
            if (!habit) return state;

            const newHabits = { ...state.habits };
            delete newHabits[id];

            const newSkills = { ...state.skills };

            // Handle both new skillIds array and legacy single skillId
            const skillsToUpdate = habit.skillIds || (habit.skillId ? [habit.skillId] : []);

            skillsToUpdate.forEach(sId => {
                if (newSkills[sId]) {
                    newSkills[sId] = {
                        ...newSkills[sId],
                        habitIds: newSkills[sId].habitIds.filter(hId => hId !== id)
                    };
                }
            });

            return {
                ...state,
                habits: newHabits,
                skills: newSkills
            };
        }
        case ACTIONS.UPDATE_HABIT: {
            const { id, updates } = action.payload;
            const oldHabit = state.habits[id];
            if (!oldHabit) return state;

            let nextSkills = state.skills;

            if (updates.skillIds) {
                const oldSkillIds = oldHabit.skillIds || (oldHabit.skillId ? [oldHabit.skillId] : []);
                const newSkillIds = updates.skillIds;

                const added = newSkillIds.filter(sid => !oldSkillIds.includes(sid));
                const removed = oldSkillIds.filter(sid => !newSkillIds.includes(sid));

                if (added.length > 0 || removed.length > 0) {
                    nextSkills = { ...state.skills };

                    added.forEach(sid => {
                        if (nextSkills[sid]) {
                            nextSkills[sid] = {
                                ...nextSkills[sid],
                                habitIds: [...(nextSkills[sid].habitIds || []), id]
                            };
                        }
                    });

                    removed.forEach(sid => {
                        if (nextSkills[sid]) {
                            nextSkills[sid] = {
                                ...nextSkills[sid],
                                habitIds: (nextSkills[sid].habitIds || []).filter(hId => hId !== id)
                            };
                        }
                    });
                }
            }

            return {
                ...state,
                habits: {
                    ...state.habits,
                    [id]: { ...oldHabit, ...updates }
                },
                skills: nextSkills
            };
        }
        case ACTIONS.UPDATE_HABIT_CONTENT: {
            const { id, notes, cards, chatHistory, chatLastUpdated } = action.payload;
            return {
                ...state,
                habits: {
                    ...state.habits,
                    [id]: {
                        ...state.habits[id],
                        notes: notes !== undefined ? notes : state.habits[id].notes,
                        cards: cards !== undefined ? cards : state.habits[id].cards,
                        chatHistory: chatHistory !== undefined ? chatHistory : state.habits[id].chatHistory,
                        chatLastUpdated: chatLastUpdated !== undefined ? chatLastUpdated : state.habits[id].chatLastUpdated
                    }
                }
            };
        }
        case ACTIONS.REVIEW_CARD: {
            const { habitId, folderId, cardId, rating } = action.payload; // rating: 'easy', 'good', 'hard', 'forgot'

            let cardSource;
            let sourceId;

            if (habitId) {
                cardSource = state.habits[habitId]?.cards || [];
                sourceId = habitId;
            } else if (folderId) {
                cardSource = state.flashcardFolders[folderId]?.cards || [];
                sourceId = folderId;
            }

            if (!cardSource) return state;

            const newCards = cardSource.map(card => {
                if (card.id !== cardId) return card;

                // SM2 Algorithm Refinement
                let { level = 0, easeFactor = 2.5, interval = 0 } = card;

                if (rating === 'forgot') {
                    level = 0;
                    interval = 1;
                    easeFactor = Math.max(1.3, easeFactor - 0.2);
                } else if (rating === 'hard') {
                    interval = Math.max(1, Math.floor(interval * 1.2));
                    easeFactor = Math.max(1.3, easeFactor - 0.15);
                } else if (rating === 'good') {
                    if (level === 0) interval = 1;
                    else if (level === 1) interval = 6;
                    else interval = Math.round(interval * easeFactor);
                    level += 1;
                } else if (rating === 'easy') {
                    if (level === 0) interval = 4;
                    else interval = Math.round(interval * easeFactor * 1.3);
                    level += 1;
                    easeFactor += 0.15;
                }

                const nextReview = new Date();
                nextReview.setDate(nextReview.getDate() + interval);

                return {
                    ...card,
                    level,
                    easeFactor,
                    interval,
                    nextReview: nextReview.toISOString(),
                    lastReviewed: new Date().toISOString()
                };
            });

            if (habitId) {
                return {
                    ...state,
                    habits: {
                        ...state.habits,
                        [habitId]: { ...state.habits[habitId], cards: newCards }
                    }
                };
            } else {
                return {
                    ...state,
                    flashcardFolders: {
                        ...state.flashcardFolders,
                        [folderId]: { ...state.flashcardFolders[folderId], cards: newCards }
                    }
                };
            }
        }
        case ACTIONS.ADD_FLASHCARD_FOLDER: {
            const { id, skillId, name } = action.payload;
            return {
                ...state,
                flashcardFolders: {
                    ...state.flashcardFolders,
                    [id]: { id, skillId, name, cards: [] }
                }
            };
        }
        case ACTIONS.DELETE_FLASHCARD_FOLDER: {
            const newFolders = { ...state.flashcardFolders };
            delete newFolders[action.payload.id];
            return { ...state, flashcardFolders: newFolders };
        }
        case ACTIONS.UPDATE_FLASHCARD_FOLDER: {
            const { id, updates } = action.payload;
            return {
                ...state,
                flashcardFolders: {
                    ...state.flashcardFolders,
                    [id]: { ...state.flashcardFolders[id], ...updates }
                }
            };
        }
        case ACTIONS.ADD_FLASHCARD_TO_FOLDER: {
            const { folderId, card } = action.payload;
            const folder = state.flashcardFolders[folderId];
            if (!folder) return state;
            return {
                ...state,
                flashcardFolders: {
                    ...state.flashcardFolders,
                    [folderId]: {
                        ...folder,
                        cards: [card, ...(folder.cards || [])]
                    }
                }
            };
        }
        case ACTIONS.DELETE_FLASHCARD_FROM_FOLDER: {
            const { folderId, cardId } = action.payload;
            const folder = state.flashcardFolders[folderId];
            if (!folder) return state;
            return {
                ...state,
                flashcardFolders: {
                    ...state.flashcardFolders,
                    [folderId]: {
                        ...folder,
                        cards: folder.cards.filter(c => c.id !== cardId)
                    }
                }
            };
        }
        case ACTIONS.MOVE_FLASHCARD: {
            const { cardId, fromHabitId, fromFolderId, toHabitId, toFolderId } = action.payload;
            let card;
            let newState = { ...state };

            // 1. Extract card
            if (fromHabitId) {
                const habit = state.habits[fromHabitId];
                card = habit.cards.find(c => c.id === cardId);
                newState.habits[fromHabitId] = {
                    ...habit,
                    cards: habit.cards.filter(c => c.id !== cardId)
                };
            } else if (fromFolderId) {
                const folder = state.flashcardFolders[fromFolderId];
                card = folder.cards.find(c => c.id === cardId);
                newState.flashcardFolders[fromFolderId] = {
                    ...folder,
                    cards: folder.cards.filter(c => c.id !== cardId)
                };
            }

            if (!card) return state;

            // 2. Insert card
            if (toHabitId) {
                const habit = newState.habits[toHabitId];
                newState.habits[toHabitId] = {
                    ...habit,
                    cards: [card, ...(habit.cards || [])]
                };
            } else if (toFolderId) {
                const folder = newState.flashcardFolders[toFolderId];
                newState.flashcardFolders[toFolderId] = {
                    ...folder,
                    cards: [card, ...(folder.cards || [])]
                };
            }

            return newState;
        }
        case ACTIONS.TOGGLE_HABIT: {
            const { id, date } = action.payload;
            const habit = state.habits[id];

            // Handle legacy boolean vs new number count
            const currentVal = habit.history[date];
            const currentCount = currentVal === true ? 1 : (Number(currentVal) || 0);

            const target = habit.targetDailyCount || 1;
            const newCount = (currentCount + 1) % (target + 1);

            const isCompletedNow = newCount >= target; // Fully complete for currency?
            // Actually, maybe we reward per increment? Or only full completion?
            // Previous logic: +5 for complete, -5 for incomplete.
            // Let's keep it simple: Reward only on FULL completion (when hitting target). 
            // If cycling from Target -> 0, subtract reward.
            // If cycling from 0 -> 1 (and target is 2), maybe small reward? 
            // For now, let's replicate simpler binary reward behavior: 
            // If we just hit Target, +5. If we just dropped from Target, -5.

            const wasCompleted = currentCount >= target;
            const willBeCompleted = newCount >= target;

            const newHistory = { ...habit.history };
            if (newCount > 0) {
                newHistory[date] = newCount;
            } else {
                delete newHistory[date];
            }

            let currencyChange = 0;
            if (!wasCompleted && willBeCompleted) {
                currencyChange = 5;
            }
            if (wasCompleted && !willBeCompleted) currencyChange = -5;

            return {
                ...state,
                habits: {
                    ...state.habits,
                    [id]: {
                        ...habit,
                        history: newHistory,
                        stabilityScore: (!wasCompleted && willBeCompleted)
                            ? (habit.stabilityScore || 0) + 1
                            : habit.stabilityScore
                    }
                },
                currency: state.currency + currencyChange,
                logs: [
                    ...(state.logs || []),
                    {
                        id: generateId(),
                        type: 'HABIT_TOGGLED',
                        habitId: id,
                        habitName: habit.name,
                        date: date,
                        isCompleted: isCompletedNow,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        }
        case ACTIONS.INCREMENT_HABIT_INTEGRATION: {
            const { id } = action.payload;
            const habit = state.habits[id];
            if (!habit) return state;

            const nextLevel = Math.min((habit.integrationLevel || 0) + 1, 3);
            const isNowBaseline = nextLevel === 3;

            return {
                ...state,
                habits: {
                    ...state.habits,
                    [id]: {
                        ...habit,
                        integrationLevel: nextLevel,
                        stabilityScore: 0, // Reset for next phase challenge
                        category: isNowBaseline ? 'baseline' : habit.category
                    }
                }
            };
        }
        case ACTIONS.ADD_REWARD: {
            const { id, name, cost } = action.payload;
            return {
                ...state,
                rewards: {
                    ...state.rewards,
                    [id]: { id, name, cost }
                }
            };
        }
        case ACTIONS.DELETE_REWARD: {
            const { id } = action.payload;
            const newRewards = { ...state.rewards };
            delete newRewards[id];
            return { ...state, rewards: newRewards };
        }
        case ACTIONS.UPDATE_REWARD: {
            const { id, updates } = action.payload;
            return {
                ...state,
                rewards: {
                    ...state.rewards,
                    [id]: { ...state.rewards[id], ...updates }
                }
            };
        }
        case ACTIONS.REORDER_REWARDS: {
            const orderedIds = action.payload;
            const updatedRewards = { ...state.rewards };
            orderedIds.forEach((id, index) => {
                if (updatedRewards[id]) {
                    updatedRewards[id] = { ...updatedRewards[id], order: index };
                }
            });
            return { ...state, rewards: updatedRewards };
        }
        case ACTIONS.REDEEM_REWARD: {
            const { id, cost } = action.payload; // Fix: Destructure id too (need to verify dispatch sends it)
            if (state.currency < cost) return state;
            const rewardName = state.rewards[id]?.name || 'Unknown Reward';

            return {
                ...state,
                currency: state.currency - cost,
                logs: [
                    ...(state.logs || []),
                    {
                        id: generateId(),
                        type: 'REWARD_REDEEMED',
                        rewardId: id,
                        rewardName: rewardName,
                        cost: cost,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        }
        case ACTIONS.REORDER_HABITS: {
            // Payload can be either an array (legacy) or { areaId, habitIds }
            const orderedIds = Array.isArray(action.payload) ? action.payload : action.payload.habitIds;
            if (!orderedIds || !Array.isArray(orderedIds)) return state;

            const updatedHabits = { ...state.habits };
            orderedIds.forEach((id, index) => {
                if (updatedHabits[id]) {
                    updatedHabits[id] = { ...updatedHabits[id], order: index };
                }
            });
            return { ...state, habits: updatedHabits };
        }
        case ACTIONS.UPDATE_JOURNAL: {
            const { date, entry } = action.payload;
            return {
                ...state,
                journal: {
                    ...state.journal,
                    [date]: { ...(state.journal[date] || {}), ...entry }
                },
                logs: [
                    ...(state.logs || []),
                    {
                        id: generateId(),
                        type: 'JOURNAL_UPDATED',
                        date: date,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        }
        case ACTIONS.UPDATE_BACKGROUND: {
            const { path, url } = action.payload;

            if (state.themeMode === 'light') {
                const newBackgroundsLight = { ...state.backgroundsLight };
                if (url === null) delete newBackgroundsLight[path];
                else newBackgroundsLight[path] = url;
                return { ...state, backgroundsLight: newBackgroundsLight };
            } else {
                const newBackgrounds = { ...state.backgrounds };
                if (url === null) delete newBackgrounds[path];
                else newBackgrounds[path] = url;
                return { ...state, backgrounds: newBackgrounds };
            }
        }
        case ACTIONS.UPDATE_USER_PROFILE: {
            return {
                ...state,
                userProfile: {
                    ...state.userProfile,
                    ...action.payload
                }
            };
        }
        case ACTIONS.ADD_AVAILABLE_MED: {
            const { med } = action.payload;
            if (state.availableMeds.includes(med)) return state;
            return {
                ...state,
                availableMeds: [...state.availableMeds, med]

            };
        }
        case ACTIONS.SET_LOGGING_SATS: {
            return {
                ...state,
                activeLoggingSats: action.payload // { type, id, habitId } or null
            };
        }
        case ACTIONS.UPDATE_TRACKER: {
            const { id, updates } = action.payload;
            return {
                ...state,
                trackers: {
                    ...state.trackers,
                    [id]: { ...state.trackers[id], ...updates }
                }
            };
        }
        case ACTIONS.ADD_TRACKER: {
            const { id, name, icon, path } = action.payload;
            return {
                ...state,
                trackers: {
                    ...state.trackers,
                    [id]: { id, name, icon, path }
                }
            };
        }
        case ACTIONS.DELETE_TRACKER: {
            const { id } = action.payload;
            const newTrackers = { ...state.trackers };
            delete newTrackers[id];
            return { ...state, trackers: newTrackers };
        }
        case ACTIONS.ADD_WEALTH_ITEM: {
            const { id, category, name, monthlyPayment, skillId, oneTime } = action.payload;
            return {
                ...state,
                wealthItems: {
                    ...state.wealthItems,
                    [id]: {
                        id,
                        category,
                        name,
                        monthlyPayment: Number(monthlyPayment) || 0,
                        skillId,
                        oneTime: !!oneTime,
                        createdAt: new Date().toISOString()
                    }
                }
            };
        }
        case ACTIONS.DELETE_WEALTH_ITEM: {
            const { id } = action.payload;
            const newWealthItems = { ...state.wealthItems };
            delete newWealthItems[id];
            return { ...state, wealthItems: newWealthItems };
        }
        case ACTIONS.UPDATE_WEALTH_ITEM: {
            const { id, updates } = action.payload;
            return {
                ...state,
                wealthItems: {
                    ...state.wealthItems,
                    [id]: { ...state.wealthItems[id], ...updates }
                }
            };
        }
        case ACTIONS.ADD_BELIEF: {
            const { id } = action.payload;
            return {
                ...state,
                beliefs: {
                    ...state.beliefs,
                    [id]: {
                        id,
                        statement: '',
                        scene: '',
                        topic: 'General / Other',
                        mentalDietApproach: 'subconscious-guide', // A/B testing: conscious-shift vs subconscious-guide
                        sessions: [],
                        status: 'not-started',
                        taskIds: [], // New: Tasks for this belief
                        mentalDiet: '',
                        uncommonEvents: [],
                        createdAt: new Date().toISOString()
                    }
                }
            };
        }
        case ACTIONS.ADD_BELIEF_TASK: {
            const { id, beliefId, title } = action.payload;
            const belief = state.beliefs[beliefId];
            if (!belief) return state;

            return {
                ...state,
                tasks: {
                    ...state.tasks,
                    [id]: {
                        id, beliefId, title,
                        isCompleted: false,
                        rewardValue: 10,
                        difficulty: 'Trivial',
                        growthType: 'Financial',
                        status: 'not-started',
                        totalInProgressTime: 0,
                        lastStartedAt: null
                    }
                },
                beliefs: {
                    ...state.beliefs,
                    [beliefId]: {
                        ...belief,
                        taskIds: [...(belief.taskIds || []), id]
                    }
                }
            };
        }
        case ACTIONS.DELETE_BELIEF_TASK: {
            const { id, beliefId } = action.payload;
            const newTasks = { ...state.tasks };
            delete newTasks[id];

            const belief = state.beliefs[beliefId];
            if (!belief) return { ...state, tasks: newTasks };

            return {
                ...state,
                tasks: newTasks,
                beliefs: {
                    ...state.beliefs,
                    [beliefId]: {
                        ...belief,
                        taskIds: (belief.taskIds || []).filter(tid => tid !== id)
                    }
                }
            };
        }
        case ACTIONS.DELETE_BELIEF: {
            const { id } = action.payload;
            const newBeliefs = { ...state.beliefs };
            delete newBeliefs[id];
            return { ...state, beliefs: newBeliefs };
        }
        case ACTIONS.UPDATE_BELIEF: {
            const { id, updates } = action.payload;
            return {
                ...state,
                beliefs: {
                    ...state.beliefs,
                    [id]: { ...state.beliefs[id], ...updates }
                }
            };
        }
        case ACTIONS.ADD_SATS_SESSION: {
            const { beliefId, session } = action.payload;
            const belief = state.beliefs[beliefId];
            if (!belief) return state;

            return {
                ...state,
                beliefs: {
                    ...state.beliefs,
                    [beliefId]: {
                        ...belief,
                        sessions: [...(belief.sessions || []), session]
                    }
                }
            };
        }
        case ACTIONS.ADD_BELIEF_TOPIC: {
            const { id, name, emoji, color } = action.payload;
            return {
                ...state,
                beliefTopics: {
                    ...state.beliefTopics,
                    [id]: { id, name, emoji, color }
                }
            };
        }
        case ACTIONS.DELETE_BELIEF_TOPIC: {
            const { id } = action.payload;
            const newTopics = { ...state.beliefTopics };
            delete newTopics[id];
            return {
                ...state,
                beliefTopics: newTopics
            };
        }
        case ACTIONS.UPDATE_BELIEF_TOPIC: {
            const { id, updates } = action.payload;
            return {
                ...state,
                beliefTopics: {
                    ...state.beliefTopics,
                    [id]: { ...state.beliefTopics[id], ...updates }
                }
            };
        }
        case ACTIONS.ADD_MANIFESTATION: {
            const { id, target } = action.payload;
            return {
                ...state,
                manifestations: {
                    ...state.manifestations,
                    [id]: {
                        id,
                        target,
                        status: 'waiting', // 'active', 'materialized', 'stalled', 'failed', 'waiting'
                        startDate: new Date().toISOString(),
                        method: 'visualizing',
                        naturalness: 5, // 1-10
                        resistance: 5, // 1-10
                        frequency: 0,
                        vividness: 5, // 1-10
                        bridgeMarkers: [],
                        sessions: [], // Array of session logs
                        createdAt: new Date().toISOString()
                    }
                }
            };
        }
        case ACTIONS.DELETE_MANIFESTATION: {
            const { id } = action.payload;
            const newManifestations = { ...state.manifestations };
            delete newManifestations[id];
            return { ...state, manifestations: newManifestations };
        }
        case ACTIONS.UPDATE_MANIFESTATION: {
            const { id, updates } = action.payload;
            return {
                ...state,
                manifestations: {
                    ...state.manifestations,
                    [id]: { ...state.manifestations[id], ...updates }
                }
            };
        }
        case ACTIONS.ADD_MANIFESTATION_SESSION: {
            const { manifestationId, session } = action.payload;
            const manifestation = state.manifestations[manifestationId];
            if (!manifestation) return state;

            // Update frequency and average stats automatically based on new session
            const currentSessions = manifestation.sessions || [];
            const newSessions = [...currentSessions, session];

            // Recalculate averages for the main view
            const avgVividness = Math.round(newSessions.reduce((acc, s) => acc + (s.vividness || 0), 0) / newSessions.length);
            const avgResistance = Math.round(newSessions.reduce((acc, s) => acc + (s.resistance || 0), 0) / newSessions.length);
            const avgImportance = Math.round(newSessions.reduce((acc, s) => acc + (s.importance || 0), 0) / newSessions.length);

            return {
                ...state,
                manifestations: {
                    ...state.manifestations,
                    [manifestationId]: {
                        ...manifestation,
                        sessions: newSessions,
                        frequency: (manifestation.frequency || 0) + 1,
                        vividness: avgVividness || manifestation.vividness,
                        resistance: avgResistance || manifestation.resistance,
                        importance: avgImportance || manifestation.importance || 5
                    }
                }
            };
        }


        case ACTIONS.ADD_DESIRE: {
            const { id, text } = action.payload;
            return {
                ...state,
                desires: {
                    ...(state.desires || {}), // Robustness fix for undefined state
                    [id]: {
                        id,
                        targetDescription: text, // Consistent naming with Manifestation
                        createdAt: new Date().toISOString(),
                        sessions: [],
                        vividness: 0,
                        resistance: 0,
                        importance: 0,
                        frequency: 0,
                        status: 'waiting'
                    }
                }
            };
        }
        case ACTIONS.UPDATE_DESIRE: {
            const { id, updates } = action.payload;
            return {
                ...state,
                desires: {
                    ...state.desires,
                    [id]: { ...state.desires[id], ...updates }
                }
            };
        }
        case ACTIONS.DELETE_DESIRE: {
            const newDesires = { ...state.desires };
            delete newDesires[action.payload];
            return { ...state, desires: newDesires };
        }
        case ACTIONS.ADD_DESIRE_SESSION: {
            const { desireId, session } = action.payload;
            const desire = state.desires[desireId];
            if (!desire) return state;

            const updatedSessions = [...(desire.sessions || []), session];

            // Calculate averages
            const avgViv = Math.round(updatedSessions.reduce((acc, s) => acc + s.vividness, 0) / updatedSessions.length);
            const avgRes = Math.round(updatedSessions.reduce((acc, s) => acc + s.resistance, 0) / updatedSessions.length);
            const avgImp = Math.round(updatedSessions.reduce((acc, s) => acc + s.importance, 0) / updatedSessions.length);

            return {
                ...state,
                desires: {
                    ...state.desires,
                    [desireId]: {
                        ...desire,
                        sessions: updatedSessions,
                        frequency: updatedSessions.length,
                        vividness: avgViv,
                        resistance: avgRes,
                        importance: avgImp
                    }
                }
            };
        }

        case ACTIONS.ADD_DESIRE_TASK: {
            const { id, desireId, title } = action.payload;
            const desire = state.desires[desireId];
            if (!desire) return state;

            return {
                ...state,
                tasks: {
                    ...state.tasks,
                    [id]: {
                        id, desireId, title,
                        isCompleted: false,
                        rewardValue: 10,
                        difficulty: 'Trivial',
                        growthType: 'Financial',
                        status: 'not-started',
                        totalInProgressTime: 0,
                        lastStartedAt: null
                    }
                },
                desires: {
                    ...state.desires,
                    [desireId]: {
                        ...desire,
                        taskIds: [...(desire.taskIds || []), id]
                    }
                }
            };
        }
        case ACTIONS.DELETE_DESIRE_TASK: {
            const { id, desireId } = action.payload;
            const newTasks = { ...state.tasks };
            delete newTasks[id];
            return {
                ...state,
                tasks: newTasks,
                desires: {
                    ...state.desires,
                    [desireId]: {
                        ...state.desires[desireId],
                        taskIds: (state.desires[desireId]?.taskIds || []).filter(taskId => taskId !== id)
                    }
                }
            };
        }

        case ACTIONS.ADD_TIME_BLOCK: {
            const { id, areaId, title } = action.payload;
            return {
                ...state,
                timeBlocks: {
                    ...state.timeBlocks,
                    [id]: {
                        id, areaId, title,
                        scheduledDate: action.payload.scheduledDate || null,
                        startTime: action.payload.startTime || null,
                        duration: action.payload.duration || 60,
                        habitIds: action.payload.habitIds || [],
                        taskIds: action.payload.taskIds || []
                    }
                }
            };
        }
        case ACTIONS.DELETE_TIME_BLOCK: {
            const newTimeBlocks = { ...state.timeBlocks };
            delete newTimeBlocks[action.payload.id];
            return { ...state, timeBlocks: newTimeBlocks };
        }
        case ACTIONS.UPDATE_TIME_BLOCK: {
            const { id, updates } = action.payload;
            return {
                ...state,
                timeBlocks: {
                    ...state.timeBlocks,
                    [id]: { ...state.timeBlocks[id], ...updates }
                }
            };
        }
        case ACTIONS.UPDATE_ROUTINE_TEMPLATE: {
            const { dayType, blocks } = action.payload; // dayType: 'work1', 'work2', 'light'
            return {
                ...state,
                routineTemplates: {
                    ...state.routineTemplates,
                    [dayType]: blocks
                }
            };
        }
        case 'SET_LAST_ROUTINE_SYNC': {
            return {
                ...state,
                lastRoutineSyncDate: action.payload
            };
        }

        case 'SYSTEM_ADD_LOGS': {
            return {
                ...state,
                logs: [...(state.logs || []), ...action.payload]
            };
        }

        default:
            return state;
    }
}


const StoreContext = createContext();

export function StoreProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Load from LocalStorage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('tomato-app-data');
        if (savedData) {
            try {
                const parsedState = JSON.parse(savedData);
                dispatch({ type: ACTIONS.LOAD_STATE, payload: parsedState });
            } catch (e) {
                console.error("Failed to load state", e);
                dispatch({ type: ACTIONS.SET_LOADED });
            }
        } else {
            dispatch({ type: ACTIONS.SET_LOADED });
        }
    }, []);
    // WE DO NOT WANT TO RUN THIS AGAIN AND AGAIN, so dependency array is empty.
    // However, fast refresh might trigger it.Ideally this logic is idempotent. 
    // Since we delete the duplicate, running it again finds nothing, which is fine.

    // Save to LocalStorage on change (Debounced to improve performance)
    useEffect(() => {
        if (!state.isLoaded) return;
        const timeoutId = setTimeout(() => {
            const json = JSON.stringify(state);
            localStorage.setItem('tomato-app-data', json);
        }, 1000); // 1s debounce
        return () => clearTimeout(timeoutId);
    }, [state]);

    // --- ROUTINE GENERATION ---
    useEffect(() => {
        if (state.isLoaded) {
            runMaintenanceSync();
        }
    }, [state.isLoaded, state.lastRoutineSyncDate]);

    // --- SUPABASE SYNC LOGIC ---

    // 1. Listen for Auth Changes & Pull Data
    const isCloudChecked = useRef(false); // New: Prevention for "Empty Overwrite" race condition
    useEffect(() => {
        const checkInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                fetchCloudData(session.user.id);
            } else {
                dispatch({ type: ACTIONS.SET_LOADED });
            }
        };

        const fetchCloudData = async (userId) => {
            try {
                const { data, error } = await supabase
                    .from('user_data')
                    .select('content')
                    .eq('id', userId)
                    .single();

                if (data && data.content) {
                    // console.log("Loaded data from Supabase Cloud");
                    dispatch({ type: ACTIONS.LOAD_STATE, payload: data.content });

                    // Safety: Update our reference count so we know what a "healthy" state looks like
                    previousTaskCountRef.current = Object.keys(data.content.tasks || {}).length;

                    // Daily Backup Check (4 AM Split)
                    checkAndCreateDailyBackup(userId, data.content);
                } else {
                    dispatch({ type: ACTIONS.SET_LOADED });
                }
            } catch (err) {
                console.error("Error fetching cloud data:", err);
                dispatch({ type: ACTIONS.SET_LOADED });
            } finally {
                // Critical: Allow saving only AFTER we've attempted to fetch cloud data
                isCloudChecked.current = true;
            }
        };

        checkInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                fetchCloudData(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Auto-Save to Supabase (Debounced)
    const previousTaskCountRef = useRef(0);

    // Helper: Logic to ensure one backup per 'Logical Day' (split at 4 AM)
    const checkAndCreateDailyBackup = async (userId, content) => {
        try {
            // Calculate Logical Date (Day ends at 4 AM)
            // FIXED: Use getTodayString() which respects the 4AM offset naturally
            const logicalDateStr = getTodayString();

            // Check local storage so we don't ping Supabase unnecessarily
            const lastBackup = localStorage.getItem('last-daily-backup-date');
            if (lastBackup === logicalDateStr) return; // Already backed up today

            await supabase
                .from('user_backups')
                .insert({
                    user_id: userId,
                    content: content,
                    backup_type: 'daily',
                    created_at: new Date().toISOString()
                });

            localStorage.setItem('last-daily-backup-date', logicalDateStr);
            // console.log(`🛡️ Daily Backup Created for Logical Day: ${logicalDateStr}`);
        } catch (e) {
            console.warn("Could not save daily backup:", e.message);
        }
    };

    // Helper: Validate State Integrity (Backend Hardening)
    const validateState = (data) => {
        if (!data) return false;
        if (typeof data !== 'object') return false;
        // Ensure critical data structures exist
        if (!data.tasks || typeof data.tasks !== 'object') return false;
        if (!data.areas || typeof data.areas !== 'object') return false;
        if (!data.skills || typeof data.skills !== 'object') return false;
        return true;
    };

    // Helper: Hard-copy persistence to project folder
    const saveToLocalFolder = async (content) => {
        try {
            await fetch('/api/save-local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(content)
            });
        } catch (e) {
            // Silently ignore if not in dev mode or server not responding
        }
    };

    // 2. Hybrid Sync Logic (Auto-Save + Manual Trigger)

    // Core Save Function (Hoisted for Hybrid use)
    const saveToCloud = async (stateToSave) => {
        // Safety: Don't save if we haven't checked cloud yet (Race Condition Fix)
        if (!isCloudChecked.current) return;

        // Safety 2: Integrity Validation
        if (!validateState(stateToSave)) {
            console.error("🛑 BLOCKED SAVE: State integrity check failed. Data is malformed.");
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const currentTaskCount = Object.keys(stateToSave.tasks || {}).length;
            const prevCount = previousTaskCountRef.current;

            // SAFETY CHECK 1: Don't overwrite cloud with empty state
            if (currentTaskCount === 0 && prevCount > 0) {
                console.error("🛑 BLOCKED SAVE: Use attempted to save empty state over existing data!");
                return;
            }

            // SAFETY CHECK 2: Data Shrink Alarm
            if (prevCount > 15 && currentTaskCount < prevCount * 0.7) {
                console.warn(`⚠️ SIGNIFICANT DATA SHRINK: Task count dropped from ${prevCount} to ${currentTaskCount}.`);
            }

            await supabase
                .from('user_data')
                .upsert({
                    id: session.user.id,
                    content: stateToSave,
                    updated_at: new Date().toISOString()
                });

            // console.log(`☁️ Synced to cloud. Tasks: ${currentTaskCount}`);
            previousTaskCountRef.current = currentTaskCount;

            // NEW: Also save a hard copy to the project folder
            saveToLocalFolder(stateToSave);
        }
    };

    // A: Auto-Save (Debounced - 2s for text/general)
    useEffect(() => {
        if (!state.isLoaded) return;
        const timeoutId = setTimeout(() => saveToCloud(state), 2000);
        return () => clearTimeout(timeoutId);
    }, [state]);

    // B: Manual Save Trigger (Instant for critical actions)
    useEffect(() => {
        if (!state.isLoaded || state.manualSavePing === 0) return;
        console.log("🚀 FORCE SAVE executing...");
        saveToCloud(state);
    }, [state.manualSavePing]);

    // Migration: Fix Language Tasks Missing skillId
    const hasFixedLanguageTasksRef = useRef(false);
    useEffect(() => {
        if (hasFixedLanguageTasksRef.current) return;
        if (Object.keys(state.tasks || {}).length === 0) return;

        const languagesArea = Object.values(state.areas || {}).find(a => a.name === 'Languages');
        if (!languagesArea || !languagesArea.skillIds || languagesArea.skillIds.length === 0) return;

        hasFixedLanguageTasksRef.current = true;

        // Get the first language skill as default
        const defaultLanguageSkill = languagesArea.skillIds[0];
        const russianSkillId = 'bf38b618-2d38-499a-8687-542c12a15340';
        const russianObjectiveIds = ['d15cf770-7cd1-469e-bdcb-910d7bfd01ae', 'b7302c6f-cfa5-44cc-bc4e-073167dc594f'];

        // 1. Find all tasks with activityTypes but no skillId (Standard Migration)
        const tasksToFix = Object.values(state.tasks || {}).filter(task =>
            task.activityTypes &&
            task.activityTypes.length > 0 &&
            !task.skillId
        );

        if (tasksToFix.length > 0) {
            tasksToFix.forEach(task => {
                let skillIdToUse = defaultLanguageSkill;
                if (task.objectiveId && state.objectives[task.objectiveId]) {
                    skillIdToUse = state.objectives[task.objectiveId].skillId;
                }
                dispatch({
                    type: ACTIONS.UPDATE_TASK,
                    payload: { id: task.id, updates: { skillId: skillIdToUse } }
                });
            });
        }

        // 2. One-time recovery for Russian tasks that were moved to Arabic or Stocks
        Object.values(state.tasks || {}).forEach(task => {
            if (task.objectiveId && russianObjectiveIds.includes(task.objectiveId) && task.skillId !== russianSkillId) {
                console.log(`🚑 Recovering Russian task: ${task.title}`);
                dispatch({
                    type: ACTIONS.UPDATE_TASK,
                    payload: { id: task.id, updates: { skillId: russianSkillId } }
                });
            }
        });
    }, [state.tasks, state.areas, state.objectives]);

    // Migration: Remove Food Tracker (Requested by User)
    const hasRemovedFoodTrackerRef = useRef(false);
    useEffect(() => {
        if (hasRemovedFoodTrackerRef.current) return;
        if (!state.trackers || !state.trackers.food) return;

        hasRemovedFoodTrackerRef.current = true;
        console.log("🧹 removing deprecated 'Food' tracker...");

        dispatch({
            type: ACTIONS.DELETE_TRACKER,
            payload: { id: 'food' }
        });
    }, [state.trackers]);

    // Migration: Recover Missing Task Logs (Retroactive Fix)
    const hasRecoveredLogsRef = useRef(false);
    useEffect(() => {
        if (!state.isLoaded || hasRecoveredLogsRef.current) return;
        const logs = state.logs || [];
        const tasks = Object.values(state.tasks || {});

        const completedTasks = tasks.filter(t => t.isCompleted && t.completedAt);
        let recoveredCount = 0;
        const newLogs = [];

        completedTasks.forEach(task => {
            // Check if ANY log exists for this task
            const hasLog = logs.some(l => l.taskId === task.id);

            if (!hasLog) {
                // Create a retroactive log
                // If it was completed today, use the actual time if possible (but we only have date usually)
                // If we don't have exact time, default to 12:00 PM on that date
                console.log(`🩹 Recovering log for task: ${task.title}`);
                newLogs.push({
                    id: generateId(),
                    type: 'TASK_TOGGLED',
                    taskId: task.id,
                    taskTitle: task.title,
                    isCompleted: true,
                    timestamp: task.completedAt.includes('T') ? task.completedAt : `${task.completedAt}T12:00:00.000Z`,
                    sessionDuration: 0 // No timer data, but at least it counts completion
                });
                recoveredCount++;
            }
        });

        if (recoveredCount > 0) {
            hasRecoveredLogsRef.current = true;
            console.log(`✅ Retroactively recovered ${recoveredCount} missing task logs.`);
            // We can't dispatch logs directly via a specific action usually, 
            // but we can use a generic patch or maybe I should add a RECOVER_LOGS action?
            // Or just use UPDATE_TASK which triggers a save, but that doesn't add a log.
            // Wait, I need an action to ADD LOGS specifically or generic UPDATE_STATE.
            // Let's use a "System Update" dispatch.
            dispatch({
                type: 'SYSTEM_ADD_LOGS', // I need to handle this in reducer, or just hijack an existing one.
                payload: newLogs
            });
        }
    }, [state.isLoaded, state.tasks, state.logs]);

    // Migration: Initialize Area Order & Set Requested Order
    const hasOrderedAreasRef = useRef(false);
    useEffect(() => {
        if (!state.isLoaded || hasOrderedAreasRef.current) return;
        const areas = Object.values(state.areas);
        if (areas.length === 0) return;

        hasOrderedAreasRef.current = true;

        let newOrder = [...state.areaOrder];

        // 1. Initialize if empty
        if (newOrder.length === 0) {
            console.log("🔧 Initializing areaOrder from existing areas...");
            newOrder = areas.map(a => a.id);
        }

        // 2. Set user requested order: Finance, Languages, Spiritual, Hot Body
        const requestedNames = ['Finance', 'Languages', 'Spiritual', 'Hot Body'];
        const orderedIds = [];

        // Find existing areas by name
        requestedNames.forEach(name => {
            const area = areas.find(a => a.name.toLowerCase() === name.toLowerCase());
            if (area) orderedIds.push(area.id);
        });

        // Add any other areas not in the list
        areas.forEach(a => {
            if (!orderedIds.includes(a.id)) orderedIds.push(a.id);
        });

        // Check if we need to update (simple shallow comparison)
        const currentOrderStr = state.areaOrder.join(',');
        const targetOrderStr = orderedIds.join(',');

        if (currentOrderStr !== targetOrderStr) {
            console.log("🔧 Applying requested area order:", requestedNames.join(' -> '));
            dispatch({ type: ACTIONS.REORDER_AREAS, payload: orderedIds });
        }
    }, [state.isLoaded, state.areas, state.areaOrder]);

    // Migration: Update Finance Skills (Warhead -> Due Diligence, Add Latte)
    useEffect(() => {
        if (!state.isLoaded || Object.keys(state.areas).length === 0) return;

        const financeArea = Object.values(state.areas).find(a => a.name === 'Finance');
        if (!financeArea) return;

        // 1. Rename Warhead to Due Diligence
        const warheadSkill = Object.values(state.skills).find(s => s.areaId === financeArea.id && s.name === 'Warhead');
        if (warheadSkill) {
            console.log("🔧 Renaming 'Warhead' skill to 'Due Diligence'...");
            dispatch({
                type: ACTIONS.UPDATE_SKILL,
                payload: { id: warheadSkill.id, updates: { name: 'Due Diligence' } }
            });
        }

        // 2. Add Latte if not exists (Idempotent check)
        // Check for 'Latte', 'Terminal' OR 'Notion replacement' to avoid duplicates
        const latteSkill = Object.values(state.skills).find(s => s.areaId === financeArea.id && (s.name === 'Latte' || s.name === 'Terminal' || s.name === 'Notion replacement'));

        // If 'Terminal' or 'Notion replacement' exists, rename it to 'Latte'
        const legacySkill = Object.values(state.skills).find(s => s.areaId === financeArea.id && (s.name === 'Terminal' || s.name === 'Notion replacement'));
        if (legacySkill) {
            console.log(`🔧 Renaming '${legacySkill.name}' to 'Latte'...`);
            dispatch({
                type: ACTIONS.UPDATE_SKILL,
                payload: { id: legacySkill.id, updates: { name: 'Latte', icon: '☕' } }
            });
            return; // Exit to let next render handle the rest
        }

        if (!latteSkill) {
            console.log("🔧 Adding 'Latte' skill to Finance...");
            const id = generateId();
            dispatch({
                type: ACTIONS.ADD_SKILL,
                payload: { id, areaId: financeArea.id, name: 'Latte', icon: '☕' }
            });
        }
    }, [state.isLoaded, state.areas, state.skills]);

    // Seeding & Cleanup: Deduplicate and Link Wellbeing Habits
    const hasSeededRef = useRef(false);
    useEffect(() => {
        if (hasSeededRef.current) return;
        if (Object.keys(state.areas).length === 0) return;

        hasSeededRef.current = true;

        const spiritualArea = Object.values(state.areas).find(a => a.name === 'Spiritual');
        if (spiritualArea) {
            let wellbeingSkill = spiritualArea.skillIds
                .map(id => state.skills[id])
                .find(s => s && s.name.toLowerCase().includes('wellbeing'));

            let wellbeingSkillId = wellbeingSkill?.id;
            if (!wellbeingSkillId) {
                wellbeingSkillId = generateId();
                dispatch({ type: ACTIONS.ADD_SKILL, payload: { id: wellbeingSkillId, areaId: spiritualArea.id, name: 'General Wellbeing', icon: '🍃' } });
            }

            // Define the canonical habits we want in Wellbeing
            const CONCEPTS = [
                { keyword: 'meds', name: 'Take my meds' },
                { keyword: 'water', name: 'Drink 1 yeti of water' },
                { keyword: 'bed', name: 'In bed at 10pm' },
                { keyword: 'phone', name: 'Avoid your phone until 10am' }, // Preferred name from screenshot
                { keyword: 'meals', name: '2-3 complete meals' }
            ];

            const allHabits = Object.values(state.habits);

            CONCEPTS.forEach(concept => {
                // Find all habits matching this concept
                const matches = allHabits.filter(h =>
                    h.name.toLowerCase().includes(concept.keyword) ||
                    concept.name.toLowerCase().includes(h.name.toLowerCase())
                );

                if (matches.length > 0) {
                    // Sort: Has Cover > No Cover
                    matches.sort((a, b) => {
                        const aHasCover = !!(a.cover || a.image);
                        const bHasCover = !!(b.cover || b.image);
                        if (aHasCover && !bHasCover) return -1;
                        if (!aHasCover && bHasCover) return 1;
                        return 0;
                    });

                    const bestHabit = matches[0];
                    const duplicates = matches.slice(1);

                    // 1. Link bestHabit to Wellbeing if not already
                    if (!bestHabit.skillIds || !bestHabit.skillIds.includes(wellbeingSkillId)) {
                        const newSkillIds = [...(bestHabit.skillIds || []), wellbeingSkillId];
                        dispatch({
                            type: ACTIONS.UPDATE_HABIT,
                            payload: { id: bestHabit.id, updates: { skillIds: newSkillIds } }
                        });
                    }

                    // 2. Remove duplicates
                    duplicates.forEach(dup => {
                        dispatch({ type: ACTIONS.DELETE_HABIT, payload: { id: dup.id } });
                    });

                } else {
                    // Create if absolutely none exist
                    const id = generateId();
                    dispatch({
                        type: ACTIONS.ADD_HABIT,
                        payload: {
                            id,
                            skillIds: [wellbeingSkillId],
                            name: concept.name,
                            category: 'integrating'
                        }
                    });
                }
            });
        }
    }, [state.areas, state.skills, state.habits]);

    // --- HYBRID SYNC HELPERS ---
    const forceSave = React.useCallback(() => {
        // console.log("💾 Manual Save Triggered");
        dispatch({ type: 'MANUAL_SAVE_TRIGGER' });
    }, []);

    const addArea = React.useCallback((name, icon = '🍅', color = 'var(--color-primary)') => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_AREA, payload: { id, name, icon, color } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteArea = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_AREA, payload: id });
        forceSave();
    }, [forceSave]);

    // UpdateArea not forced (usually text editing)
    const updateArea = React.useCallback((id, updates) => {
        dispatch({ type: ACTIONS.UPDATE_AREA, payload: { id, updates } });
    }, []);

    const addSkill = React.useCallback((areaId, name, icon = '🎯') => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_SKILL, payload: { id, areaId, name, icon } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteSkill = React.useCallback((id, areaId) => {
        dispatch({ type: ACTIONS.DELETE_SKILL, payload: { id, areaId } });
        forceSave();
    }, [forceSave]);

    const updateSkill = React.useCallback((id, updates) => {
        dispatch({ type: ACTIONS.UPDATE_SKILL, payload: { id, updates } });
    }, []);

    const reorderSkills = React.useCallback((areaId, skillIds) => {
        dispatch({ type: ACTIONS.REORDER_SKILLS, payload: { areaId, skillIds } });
        forceSave();
    }, [forceSave]);

    const addObjective = React.useCallback((skillId, title) => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_OBJECTIVE, payload: { id, skillId, title } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteObjective = React.useCallback((id, skillId) => {
        dispatch({ type: ACTIONS.DELETE_OBJECTIVE, payload: { id, skillId } });
        forceSave();
    }, [forceSave]);

    const updateObjective = React.useCallback((id, updates) => {
        dispatch({ type: ACTIONS.UPDATE_OBJECTIVE, payload: { id, updates } });
    }, []);

    // AddTask not forced (user might still be typing title elsewhere? No, usually explicitly added)
    // But title is often "New Task", so maybe wait.
    // Actually, creating a task is a distinct action. Let's force save.
    const addTask = React.useCallback((objectiveId, title, difficulty = 'Trivial', growthType = 'Financial') => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_TASK, payload: { id, objectiveId, title, difficulty, growthType } });
        forceSave();
        return id;
    }, [forceSave]);

    const updateTask = React.useCallback((id, updates) => {
        dispatch({ type: ACTIONS.UPDATE_TASK, payload: { id, updates } });
        // updateTask is used for typing titles, so NO forceSave here.
    }, []);

    const deleteTask = React.useCallback((id, objectiveId) => {
        dispatch({ type: ACTIONS.DELETE_TASK, payload: { id, objectiveId } });
        forceSave();
    }, [forceSave]);

    const toggleTask = React.useCallback((id, date) => {
        const d = date || getTodayString();
        dispatch({ type: ACTIONS.TOGGLE_TASK, payload: { id, date: d } });
        forceSave();
    }, [forceSave]);

    const addHabit = React.useCallback((skillIds, name, category = 'integrating') => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_HABIT, payload: { id, skillIds, name, category } });
        forceSave();
    }, [forceSave]);

    const deleteHabit = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_HABIT, payload: { id } });
        forceSave();
    }, [forceSave]);

    const addWarheadNotification = React.useCallback((text) => {
        const savedData = localStorage.getItem('tomato-app-data');
        if (!savedData) return;
        try {
            const parsedState = JSON.parse(savedData);
            const sessionId = parsedState.activeSessionId || Object.keys(parsedState.chatSessions || {})[0];

            if (sessionId) {
                const message = {
                    id: generateId(),
                    role: 'assistant',
                    content: text,
                    timestamp: new Date().toISOString(),
                    isNotification: true
                };
                dispatch({ type: ACTIONS.ADD_MESSAGE_TO_SESSION, payload: { sessionId, message } });
            }
        } catch (e) { }
    }, []);

    const toggleHabit = React.useCallback((id, date) => {
        const habit = state.habits[id];
        if (habit) {
            const target = habit.targetDailyCount || 1;
            const currentVal = habit.history[date];
            const currentCount = currentVal === true ? 1 : (Number(currentVal) || 0);
            const wasCompleted = currentCount >= target;
            const newCount = (currentCount + 1) % (target + 1);
            const willBeCompleted = newCount >= target;

            if (!wasCompleted && willBeCompleted) {
                const nextStability = (habit.stabilityScore || 0) + 1;
                const level = habit.integrationLevel || 0;
                const targets = [7, 14, 21];
                const currentTarget = targets[level] || 7;

                if (nextStability === currentTarget && level < 3) {
                    addWarheadNotification(`Intriguing progress on "${habit.name}". Stage stability reached at ${currentTarget} days. Ready to level up.`);
                }
            }
        }
        dispatch({ type: ACTIONS.TOGGLE_HABIT, payload: { id, date } });
        forceSave();
    }, [state.habits, addWarheadNotification, forceSave]);

    const updateHabit = React.useCallback((id, updates) => {
        dispatch({ type: ACTIONS.UPDATE_HABIT, payload: { id, updates } });
    }, []);

    const addReward = React.useCallback((name, cost) => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_REWARD, payload: { id, name, cost } });
        forceSave();
    }, [forceSave]);

    const deleteReward = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_REWARD, payload: { id } });
        forceSave();
    }, [forceSave]);

    const updateReward = React.useCallback((id, updates) => {
        dispatch({ type: ACTIONS.UPDATE_REWARD, payload: { id, updates } });
    }, []);

    const reorderRewards = React.useCallback((orderedIds) => {
        dispatch({ type: ACTIONS.REORDER_REWARDS, payload: orderedIds });
        forceSave();
    }, [forceSave]);

    const redeemReward = React.useCallback((id, cost) => {
        dispatch({ type: ACTIONS.REDEEM_REWARD, payload: { id, cost } });
        forceSave();
    }, [forceSave]);

    const updateJournal = React.useCallback((date, entry) => {
        dispatch({ type: ACTIONS.UPDATE_JOURNAL, payload: { date, entry } });
        // Journal is text heavy, so we rely on 2s debounce.
    }, []);

    const updateBackground = React.useCallback((path, url) => {
        dispatch({ type: ACTIONS.UPDATE_BACKGROUND, payload: { path, url } });
        forceSave();
    }, [forceSave]);

    const toggleTheme = React.useCallback(() => {
        dispatch({ type: ACTIONS.TOGGLE_THEME });
        forceSave();
    }, [forceSave]);

    const toggleBackgrounds = React.useCallback(() => {
        dispatch({ type: ACTIONS.TOGGLE_BACKGROUNDS });
        forceSave();
    }, [forceSave]);

    const updateUserProfile = React.useCallback((updates) => {
        dispatch({ type: ACTIONS.UPDATE_USER_PROFILE, payload: updates });
    }, []);

    const addWealthItem = React.useCallback((category, name, monthlyPayment, skillId, oneTime = false) => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_WEALTH_ITEM, payload: { id, category, name, monthlyPayment, skillId, oneTime } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteWealthItem = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_WEALTH_ITEM, payload: { id } });
        forceSave();
    }, [forceSave]);

    const updateWealthItem = React.useCallback((id, updates) => {
        dispatch({ type: ACTIONS.UPDATE_WEALTH_ITEM, payload: { id, updates } });
    }, []);

    const addBelief = React.useCallback(() => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_BELIEF, payload: { id } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteBelief = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_BELIEF, payload: { id } });
        forceSave();
    }, [forceSave]);

    const updateBelief = React.useCallback((id, updates) => dispatch({ type: ACTIONS.UPDATE_BELIEF, payload: { id, updates } }), []);

    const addSatsSession = React.useCallback((beliefId, session) => {
        dispatch({ type: ACTIONS.ADD_SATS_SESSION, payload: { beliefId, session } });
        forceSave();
    }, [forceSave]);

    const addBeliefTask = React.useCallback((beliefId, title) => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_BELIEF_TASK, payload: { id, beliefId, title } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteBeliefTask = React.useCallback((id, beliefId) => {
        dispatch({ type: ACTIONS.DELETE_BELIEF_TASK, payload: { id, beliefId } });
        forceSave();
    }, [forceSave]);

    const addBeliefTopic = React.useCallback((name, emoji, color) => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_BELIEF_TOPIC, payload: { id, name, emoji, color } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteBeliefTopic = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_BELIEF_TOPIC, payload: { id } });
        forceSave();
    }, [forceSave]);

    const updateBeliefTopic = React.useCallback((id, updates) => dispatch({ type: ACTIONS.UPDATE_BELIEF_TOPIC, payload: { id, updates } }), []);

    const addManifestation = React.useCallback((target) => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_MANIFESTATION, payload: { id, target } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteManifestation = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_MANIFESTATION, payload: { id } });
        forceSave();
    }, [forceSave]);

    const updateManifestation = React.useCallback((id, updates) => dispatch({ type: ACTIONS.UPDATE_MANIFESTATION, payload: { id, updates } }), []);

    const addManifestationSession = React.useCallback((manifestationId, session) => {
        dispatch({ type: ACTIONS.ADD_MANIFESTATION_SESSION, payload: { manifestationId, session } });
        forceSave();
    }, [forceSave]);

    const addDesire = React.useCallback((input) => {
        const id = generateId();
        const text = (typeof input === 'object' && input.description) ? input.description : input;
        dispatch({ type: ACTIONS.ADD_DESIRE, payload: { id, text } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteDesire = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_DESIRE, payload: { id } });
        forceSave();
    }, [forceSave]);

    const updateDesire = React.useCallback((id, updates) => dispatch({ type: ACTIONS.UPDATE_DESIRE, payload: { id, updates } }), []);

    const addDesireSession = React.useCallback((desireId, session) => {
        dispatch({ type: ACTIONS.ADD_DESIRE_SESSION, payload: { desireId, session } });
        forceSave();
    }, [forceSave]);

    const addDesireTask = React.useCallback((desireId, title) => {
        const id = generateId();
        dispatch({ type: ACTIONS.ADD_DESIRE_TASK, payload: { id, desireId, title } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteDesireTask = React.useCallback((id, desireId) => {
        dispatch({ type: ACTIONS.DELETE_DESIRE_TASK, payload: { id, desireId } });
        forceSave();
    }, [forceSave]);

    // ScheduleTask (Dragging) - Should be instant
    const scheduleTask = React.useCallback((id, dateStr, timeStr, duration = 60) => {
        console.log('📅 Scheduling task:', { id, dateStr, timeStr, duration });
        dispatch({
            type: ACTIONS.UPDATE_TASK,
            payload: { id, updates: { scheduledDate: dateStr, startTime: timeStr, duration: duration } }
        });
        forceSave();
    }, [forceSave]);

    const unscheduleTask = React.useCallback((id) => {
        dispatch({
            type: ACTIONS.UPDATE_TASK,
            payload: { id, updates: { scheduledDate: null, startTime: null, duration: null } }
        });
        forceSave();
    }, [forceSave]);

    const addTimeBlock = React.useCallback((areaId, title) => {
        const id = generateId();
        console.log('🏗️ addTimeBlock Action Dispatched:', { id, areaId, title });
        dispatch({ type: ACTIONS.ADD_TIME_BLOCK, payload: { id, areaId, title } });
        forceSave();
        return id;
    }, [forceSave]);

    const deleteTimeBlock = React.useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE_TIME_BLOCK, payload: { id } });
        forceSave();
    }, [forceSave]);

    const scheduleTimeBlock = React.useCallback((id, dateStr, timeStr, duration = 120) => {
        dispatch({
            type: ACTIONS.UPDATE_TIME_BLOCK,
            payload: { id, updates: { scheduledDate: dateStr, startTime: timeStr, duration: duration } }
        });
        forceSave();
    }, [forceSave]);

    const updateTimeBlock = React.useCallback((id, updates) => dispatch({ type: ACTIONS.UPDATE_TIME_BLOCK, payload: { id, updates } }), []);

    const updateRoutineTemplate = React.useCallback((dayType, blocks) => {
        dispatch({ type: ACTIONS.UPDATE_ROUTINE_TEMPLATE, payload: { dayType, blocks } });
    }, []);

    const getCycleType = React.useCallback((date) => {
        const anchor = new Date('2026-01-01T00:00:00');
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const diffTime = d.getTime() - anchor.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const cycleIndex = ((diffDays % 3) + 3) % 3;
        if (cycleIndex === 2) return 'light';
        return cycleIndex === 0 ? 'work1' : 'work2';
    }, []);

    const generateRoutineForDate = React.useCallback((date) => {
        // FIXED: Use getDateString(date) to keep it local (avoid UTC shift from toISOString)
        const dateStr = getDateString(date);
        const dayType = getCycleType(date);
        const templates = state.routineTemplates[dayType] || [];
        const existingBlocks = Object.values(state.timeBlocks).filter(tb => tb.scheduledDate === dateStr);
        const existingTasks = Object.values(state.tasks).filter(t => t.scheduledDate === dateStr);

        templates.forEach(template => {
            const alreadyScheduled = existingBlocks.some(eb => eb.title === template.title && eb.startTime === template.startTime) ||
                existingTasks.some(et => et.title === template.title && et.startTime === template.startTime);

            if (!alreadyScheduled) {
                const id = generateId();
                const defaultAreaId = Object.keys(state.areas || {})[0];
                if (!template.areaId && !defaultAreaId) return;

                dispatch({
                    type: ACTIONS.ADD_TIME_BLOCK,
                    payload: {
                        id,
                        areaId: template.areaId || defaultAreaId,
                        title: template.title,
                        scheduledDate: dateStr,
                        startTime: template.startTime,
                        duration: template.duration || 60,
                        habitIds: template.habitIds || [],
                        taskIds: template.taskIds || []
                    }
                });
            }
        });
    }, [state.routineTemplates, state.timeBlocks, state.tasks, state.areas, getCycleType]);

    const addTimeBlockToRoutine = React.useCallback((timeBlock, targetDayType = null) => {
        const template = {
            title: timeBlock.title,
            startTime: timeBlock.startTime,
            duration: timeBlock.duration,
            areaId: timeBlock.areaId,
            habitIds: timeBlock.habitIds || [],
            taskIds: timeBlock.taskIds || []
        };
        const targetTypes = targetDayType ? [targetDayType] : ['work1', 'work2', 'light'];
        targetTypes.forEach(dayType => {
            const current = state.routineTemplates[dayType] || [];
            if (!current.some(t => t.title === template.title && t.startTime === template.startTime)) {
                updateRoutineTemplate(dayType, [...current, template]);
            }
        });
        forceSave();
    }, [state.routineTemplates, updateRoutineTemplate, forceSave]);

    const runMaintenanceSync = React.useCallback(() => {
        if (!state.isLoaded) return;

        // Logical Day Turnover (4 AM Split)
        const now = new Date();
        const adjustedNow = new Date(now.getTime() - (4 * 60 * 60 * 1000));
        const todayStr = adjustedNow.toISOString().split('T')[0];

        if (state.lastRoutineSyncDate !== todayStr) {
            console.log("--- LOGICAL DAY TURNOVER --- Cleaning up timers and SATS data...", { tasks: Object.keys(state.tasks || {}).length });

            // CRITICAL: Update the sync date FIRST to prevent infinite loops if nested dispatches trigger re-renders
            dispatch({ type: 'SET_LAST_ROUTINE_SYNC', payload: todayStr });

            // 1. Stop all tasks that were left "running" from a previous logical day
            Object.values(state.tasks || {}).forEach(task => {
                if (task.status === 'in-progress' && task.lastStartedAt) {
                    const lastStart = new Date(task.lastStartedAt);
                    const adjustedLastStart = new Date(lastStart.getTime() - (4 * 60 * 60 * 1000));
                    const lastStartDateStr = adjustedLastStart.toISOString().split('T')[0];

                    if (lastStartDateStr !== todayStr) {
                        dispatch({
                            type: ACTIONS.UPDATE_TASK,
                            payload: {
                                id: task.id,
                                updates: { status: 'not-started', lastStartedAt: null }
                            }
                        });
                    }
                }
            });

            // 2. Cleanup "Orphaned" SATS data (missing timestamps)
            ['beliefs', 'manifestations', 'desires'].forEach(key => {
                Object.values(state[key] || {}).forEach(item => {
                    if (item.sessions && item.sessions.some(s => !s.timestamp)) {
                        const cleanedSessions = item.sessions.filter(s => s.timestamp);
                        dispatch({
                            type: `UPDATE_${key.slice(0, -1).toUpperCase()}`,
                            payload: { id: item.id, updates: { sessions: cleanedSessions } }
                        });
                    }
                });
            });

            // 3. Generate routines for the new day
            // We use a local version of generateRoutine to avoid dependency issues within the effect
            for (let i = 0; i < 3; i++) {
                const targetDate = new Date();
                targetDate.setDate(now.getDate() + i);

                const dateStr = getDateString(targetDate);
                const dayType = getCycleType(targetDate);
                const templates = state.routineTemplates[dayType] || [];
                const existingBlocks = Object.values(state.timeBlocks).filter(tb => tb.scheduledDate === dateStr);
                const existingTasks = Object.values(state.tasks).filter(t => t.scheduledDate === dateStr);

                templates.forEach(template => {
                    const alreadyScheduled = existingBlocks.some(eb => eb.title === template.title && eb.startTime === template.startTime) ||
                        existingTasks.some(et => et.title === template.title && et.startTime === template.startTime);

                    if (!alreadyScheduled) {
                        const id = generateId();
                        const defaultAreaId = Object.keys(state.areas || {})[0];
                        if (template.areaId || defaultAreaId) {
                            dispatch({
                                type: ACTIONS.ADD_TIME_BLOCK,
                                payload: {
                                    id,
                                    areaId: template.areaId || defaultAreaId,
                                    title: template.title,
                                    scheduledDate: dateStr,
                                    startTime: template.startTime,
                                    duration: template.duration || 60,
                                    habitIds: template.habitIds || [],
                                    taskIds: template.taskIds || []
                                }
                            });
                        }
                    }
                });
            }

            // Maintenance sync updates state significantly
            forceSave();
        }
    }, [state.isLoaded, state.lastRoutineSyncDate, dispatch, forceSave]); // Removed unstable dependencies

    const contextValue = React.useMemo(() => ({
        state,
        dispatch,
        forceSave, // Use the hoisted forceSave
        addArea, deleteArea, updateArea,
        reorderAreas: (ids) => {
            dispatch({ type: ACTIONS.REORDER_AREAS, payload: ids });
            forceSave();
        },
        addSkill, deleteSkill, updateSkill, reorderSkills,
        addObjective, deleteObjective, updateObjective,
        addTask, deleteTask, toggleTask, updateTask,
        scheduleTask, unscheduleTask,
        addHabit, deleteHabit, toggleHabit, updateHabit,
        incrementHabitIntegration: (id) => {
            dispatch({ type: ACTIONS.INCREMENT_HABIT_INTEGRATION, payload: { id } });
            forceSave();
        },
        reorderHabits: (areaId, habitIds) => {
            dispatch({ type: ACTIONS.REORDER_HABITS, payload: { areaId, habitIds } });
            forceSave();
        },
        updateHabitContent: (id, notes, cards, chatHistory, chatLastUpdated) => dispatch({ type: ACTIONS.UPDATE_HABIT_CONTENT, payload: { id, notes, cards, chatHistory, chatLastUpdated } }),
        reviewCard: (habitId, cardId, rating, folderId) => {
            dispatch({ type: ACTIONS.REVIEW_CARD, payload: { habitId, cardId, rating, folderId } });
            forceSave();
        },
        addFlashcardFolder: (skillId, name) => {
            const id = generateId();
            dispatch({ type: ACTIONS.ADD_FLASHCARD_FOLDER, payload: { id, skillId, name } });
            forceSave();
            return id;
        },
        deleteFlashcardFolder: (id) => {
            dispatch({ type: ACTIONS.DELETE_FLASHCARD_FOLDER, payload: { id } });
            forceSave();
        },
        addFlashcardToFolder: (folderId, card) => {
            dispatch({ type: ACTIONS.ADD_FLASHCARD_TO_FOLDER, payload: { folderId, card } });
            forceSave();
        },
        deleteFlashcardFromFolder: (folderId, cardId) => {
            dispatch({ type: ACTIONS.DELETE_FLASHCARD_FROM_FOLDER, payload: { folderId, cardId } });
            forceSave();
        },
        moveFlashcard: (payload) => {
            dispatch({ type: ACTIONS.MOVE_FLASHCARD, payload });
            forceSave();
        },
        addReward, deleteReward, redeemReward, updateReward, reorderRewards,
        addTimeBlockToRoutine, getCycleType,
        updateJournal,
        updateBackground,
        toggleTheme,
        toggleBackgrounds,
        updateUserProfile,
        setApiKey: (key) => dispatch({ type: ACTIONS.SET_API_KEY, payload: key }),
        setWarheadInstructions: (text) => dispatch({ type: ACTIONS.SET_WARHEAD_INSTRUCTIONS, payload: text }),
        addAvailableMed: (med) => {
            dispatch({ type: ACTIONS.ADD_AVAILABLE_MED, payload: { med } });
            forceSave();
        },
        addWealthItem, deleteWealthItem, updateWealthItem,
        addResource: (skillId, title, url) => {
            const id = generateId();
            dispatch({ type: ACTIONS.ADD_RESOURCE, payload: { id, skillId, title, url } });
            forceSave();
            return id;
        },
        deleteResource: (id, skillId) => {
            dispatch({ type: ACTIONS.DELETE_RESOURCE, payload: { id, skillId } });
            forceSave();
        },
        updateResource: (id, skillId, updates) => dispatch({ type: ACTIONS.UPDATE_RESOURCE, payload: { id, skillId, updates } }),
        updateTracker: (id, updates) => dispatch({ type: ACTIONS.UPDATE_TRACKER, payload: { id, updates } }),
        addTracker: (name) => {
            let id = name ? name.toLowerCase().replace(/\s+/g, '-') : `tracker-${Date.now()}`;
            let path = `/trackers/${id}`;
            let icon = 'Activity';
            if (id.includes('belief')) icon = 'Brain';
            if (id.includes('manifest')) icon = 'Star';
            if (id.includes('wealth') || id.includes('money')) icon = 'DollarSign';
            if (id.includes('food') || id.includes('diet')) icon = 'Utensils';
            dispatch({ type: ACTIONS.ADD_TRACKER, payload: { id, name, icon, path } });
            forceSave();
            return id;
        },
        deleteTracker: (id) => {
            dispatch({ type: ACTIONS.DELETE_TRACKER, payload: { id } });
            forceSave();
        },
        addBelief, deleteBelief, updateBelief, addSatsSession,
        addBeliefTask,
        deleteBeliefTask,
        addBeliefTopic: (name, emoji, color) => {
            const id = generateId();
            dispatch({ type: ACTIONS.ADD_BELIEF_TOPIC, payload: { id, name, emoji, color } });
            forceSave();
            return id;
        },
        deleteBeliefTopic: (id) => {
            dispatch({ type: ACTIONS.DELETE_BELIEF_TOPIC, payload: { id } });
            forceSave();
        },
        updateBeliefTopic: (id, updates) => dispatch({ type: ACTIONS.UPDATE_BELIEF_TOPIC, payload: { id, updates } }),
        addManifestation, deleteManifestation, updateManifestation, addManifestationSession,
        addDesire, deleteDesire, updateDesire, addDesireSession,
        addDesireTask,
        deleteDesireTask,
        addTimeBlock, deleteTimeBlock, scheduleTimeBlock,
        updateTimeBlock: (id, updates) => dispatch({ type: ACTIONS.UPDATE_TIME_BLOCK, payload: { id, updates } }),
        updateRoutineTemplate,
        runMaintenanceSync,
        addWarheadNotification
    }), [
        state, addArea, deleteArea, updateArea, addSkill, deleteSkill, updateSkill, reorderSkills,
        addObjective, deleteObjective, updateObjective, addTask, deleteTask, toggleTask, updateTask,
        scheduleTask, unscheduleTask, addHabit, deleteHabit, toggleHabit, updateHabit, addReward,
        deleteReward, redeemReward, updateReward, reorderRewards, addTimeBlockToRoutine, getCycleType,
        updateJournal, updateBackground, toggleTheme, toggleBackgrounds, updateUserProfile,
        addWealthItem, deleteWealthItem, updateWealthItem, addBelief, deleteBelief, updateBelief,
        addSatsSession, addBeliefTask, deleteBeliefTask, addDesireTask, deleteDesireTask, addTimeBlock, deleteTimeBlock,
        scheduleTimeBlock, updateRoutineTemplate, runMaintenanceSync, addWarheadNotification,
        addManifestation, deleteManifestation, updateManifestation, addManifestationSession,
        addDesire, deleteDesire, updateDesire, addDesireSession,
        forceSave // Add forceSave to dep array
    ]);

    // Expose store for debugging
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.store = contextValue;
        }
    }, [contextValue]);

    return (
        <StoreContext.Provider value={contextValue}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    return useContext(StoreContext);
}