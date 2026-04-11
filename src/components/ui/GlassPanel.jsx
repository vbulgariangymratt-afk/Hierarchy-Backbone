import React from 'react';
import './GlassPanel.css';

/**
 * GlassPanel Component
 * 
 * A reusable container that implements the Liquid Glass UI system.
 * Uses the Design Token system for blur, transparency, and borders.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {'primary' | 'secondary' | 'floating'} props.variant - Visual style variant
 * @param {string} props.className - Additional CSS classes
 */
const GlassPanel = ({
    children,
    variant = 'primary',
    className = '',
    style = {},
    ...props
}) => {
    return (
        <div
            className={`glass-panel glass-panel-${variant} ${className}`}
            style={style}
            {...props}
        >
            {/* Content layer */}
            <div className="glass-content">
                {children}
            </div>
        </div>
    );
};

export default GlassPanel;
