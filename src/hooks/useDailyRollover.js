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
        try {
          const allNodes = await backbone.getAllNodes();
          const tomorrowTasks = allNodes.filter(n => 
            n.type === NodeTypes.TASK && n.metadata?.tomorrow === true
          );

          if (tomorrowTasks.length > 0) {
            
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
            
          } else {
          }
          
          localStorage.setItem("lastRolloverDate", today);
        } catch (err) {
          console.error("[Rollover] Failed to complete daily rollover:", err);
        }
      } else {
      }
    };
    
    runRollover();
  }, [repositoriesReady]);
};
