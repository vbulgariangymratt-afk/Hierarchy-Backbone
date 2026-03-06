import { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { flattenState } from '../services/dataAggregator';

export const useAIAnalyst = () => {
    const { state } = useStore();

    const insights = useMemo(() => {
        const generatedInsights = [];
        const timeSeries = flattenState(state);
        if (timeSeries.length === 0) {
            return [{
                id: 'gathering-data',
                type: 'info',
                title: 'Awaiting Records',
                description: "I need a few days of data to start finding patterns. Keep logging your mood and habits!",
                question: null
            }];
        }

        const latest = timeSeries[timeSeries.length - 1];

        // --- RULE 1: Sleep & Productivity Correlation ---
        const sleepProductivityLink = timeSeries.filter(d => d.sleepDuration !== null && d.habitCompletionRate !== null);
        if (sleepProductivityLink.length >= 3) {
            const shortSleepDays = sleepProductivityLink.filter(d => d.sleepDuration < 6.5);
            const lowPerfShortSleep = shortSleepDays.filter(d => d.habitCompletionRate < 0.4);

            if (shortSleepDays.length > 0 && (lowPerfShortSleep.length / shortSleepDays.length) > 0.6) {
                generatedInsights.push({
                    id: 'sleep-impact',
                    type: 'warning',
                    title: 'Sleep-Performance Link',
                    description: `I've noticed that ${Math.round((lowPerfShortSleep.length / shortSleepDays.length) * 100)}% of the time you sleep less than 6.5 hours, your habit completion drops below 40%.`,
                    question: "Would you like to set a 'Wind Down' reminder for 10 PM?"
                });
            }
        }

        // --- RULE 2: Medication Efficacy (Anxiety Focus) ---
        const focusedMeds = ['Sertralina', 'Omega 3'];
        focusedMeds.forEach(medName => {
            const medDays = timeSeries.filter(d => d.meds.includes(medName) && d.anxiety !== null);
            const nonMedDays = timeSeries.filter(d => !d.meds.includes(medName) && d.anxiety !== null);

            if (medDays.length >= 2 && nonMedDays.length >= 2) {
                const avgAnxietyMed = medDays.reduce((acc, d) => acc + d.anxiety, 0) / medDays.length;
                const avgAnxietyNoMed = nonMedDays.reduce((acc, d) => acc + d.anxiety, 0) / nonMedDays.length;

                if (avgAnxietyNoMed - avgAnxietyMed > 1.5) {
                    generatedInsights.push({
                        id: `med-efficacy-${medName}`,
                        type: 'success',
                        title: `${medName} Effectiveness`,
                        description: `Your average anxiety is significantly lower (${Math.round(avgAnxietyMed)}/10) on days you take ${medName} compared to days you don't (${Math.round(avgAnxietyNoMed)}/10).`,
                        question: `Did you notice feeling calmer after taking ${medName} lately?`
                    });
                }
            }
        });

        // --- RULE 3: Burnout Warning ---
        if (timeSeries.length >= 4) {
            const last4 = timeSeries.slice(-4);
            const highAnxietyStreak = last4.every(d => d.anxiety >= 7);
            const decliningHabits = last4[3].habitCompletionRate < last4[0].habitCompletionRate;

            if (highAnxietyStreak && decliningHabits) {
                generatedInsights.push({
                    id: 'burnout-alert',
                    type: 'danger',
                    title: 'Burnout Warning',
                    description: "You've had 4 days of high anxiety and your productivity is starting to dip. This is a classic burnout pattern.",
                    question: "Can we schedule a 'Zero Task' day tomorrow to reset?"
                });
            }
        }

        // --- RULE 4: Retail Therapy Check ---
        if (latest.anxiety > 7 || latest.overthinking > 7) {
            const lowCostReward = Object.values(state.rewards || {}).find(r => r.cost < 20);
            if (lowCostReward) {
                generatedInsights.push({
                    id: 'anxiety-reward',
                    type: 'suggestion',
                    title: 'Stress Relief',
                    description: `Stress levels are high today. Maybe '${lowCostReward.name}' would be a healthy way to decompress?`,
                    question: null
                });
            }
        }


        // --- RULE 5: Habit Level-Up Alert ---
        Object.values(state.habits || {}).forEach(habit => {
            const level = habit.integrationLevel || 0;
            const targets = [7, 14, 21];
            const currentTarget = targets[level];

            if (currentTarget && (habit.stabilityScore || 0) >= currentTarget && level < 3) {
                generatedInsights.push({
                    id: `habit-levelup-${habit.id}`,
                    type: 'success',
                    title: 'Level Up Available',
                    description: `"${habit.name}" has reached ${habit.stabilityScore} days of stability in the ${level === 0 ? 'Seed' : level === 1 ? 'Sprout' : 'Mature'} phase.`,
                    question: `Are you ready to evolve this habit to the next stage?`
                });
            }
        });

        return generatedInsights;
    }, [state]);

    return insights;
};
