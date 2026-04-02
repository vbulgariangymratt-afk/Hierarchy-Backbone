/**
 * Standardizes time duration formatting across the application.
 * Converts seconds (default) or minutes into "Xh Ym" or "Xm" format.
 * 
 * @param {number} value - The time value to format.
 * @param {'seconds' | 'minutes'} unit - The unit of the input value.
 * @returns {string} - The formatted string (e.g., "1h 15m", "45m").
 */
export const formatDuration = (value, unit = 'seconds') => {
    if (value === null || value === undefined || isNaN(value)) return '';

    const totalSeconds = unit === 'minutes' ? value * 60 : value;
    const totalMinutes = Math.floor(totalSeconds / 60);
    
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h > 0) {
        return `${h}h ${m}m`;
    }
    return `${m}m`;
};

/**
 * Legacy support/alternate: Returns mm:ss for timers.
 */
export const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
