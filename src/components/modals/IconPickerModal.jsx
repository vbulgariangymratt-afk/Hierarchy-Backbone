import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Search, X } from 'lucide-react';
import './IconPickerModal.css';

// Popular default list to show when search is empty (ADHD-friendly categories)
const POPULAR_ICONS = [
    'Brain', 'Code', 'Activity', 'Heart', 'Book', 'Target', 'Compass', 'Coffee', 
    'Music', 'Gamepad', 'Cpu', 'Terminal', 'Flame', 'Dumbbell', 'Smile', 'PenTool', 
    'Globe', 'Briefcase', 'Layers', 'GitBranch', 'Database', 'Server', 'FileCode',
    'Smartphone', 'Laptop', 'Award', 'Sparkles', 'Zap', 'Lightbulb', 'Shield',
    'TrendingUp', 'Scale', 'Settings', 'Eye', 'MessageSquare', 'Camera', 'Video',
    'Play', 'Anchor', 'Bookmark', 'Map', 'Navigation', 'Sun', 'Moon', 'Wind'
];

const EXCLUDED_KEYS = new Set([
    'createLucideIcon', 'LucideIcon', 'default', 'Icon', 'React', 'IconNode',
    'Search', 'X' // Exclude modal search helpers
]);

const IconPickerModal = ({ isOpen, onClose, onSelect, currentIcon }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef(null);

    // Auto-focus search input when opened
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Gather all valid Lucide icon names
    const allIconNames = useMemo(() => {
        return Object.keys(LucideIcons).filter(key => 
            !EXCLUDED_KEYS.has(key) &&
            /^[A-Z]/.test(key) &&
            (typeof LucideIcons[key] === 'function' || typeof LucideIcons[key] === 'object')
        );
    }, []);

    // Filtered list based on query
    const filteredIcons = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return POPULAR_ICONS;

        return allIconNames
            .filter(name => name.toLowerCase().includes(query))
            .slice(0, 120); // Cap at 120 items for rendering performance
    }, [searchQuery, allIconNames]);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <div className="icon-picker-backdrop" onClick={onClose}>
                <motion.div 
                    className="icon-picker-container"
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <header className="icon-picker-header">
                        <div className="title-section">
                            <h2>Select Icon</h2>
                            <p>Choose a custom Lucide icon for this Area</p>
                        </div>
                        <button className="icon-picker-close-btn" onClick={onClose}>
                            <X size={16} />
                        </button>
                    </header>

                    <div className="icon-picker-search-bar">
                        <Search className="search-icon" size={16} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search Lucide library (e.g. code, heart, brain)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="icon-picker-grid-container">
                        {filteredIcons.length > 0 ? (
                            <div className="icon-picker-grid">
                                {filteredIcons.map(name => {
                                    const IconComponent = LucideIcons[name];
                                    const isSelected = currentIcon === name;
                                    if (!IconComponent) return null;

                                    return (
                                        <button
                                            key={name}
                                            className={`icon-grid-item ${isSelected ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                onSelect(name);
                                                onClose();
                                            }}
                                            title={name}
                                        >
                                            <IconComponent size={20} />
                                            <span className="icon-name-label">{name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="icon-picker-empty">
                                <p>No icons match "{searchQuery}"</p>
                                <p className="hint">Try searching for simple nouns like 'star', 'file', or 'user'.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default IconPickerModal;
