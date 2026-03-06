import { HierarchyService } from './application/hierarchyService';
import { AuraService } from './application/auraService';
import { JournalService } from './application/journalService';
import { createPersistentRepository } from './infrastructure/persistentRepository';
import { createJournalRepository } from './infrastructure/journalRepository';
import { NodeTypes, ObjectiveStatuses, TaskStatuses, IdentityTiers } from './domain/entities';

import { createHabitRepository } from '../habit-engine/habitRepository';
import { createHabitService } from '../habit-engine/habitService';

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

        existing.auraService = auraService;
        existing.backbone = backbone;
        existing.habitService = habitService;
        existing.journalRepo = journalRepo;
        existing.journalService = journalService;

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

    // Initial triggers
    repository.initialize();
    journalRepo.initialize();
    backbone.initialize();
    habitService.initialize();
    journalService.initialize();

    globalThis[key] = {
        backbone,
        repository,
        auraService,
        habitRepo,
        habitService,
        journalRepo,
        journalService
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
    journalService
} = getInstance();

export {
    backbone,
    repository,
    habitService,
    habitRepo,
    auraService,
    journalRepo,
    journalService,
    NodeTypes,
    ObjectiveStatuses,
    TaskStatuses,
    IdentityTiers,
    HierarchyService
};

export default backbone;
