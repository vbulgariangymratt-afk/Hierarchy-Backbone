import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
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
      try {
        // --- STEP 1: Recover session first & set UID immediately to prevent startup reload race ---
        let initialSession = null;
        try {
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 4000));
          const result = await Promise.race([sessionPromise, timeoutPromise]);
          initialSession = result?.data?.session || null;
        } catch (authErr) {
          console.warn('[App Init] Session recovery warning:', authErr);
        }

        if (initialSession?.user?.id) {
          _lastKnownUid = initialSession.user.id;
          posthog.identify(initialSession.user.id, {
            email: initialSession.user.email
          });
          Sentry.setUser({
            id: initialSession.user.id,
            email: initialSession.user.email
          });
        }

        // --- STEP 2: Hydrate backbone with safety timeout ---
        const bootstrapPromise = (async () => {
          if (backbone?.initialize) {
            await backbone.initialize();
          }
          const allNodes = await backbone.getAllNodes();
          initializeNodes(allNodes);

          if (initialSession?.user?.id) {
            if (repository?.migrateGuestData) await repository.migrateGuestData(initialSession.user.id);
            if (habitRepo?.migrateGuestData) await habitRepo.migrateGuestData(initialSession.user.id);
            if (journalRepo?.migrateGuestData) await journalRepo.migrateGuestData(initialSession.user.id);
          }
        })();

        // Cap bootstrap wait at 6s so the UI never deadlocks
        const bootstrapTimeout = new Promise(resolve => setTimeout(resolve, 6000));
        await Promise.race([bootstrapPromise, bootstrapTimeout]);

        setSession(initialSession);
        setLoading(false);
        setRepositoriesReady(true);

        // --- STEP 3: Listen for auth state changes ---
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          setSession(newSession);

          if (event === 'SIGNED_IN' && newSession?.user?.id) {
            posthog.identify(newSession.user.id, {
              email: newSession.user.email
            });
            Sentry.setUser({
              id: newSession.user.id,
              email: newSession.user.email
            });

            // Only trigger reload if user explicitly switched or logged in fresh after startup
            const isDifferentUser = _lastKnownUid && newSession.user.id !== _lastKnownUid;
            
            if (isDifferentUser && !_isReloading) {
              _isReloading = true;
              _lastKnownUid = newSession.user.id;
              setRepositoriesReady(false);
              try {
                await new Promise(r => setTimeout(r, 300));
                if (repository?.migrateGuestData) await repository.migrateGuestData(newSession.user.id);
                if (habitRepo?.migrateGuestData) await habitRepo.migrateGuestData(newSession.user.id);
                if (journalRepo?.migrateGuestData) await journalRepo.migrateGuestData(newSession.user.id);

                await reloadAllData();
                initializeNodes(await backbone.getAllNodes());
              } catch (err) {
                console.error('[App] Reload failed after sign-in:', err);
              } finally {
                _isReloading = false;
                setRepositoriesReady(true);
              }
            } else {
              _lastKnownUid = newSession.user.id;
            }
          }

          if (event === 'SIGNED_OUT') {
            _lastKnownUid = null;
            posthog.reset();
            Sentry.setUser(null);
            clearAllData();
            initializeNodes([]);
            setRepositoriesReady(true);
          }
        });
        
        // --- STEP 4: Real-time Reactive Sync Loop ---
        const syncStore = async () => {
          const nodes = await backbone.getAllNodes();
          const habits = habitRepo ? habitRepo.getAll() : [];
          
          const newMap = {};
          nodes.filter(n => n.type === NodeTypes.SKILL).forEach(skill => {
            newMap[skill.id] = getSkillEngagementStatus(skill.id, nodes, habits);
          });
          
          setEngagementMap(newMap);
          initializeNodes(nodes);
        };

        const unsubNodes = repository.subscribe(syncStore);
        const unsubHabits = habitRepo.subscribe(syncStore);

        await syncStore();

        return () => {
          subscription.unsubscribe?.();
          unsubNodes();
          unsubHabits();
        };
      } catch (error) {
        console.error('[App Init] Initialization error caught:', error);
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
