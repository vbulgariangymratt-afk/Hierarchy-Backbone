import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { backbone, repository } from '../backbone-v2/index';
import { useTheme } from '../context/ThemeContext';
import './Sidebar.css';

const Sidebar = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lifeAreas, setLifeAreas] = useState([]);
    const [activeAreaIds, setActiveAreaIds] = useState(new Set());
    const [isAreasExpanded, setIsAreasExpanded] = useState(true);
    const [sectionTitle, setSectionTitle] = useState("Life Areas");
    const [isAddingArea, setIsAddingArea] = useState(false);
    const [newAreaName, setNewAreaName] = useState('');

    const [hryvniaBalance, setHryvniaBalance] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [root, areas, balance, allNodes] = await Promise.all([
                    repository.getById('ROOT'),
                    backbone.getTopPriorityAreas(),
                    backbone.getHryvniaBalance(),
                    repository.getAll()
                ]);
                setIsFocusMode(!!root?.metadata?.focusModeEntryAt);
                setLifeAreas(areas);
                setHryvniaBalance(balance);

                // Calculate which areas have active skills
                const activeSkills = allNodes.filter(n =>
                    n.type === 'SKILL' &&
                    (n.metadata?.status === 'ACTIVE' || (n.metadata?.isActive && n.metadata?.status !== 'SLEEPING'))
                );
                const activeIds = new Set(activeSkills.map(s => s.parentId));
                setActiveAreaIds(activeIds);
            } catch (error) {
                console.error("Failed to fetch sidebar data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Reactive updates via subscription
        let unsubscribe;
        if (repository.subscribe) {
            unsubscribe = repository.subscribe(fetchData);
        }

        // Keep interval as a fallback/safety measure since it was already there
        const interval = setInterval(fetchData, 1000);
        return () => {
            clearInterval(interval);
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const toggleMode = async () => {
        const newMode = !isFocusMode;
        await backbone.trackFocusMode(newMode);
        setIsFocusMode(newMode);

        if (newMode) {
            navigate('/focus');
        } else {
            navigate('/launchpad');
        }
    };

    const handleCreateArea = async (e) => {
        if (e.key !== 'Enter') return;
        const name = newAreaName.trim();
        if (!name) return;
        try {
            await backbone.addNode({
                id: Math.random().toString(36).substr(2, 9),
                name,
                type: 'LIFE_AREA',
                parentId: null,
                metadata: {}
            });
        } catch (err) {
            console.error('Failed to create area:', err);
        } finally {
            setNewAreaName('');
            setIsAddingArea(false);
        }
    };

    return (
        <aside className={`sidebar ${isFocusMode ? 'mode-focus' : 'mode-planning'}`}>
            <div className="sidebar-top">
                <button
                    className="mode-toggle-btn"
                    onClick={toggleMode}
                    disabled={loading}
                >
                    <div className="btn-icon">
                        {isFocusMode ? '🎯' : '📝'}
                    </div>
                    <span className="btn-text">
                        {isFocusMode ? 'Focus Mode' : 'Planning Mode'}
                    </span>
                    <div className="btn-status-indicator"></div>
                </button>

                <nav className="sidebar-nav">
                    {!isFocusMode ? (
                        /* PLANNING MODE SIDEBAR CONTENT */
                        <>
                            <NavLink to="/launchpad" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="btn-icon">🚀</span>
                                <span className="btn-text">Launchpad</span>
                            </NavLink>

                            <NavLink to="/marketplace" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="btn-icon">🛍️</span>
                                <span className="btn-text">Marketplace</span>
                            </NavLink>

                            <NavLink to="/journal" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="btn-icon">📓</span>
                                <span className="btn-text">Journal</span>
                            </NavLink>

                            {/* Collapsible Life Areas Section */}
                            <div className="sidebar-section">
                                <div
                                    className="section-title-container"
                                    onClick={() => setIsAreasExpanded(!isAreasExpanded)}
                                >
                                    <span className={`section-toggle-icon ${isAreasExpanded ? 'expanded' : ''}`}>
                                        ‣
                                    </span>
                                    <input
                                        className="section-title-input"
                                        value={sectionTitle}
                                        onChange={(e) => setSectionTitle(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>

                                {isAreasExpanded && (
                                    <div className="section-content">
                                        {lifeAreas.map(area => (
                                            <NavLink
                                                key={area.id}
                                                to={`/area/${area.id}`}
                                                className={({ isActive }) => `nav-item area-item ${isActive ? 'active' : ''}`}
                                            >
                                                <span className="btn-icon">{area.icon || '🌐'}</span>
                                                <span className="btn-text">{area.name}</span>
                                                {activeAreaIds.has(area.id) && (
                                                    <div className="active-skill-dot" title="Active Skills inside"></div>
                                                )}
                                            </NavLink>
                                        ))}

                                        {isAddingArea ? (
                                            <input
                                                autoFocus
                                                className="new-area-input"
                                                placeholder="Area name..."
                                                value={newAreaName}
                                                onChange={(e) => setNewAreaName(e.target.value)}
                                                onKeyDown={handleCreateArea}
                                                onBlur={() => { setIsAddingArea(false); setNewAreaName(''); }}
                                            />
                                        ) : (
                                            <button
                                                className="nav-item new-area-btn"
                                                onClick={() => setIsAddingArea(true)}
                                            >
                                                <span className="btn-icon">＋</span>
                                                <span className="btn-text">New Area</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <NavLink to="/backbone-tester" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="btn-icon">🛠️</span>
                                <span className="btn-text">Backbone Tester</span>
                            </NavLink>
                        </>
                    ) : (
                        /* FOCUS MODE SIDEBAR CONTENT (Placeholder) */
                        <div className="focus-sidebar-placeholder">
                            <div className="placeholder-item active">
                                <span className="btn-icon">🎯</span>
                                <span className="btn-text">Active Session</span>
                            </div>
                            <p className="placeholder-hint">Focus Mode layout coming soon...</p>
                        </div>
                    )}
                </nav>
            </div>

            <div className="sidebar-bottom">
                <div className="hryvnia-display">
                    <span className="hryvnia-icon">₴</span>
                    <span className="hryvnia-amount">{hryvniaBalance}</span>
                </div>
                <div className="sidebar-divider"></div>

                {/* Theme Toggle Button */}
                <button className="nav-item theme-toggle-sidebar" onClick={toggleTheme}>
                    <span className="btn-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
                    <span className="btn-text">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>

                <Link to="/settings" className="nav-item settings-btn">
                    <span className="btn-icon">⚙️</span>
                    <span className="btn-text">Settings</span>
                </Link>
            </div>
        </aside>
    );
};

export default Sidebar;
