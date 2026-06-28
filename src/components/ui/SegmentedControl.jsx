import React from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import './SegmentedControl.css';

const SPRING = {
    type: 'spring',
    damping: 20,
    stiffness: 230,
    mass: 1.2,
};

/**
 * SegmentedControl
 *
 * A reusable animated segmented pill — identical animation to the
 * appearance-mode switchers in the header. All Framer Motion layoutId
 * logic lives here once; callers just pass options + state.
 *
 * Props
 * ─────
 * options      – Array of { id, title, icon } objects
 * value        – Currently active id (string)
 * onChange     – Called with the new id when the user clicks
 * layoutPrefix – REQUIRED unique string per instance (e.g. "tier", "theme")
 *                Prevents layoutId collisions between multiple controls on the page
 * buttonSize   – Collapsed button size in px (default 28 — matches header switchers)
 * fontSize     – Label font size (default '0.8rem')
 * activePadding– Horizontal padding when expanded (default '0 12px')
 */
const SegmentedControl = ({
    options,
    value,
    onChange,
    layoutPrefix,
    buttonSize = 28,
    fontSize = '0.8rem',
    activePadding = '0 12px',
}) => {
    return (
        <LayoutGroup id={layoutPrefix}>
            {/*
              LayoutGroup isolates this component's layout measurements from the
              rest of the page. Without it, any AnimatePresence animation
              elsewhere (e.g. a fading list below) can shift bounding rects
              mid-frame and cause the sliding pill to teleport instead of slide.
              Always keep this wrapper whenever layoutId is used inside a
              component that lives near other animated content.
            */}
        <div
            className="segmented-control"
            style={{ '--sc-button-size': `${buttonSize}px` }}
        >
            {options.map((item) => {
                const isActive = value === item.id;
                const Icon = item.icon;
                return (
                    <motion.button
                        key={item.id}
                        type="button"
                        className={`sc-btn ${isActive ? 'active' : ''}`}
                        onClick={() => onChange(item.id)}
                        layoutId={`${layoutPrefix}-btn-${item.id}`}
                        transition={{ layout: SPRING }}
                        style={{
                            position: 'relative',
                            fontSize,
                            padding: isActive ? activePadding : '0',
                        }}
                    >
                        {/* Sliding pill — stays inside its own button so inset:0 always works */}
                        {isActive && (
                            <motion.div
                                layoutId={`${layoutPrefix}-active-pill`}
                                className="sc-pill"
                                transition={SPRING}
                            />
                        )}

                        {/* Icon + label row */}
                        <motion.div className="sc-content" layout>
                            <motion.div
                                layoutId={`${layoutPrefix}-icon-${item.id}`}
                                className="sc-icon-wrapper"
                            >
                                <Icon size={14} className="sc-icon" />
                            </motion.div>

                            {isActive && (
                                <motion.span
                                    className="sc-label"
                                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                                    transition={{ duration: 0.2, ease: [0.86, 0, 0.07, 1] }}
                                >
                                    {item.title}
                                </motion.span>
                            )}
                        </motion.div>
                    </motion.button>
                );
            })}
        </div>
        </LayoutGroup>
    );
};

export default SegmentedControl;
