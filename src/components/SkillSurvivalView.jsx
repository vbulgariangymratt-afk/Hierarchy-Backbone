import React from 'react';
import { NodeTypes, TaskStatuses, habitService } from '../backbone-v2/index';

/**
 * Energy 1-2 Survival View for a Skill.
 * Displays a minimal interface focusing on maintenance habits when energy is low.
 */
const SkillSurvivalView = ({
    skill,
    energyLevel,
    allNodes,
    habits,
    navigate,
    handleHabitComplete,
    getChildren
}) => {
    // Find a suitable MVE task for low energy (not used in current UI but logic preserved)
    const mveTask = allNodes.find(n => 
        n.type === NodeTypes.TASK && 
        n.metadata?.status !== TaskStatuses.DONE &&
        n.metadata?.isLowEnergySafe !== false &&
        getChildren(n.parentId, NodeTypes.TASK).some(t => {
            const aspect = allNodes.find(a => a.id === n.parentId);
            const obj = allNodes.find(o => o.id === aspect?.parentId);
            return obj?.parentId === skill.id;
        })
    );

    let displayedHabits = habits;
    if (energyLevel === 1) {
        // In Energy 1, only show the most "stable" and "light" habits
        const getHabitScore = (habit) => {
            const completions = habit.completions || [];
            const frictionScores = { light: 1, medium: 2, heavy: 3 };
            const last8 = completions.slice(-8);
            const avgFriction = last8.length > 0 
                ? last8.reduce((sum, c) => sum + frictionScores[c.friction], 0) / last8.length 
                : 3;
            const twelveDaysAgo = Date.now() - (12 * 24 * 60 * 60 * 1000);
            const uniqueDays = new Set(completions.filter(c => c.timestamp >= twelveDaysAgo).map(c => new Date(c.timestamp).toLocaleDateString('en-CA'))).size;
            const stability = uniqueDays / 12;
            return avgFriction - (stability * 2); 
        };
        displayedHabits = [...habits].sort((a, b) => getHabitScore(a) - getHabitScore(b)).slice(0, 2);
    }

    return (
        <div className="skill-page energy-survival-mode" style={{ background: 'var(--bg-app)', minHeight: '100vh', padding: '40px' }}>
            <button className="back-button" onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '40px' }}>
                <span>&larr;</span> Back
            </button>
            
            <div style={{ maxWidth: '440px', margin: '60px auto 0 auto', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', color: '#fff', marginBottom: '8px', fontWeight: 800, letterSpacing: '-0.03em' }}>Fuel: {skill.name}</h1>
                <p style={{ color: '#444', fontSize: '15px', marginBottom: '48px', fontWeight: 500 }}>Just a tiny win for your future self.</p>

                {/* Maintenance Habits Section */}
                {displayedHabits.length > 0 && (
                    <div style={{ marginTop: '48px', textAlign: 'left' }}>
                        <div style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.05)' }}></div>
                            Maintenance
                            <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.05)' }}></div>
                        </div>
                        <div className="survival-habits-grid" style={{ display: 'grid', gap: '12px' }}>
                            {displayedHabits.map(habit => (
                                <div 
                                    key={habit.id} 
                                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <div>
                                        <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{habit.ifTrigger} &rarr; {habit.phases[habit.currentPhaseLevel || 0]?.description}</div>
                                        <div style={{ color: '#444', fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>{habitService.getHabitProgress(habit).displayProgress}</div>
                                    </div>
                                    <button 
                                        onClick={() => handleHabitComplete(habit.id)}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Done
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button 
                     onClick={() => navigate('/launchpad')}
                     style={{ marginTop: '32px', background: 'transparent', border: 'none', color: '#333', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}
                >
                    Go back to Launchpad
                </button>
            </div>
        </div>
    );
};

export default SkillSurvivalView;
