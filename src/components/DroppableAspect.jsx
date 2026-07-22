import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import BorderGlow from './ui/BorderGlow';

const macOSSpring = {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.8
};

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
    const { setNodeRef, isOver } = useDroppable({
        id: aspect.id,
        data: { type: 'ASPECT', aspect }
    });

    return (
        <motion.div
            layout="position"
            ref={setNodeRef}
            className={`aspect-card liquid-glass ${isOver ? 'drag-over' : ''} ${isUntouched ? 'is-untouched' : ''} ${isNoveltyHighlighted ? 'novelty-highlight' : ''}`}
            transition={macOSSpring}
            whileHover={isEditing ? {} : { y: -4 }}
            style={{
                borderRadius: '12px',
            }}
            onClick={(e) => {
                // Don't toggle if clicking inside the aspect title area (rename interaction)
                if (e.target.closest('.aspect-title-group')) return;
                e.stopPropagation();
                onToggleAspect(aspect.id);
            }}
        >
            <BorderGlow
                glowColor="260 85 65"
                backgroundColor="transparent"
                borderRadius={12}
                className="aspect-card-glow-wrapper"
            >
                <div className="card-shine" />
                {isNoveltyHighlighted && (
                    <div className="novelty-badge">UNEXPLORED</div>
                )}
                <div style={{ width: '100%' }}>
                    {children}
                </div>
            </BorderGlow>
        </motion.div>
    );
}, (prev, next) => {
    const childrenSame = prev.children === next.children;
    const aspectSame = prev.aspect.id === next.aspect.id && prev.aspect.name === next.aspect.name;
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
