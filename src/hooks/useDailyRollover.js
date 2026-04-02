import { useEffect } from 'react';
import { backbone, NodeTypes } from '../backbone-v2';

/**
 * Hook to manage daily rollover of tasks.
 * When a new day is detected, it moves all "tomorrow" tasks to "today".
 * 
 * @param {boolean} repositoriesReady - Ensure we only run after data is initialized.
 */
export const useDailyRollover = (repositoriesReady) => {
  useEffect(() => {
    if (!repositoriesReady) return;

    const runRollover = async () => {
      const today = new Date().toDateString();
      const lastRun = localStorage.getItem("lastRolloverDate");

      if (lastRun !== today) {
        console.log("[Rollover] New day detected. Starting daily rollover...");
        try {
          const allNodes = await backbone.getAllNodes();
          const tomorrowTasks = allNodes.filter(n => 
            n.type === NodeTypes.TASK && n.metadata?.tomorrow === true
          );

          if (tomorrowTasks.length > 0) {
            console.log(`[Rollover] Found ${tomorrowTasks.length} tasks to roll over from tomorrow to today.`);
            
            // Process in parallel to minimize UI impact
            await Promise.all(tomorrowTasks.map(task => 
              backbone.updateNode(task.id, {
                metadata: {
                  ...task.metadata,
                  isToday: true,
                  tomorrow: false
                }
              })
            ));
            
            console.log("[Rollover] Successfully rolled over tasks.");
          } else {
            console.log("[Rollover] No tomorrow tasks found to roll over.");
          }
          
          localStorage.setItem("lastRolloverDate", today);
          console.log("[Rollover] Last run date updated to:", today);
        } catch (err) {
          console.error("[Rollover] Failed to complete daily rollover:", err);
        }
      } else {
        console.log("[Rollover] Rollover already ran today:", today);
      }
    };
    
    runRollover();
  }, [repositoriesReady]);
};
