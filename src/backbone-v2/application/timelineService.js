
/**
 * Timeline Service - Read-only aggregation layer
 * Joins Tasks, Focus Sessions, Habits, and Journal entries into a per-day structure.
 */
export const TimelineService = (backbone, habitService, journalService) => {

    const formatDate = (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const findSkillAncestor = (allNodes, nodeId) => {
        if (!nodeId) return null;
        let current = allNodes.find(n => n.id === nodeId);
        let depth = 0; // Prevent infinite loops
        while (current && current.type !== 'SKILL' && depth < 10) {
            if (!current.parentId) return null;
            current = allNodes.find(n => n.id === current.parentId);
            depth++;
        }
        return (current && current.type === 'SKILL') ? current : null;
    };

    /**
     * getTimelineRange
     * @param {Date|string} startDate 
     * @param {Date|string} endDate 
     * @param {string[]} focusSlotIds - Array of active skill IDs from focus slots
     */
    const getTimelineRange = async (startDate, endDate, focusSlotIds = []) => {
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            // Fetch all data once to filter in memory
            const [allNodes, allHabits, allJournalEntries] = await Promise.all([
                backbone.getAllNodes(),
                habitService.getAllHabits(),
                journalService.getAllEntries()
            ]);

            const rootNode = allNodes.find(n => n.id === 'ROOT');
            const dailyRepLog = rootNode?.metadata?.dailyRepLog || {};

            const days = [];
            let current = new Date(start);
            
            // Normalize today for "Unfinished" logic
            const todayStr = formatDate(new Date());

            while (current <= end) {
                const dateStr = formatDate(current);
                
                // Day window in timestamps
                const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, 0, 0, 0).getTime();
                const dayEnd = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 23, 59, 59, 999).getTime();

                // 1. Tasks Completed today
                const tasksCompleted = allNodes.filter(n => 
                    n.type === 'TASK' && 
                    n.metadata?.status === 'DONE' &&
                    n.metadata?.completedAt >= dayStart &&
                    n.metadata?.completedAt <= dayEnd
                );

                // 2. Unfinished Tasks 
                let tasksUnfinished = [];
                if (dateStr === todayStr) {
                    tasksUnfinished = allNodes.filter(n => 
                        n.type === 'TASK' && 
                        n.metadata?.status !== 'DONE' &&
                        n.metadata?.isToday === true
                    );
                }

                // 3. Focus Sessions completed today
                let focusSessions = [];
                allNodes.filter(n => n.type === 'TASK').forEach(task => {
                    const sessions = task.metadata?.sessions || [];
                    sessions.forEach(s => {
                        if (s.status === 'completed' && s.endTime >= dayStart && s.endTime <= dayEnd) {
                            focusSessions.push({
                                ...s,
                                taskName: task.name,
                                taskId: task.id
                            });
                        }
                    });
                });

                // 4. Habit Completions today
                let habitCompletions = [];
                allHabits.forEach(habit => {
                    const comps = (habit.completions || []).filter(c => 
                        c.timestamp >= dayStart && c.timestamp <= dayEnd
                    );
                    if (comps.length > 0) {
                        habitCompletions.push({
                            habitId: habit.id,
                            name: habit.ifTrigger || habit.name || "Unnamed Habit",
                            count: comps.length,
                            completions: comps,
                            linkedSkillIds: habit.linkedSkillIds || (habit.linkedSkillId ? [habit.linkedSkillId] : [])
                        });
                    }
                });

                // 5. Repetition Activities today
                const repLog = dailyRepLog[dateStr] || {};
                const repetitionActivities = [];
                for (const [taskId, count] of Object.entries(repLog)) {
                    const task = allNodes.find(n => n.id === taskId);
                    if (task) {
                        repetitionActivities.push({
                            taskId,
                            name: task.name,
                            count
                        });
                    }
                }

                // --- GROUPING BY SKILL ---
                const skillGroupsMap = {};
                const getOrCreateGroup = (skillNode) => {
                    const key = skillNode ? skillNode.id : 'no-skill';
                    if (!skillGroupsMap[key]) {
                        skillGroupsMap[key] = {
                            id: key,
                            name: skillNode ? skillNode.name : 'Other Actions',
                            tasksCompleted: [],
                            tasksUnfinished: [],
                            focusSessions: [],
                            habitCompletions: [],
                            repetitionActivities: []
                        };
                    }
                    return skillGroupsMap[key];
                };

                tasksCompleted.forEach(t => {
                    const skill = findSkillAncestor(allNodes, t.id);
                    getOrCreateGroup(skill).tasksCompleted.push(t);
                });

                tasksUnfinished.forEach(t => {
                    const skill = findSkillAncestor(allNodes, t.id);
                    getOrCreateGroup(skill).tasksUnfinished.push(t);
                });

                focusSessions.forEach(s => {
                    const skill = findSkillAncestor(allNodes, s.taskId);
                    getOrCreateGroup(skill).focusSessions.push(s);
                });

                habitCompletions.forEach(h => {
                    // Pick the first linked skill for grouping
                    const skillId = h.linkedSkillIds?.[0];
                    const skill = skillId ? allNodes.find(n => n.id === skillId) : null;
                    getOrCreateGroup(skill).habitCompletions.push(h);
                });

                repetitionActivities.forEach(r => {
                    const skill = findSkillAncestor(allNodes, r.taskId);
                    getOrCreateGroup(skill).repetitionActivities.push(r);
                });

                const skillGroups = Object.values(skillGroupsMap).filter(group => 
                    group.tasksCompleted.length > 0 || 
                    group.tasksUnfinished.length > 0 ||
                    group.focusSessions.length > 0 ||
                    group.habitCompletions.length > 0 ||
                    group.repetitionActivities.length > 0
                );

                // 6. Journal Entry
                const journalEntry = allJournalEntries.find(e => e.date === dateStr);

                days.push({
                    date: dateStr,
                    timestamp: dayStart,
                    tasksCompleted,
                    tasksUnfinished,
                    focusSessions,
                    habitCompletions,
                    repetitionActivities,
                    skillGroups, // NEW: Use this for detail view
                    journalEntry: journalEntry || null
                });

                // Move to next day
                current.setDate(current.getDate() + 1);
            }

            return { 
                days: days.sort((a, b) => a.timestamp - b.timestamp)
            };
        } catch (error) {
            console.error("TimelineService: Error aggregating range", error);
            return { days: [] };
        }
    };

    return {
        getTimelineRange
    };
};
