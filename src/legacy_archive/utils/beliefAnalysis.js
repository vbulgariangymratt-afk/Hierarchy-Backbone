/**
 * Belief Analysis Utilities
 * Helper functions for analyzing belief timelines and correlating with manifestation events
 */

/**
 * Get chronological timeline of sessions for a specific belief
 * @param {Object} belief - The belief object with sessions array
 * @returns {Array} Sorted sessions from oldest to newest
 */
export function getBeliefTimeline(belief) {
    if (!belief || !belief.sessions || belief.sessions.length === 0) {
        return [];
    }

    return [...belief.sessions].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );
}

/**
 * Find journal unusual events within N days of a belief session
 * @param {Object} session - The belief session to correlate
 * @param {Object} journal - The journal entries object (date -> entry)
 * @param {number} daysWindow - Number of days after session to search (default 7)
 * @returns {Array} Array of {date, event} objects that occurred after the session
 */
export function findTemporalCorrelations(session, journal, daysWindow = 7) {
    if (!session || !session.date || !journal) return [];

    const sessionDate = new Date(session.date);
    const correlatedEvents = [];

    Object.entries(journal).forEach(([dateStr, entry]) => {
        if (!entry.unusualEvents || entry.unusualEvents.length === 0) return;

        const entryDate = new Date(dateStr);
        const daysDiff = Math.floor((entryDate - sessionDate) / (1000 * 60 * 60 * 24));

        // Check if event is within the window after the session
        if (daysDiff >= 0 && daysDiff <= daysWindow) {
            entry.unusualEvents.forEach(event => {
                correlatedEvents.push({
                    date: dateStr,
                    event: event.description,
                    daysAfter: daysDiff
                });
            });
        }
    });

    return correlatedEvents.sort((a, b) => a.daysAfter - b.daysAfter);
}

/**
 * Analyze naturalness progress for a belief
 * @param {Object} belief - The belief object
 * @returns {Object} Stats about naturalness trends
 */
export function analyzeNaturalnessProgress(belief) {
    const timeline = getBeliefTimeline(belief);

    if (timeline.length === 0) {
        return {
            average: 0,
            latest: 0,
            trend: 'none',
            improvement: 0,
            sessions: 0
        };
    }

    const naturalnessValues = timeline.map(s => Number(s.naturalness) || 0);
    const average = naturalnessValues.reduce((a, b) => a + b, 0) / naturalnessValues.length;
    const latest = naturalnessValues[naturalnessValues.length - 1];
    const first = naturalnessValues[0];
    const improvement = latest - first;

    // Simple trend analysis
    let trend = 'stable';
    if (timeline.length >= 3) {
        const recentAvg = naturalnessValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const earlyAvg = naturalnessValues.slice(0, 3).reduce((a, b) => a + b, 0) / 3;

        if (recentAvg - earlyAvg > 1) trend = 'improving';
        else if (recentAvg - earlyAvg < -1) trend = 'declining';
    }

    return {
        average: average.toFixed(1),
        latest,
        trend,
        improvement: improvement.toFixed(1),
        sessions: timeline.length
    };
}

/**
 * Suggest which belief might correlate with an unusual event
 * @param {string} eventDate - Date of the unusual event
 * @param {string} eventDescription - Description of the event
 * @param {Object} beliefs - All beliefs object
 * @param {number} lookbackDays - How many days back to check for sessions (default 14)
 * @returns {Array} Suggested beliefs with correlation scores
 */
