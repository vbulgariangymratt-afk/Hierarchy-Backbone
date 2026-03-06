import { useState, useRef } from 'react';

import { NavLink, useLocation } from 'react-router-dom';
import {
    Home,
    Search,
    Settings,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Plus,
    LayoutGrid,
    ShoppingBag,
    Book,
    CheckCircle,
    Image,
    Sparkles,
    Brain,
    Star,
    DollarSign,
    Utensils,
    Activity,
    Cloud,
    Trash2,
    Sun,
    Moon,
    Eye,
    EyeOff
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import '../styles/Sidebar.css';

const Sidebar = () => {
    const [isAreasExpanded, setIsAreasExpanded] = useState(true);
    const [isTrackersExpanded, setIsTrackersExpanded] = useState(true);
    const [editingTrackerId, setEditingTrackerId] = useState(null);
    const [editName, setEditName] = useState('');
    const { state, addArea, updateBackground, updateUserProfile, updateTracker, addTracker, deleteTracker, forceSave, reorderAreas, toggleTheme, toggleBackgrounds } = useStore();
    const location = useLocation();
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateBackground(location.pathname, reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Fixed order for Life Areas
    const lifeAreas = Object.values(state.areas || {}).sort((a, b) => {
        const order = ['Finance', 'Languages', 'Spiritual', 'Hot body'];
        const indexA = order.indexOf(a.name);
        const indexB = order.indexOf(b.name);

        // If both are in the fixed list, sort by defined order
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // If only A is in list, it comes first
        if (indexA !== -1) return -1;
        // If only B is in list, it comes first
        if (indexB !== -1) return 1;
        // Otherwise keep original order
        return 0;
    });

    const handleAddArea = () => {
        const name = prompt("Enter the name of the new Life Area (e.g., 'Fitness')");
        if (name) {
            const iconInput = prompt("Enter an Icon URL (from notionicons.so) or an Emoji", "🍅");
            const icon = iconInput || "🍅";
            addArea(name, icon);
        }
    };

    // Helper to render icon (emoji or image)
    const renderIcon = (iconStr) => {
        if (iconStr?.startsWith('http') || iconStr?.startsWith('data:')) {
            return <img src={iconStr} alt="icon" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />;
        }
        return <span className="icon">{iconStr}</span>;
    };

    const handleEditProfile = () => {
        const newName = prompt("Enter Workspace Name:", state.userProfile?.name);
        if (newName) {
            const newAvatar = prompt("Enter Avatar (Emoji or URL):", state.userProfile?.avatar);
            updateUserProfile({ name: newName, avatar: newAvatar || state.userProfile?.avatar });
        }
    };

    return (
        <aside className={`sidebar ${!state.showBackgrounds ? 'solid-mode' : ''}`}>
            <div className="sidebar-header">
                <div className="user-profile" onClick={handleEditProfile} title="Click to edit profile">
                    {state.userProfile?.avatar?.startsWith('http') ? (
                        <img src={state.userProfile.avatar} alt="avatar" className="avatar" style={{ objectFit: 'cover' }} />
                    ) : (
                        <div className="avatar">{state.userProfile?.avatar || 'W'}</div>
                    )}
                    <span className="username">{state.userProfile?.name || "Workspace"}</span>
                </div>
            </div>

            <div className="sidebar-content">
                <div className="section">
                    <button className="sidebar-item action-search">
                        <Search size={16} />
                        <span>Search</span>
                        <span className="shortcut">⌘K</span>
                    </button>

                    <NavLink to="/" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                        <Home size={16} />
                        <span>Home</span>
                    </NavLink>
                </div>

                <div className="section">
                    <div className="section-header">
                        <span className="section-title">Apps</span>
                    </div>
                    <NavLink to="/calendar" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                        <LayoutGrid size={16} />
                        <span>Calendar</span>
                    </NavLink>

                    <NavLink to="/habits" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                        <CheckCircle size={16} />
                        <span>Habits</span>
                    </NavLink>

                    <NavLink to="/marketplace" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                        <ShoppingBag size={16} />
                        <span>Marketplace</span>
                    </NavLink>

                    <NavLink to="/journal" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                        <Book size={16} />
                        <span>Journal</span>
                    </NavLink>


                </div>

                <div className="section">
                    <div className="section-header">
                        <button
                            className="toggle-expand"
                            onClick={() => setIsAreasExpanded(!isAreasExpanded)}
                        >
                            {isAreasExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span className="section-title">Life Areas</span>
                        <button className="add-item" onClick={handleAddArea}>
                            <Plus size={14} />
                        </button>
                    </div>

                    {isAreasExpanded && (
                        <div className="nested-items">
                            {lifeAreas.length === 0 && (
                                <div style={{ padding: '8px 24px', fontSize: '13px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                    No areas yet. Add one!
                                </div>
                            )}
                            {lifeAreas.map(area => (
                                <div key={area.id} style={{ display: 'flex', alignItems: 'center' }} className="area-item-wrapper group">
                                    <NavLink
                                        to={`/area/${area.id}`}
                                        className={({ isActive }) => `sidebar-item nested ${isActive ? 'active' : ''}`}
                                        style={{ flex: 1 }}
                                    >
                                        {renderIcon(area.icon)}
                                        <span>{area.name}</span>
                                    </NavLink>

                                </div>
                            ))}
                            <div
                                className="sidebar-item nested placeholder"
                                onClick={handleAddArea}
                                style={{ cursor: 'pointer' }}
                            >
                                <Plus size={14} />
                                <span>Add Area</span>
                            </div>
                        </div>
                    )}
                </div>



                <div className="section">
                    <div className="section-header">
                        <button
                            className="toggle-expand"
                            onClick={() => setIsTrackersExpanded(!isTrackersExpanded)}
                        >
                            {isTrackersExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span className="section-title">Trackers</span>
                        <button
                            className="add-item"
                            onClick={(e) => {
                                e.stopPropagation();
                                const id = addTracker(""); // Create empty tracker
                                setEditingTrackerId(id);
                                setEditName("");
                            }}
                            title="Add Tracker"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {isTrackersExpanded && (
                        <div className="nested-items">
                            {state.trackers && Object.values(state.trackers || {})
                                .filter(tracker => tracker.id !== 'beliefs') // Hidden after migration to Spiritual area
                                .map(tracker => (
                                    <div key={tracker.id} style={{ display: 'flex', alignItems: 'center', group: 'hover' }} className="area-item-wrapper">
                                        {editingTrackerId === tracker.id ? (
                                            <div className="sidebar-item nested" style={{ paddingLeft: '28px', flex: 1 }}>
                                                <input
                                                    autoFocus
                                                    value={editName}
                                                    placeholder="Tracker Name..."
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onBlur={() => {
                                                        updateTracker(tracker.id, { name: editName.trim() || 'Untitled Tracker' });
                                                        setEditingTrackerId(null);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            updateTracker(tracker.id, { name: editName.trim() || 'Untitled Tracker' });
                                                            setEditingTrackerId(null);
                                                        }
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'inherit',
                                                        fontFamily: 'inherit',
                                                        fontSize: 'inherit',
                                                        width: '100%',
                                                        outline: 'none',
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <NavLink
                                                to={tracker.path}
                                                className={({ isActive }) => `sidebar-item nested ${isActive ? 'active' : ''}`}
                                                style={{ flex: 1 }}
                                                title="Right-click to rename"
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setEditingTrackerId(tracker.id);
                                                    setEditName(tracker.name);
                                                }}
                                            >
                                                <div
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        /* Use Prompt for URL or Emoji to match Life Areas capability */
                                                        const iconInput = prompt("Enter Icon URL (Notionicons.so) or Emoji", tracker.icon);
                                                        if (iconInput) updateTracker(tracker.id, { icon: iconInput });
                                                    }}
                                                    title="Click to change icon"
                                                    style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                                >
                                                    {/* Hybrid Renderer: URLs -> Image, Lucide Name -> Component, Emoji -> Span */}
                                                    {(() => {
                                                        const IconComponent = { Brain, Star, DollarSign, Utensils, Activity }[tracker.icon];
                                                        if (IconComponent) return <IconComponent size={20} />;

                                                        // Fallback to standard renderIcon for URLs/Emojis
                                                        if (tracker.icon?.startsWith('http') || tracker.icon?.startsWith('data:')) {
                                                            return <img src={tracker.icon} alt="icon" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />;
                                                        }
                                                        return <span className="icon">{tracker.icon}</span>;
                                                    })()}
                                                </div>
                                                <span>{tracker.name}</span>
                                            </NavLink>
                                        )}

                                        <button
                                            className="delete-tracker-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`Delete the "${tracker.name}" tracker?`)) {
                                                    deleteTracker(tracker.id);
                                                }
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'rgba(255,255,255,0.2)',
                                                padding: '4px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: 0, // Hidden until hover
                                                transition: 'opacity 0.2s',
                                                marginLeft: 'auto'
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
                <style>{`

                    .area-item-wrapper:hover .delete-tracker-btn {
                        opacity: 1 !important;
                    }
                    .delete-tracker-btn:hover {
                        color: #ef4444 !important;
                    }
                `}</style>
            </div>

            <div className="sidebar-footer">
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileUpload}
                />
                <button
                    className="sidebar-item"
                    onClick={() => {
                        const upload = confirm("Would you like to UPLOAD an image file? \n\n(Click Cancel to enter a URL link instead)");
                        if (upload) {
                            fileInputRef.current.click();
                        } else {
                            const url = prompt("Enter background image URL for this page:");
                            if (url) {
                                updateBackground(location.pathname, url);
                            } else if (url === '') {
                                updateBackground(location.pathname, null);
                            }
                        }
                    }}
                    title="Set page background"
                >
                    <Image size={16} />
                    <span>Set Background</span>
                </button>
                <button
                    className="sidebar-item"
                    onClick={toggleTheme}
                    title={`Switch to ${state.themeMode === 'light' ? 'Dark' : 'Light'} Mode`}
                >
                    {state.themeMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                    <span>{state.themeMode === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
                <button
                    className="sidebar-item"
                    onClick={toggleBackgrounds}
                    title={`Switch to ${state.showBackgrounds ? 'Solid' : 'Liquid'} Mode`}
                >
                    {state.showBackgrounds ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span>{state.showBackgrounds ? 'Liquid Mode' : 'Solid Mode'}</span>
                </button>
                <NavLink to="/settings" className="sidebar-item">
                    <Settings size={16} />
                    <span>Settings</span>
                </NavLink>
            </div>
        </aside>
    );
};

export default Sidebar;
