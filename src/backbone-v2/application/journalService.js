/**
 * Journal Service - Structured storage + Snapshot Layer
 * Handles daily journal entries and auto-computed snapshots.
 */
export const JournalService = (journalRepository, backbone, habitService) => {

    /**
     * Check if an entry is locked based on the 24-hour rule.
     * Rule: A JournalEntry becomes read-only 24 hours after its date ends.
     * Example: Feb 27 entry locks at Feb 28 23:59:59 local time.
     */
    const isEntryLocked = (dateStr) => {
        const entryDate = new Date(dateStr);
        // End of entry date day
        const entryDayEnd = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate(), 23, 59, 59, 999);
        // Lock time is 24 hours after that
        const lockTime = entryDayEnd.getTime() + (24 * 60 * 60 * 1000);
        return Date.now() > lockTime;
    };

    const getLocalDateStr = (timestamp = Date.now()) => {
        const d = new Date(timestamp);
        // YYYY-MM-DD
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    };

    /**
     * Compute auto-snapshot metrics for a date
     */
    const computeSnapshot = async (dateStr) => {
        const defaults = {
            deepWorkMinutes: 0,
            totalFocusMinutes: 0,
            frictionCounts: { light: 0, medium: 0, heavy: 0 },
            dominantDriver: "Driver unclear"
        };

        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const startOfDayDate = new Date(y, m - 1, d, 0, 0, 0, 0);
            const startOfDay = startOfDayDate.getTime();
            const endOfDayDate = new Date(y, m - 1, d, 23, 59, 59, 999);
            const endOfDay = endOfDayDate.getTime() + 1;

            const allNodes = await backbone.getAllNodes() || [];
            const allHabits = habitService.getAllHabits() || [];

            console.log("\n--- [DETAILED DIAGNOSTIC] Snapshot Computation ---");
            console.log(`Window: ${startOfDay} (${startOfDayDate.toLocaleString()}) to ${endOfDay} (${endOfDayDate.toLocaleString()})`);

            let totalFocusSeconds = 0;
            let taskFocusSeconds = 0;
            let frictionCounts = { light: 0, medium: 0, heavy: 0 };
            let pinchFrequencies = {};

            // Accumulators
            let doneTasksTodayCount = 0;
            let doneTasksTodayWithCompletedSessionsCount = 0;
            let doneTasksTodayWithZeroSessionsCount = 0;
            let doneTasksTodayWithOnlyActiveSessionsCount = 0;
            let zeroSecondTasks = [];
            let allDoneTasksEver = [];
            let tasksWithSessionsEver = [];

            const taskNodes = allNodes.filter(n => n.type === 'TASK');

            console.log(`[Diagnostic] Filtering DONE tasks for window: ${dateStr}`);
            taskNodes.forEach(task => {
                const meta = task.metadata || {};
                const isDone = meta.status === 'DONE';
                if (!isDone) return;

                const completedAt = meta.completedAt || meta.doneAt || 0;
                const completedDateStr = completedAt ? new Date(completedAt).toLocaleDateString('en-CA') : 'N/A';
                const wasDoneInWindow = completedAt >= startOfDay && completedAt < endOfDay;

                console.log(`- Task: "${task.name}" | completedAt: ${completedAt} (${completedDateStr}) | In Window? ${wasDoneInWindow}`);

                const sessions = meta.sessions || [];
                const completedToday = sessions.filter(s => s.status === 'completed' && s.endTime >= startOfDay && s.endTime < endOfDay);
                
                if (wasDoneInWindow) {
                    doneTasksTodayCount++;
                    if (completedToday.length > 0) {
                        doneTasksTodayWithCompletedSessionsCount++;
                    }
                }

                completedToday.forEach(s => {
                    const duration = s.actualDuration || 0;
                    taskFocusSeconds += duration;
                    totalFocusSeconds += duration;
                });
            });

            if (doneTasksTodayCount > 0) {
                console.log(`[Journal Capture] Tasks Done Today: ${doneTasksTodayCount}, with focus: ${doneTasksTodayWithCompletedSessionsCount}, Deep Work: ${Math.round(taskFocusSeconds/60)}m`);
            }

            // (Processing habits & drivers)
            allHabits.forEach(habit => {
                const completionsOnDate = (habit.completions || []).filter(c =>
                    c.timestamp >= startOfDay &&
                    c.timestamp < endOfDay
                );
                completionsOnDate.forEach(c => {
                    const durationSec = c.duration || 0;
                    if (durationSec > 0) totalFocusSeconds += durationSec;
                    const friction = c.friction || 'medium';
                    if (frictionCounts[friction] !== undefined) frictionCounts[friction]++;
                });
            });

            allNodes.filter(n => n.type === 'SKILL' && n.metadata?.pinchState?.drivers).forEach(skill => {
                skill.metadata.pinchState.drivers.forEach(d => {
                    pinchFrequencies[d] = (pinchFrequencies[d] || 0) + 1;
                });
            });

            let dominantDriver = "Driver unclear";
            let maxFreq = 0;
            Object.entries(pinchFrequencies).forEach(([driver, freq]) => {
                if (freq > maxFreq) {
                    maxFreq = freq;
                    dominantDriver = driver;
                }
            });

            console.log("\n--- [END DIAGNOSTIC] ---\n");

            return {
                deepWorkMinutes: Math.round(taskFocusSeconds / 60),
                totalFocusMinutes: Math.round(totalFocusSeconds / 60),
                frictionCounts,
                dominantDriver
            };
        } catch (error) {
            console.warn("JournalService: Failed to compute snapshot metrics:", error);
            return defaults;
        }
    };

    /**
     * Sleep Detection Logic
     */
    const detectSleep = async () => {
        try {
            const meta = journalRepository.getMetadata();
            const now = Date.now();
            const lastClose = meta.lastAppCloseTime;

            if (!lastClose) return;

            const gap = now - lastClose;
            const currentHour = new Date(now).getHours();

            // Rule: Gap > 4 hours AND firstAppOpenTime is between 4AM–11AM
            if (gap > (4 * 60 * 60 * 1000) && currentHour >= 4 && currentHour < 11) {
                const todayStr = getLocalDateStr(now);
                const entry = await journalService.getEntry(todayStr);

                // If manual preference is on and a manual record exists, skip auto-detection
                const preferManual = localStorage.getItem('pref_manual_sleep') === 'true';
                const hasManualRecord = entry.biological?.manualOverride || (entry.biological?.sleepStartTime && !entry.biological?.sleepDetectedAutomatically);
                if (preferManual && hasManualRecord) {
                    console.log("JournalService: Skipping auto-sleep detection (Manual preference enabled + manual record exists)");
                    return;
                }

                // only update if not manually overridden or already detected for today
                if (!entry.biological?.sleepStartTime || entry.biological?.sleepDetectedAutomatically) {
                    const sleepDurationMinutes = Math.round(gap / (60 * 1000));

                    await journalRepository.update(entry.id, {
                        biological: {
                            sleepStartTime: lastClose,
                            wakeTime: now,
                            sleepDurationMinutes,
                            sleepDetectedAutomatically: true
                        }
                    });
                    console.log(`JournalService: Automatic sleep detected. Duration: ${sleepDurationMinutes}m`);
                }
            }
        } catch (error) {
            console.warn("JournalService: Error during automatic sleep detection:", error);
        }
    };

    const journalService = {
        initialize: async () => {
            await journalRepository.initialize();

            // Track App Open
            const now = Date.now();
            await detectSleep();
            await journalRepository.updateMetadata({ firstAppOpenTime: now });

            // Setup "Heartbeat" to track lastAppCloseTime (closest proxy for web)
            setInterval(() => {
                journalRepository.updateMetadata({ lastAppCloseTime: Date.now() });
            }, 60000); // Every minute
        },

        /**
         * Get one entry per calendar day. Creates lazily if missing.
         */
        getEntry: async (dateStr) => {
            let entry = await journalRepository.getByDate(dateStr);

            if (!entry) {
                entry = {
                    id: `JOURNAL-${dateStr}-${Math.random().toString(36).substr(2, 5)}`,
                    date: dateStr,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    biological: {
                        sleepStartTime: null,
                        wakeTime: null,
                        sleepDurationMinutes: null,
                        sleepDetectedAutomatically: false
                    },
                    activation: {
                        morningActivationLevel: null
                    },
                    regulation: {
                        hadDeepLockOver90Min: false,
                        rsdTrigger: false
                    },
                    medication_taken: false,
                    med_taken_at: null,
                    hydration_level: 2,
                    nutrition_level: 2,
                    sugar_level: 2,
                    morning_activity_done: false,
                    morning_activity_at: null,
                    notes: ""
                };
                await journalRepository.save(entry);
                console.log(`JournalService: Lazy created entry for ${dateStr}`);
            }

            // Always compute fresh snapshots on fetch
            const snapshots = await computeSnapshot(dateStr);
            return {
                ...entry,
                snapshots,
                isLocked: isEntryLocked(dateStr)
            };
        },

        /**
         * Update manual fields. Enforces Lock Rule.
         */
        updateEntry: async (dateStr, updates) => {
            if (isEntryLocked(dateStr)) {
                throw new Error(`Journal entry for ${dateStr} is locked and cannot be modified.`);
            }

            const result = await journalService.getEntry(dateStr);
            const entry = result; // Adjust based on getEntry returning { ...entry, snapshots, isLocked }

            // Deep merge for biological, activation, regulation
            const merged = {
                ...entry,
                ...updates,
                biological: { ...entry.biological, ...(updates.biological || {}) },
                activation: { ...entry.activation, ...(updates.activation || {}) },
                regulation: { ...entry.regulation, ...(updates.regulation || {}) },
                updatedAt: Date.now()
            };

            // If biological fields are updated manually, reset automatic flag
            if (updates.biological && (updates.biological.sleepStartTime || updates.biological.wakeTime)) {
                merged.biological.sleepDetectedAutomatically = false;

                // Re-calculate duration if both exist
                if (merged.biological.sleepStartTime && merged.biological.wakeTime) {
                    merged.biological.sleepDurationMinutes = Math.round(
                        (merged.biological.wakeTime - merged.biological.sleepStartTime) / (60 * 1000)
                    );
                }
            }

            // Remove snapshots/isLocked before saving to repository
            const { snapshots: _, isLocked: __, ...toSave } = merged;
            return await journalRepository.save(toSave);
        },

        updateEntryMetrics: async (dateStr, updates) => {
            return journalService.updateEntry(dateStr, updates);
        },

        isLocked: (dateStr) => isEntryLocked(dateStr),

        ensureTodayEntry: async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                return await journalService.getEntry(today);
            } catch (error) {
                console.error("JournalService: Critical error during ensureTodayEntry:", error);
                return null;
            }
        },

        getAllEntries: async () => {
            return await journalRepository.getAll();
        }
    };

    return journalService;
};