export function suggestEventCorrelations(eventDate, eventDescription, beliefs, lookbackDays = 14) {
    if (!beliefs || Object.keys(beliefs).length === 0) return [];

    const eventDateObj = new Date(eventDate);
    const suggestions = [];

    Object.values(beliefs).forEach(belief => {
        if (!belief.sessions || belief.sessions.length === 0) return;

        // Find recent sessions before the event
        const recentSessions = belief.sessions.filter(session => {
            const sessionDate = new Date(session.date);
            const daysDiff = Math.floor((eventDateObj - sessionDate) / (1000 * 60 * 60 * 24));
            return daysDiff >= 0 && daysDiff <= lookbackDays;
        });

        if (recentSessions.length === 0) return;

        // Calculate correlation score
        const latestSession = recentSessions.sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        )[0];

        const daysAgo = Math.floor((eventDateObj - new Date(latestSession.date)) / (1000 * 60 * 60 * 24));

        // Score based on: naturalness level, letting go status, and time proximity
        let score = 0;

        // Higher naturalness = stronger correlation
        score += (Number(latestSession.naturalness) || 0) * 2;

        // Detached status indicates stronger manifestation potential
        const lgStatusScores = {
            'detached': 10,
            'letting-go': 7,
            'slight-obsession': 3,
            'very-obsessed': 1
        };
        score += lgStatusScores[latestSession.lettingGoStatus] || 0;

        // Closer in time = more likely correlation (exponential decay)
        score += Math.max(0, 20 - (daysAgo * 2));

        // Keyword matching (simple)
        if (belief.statement && eventDescription) {
            const beliefWords = belief.statement.toLowerCase().split(/\s+/);
            const eventWords = eventDescription.toLowerCase().split(/\s+/);
            const commonWords = beliefWords.filter(w => w.length > 3 && eventWords.includes(w));
            score += commonWords.length * 5;
        }

        suggestions.push({
            beliefId: belief.id,
            beliefStatement: belief.statement,
            score,
            latestSession: {
                date: latestSession.date,
                naturalness: latestSession.naturalness,
                lettingGoStatus: latestSession.lettingGoStatus,
                daysAgo
            }
        });
    });

    return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 3); // Return top 3 matches
}

/**
 * Generate analysis context for Warhead AI
 * @param {Object} state - The application state
 * @returns {string} Formatted text for AI context
 */
export function getBeliefsAnalysisContext(state) {
    if (!state.beliefs || Object.keys(state.beliefs).length === 0) {
        return "No beliefs are currently being tracked.";
    }

    let context = "=== BELIEF TRACKING DATA ===\n\n";

    Object.values(state.beliefs).forEach(belief => {
        const analysis = analyzeNaturalnessProgress(belief);
        const timeline = getBeliefTimeline(belief);

        context += `Belief: "${belief.statement || 'Unnamed'}"\n`;
        context += `  Status: ${belief.isDone ? 'Satisfied/Complete' : 'Active'}\n`;
        context += `  Sessions: ${analysis.sessions}\n`;
        context += `  Naturalness: Latest=${analysis.latest}/10, Average=${analysis.average}/10, Trend=${analysis.trend}\n`;

        if (timeline.length > 0) {
            const latest = timeline[timeline.length - 1];
            const lgMap = {
                'detached': 'Completely Detached',
                'letting-go': 'Letting Go',
                'slight-obsession': 'Slight Obsession',
                'very-obsessed': 'Very Obsessed'
            };
            context += `  Latest Letting Go Status: ${lgMap[latest.lettingGoStatus] || 'Unknown'} (${latest.date})\n`;

            // Show last 3 sessions
            if (timeline.length > 0) {
                context += `  Recent Sessions:\n`;
                timeline.slice(-3).forEach(s => {
                    context += `    - ${s.date}: Naturalness ${s.naturalness}/10, ${lgMap[s.lettingGoStatus] || 'Unknown'}\n`;
                });
            }
        }

        // Check for correlations with journal events
        if (state.journal) {
            const correlations = timeline.flatMap(session =>
                findTemporalCorrelations(session, state.journal, 7)
            );

            if (correlations.length > 0) {
                context += `  Correlated Events (within 7 days of sessions):\n`;
                correlations.slice(0, 3).forEach(corr => {
                    context += `    - ${corr.date} (+${corr.daysAfter} days): ${corr.event}\n`;
                });
            }
        }

        context += `\n`;
    });

    // Add journal unusual events summary
    if (state.journal) {
        const allEvents = [];
        Object.entries(state.journal).forEach(([date, entry]) => {
            if (entry.unusualEvents && entry.unusualEvents.length > 0) {
                entry.unusualEvents.forEach(event => {
                    allEvents.push({ date, description: event.description });
                });
            }
        });

        if (allEvents.length > 0) {
            context += `=== UNUSUAL EVENTS / SYNCHRONICITIES ===\n\n`;
            allEvents.slice(-10).forEach(event => {
                context += `${event.date}: ${event.description}\n`;
            });
        }
    }

    return context;
}
