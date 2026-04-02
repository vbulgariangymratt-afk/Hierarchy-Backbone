import React, { useState, useEffect } from 'react';
import { habitService } from '../../backbone-v2/index';
import './HabitEvolutionGauge.css';

const CACHE_TTL = 10000; // 10s caching for sidebar rerenders
const eligibilityCache = new Map();

const HabitEvolutionGauge = ({ habitId, compact = false }) => {
    const [eligibility, setEligibility] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            const now = Date.now();
            const cached = eligibilityCache.get(habitId);

            if (cached && (now - cached.timestamp < CACHE_TTL)) {
                if (isMounted) {
                    setEligibility(cached.data);
                    setLoading(false);
                }
                return;
            }

            try {
                // IMPORTANT: Fetching exactly what's needed from the service
                const data = await habitService.evaluateEvolutionEligibility(habitId);
                eligibilityCache.set(habitId, { data, timestamp: now });
                if (isMounted) {
                    setEligibility(data);
                }
            } catch (err) {
                console.error("Failed to fetch eligibility:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [habitId]);

    if (loading || !eligibility) return null;

    const { gateStatus, evolutionReady, isCapped, nextPhaseLevel } = eligibility;

    // Gate Pass Rules (from requirement C)
    const lifetimePass = gateStatus.lifetime.current >= gateStatus.lifetime.required;
    const stabilityPass = gateStatus.stability.completedDays >= gateStatus.stability.required;
    const frictionPass = !gateStatus.friction.blockedByRecentHeavy && gateStatus.friction.average <= 2.0;

    const passedCount = [lifetimePass, stabilityPass, frictionPass].filter(Boolean).length;

    // Simplified Layout for both views
    return (
        <div className={`habit-evolution-gauge ${compact ? 'compact' : 'full'}`}>
            <div className="gauge-header">
                <span className="gauge-count">Evolution: {passedCount}/3 gates</span>
                {isCapped ? (
                    <span className="gauge-status capped">Max Phase Reached</span>
                ) : evolutionReady ? (
                    <span className="gauge-status ready">Ready to evolve → Phase {nextPhaseLevel}</span>
                ) : null}
            </div>
            
            <div className="gauge-bar-container">
                <div 
                    className={`gauge-bar-fill ${evolutionReady ? 'ready' : ''}`} 
                    style={{ width: `${(passedCount / 3) * 100}%` }} 
                />
            </div>
            
            {!evolutionReady && !isCapped && !compact && (
                <div className="gauge-details-hint" style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px' }}>
                    Lifetime: {gateStatus.lifetime.current}/{gateStatus.lifetime.required} &bull; 
                    Stability: {gateStatus.stability.completedDays}/{gateStatus.stability.required}d &bull;
                    Friction: {gateStatus.friction.average.toFixed(1)}
                </div>
            )}
        </div>
    );
};

export default HabitEvolutionGauge;

