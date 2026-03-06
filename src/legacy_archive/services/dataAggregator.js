/**
 * Utility to flatten the Latte app's state into a time-series format.
 * This aggregates data from journal entries, habits, and tasks into an array of day objects.
 */

export const flattenState = (state) => {
    const { journal = {}, habits = {}, tasks = {}, rewards = {}, wealthItems = {} } = state;

    // Get all unique dates from journal, habit history, and task completions
    const dateSet = new Set(Object.keys(journal));

    Object.values(habits).forEach(habit => {
        if (habit.history) {
            Object.keys(habit.history).forEach(date => dateSet.add(date));
        }
    });

    Object.values(tasks).forEach(task => {
        if (task.completedAt) {
            dateSet.add(task.completedAt);
        }
    });

    // Add dates from reward redemptions
    Object.values(rewards).forEach(reward => {
        if (reward.history) {
            Object.keys(reward.history).forEach(date => dateSet.add(date));
        }
    });

    // Sort dates chronologically
    const sortedDates = Array.from(dateSet).sort();

    return sortedDates.map(date => {
        const journalEntry = journal[date] || {};

        // Calculate habit completion rate for the day
        const totalHabits = Object.values(habits).length;
        const completedHabits = Object.values(habits).filter(h => h.history && h.history[date]).length;
        const habitCompletionRate = totalHabits > 0 ? (completedHabits / totalHabits) : 0;

        // Calculate tasks completed on this specific day
        const tasksCompletedCount = Object.values(tasks).filter(t => t.completedAt === date).length;

        // Calculate sleep duration (if both start and end exist)
        let sleepDuration = null;
        if (journalEntry.sleepStart && journalEntry.sleepEnd) {
            const start = new Date(`2000-01-01T${journalEntry.sleepStart}`);
            let end = new Date(`2000-01-01T${journalEntry.sleepEnd}`);

            // If end time is earlier than start time, it means sleep crossed midnight
            if (end < start) {
                end = new Date(`2000-01-02T${journalEntry.sleepEnd}`);
            }

            sleepDuration = (end - start) / (1000 * 60 * 60); // In hours
        }

        // Calculate rewards redeemed
        const redeemedRewards = [];
        Object.values(rewards).forEach(r => {
            if (r.history && r.history[date]) {
                redeemedRewards.push({ name: r.name, cost: r.cost, count: r.history[date] });
            }
        });

        // Calculate wealth spending (approximate daily if needed, but for now just raw items context is passed separately to LLM)
        // We will pass the full wealth state separately in the prompt context, not per-day here unless we track daily transactions.

        return {
            date,
            mood: journalEntry.moodOverview || null, // Can be text or numeric depending on implementation
            anxiety: journalEntry.anxietyLevel || null,
            overthinking: journalEntry.overthinkingLevel || null,
            sleepDuration,
            habitCompletionRate,
            tasksCompletedCount,
            redeemedRewards, // New: Financial/Dopamine data
            meds: journalEntry.meds || [],
            symptoms: journalEntry.symptoms || '',
            accomplishments: journalEntry.accomplishments || '',
            journalText: journalEntry.journalText || ''
        };
    });
};
