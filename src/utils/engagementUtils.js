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

    // 1. Check Tasks and Sessions under this skill
    // This includes the skill node itself and its children (tasks)
    const descendants = nodes.filter(n => n.id === skillId || n.parentId === skillId);
    
    descendants.forEach(node => {
        // a) Task Completion
        if (node.metadata?.completedAt) {
            const time = new Date(node.metadata.completedAt).getTime();
            if (time > latestEngagement) latestEngagement = time;
        }

        // b) Focus Sessions (metadata.sessions)
        if (node.metadata?.sessions) {
            node.metadata.sessions.forEach(session => {
                if (session.status === 'completed' && session.endTime) {
                    if (session.endTime > latestEngagement) latestEngagement = session.endTime;
                }
            });
        }
    });

    // 2. Check Habits linked to this skill
    const skillHabits = habits.filter(h => 
        (h.linkedSkillIds && h.linkedSkillIds.includes(skillId)) || 
        h.linkedSkillId === skillId
    );

    skillHabits.forEach(habit => {
        if (habit.lastCompletedAt) {
            const time = new Date(habit.lastCompletedAt).getTime();
            if (time > latestEngagement) latestEngagement = time;
        }
        
        // Also check actual completions array in habit just in case lastCompletedAt is stale
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

    const diffMs = now.getTime() - latestEngagement;
    const daysSince = Math.floor(diffMs / msInDay);

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
