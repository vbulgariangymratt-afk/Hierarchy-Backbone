import { useState, useEffect, useCallback, useRef } from 'react';
import { backbone, repository, habitService } from '../backbone-v2/index';

/**
 * Custom hook to manage skill page data fetching and subscriptions.
 * 
 * @param {string} id - The skill ID from params
 * @param {Object} isReorderingRef - Ref to track if a drag-and-drop reorder is in progress
 * @returns {Object} - Skill data, loading state, and fetch functions
 */
export const useSkillPageData = (id, isReorderingRef) => {
    const [skill, setSkill] = useState(null);
    const [allNodes, setAllNodes] = useState([]);
    const allNodesRef = useRef([]);
    const [loading, setLoading] = useState(true);
    const [skillHabits, setSkillHabits] = useState([]);

    const fetchSkills = useCallback(async () => {
        try {
            const [nodes, habitsData] = await Promise.all([
                repository.getAll(),
                habitService.getHabitsBySkill(id)
            ]);
            
            setAllNodes(nodes);
            allNodesRef.current = nodes;
            setSkillHabits(habitsData || []);
            
            const skillNode = nodes.find(n => n.id === id);
            if (skillNode) {
                setSkill(skillNode);
            } else {
                setSkill(null);
            }
        } catch (error) {
            console.error("Failed to fetch skills and habits:", error);
            throw error;
        }
    }, [id]);

    const fetchData = useCallback(async () => {
        try {
            await fetchSkills();
        } catch (error) {
            console.error("Failed to fetch skill hierarchy:", error);
        } finally {
            setLoading(false);
        }
    }, [fetchSkills]);

    // Check expirations and subscribe to repository changes
    useEffect(() => {
        const init = async () => {
            await backbone.checkExpirations();
            fetchData();
        };
        init();
        
        const sub1 = repository.subscribe((changedId) => {
            // Don't re-fetch if we're currently reordering via drag-and-drop
            if (isReorderingRef.current) return;
            
            if (changedId !== null && changedId !== id) {
                const isDescendant = (() => {
                    let current = allNodesRef.current.find(n => n.id === changedId);
                    if (!current) { 
                        // If node isn't found, it might be new or deleted, better fetch to be safe
                        fetchData(); 
                        return; 
                    }
                    while (current) {
                        if (current.parentId === id) return true;
                        current = allNodesRef.current.find(n => n.id === current.parentId);
                    }
                    return false;
                })();
                
                if (!isDescendant) return;
            }
            
            fetchData();
        });
        
        return () => sub1();
    }, [fetchData, id, isReorderingRef]);

    return {
        skill,
        allNodes,
        loading,
        skillHabits,
        setAllNodes,
        setSkillHabits,
        fetchData,
        fetchSkills
    };
};

export default useSkillPageData;
