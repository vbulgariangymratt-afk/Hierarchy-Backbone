import { useEffect } from 'react';

/**
 * Custom hook to manage keyboard shortcuts centrally.
 * @param {Object} shortcuts - Mapping of shortcut strings to callback functions.
 *                             Format: "cmd+shift+key"
 *                             Available modifiers: cmd, ctrl, alt, shift
 */
export const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    // Pre-parse shortcuts for slight performance gain and cleaner comparison logic
    const parsedShortcuts = Object.entries(shortcuts).map(([shortcutStr, callback]) => {
      const parts = shortcutStr.toLowerCase().split('+');
      
      const needsCmd = parts.includes('cmd') || parts.includes('meta');
      const needsCtrl = parts.includes('ctrl');
      const needsAlt = parts.includes('alt');
      const needsShift = parts.includes('shift');
      
      const modifiers = ['cmd', 'meta', 'ctrl', 'alt', 'shift'];
      const key = parts.find(p => !modifiers.includes(p));

      return {
        needsCmd,
        needsCtrl,
        needsAlt,
        needsShift,
        key,
        callback
      };
    });

    const handleKeyDown = (e) => {
      // 1. Input Safety: Ignore if typing
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable
      );

      if (isTyping) return;

      // 2. Safety: Ignore repeats
      if (e.repeat) return;

      // 3. Match defined shortcuts
      for (const s of parsedShortcuts) {
        const matches = 
          e.metaKey === s.needsCmd &&
          e.ctrlKey === s.needsCtrl &&
          e.altKey === s.needsAlt &&
          // Match if Shift state matches exactly OR if Shift was pressed for a special char 
          // that matches the key case-sensitively (e.g. Cmd + { where { implies Shift).
          (e.shiftKey === s.needsShift || (e.shiftKey && !s.needsShift && e.key === s.key)) &&
          e.key.toLowerCase() === s.key;

        if (matches) {
          // 4. Default behavior prevention
          e.preventDefault();
          s.callback(e);
          break; // Stop after first match
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};
