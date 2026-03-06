/**
 * Unified Date Utilities for the app
 * Handles the "Logical Day" logic (day ends at 4 AM local time)
 * and correct Local <-> String conversions to avoid UTC/Timezone shifts.
 */

/**
 * Returns a local Date object shifted by -4 hours.
 * Used to determine which "Logical Day" we are in.
 */
export const getAdjustedNow = () => {
    const now = new Date();
    const adjusted = new Date(now);
    adjusted.setHours(adjusted.getHours() - 4);
    return adjusted;
};

/**
 * Converts a Date object to a YYYY-MM-DD string using LOCAL components.
 * This avoids the common bug where .toISOString() returns the next/previous day.
 */
export const getDateString = (date = new Date()) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Robustly get the logical date string from ANY timestamp.
 * If it's a YYYY-MM-DD string, returns it as is.
 * If it's an ISO string or Date, applies the -4h adjustment.
 */
export const getLogicalDate = (ts) => {
    if (!ts) return '';
    if (typeof ts === 'string' && ts.length === 10 && ts.includes('-')) return ts;

    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';

    // Apply 4h offset for "Logical Day"
    const adjusted = new Date(d.getTime() - (4 * 60 * 60 * 1000));
    return getDateString(adjusted);
};

/**
 * Returns the YYYY-MM-DD string for "Today" (Logically adjusted to 4 AM).
 */
export const getTodayString = () => {
    return getDateString(getAdjustedNow());
};

/**
 * Safely parses a YYYY-MM-DD string into a local Date object at midnight.
 */
export const parseDateString = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Formats a YYYY-MM-DD string for premium display.
 * e.g. "2026-01-25" -> "Jan 25, 2026"
 */
export const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = parseDateString(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
};

/**
 * Cycle Logic Helper (Matches 3-day cycle: Work1, Work2, Light)
 */
export const getCycleType = (dateStr) => {
    const anchor = new Date(2026, 0, 1); // Jan 1, 2026 local
    const d = parseDateString(dateStr);
    d.setHours(0, 0, 0, 0);

    const diffTime = d.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const cycleIndex = ((diffDays % 3) + 3) % 3;
    if (cycleIndex === 0) return 'work1';
    if (cycleIndex === 1) return 'work2';
    return 'light';
};
