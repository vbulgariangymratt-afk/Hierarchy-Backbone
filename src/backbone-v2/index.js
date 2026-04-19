import { HierarchyService } from './application/hierarchyService';
import { AuraService } from './application/auraService';
import { JournalService } from './application/journalService';
import { createPersistentRepository } from './infrastructure/persistentRepository';
import { createJournalRepository } from './infrastructure/journalRepository';
import { NodeTypes, ObjectiveStatuses, TaskStatuses, IdentityTiers } from './domain/entities';

import { createHabitRepository } from '../habit-engine/habitRepository';
import { createHabitService } from '../habit-engine/habitService';
import { TimelineService } from './application/timelineService';


/**
 * Hierarchy Backbone V2 - Singleton Environment
 * 
 * This module ensures the backbone repository and services are stable
 * singletons, persisting across HMR reloads where possible by using 
 * the globalThis context.
 */

const getInstance = () => {
    const key = '__BACKBONE_V2_SINGLETON__';

    if (globalThis[key]) {
        // Update methods on existing singleton to prevent HMR staling
        const existing = globalThis[key];
        const repository = existing.repository;
        const journalRepo = existing.journalRepo || createJournalRepository();
        const auraService = AuraService(repository);
        const backbone = HierarchyService(repository, auraService);
        const habitService = createHabitService(existing.habitRepo, auraService, backbone);
        const journalService = JournalService(journalRepo, backbone, habitService);
        const timelineService = TimelineService(backbone, habitService, journalService);

        existing.auraService = auraService;
        existing.backbone = backbone;
        existing.habitService = habitService;
        existing.journalRepo = journalRepo;
        existing.journalService = journalService;
        existing.timelineService = timelineService;

        return existing;
    }


    // 1. Initialize persistent repositories
    const repository = createPersistentRepository();
    const journalRepo = createJournalRepository();

    // 2. Initialize Aura Service (Dependency for Hierarchy and Habits)
    const auraService = AuraService(repository);

    // 3. Initialize Hierarchy System
    const backbone = HierarchyService(repository, auraService);

    // 4. Initialize Habit Engine
    const habitRepo = createHabitRepository();
    const habitService = createHabitService(habitRepo, auraService, backbone);

    // 5. Initialize Journal System
    const journalService = JournalService(journalRepo, backbone, habitService);

    // 6. Initialize Timeline Service
    const timelineService = TimelineService(backbone, habitService, journalService);


    // Initial triggers
    const readyPromise = Promise.all([
        repository.initialize(),
        journalRepo.initialize(),
        backbone.initialize(),
        habitService.initialize(),
        journalService.initialize()
    ]).then(() => {
        return true;
    }).catch(err => {
        console.error('Backbone V2: Error during system initialization', err);
        return false;
    });

    globalThis[key] = {
        backbone,
        repository,
        auraService,
        habitRepo,
        habitService,
        journalRepo,
        journalService,
        timelineService,
        waitForReady: () => readyPromise
    };


    return globalThis[key];
};

const {
    backbone,
    repository,
    auraService,
    habitRepo,
    habitService,
    journalRepo,
    journalService,
    timelineService,
    waitForReady
} = getInstance();


import { logToFile } from '../lib/logger';

const _doReload = async () => {
    
    if (!backbone || typeof backbone.initialize !== 'function') {
        return false;
    }

    await logToFile('Triggering reloadAllData after SIGNED_IN');
    
    await logToFile('Reloading areas and core nodes...');
    if (repository && typeof repository.reinitialize === 'function') {
        await repository.reinitialize();
    }
    
    await logToFile('Reloading journal and habits...');
    await Promise.all([
        journalRepo?.reinitialize ? journalRepo.reinitialize() : Promise.resolve(),
        habitRepo?.reinitialize ? habitRepo.reinitialize() : Promise.resolve(),
        backbone.initialize ? backbone.initialize() : Promise.resolve(),
        journalService?.initialize ? journalService.initialize() : Promise.resolve()
    ]);

    await logToFile('Reload complete');
    return true;
};

export const reloadAllData = async () => {
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('reloadAllData timed out after 15s')), 15000)
    );
    try {
        return await Promise.race([_doReload(), timeout]);
    } catch (err) {
        console.error('Backbone V2: reloadAllData failed or timed out:', err);
        await logErrorToFile('reloadAllData (SIGNED_IN)', err);
        return false;
    }
};



export const clearAllData = () => {
    habitRepo?.reset?.();
    repository?.reset?.();
    journalRepo?.reset?.(); // Added journalRepo for completeness if available
};

export {
    backbone,
    repository,
    habitService,
    habitRepo,
    auraService,
    journalRepo,
    journalService,
    timelineService,
    waitForReady,

    NodeTypes,
    ObjectiveStatuses,
    TaskStatuses,
    IdentityTiers,
    HierarchyService
};

export default backbone;
