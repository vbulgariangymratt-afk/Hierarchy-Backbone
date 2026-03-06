import { useStore } from '../context/StoreContext';

/**
 * Custom hook to get the appropriate glass effect class based on background visibility
 * Returns 'liquid-glass' when backgrounds are shown, 'solid-bg' when hidden
 */
export const useGlassClass = () => {
    const { state } = useStore();
    return state.showBackgrounds ? 'liquid-glass' : 'solid-bg';
};
