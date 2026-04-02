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

        console.log('Backbone V2: Returning existing singleton from globalThis');
        return existing;
    }

    console.log('Backbone V2: Initializing FRESH Singleton Environment');

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
        console.log('Backbone V2: All systems READY');
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


    console.log('Backbone V2: Fresh singleton stored in globalThis');
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

export const reloadAllData = async () => {
    try {
        console.log('Backbone V2: RELOADING ALL DATA...');
        
        // Safety check requested by user
        if (!backbone || typeof backbone.initialize !== 'function') {
            console.warn('Backbone V2: backbone not initialized, skipping reload');
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
            habitService?.initialize ? habitService.initialize() : Promise.resolve(),
            backbone.initialize ? backbone.initialize() : Promise.resolve(),
            journalService?.initialize ? journalService.initialize() : Promise.resolve()
        ]);

        console.log('Backbone V2: RELOAD COMPLETE');
        await logToFile('Reload complete');
        return true;
    } catch (err) {
        console.error('Backbone V2: Critical Error during reloadAllData', err);
        await logErrorToFile('reloadAllData (SIGNED_IN)', err);
        // Important: return false instead of crashing to prevent triggering 
        // fallback node creation logic in other parts of the system.
        return false;
    }
};


export const clearAllData = () => {
    console.log('Backbone V2: CLEARING ALL DATA (Signed Out)');
    // This should ideally reset storage in repos
    // For now we rely on the fact that repos will re-init with empty if no user
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
