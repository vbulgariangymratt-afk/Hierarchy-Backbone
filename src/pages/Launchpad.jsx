import React, { useState, useEffect, useCallback } from 'react';
import { backbone, habitService, repository, habitRepo } from '../backbone-v2/index';
import { useSettings } from '../context/SettingsContext';
import LaunchpadView from '../components/LaunchpadView';

/**
 * Launchpad Controller - Enriched to support Maintenance and Stage Pips
 */
const Launchpad = () => {
    const { maintenanceSkillIds, maintenanceEnabled } = useSettings();
    const [data, setData] = useState({
        auraPoints: 0,
        hryvniaBalance: 0,
        areas: [],
        maintenance: null,
        maintenanceHabits: [],
        loading: true
    });

    const fetchData = async () => {
        try {
            const [auraPoints, hryvniaBalance, areas, maintenance, nodes] = await Promise.all([
                backbone.getTotalAuraPoints(),
                backbone.getHryvniaBalance(),
                backbone.getTopPriorityAreas(),
                backbone.getTodayRest(),
                repository.getAll()
            ]);

            // Calculate Maintenance Data
            let mHabitData = [];
            if (maintenanceEnabled && Array.isArray(maintenanceSkillIds) && maintenanceSkillIds.length > 0) {
                mHabitData = maintenanceSkillIds.map(sid => {
                    const skill = nodes.find(n => n.id === sid);
                    const allSkillHabits = habitService.getHabitsBySkill(sid) || [];
                    const dueHabits = allSkillHabits.filter(h => !habitService.getHabitProgress(h).isDone);
                    
                    // Only return skill in mHabitData if it has habits (due or not) OR needs placeholder
                    // We filter out skills that have habits but they are all done
                    if (dueHabits.length > 0 || allSkillHabits.length === 0) {
                        return { 
                            skill, 
                            habits: dueHabits,
                            hasNoHabits: allSkillHabits.length === 0
                        };
                    }
                    return null;
                }).filter(group => group && group.skill);
            }

            setData({
                auraPoints,
                hryvniaBalance,
                areas,
                maintenance,
                maintenanceHabits: mHabitData,
                loading: false
            });
        } catch (error) {
            console.error("Failed to fetch launchpad data:", error);
            setData(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        fetchData();
        
        let unsubNodes, unsubHabits;
        if (repository && repository.subscribe) unsubNodes = repository.subscribe(fetchData);
        if (habitRepo && habitRepo.subscribe) unsubHabits = habitRepo.subscribe(fetchData);

        return () => {
            if (unsubNodes) unsubNodes();
            if (unsubHabits) unsubHabits();
        };
    }, [maintenanceSkillIds, maintenanceEnabled]);

    const handleStartDay = useCallback(async (selectedAreaIds) => {
        await backbone.saveSelectedAreas(selectedAreaIds);
        await backbone.trackFocusMode(true);
    }, [backbone]);

    const handleMaintenanceComplete = useCallback(async (restId) => {
        await backbone.completeRest(restId);
        fetchData();
    }, [backbone]); // fetchData is currently not a callback but defined in same scope

    const handleMaintenanceReplace = useCallback(async (restId) => {
        await backbone.createDailyRestSuggestion();
        fetchData();
    }, [backbone]);

    const handleHabitComplete = useCallback(async (habitId) => {
        // The HabitCard now handles its own completeHabit call to capture friction.
        // We just need to wait for the repository to notify us (handled by subscription).
    }, []);

    if (data.loading) {
        return (
            <div className="launchpad-loading">
                Initializing Launchpad...
            </div>
        );
    }

    return (
        <LaunchpadView
            auraPoints={data.auraPoints}
            hryvniaBalance={data.hryvniaBalance}
            areas={data.areas}
            maintenance={data.maintenance}
            maintenanceHabitGroups={data.maintenanceHabits}
            onStartDay={handleStartDay}
            onMaintenanceComplete={handleMaintenanceComplete}
            onMaintenanceReplace={handleMaintenanceReplace}
            onHabitComplete={handleHabitComplete}
        />
    );
};

export default Launchpad;
