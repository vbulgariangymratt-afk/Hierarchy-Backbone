import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  backbone, 
  repository, 
  habitRepo, 
  journalRepo,
  NodeTypes, 
  reloadAllData, 
  clearAllData 
} from '../backbone-v2';
import { getSkillEngagementStatus } from '../utils/engagementUtils';
import { useBackboneStore } from '../store/backboneStore';

// Module-level tracker to prevent redundant reloads on macOS desktop switching (token refresh)
let _lastKnownUid = null;
let _isReloading = false;

/**
 * The core "Brain" hook that bootstraps the entire Backbone V2 system.
 * Handles initialization, authentication lifecycle, and real-time synchronization.
 *
 * @param {Function} setSession - Callback to update the session in App.jsx
 * @returns {Object} { loading, repositoriesReady }
 */
export const useAppInitialization = (setSession) => {
  const initializeNodes = useBackboneStore(state => state.initializeNodes);
  const setEngagementMap = useBackboneStore(state => state.setEngagementMap);

  const [loading, setLoading] = useState(true);
  const [repositoriesReady, setRepositoriesReady] = useState(false);

  useEffect(() => {

    const initApp = async () => {
      // ENSURE backbone is ready before anything else
      if (!backbone || typeof backbone.initialize !== 'function') {
      }

      try {
        await backbone.initialize();
        
        // --- STEP 1: Initial hydration from cache/database ---
        const allNodes = await backbone.getAllNodes();
        initializeNodes(allNodes);

        
        // --- STEP 2: Client-side session recovery ---
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        // Set this BEFORE registering the auth listener so the startup
        // SIGNED_IN event is treated as a token refresh, not a new login
        if (initialSession?.user?.id) {
          _lastKnownUid = initialSession.user.id;
        }

        setSession(initialSession);
        setLoading(false);
        setRepositoriesReady(true);


        // --- STEP 3: Listen for system-level auth state changes ---
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          
          setSession(newSession);

          if (event === 'SIGNED_IN' && newSession) {
            // macOS Performance Fix: Skip re-load if it's just a token refresh
            const isNewUser = newSession.user.id !== _lastKnownUid;
            
            if (isNewUser && !_isReloading) {
              _isReloading = true;
              _lastKnownUid = newSession.user.id;
              setRepositoriesReady(false);
              try {
                // Migrate local guest data to Supabase first
                if (repository?.migrateGuestData) {
                  await repository.migrateGuestData(newSession.user.id);
                }
                if (habitRepo?.migrateGuestData) {
                  await habitRepo.migrateGuestData(newSession.user.id);
                }
                if (journalRepo?.migrateGuestData) {
                  await journalRepo.migrateGuestData(newSession.user.id);
                }

                await reloadAllData();
                initializeNodes(await backbone.getAllNodes());
              } catch (err) {
                console.error('[App] Reload and migration failed after sign-in:', err);
              } finally {
                _isReloading = false;
                setRepositoriesReady(true);
              }
            } else {
            }
          }


          if (event === 'SIGNED_OUT') {
            _lastKnownUid = null;
            clearAllData();
            initializeNodes([]); // Clear the Zustand store
            setRepositoriesReady(false);
            setRepositoriesReady(true); // Force re-render of providers
          }
        });
        
        // --- STEP 4: Real-time Reactive Sync Loop ---
        const syncStore = async () => {
          const nodes = await backbone.getAllNodes();
          const habits = habitRepo ? habitRepo.getAll() : [];
          
          // Recompute global engagement map for O(1) Lookups
          const newMap = {};
          nodes.filter(n => n.type === NodeTypes.SKILL).forEach(skill => {
            newMap[skill.id] = getSkillEngagementStatus(skill.id, nodes, habits);
          });
          
          setEngagementMap(newMap);
          initializeNodes(nodes);
        };

        // Subscribe to any/all low-level repository changes
        const unsubNodes = repository.subscribe(syncStore);
        const unsubHabits = habitRepo.subscribe(syncStore);

        // Perform initial sync immediately to bridge any latency
        await syncStore();

        return () => {
          subscription.unsubscribe?.();
          unsubNodes();
          unsubHabits();
        };
      } catch (error) {
        console.error('[App Init] CRITICAL FAILURE during bootstrap:', error);
        setLoading(false);
        setRepositoriesReady(true);
      }
    };

    const authPromise = initApp();

    return () => {
      authPromise.then(cleanup => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, [initializeNodes, setEngagementMap, setSession]);

  return { loading, repositoriesReady };
};
