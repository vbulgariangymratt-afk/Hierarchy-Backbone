import { NodeTypes, TaskStatuses } from '../backbone-v2/domain/entities';

/**
 * Shared logic for scoring tasks based on energy levels and historical data.
 */

export const getAspectStats = (allNodes) => {
    const stats = new Map();
    allNodes.forEach(node => {
        if (
            node.type === NodeTypes.TASK &&
            node.metadata?.status === TaskStatuses.DONE
        ) {
            const aspectId = node.parentId;
            const sessions = node.metadata?.sessions || [];
            const totalTime = sessions.reduce(
                (acc, s) => acc + (s.actualDuration ?? 0),
                0
            );

            const current = stats.get(aspectId) || {
                totalTime: 0,
                count: 0
            };

            stats.set(aspectId, {
                totalTime: current.totalTime + totalTime,
                count: current.count + 1
            });
        }
    });
    return stats;
};

export const getAspectAvgTime = (aspectId, aspectStats) => {
    if (!aspectStats) return Infinity;
    const stat = aspectStats.get(aspectId);
    if (!stat || stat.count === 0) return Infinity;
    return stat.totalTime / stat.count;
};

export const scoreLowEnergyTask = (task, aspectStats) => {
    let score = 0;

    // 1. Aspect ease (LOWER TIME = BETTER)
    const aspectId = task.parentId;
    const avgTime = getAspectAvgTime(aspectId, aspectStats);

    if (avgTime !== Infinity) {
        score += 100 / (avgTime + 1);
    }

    // 2. Already started = easier
    if (task.metadata?.status === TaskStatuses.IN_PROGRESS) score += 3;
    
    // 3. Has micro action = easier
    if (task.metadata?.microAction) score += 2;
    
    // 4. Fewer substeps = easier
    const stepCount = task.metadata?.subSteps?.length || 0;
    score += Math.max(0, 3 - stepCount);

    return score;
};

/**
 * Selects the best low energy task by prioritizing:
 * 1. Speed (historical average duration of the aspect, faster is better)
 * 2. Schedule pressure (non-today tasks preferred over today tasks)
 * 3. Fallbacks to tasks with no session history last
 */
export const selectBestLowEnergyTask = (pool, aspectStats) => {
    if (!pool || pool.length === 0) return null;

    const sortedPool = [...pool].sort((a, b) => {
        const avgTimeA = getAspectAvgTime(a.parentId, aspectStats);
        const avgTimeB = getAspectAvgTime(b.parentId, aspectStats);

        const hasHistoryA = avgTimeA !== Infinity;
        const hasHistoryB = avgTimeB !== Infinity;

        if (hasHistoryA && !hasHistoryB) return -1;
        if (!hasHistoryA && hasHistoryB) return 1;

        if (hasHistoryA && hasHistoryB) {
            if (avgTimeA !== avgTimeB) {
                return avgTimeA - avgTimeB;
            }
        }

        const isTodayA = a.metadata?.isToday === true;
        const isTodayB = b.metadata?.isToday === true;

        if (!isTodayA && isTodayB) return -1;
        if (isTodayA && !isTodayB) return 1;

        return 0;
    });

    console.log("Newly Selected Low Energy Task:", sortedPool[0]?.name);
    return sortedPool[0];
};
