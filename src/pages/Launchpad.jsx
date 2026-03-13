import React, { useState, useEffect } from 'react';
import { backbone } from '../backbone-v2/index';
import LaunchpadView from '../components/LaunchpadView';

/**
 * Launchpad Controller - Enriched to support Maintenance and Stage Pips
 */
const Launchpad = () => {
    const [data, setData] = useState({
        auraPoints: 0,
        hryvniaBalance: 0,
        areas: [],
        maintenance: null,
        loading: true
    });

    const fetchData = async () => {
        try {
            const auraPoints = await backbone.getTotalAuraPoints();
            const hryvniaBalance = await backbone.getHryvniaBalance();
            const areas = await backbone.getTopPriorityAreas();
            const maintenance = await backbone.getTodayRest();

            setData({
                auraPoints,
                hryvniaBalance,
                areas,
                maintenance,
                loading: false
            });
        } catch (error) {
            console.error("Failed to fetch launchpad data:", error);
            setData(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        fetchData();
        // Removed interval to prevent state-override bugs during planning
    }, []);

    const handleStartDay = async (selectedAreaIds) => {
        console.log("Launchpad (Controller): Starting day with selected areas:", selectedAreaIds);
        await backbone.saveSelectedAreas(selectedAreaIds);
        await backbone.trackFocusMode(true);
    };

    const handleMaintenanceComplete = async (restId) => {
        await backbone.completeRest(restId);
        fetchData();
    };

    const handleMaintenanceReplace = async (restId) => {
        await backbone.createDailyRestSuggestion();
        fetchData();
    };

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
            onStartDay={handleStartDay}
            onMaintenanceComplete={handleMaintenanceComplete}
            onMaintenanceReplace={handleMaintenanceReplace}
        />
    );
};

export default Launchpad;
