import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';

const macOSSpring = {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.8
};

const CARD_BORDER_RADIUS = 18;

const DroppableAspect = React.memo(({ 
    aspect, 
    aspectTasks, 
    isUntouched, 
    isNoveltyHighlighted, 
    isExpanded,
    isEditing,
    children, 
    onToggleAspect 
}) => {
    // Dropping disabled
    const setNodeRef = null;
    const isOver = false;

    return (
        <motion.div
            layout="position"
            ref={setNodeRef}
            className={`aspect-card ${isOver ? 'drag-over' : ''} ${isUntouched ? 'is-untouched' : ''} ${isNoveltyHighlighted ? 'novelty-highlight' : ''}`}
            transition={macOSSpring}
            style={{
                borderRadius: '24px',
            }}
            onClick={(e) => {
                // Don't toggle if clicking inside the aspect title area (rename interaction)
                if (e.target.closest('.aspect-title-group')) return;
                e.stopPropagation();
                onToggleAspect(aspect.id);
            }}
        >
            {isNoveltyHighlighted && (
                <div className="novelty-badge">UNEXPLORED</div>
            )}
            <div style={{ width: '100%' }}>
                {children}
            </div>
        </motion.div>
    );
}, (prev, next) => {
    const childrenSame = prev.children === next.children;
    const aspectSame = prev.aspect.id === next.aspect.id && prev.aspect.name === next.aspect.name;
    console.log('[DroppableAspect] comparator ran — childrenSame:', childrenSame, 'aspectSame:', aspectSame);
    return (
        childrenSame &&
        aspectSame &&
        prev.isUntouched === next.isUntouched &&
        prev.isNoveltyHighlighted === next.isNoveltyHighlighted &&
        prev.isExpanded === next.isExpanded &&
        prev.isEditing === next.isEditing &&
        prev.aspectTasks.length === next.aspectTasks.length &&
        prev.aspectTasks.every((t, i) => {
            const nt = next.aspectTasks[i];
            return (
                t.id === nt.id &&
                t.updatedAt === nt.updatedAt &&
                t.metadata?.status === nt.metadata?.status
            );
        })
    );
});

export default DroppableAspect;
