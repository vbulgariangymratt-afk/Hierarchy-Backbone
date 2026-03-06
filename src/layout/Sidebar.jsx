import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { backbone, repository } from '../backbone-v2/index';
import { useTheme } from '../context/ThemeContext';
import NodeIcon from '../components/NodeIcon';
import './Sidebar.css';

const SVG_ICONS = {
    LAUNCHPAD: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpolyline points='9 22 9 12 15 12 15 22'/%3E%3C/svg%3E",
    MARKETPLACE: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'/%3E%3Cpath d='M3 6h18'/%3E%3Cpath d='M16 10a4 4 0 0 1-8 0'/%3E%3C/svg%3E",
    JOURNAL: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'/%3E%3C/svg%3E",
    SETTINGS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E",
    SUN: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3Cpath d='M12 2v2'/%3E%3Cpath d='M12 20v2'/%3E%3Cpath d='m4.93 4.93 1.41 1.41'/%3E%3Cpath d='m17.66 17.66 1.41 1.41'/%3E%3Cpath d='M2 12h2'/%3E%3Cpath d='M20 12h2'/%3E%3Cpath d='m6.34 17.66-1.41 1.41'/%3E%3Cpath d='m19.07 4.93-1.41 1.41'/%3E%3C/svg%3E",
    MOON: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'/%3E%3C/svg%3E",
    PLUS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='12' y1='5' x2='12' y2='19'/%3E%3Cline x1='5' y1='12' x2='19' y2='12'/%3E%3C/svg%3E",
    PLANNING: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'/%3E%3C/svg%3E",
    FOCUS: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Cline x1='12' y1='2' x2='12' y2='5'/%3E%3Cline x1='12' y1='19' x2='12' y2='22'/%3E%3Cline x1='2' y1='12' x2='5' y2='12'/%3E%3Cline x1='19' y1='12' x2='22' y2='12'/%3E%3C/svg%3E"
};

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
    const [editingIconNode, setEditingIconNode] = useState(null);
    const [tempIconUrl, setTempIconUrl] = useState('');

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

    const handleIconClick = (e, node) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingIconNode(node);
        setTempIconUrl(node.metadata?.iconUrl || '');
    };

    const handleSaveIcon = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!editingIconNode) return;

        try {
            await backbone.updateNode(editingIconNode.id, {
                metadata: {
                    ...editingIconNode.metadata,
                    iconUrl: tempIconUrl.trim() || null
                }
            });
            setEditingIconNode(null);
        } catch (err) {
            console.error('Failed to update icon:', err);
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
                        <NodeIcon iconUrl={isFocusMode ? SVG_ICONS.FOCUS : SVG_ICONS.PLANNING} size={18} />
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
                                <span className="btn-icon">
                                    <NodeIcon iconUrl={SVG_ICONS.LAUNCHPAD} size={18} />
                                </span>
                                <span className="btn-text">Launchpad</span>
                            </NavLink>

                            <NavLink to="/marketplace" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="btn-icon">
                                    <NodeIcon iconUrl={SVG_ICONS.MARKETPLACE} size={18} />
                                </span>
                                <span className="btn-text">Marketplace</span>
                            </NavLink>

                            <NavLink to="/journal" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="btn-icon">
                                    <NodeIcon iconUrl={SVG_ICONS.JOURNAL} size={18} />
                                </span>
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
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    className="btn-icon editable-icon-trigger"
                                                    title="Click to change icon"
                                                    onClick={(e) => handleIconClick(e, area)}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    style={{ border: 'none', background: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <NodeIcon
                                                        iconUrl={area.metadata?.iconUrl}
                                                        emoji={area.icon}
                                                        defaultIcon="🌐"
                                                    />
                                                    {editingIconNode?.id === area.id && (
                                                        <div className="icon-edit-popover" onClick={e => e.stopPropagation()}>
                                                            <div className="popover-header">Change Icon</div>
                                                            <input
                                                                autoFocus
                                                                className="popover-input"
                                                                placeholder="Paste icon URL..."
                                                                value={tempIconUrl}
                                                                onChange={e => setTempIconUrl(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleSaveIcon(e);
                                                                    if (e.key === 'Escape') setEditingIconNode(null);
                                                                }}
                                                            />
                                                            <div className="popover-preview">
                                                                <NodeIcon iconUrl={tempIconUrl} emoji={area.icon} size={24} />
                                                            </div>
                                                            <div className="popover-actions">
                                                                <button className="confirm-btn" onClick={handleSaveIcon}>Save</button>
                                                                <button className="cancel-btn" onClick={() => setEditingIconNode(null)}>Cancel</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
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
                                                <span className="btn-icon">
                                                    <NodeIcon iconUrl={SVG_ICONS.PLUS} size={14} />
                                                </span>
                                                <span className="btn-text">New Area</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>


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
                    <span className="btn-icon">
                        <NodeIcon iconUrl={theme === 'dark' ? SVG_ICONS.MOON : SVG_ICONS.SUN} size={18} />
                    </span>
                    <span className="btn-text">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>

                <Link to="/settings" className="nav-item settings-btn">
                    <span className="btn-icon">
                        <NodeIcon iconUrl={SVG_ICONS.SETTINGS} size={18} />
                    </span>
                    <span className="btn-text">Settings</span>
                </Link>
            </div>
        </aside>
    );
};

export default Sidebar;
