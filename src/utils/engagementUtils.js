/**
 * Computes the engagement status (Health Dot) for a specific skill.
 * 
 * Rules:
 * - Blue: last engagement within 0–3 days
 * - Orange: last engagement within 4–7 days
 * - Grey: last engagement 8+ days or never
 * 
 * Engagement counts:
 * - Completed Task under the skill (DONE + completedAt)
 * - Completed Habit linked to the skill (lastCompletedAt)
 * - Completed Focus Session in a task under the skill
 */
export const getSkillEngagementStatus = (skillId, nodes = [], habits = []) => {
    if (!skillId) return { lastEngagedAt: null, status: "grey", daysSince: null };

    const msInDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    let latestEngagement = 0; // timestamp

    // 1. Build a map for efficient child lookups
    const childrenMap = {};
    nodes.forEach(n => {
        if (n.parentId) {
            if (!childrenMap[n.parentId]) childrenMap[n.parentId] = [];
            childrenMap[n.parentId].push(n);
        }
    });

    // 2. Find ALL descendants recursively (Skill -> Objectives -> Aspects -> Tasks)
    const descendants = [];
    const skillNode = nodes.find(n => n.id === skillId);
    if (!skillNode) return { lastEngagedAt: null, status: "grey", daysSince: Infinity };

    const stack = [skillNode];
    const visited = new Set();
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current.id)) continue;
        visited.add(current.id);
        descendants.push(current);
        
        const children = childrenMap[current.id] || [];
        children.forEach(c => stack.push(c));
    }
    
    // 3. Evaluate activity markers across all descendants
    descendants.forEach(node => {
        const meta = node.metadata || {};

        // a) Task/Node Completion (completedAt, achievedAt, doneAt)
        const completionTime = meta.completedAt || meta.achievedAt || meta.doneAt;
        if (completionTime) {
            const time = new Date(completionTime).getTime();
            if (time > latestEngagement) latestEngagement = time;
        }

        // b) Momentum (lastWorkedAt)
        if (meta.lastWorkedAt) {
            const time = new Date(meta.lastWorkedAt).getTime();
            if (time > latestEngagement) latestEngagement = time;
        }

        // d) Node updated_at (catches any recent interaction)
        if (node.updatedAt) {
            const time = new Date(node.updatedAt).getTime();
            if (time > latestEngagement) latestEngagement = time;
        }

        // c) Focus Sessions (metadata.sessions)
        if (meta.sessions) {
            meta.sessions.forEach(session => {
                // Count completed sessions by their end time
                if (session.status === 'completed' && session.endTime) {
                    if (session.endTime > latestEngagement) latestEngagement = session.endTime;
                }
                // Count active sessions by their start time (if currently active, it's "now")
                if (session.status === 'active' && session.startTime) {
                    if (session.startTime > latestEngagement) latestEngagement = session.startTime;
                }
            });
        }
    });

    // 4. Check Habits linked to this skill
    const skillHabits = habits.filter(h => 
        (h.linkedSkillIds && h.linkedSkillIds.includes(skillId)) || 
        h.linkedSkillId === skillId
    );

    skillHabits.forEach(habit => {
        if (habit.lastCompletedAt) {
            const time = new Date(habit.lastCompletedAt).getTime();
            if (time > latestEngagement) latestEngagement = time;
        }
        
        if (habit.completions && habit.completions.length > 0) {
            const lastComp = habit.completions[habit.completions.length - 1];
            if (lastComp.timestamp && lastComp.timestamp > latestEngagement) {
                latestEngagement = lastComp.timestamp;
            }
        }
    });

    if (latestEngagement === 0) {
        return { lastEngagedAt: null, status: "grey", daysSince: Infinity };
    }

    // 5. Calculate Calendar Days (Midnight to Midnight)
    // Using local time to match user mental model of "Today vs Yesterday"
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const engDate = new Date(latestEngagement);
    const startOfEng = new Date(engDate.getFullYear(), engDate.getMonth(), engDate.getDate());

    const diffMs = startOfNow.getTime() - startOfEng.getTime();
    const daysSince = Math.round(diffMs / msInDay);

    let status = "grey";
    if (daysSince <= 3) {
        status = "blue";
    } else if (daysSince <= 7) {
        status = "orange";
    }

    return { 
        lastEngagedAt: new Date(latestEngagement), 
        status, 
        daysSince,
        label: getEngagementLabel(daysSince)
    };
};



const getEngagementLabel = (days) => {
    if (days === 0) return "Touched today";
    if (days === 1) return "Touched yesterday";
    if (days === Infinity) return "Quiet for a long time";
    if (days > 7) return `Quiet for ${days} days`;
    return `Touched ${days} days ago`;
};
