import React, { useState, useEffect } from 'react';
import { habitService } from '../../backbone-v2/index';
import './HabitEvolutionGauge.css';

const CACHE_TTL = 10000; // 10s caching for sidebar rerenders
const eligibilityCache = new Map();

const HabitEvolutionGauge = ({ habit, compact = false, todayCount = 0 }) => {
    if (!habit) return null;
    
    const habitId = habit.id;
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

    const validCompletions = (habit?.completions || []).filter(c => c.friction !== 'heavy' && c.friction !== 'high').length;
    const requiredCompletions = gateStatus.lifetime.required || 1;
    const completionsRemaining = Math.max(0, requiredCompletions - validCompletions);
    const barPercentage = Math.min(100, (validCompletions / requiredCompletions) * 100);
    const loadPercentage = Math.min(100, Math.max(0, Math.round(((gateStatus.friction.average - 1) / 2) * 100)));

    // Simplified Layout for both views
    return (
        <div className={`habit-evolution-gauge ${compact ? 'compact' : 'full'}`}>
            <div className={`mastery-bar-container ${todayCount > 0 ? 'shimmer' : ''}`} style={{ marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div className="phase-badge">Phase {habit.currentPhaseLevel + 1}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                        · {completionsRemaining > 0 ? `${completionsRemaining} more to level up` : 'In Progress'}
                    </div>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                    <div 
                        className={todayCount > 0 ? 'shimmer-fill' : ''}
                        style={{ width: `${barPercentage}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-accent) 0%, rgba(96, 165, 250, 0.8) 100%)', borderRadius: '3px', transition: 'width 0.4s ease' }} 
                    />
                </div>
            </div>
            
            <div className="system-spec-row" style={{ fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '10px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                    Stability: {gateStatus.stability.completedDays}/{gateStatus.stability.required}
                    <span title="Stabilize by hitting 8 of the last 12 days." style={{ cursor: 'help', opacity: 0.5, marginLeft: '4px', borderBottom: '1px dotted rgba(255,255,255,0.3)', lineHeight: '1' }}>(?)</span>
                </span>
                <span>Friction Index: {gateStatus.friction.average.toFixed(1)}</span>
            </div>
        </div>
    );
};

export default HabitEvolutionGauge;

