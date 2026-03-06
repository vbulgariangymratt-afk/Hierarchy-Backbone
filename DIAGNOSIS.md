# Calendar Sync Diagnosis

## Issue
Activities scheduled in the language calendar (SubCalendar on Languages area page) are not appearing in the main Calendar page.

## Root Cause Analysis

Both calendars use the same data source (`state.tasks`) and the same scheduling function (`scheduleTask`). When you schedule a task in SubCalendar:

```javascript
scheduleTask(taskId, dateStr, snappedTime, task?.duration || 60);
```

This updates the task with:
- `scheduledDate`: The date string (e.g., "2026-01-28")
- `startTime`: The time string (e.g., "14:00")
- `duration`: Duration in minutes (e.g., 60)

The main Calendar filters tasks like this:
```javascript
const scheduledTasks = Object.values(state.tasks || {}).filter(t => t.scheduledDate && t.startTime);
```

## Possible Issues

1. **State not syncing**: The state might not be updating properly between page navigations
2. **Data persistence**: The scheduled tasks might not be saving to the cloud/local storage
3. **Filtering issue**: There might be additional filtering that excludes language tasks

## Solution

The tasks SHOULD be appearing in both calendars since they share the same data source. Let's verify:

1. Check if tasks have `scheduledDate` and `startTime` set
2. Ensure state is persisting correctly
3. Add console logging to track task scheduling

## Next Steps

Run the app and check the browser console for any errors when scheduling tasks in the language calendar.
