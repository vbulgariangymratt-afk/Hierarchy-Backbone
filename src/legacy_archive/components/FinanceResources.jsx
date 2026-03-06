import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Plus, ExternalLink, Trash2, FolderOpen, ArrowUpRight, X, Maximize2, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../context/StoreContext';

// Add keyframes for animations
const styles = `
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;
document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);

const FinanceResources = ({ areaId }) => {
    const { state, addResource, deleteResource, updateResource } = useStore();

    const [selectedResource, setSelectedResource] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const showBackgrounds = state.showBackgrounds !== false;

    // Get Finance Area
    const area = state.areas[areaId];
    if (!area) return null;

    // Get Skills in this area to use as "Groups"
    const skills = area.skillIds.map(id => state.skills[id]).filter(Boolean);

    const handleAddResource = (skillId) => {
        const id = addResource(skillId, "Untitled Document", "");
        if (id) {
            setSelectedResource({ id, skillId, title: "Untitled Document", content: "" });
        }
    };

    const handleDelete = (skillId, resourceId) => {
        if (confirm("Delete this resource?")) {
            // FIX: Correct Argument Order: (resourceId, skillId)
            deleteResource(resourceId, skillId);
        }
    };


    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                marginBottom: 'var(--spacing-xl)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                padding: '32px',
                background: showBackgrounds ? 'rgba(0, 0, 0, 0.1)' : '#1e1e1e', // Medium Dark Glass or Solid 
                backdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                WebkitBackdropFilter: showBackgrounds ? 'blur(20px)' : 'none',
                boxShadow: !showBackgrounds
                    ? (isHovered
                        ? '0 30px 60px -12px rgba(0,0,0,0.7), 0 18px 36px -18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)'
                        : '0 20px 40px -12px rgba(0,0,0,0.5), 0 12px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)')
                    : (isHovered ? '0 40px 80px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.2)'),
                transform: isHovered ? 'translateY(-2px) scale(1.005)' : 'translateY(0) scale(1)',
                transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.4s ease',
                willChange: 'transform, box-shadow'
            }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '32px',
            }}>
                <div style={{
                    padding: '8px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <FolderOpen size={20} color="#a5b4fc" />
                </div>
                <h2 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)',
                    letterSpacing: '-0.02em'
                }}>
                    {area.name === 'Finance' ? 'Financial Resources' : 'Resources & Knowledge'}
                </h2>
            </div>

            {/* Grid Layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '32px',
                alignItems: 'start'
            }}>
                {skills.map(skill => {
                    const resources = skill.resources || [];

                    return (
                        <div key={skill.id} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Skill Header (Pill Tag) */}
                            <div style={{ display: 'flex' }}>
                                <span style={{
                                    padding: '6px 12px',
                                    borderRadius: '100px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em'
                                }}>
                                    {skill.name}
                                </span>
                            </div>

                            {/* Resources List */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr',
                                gap: '16px'
                            }}>
                                {resources.map(res => {
                                    // Parse URL to get domain
                                    let domain = '';
                                    try {
                                        domain = new URL(res.url).hostname.replace('www.', '');
                                    } catch (e) {
                                        domain = 'web link';
                                    }

                                    return (
                                        <div key={res.id}
                                            onClick={() => setSelectedResource({ ...res, skillId: skill.id })}
                                            className="resource-card group"
                                            style={{
                                                position: 'relative',
                                                padding: '20px',
                                                borderRadius: '20px',
                                                background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                overflow: 'hidden',
                                                minHeight: '80px' // More substantial
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.transform = 'translateY(-4px)';
                                                e.currentTarget.style.boxShadow = '0 16px 32px -8px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255,255,255,0.1)';
                                                e.currentTarget.style.background = 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)';
                                                const icon = e.currentTarget.querySelector('.card-icon');
                                                if (icon) { icon.style.color = '#a5b4fc'; icon.style.transform = 'scale(1.1)'; }
                                                const arrow = e.currentTarget.querySelector('.arrow-icon');
                                                if (arrow) { arrow.style.opacity = '1'; arrow.style.transform = 'translate(0, 0)'; }
                                                const del = e.currentTarget.querySelector('.delete-btn');
                                                if (del) del.style.opacity = '1';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = 'none';
                                                e.currentTarget.style.background = 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)';
                                                const icon = e.currentTarget.querySelector('.card-icon');
                                                if (icon) { icon.style.color = 'rgba(255,255,255,0.4)'; icon.style.transform = 'scale(1)'; }
                                                const arrow = e.currentTarget.querySelector('.arrow-icon');
                                                if (arrow) { arrow.style.opacity = '0'; arrow.style.transform = 'translate(-4px, 4px)'; }
                                                const del = e.currentTarget.querySelector('.delete-btn');
                                                if (del) del.style.opacity = '0';
                                            }}
                                        >
                                            <div className="card-icon" style={{
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                color: 'rgba(255,255,255,0.4)',
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: '12px',
                                                padding: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <FileText size={20} />
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{
                                                    fontSize: '15px',
                                                    fontWeight: '600',
                                                    color: 'rgba(255, 255, 255, 0.9)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    letterSpacing: '-0.01em'
                                                }}>
                                                    {res.title}
                                                </div>
                                            </div>

                                            <button
                                                className="delete-btn"
                                                onClick={(e) => {
                                                    e.preventDefault(); // Prevent modal open
                                                    e.stopPropagation();
                                                    handleDelete(skill.id, res.id);
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    background: 'rgba(0, 0, 0, 0.3)',
                                                    backdropFilter: 'blur(8px)',
                                                    WebkitBackdropFilter: 'blur(8px)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '8px',
                                                    color: '#f87171',
                                                    cursor: 'pointer',
                                                    opacity: 0,
                                                    transition: 'opacity 0.2s',
                                                    padding: '6px',
                                                    zIndex: 10,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    );
                                })}

                                {/* Add New Button */}
                                <div
                                    onClick={() => handleAddResource(skill.id)}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '20px',
                                        border: '1px dashed rgba(255,255,255,0.1)',
                                        background: 'rgba(255,255,255,0.01)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        color: 'rgba(255,255,255,0.4)',
                                        transition: 'all 0.2s',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        minHeight: '80px'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                                    }}
                                >
                                    <Plus size={16} />
                                    <span>Add Record</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {skills.length === 0 && (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '13px',
                    fontStyle: 'italic'
                }}>
                    Define skills in your area settings to start organizing resources.
                </div>
            )}

            {/* RESOURCE MODAL */}
            {selectedResource && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(3px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                    animation: 'fadeIn 0.2s ease-out'
                }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedResource(null);
                    }}
                >
                    <div style={{
                        width: '900px',
                        maxWidth: '92%',
                        height: '85vh',
                        background: '#191919', // Notion Dark Core
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 40px 100px -20px rgba(0,0,0,0.8), 0 24px 48px -12px rgba(0,0,0,0.5)', // Premium depth
                        overflow: 'hidden',
                        animation: 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)', // Spring-like feel
                        position: 'relative' // Ensure absolute children are positioned relative to this
                    }}>
                        {selectedResource.backgroundImage && (
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                zIndex: 0,
                                overflow: 'hidden',
                                pointerEvents: 'none' // Click through to content
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '-20px', left: '-20px', right: '-20px', bottom: '-20px',
                                    backgroundImage: `url(${selectedResource.backgroundImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    filter: 'blur(8px)', // Reduced blur as requested
                                    opacity: 0.5, // Brighter
                                    transform: 'scale(1.1)' // Prevent blur edges
                                }} />
                            </div>
                        )}
                        <div style={{
                            padding: '20px 24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            position: 'relative',
                            zIndex: 10,
                            pointerEvents: 'none' // Let clicks pass through empty space
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                // removed flex: 1 to make it fit content
                                minWidth: 0,
                                pointerEvents: 'auto', // Re-enable clicks
                                background: 'rgba(0, 0, 0, 0.4)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                padding: '8px 16px',
                                borderRadius: '30px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'rgba(255, 255, 255, 0.8)'
                                }}>
                                    <FileText size={16} />
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateAreas: '"stack"',
                                    minWidth: '50px', // Minimum width for empty state
                                    alignItems: 'center'
                                }}>
                                    {/* Dimensions Mirror */}
                                    <span style={{
                                        gridArea: 'stack',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        visibility: 'hidden',
                                        whiteSpace: 'pre', // Preserve spaces
                                        padding: 0,
                                        fontFamily: 'inherit',
                                    }}>
                                        {(selectedResource.tempTitle !== undefined ? selectedResource.tempTitle : selectedResource.title) || 'Untitled'}
                                    </span>

                                    {/* Actual Input */}
                                    <input
                                        value={selectedResource.tempTitle !== undefined ? selectedResource.tempTitle : selectedResource.title}
                                        onChange={(e) => {
                                            setSelectedResource(prev => ({ ...prev, tempTitle: e.target.value }));
                                        }}
                                        onBlur={() => {
                                            if (selectedResource.tempTitle !== undefined && selectedResource.tempTitle !== selectedResource.title) {
                                                updateResource(selectedResource.id, selectedResource.skillId, { title: selectedResource.tempTitle });
                                                // Update local state to remove tempTitle so we sync with canonical state
                                                setSelectedResource(prev => ({ ...prev, title: prev.tempTitle, tempTitle: undefined }));
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        style={{
                                            gridArea: 'stack',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: 'rgba(255,255,255,0.95)',
                                            margin: 0,
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            padding: 0,
                                            fontFamily: 'inherit',
                                            cursor: 'text'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                pointerEvents: 'auto',
                                background: 'rgba(0, 0, 0, 0.4)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                padding: '4px',
                                borderRadius: '30px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}>
                                <button
                                    onClick={() => {
                                        const url = prompt("Enter Image URL for Background:");
                                        if (url) {
                                            const skillId = skills.find(s => s.resources.find(r => r.id === selectedResource.id))?.id;
                                            if (skillId) {
                                                updateResource(selectedResource.id, skillId, { backgroundImage: url });
                                                setSelectedResource(prev => ({ ...prev, backgroundImage: url }));
                                            }
                                        }
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 12px', borderRadius: '6px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '400',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                                    }}
                                >
                                    <ImageIcon size={14} />
                                    Set Background
                                </button>

                                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <button
                                    onClick={() => setSelectedResource(null)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer',
                                        padding: '6px',
                                        borderRadius: '6px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <ModalContent
                            resource={selectedResource}
                            updateResource={updateResource}
                            skillId={skills.find(s => s.resources.find(r => r.id === selectedResource.id))?.id}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
};

// Sub-component to handle Editor State logic cleanly
const ModalContent = ({ resource, updateResource, skillId }) => {
    const [content, setContent] = useState(resource.url || '');
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [searchText, setSearchText] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const textareaRef = useRef(null);
    const timeoutRef = useRef(null);

    // Update local state if resource changes externally (or on open)
    useEffect(() => {
        setContent(resource.url || '');
    }, [resource.id]);

    const isUrl = (text) => {
        if (!text) return false;
        const trimmed = text.trim();
        return (trimmed.startsWith('http://') || trimmed.startsWith('https://')) && trimmed.length > 10 && !trimmed.includes('\n');
    };

    const handleChange = (e) => {
        const newVal = e.target.value;
        const selectionStart = e.target.selectionStart;

        // Auto-save debounce (1s)
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (skillId) {
                updateResource(resource.id, skillId, { url: newVal });
            }
        }, 1000);

        // Slash Command Logic
        const textBeforeCursor = newVal.substring(0, selectionStart);
        const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

        // Check if we are currently typing a slash command
        if (lastSlashIndex !== -1) {
            // Check if the slash is at the start of a line OR preceded by a space
            const charBeforeSlash = lastSlashIndex > 0 ? newVal[lastSlashIndex - 1] : '\n';
            const isStartOfLineOrWord = charBeforeSlash === ' ' || charBeforeSlash === '\n';

            if (isStartOfLineOrWord && (selectionStart - lastSlashIndex) <= 10) { // Limit search to 10 chars
                const query = newVal.substring(lastSlashIndex + 1, selectionStart);
                if (!query.includes(' ')) { // Stop if space is typed
                    setMenuOpen(true);
                    setSearchText(query);
                    setSelectedIndex(0);

                    // Calculate Menu Position
                    const coords = getCaretCoordinates(textareaRef.current, selectionStart);
                    setMenuPosition({ top: coords.top + 24, left: coords.left }); // 24px below cursor
                } else {
                    setMenuOpen(false);
                }
            } else {
                setMenuOpen(false);
            }
        } else {
            setMenuOpen(false);
        }

        setContent(newVal);
    };

    const executeCommand = (command) => {
        const selectionStart = textareaRef.current.selectionStart;
        const textBeforeCursor = content.substring(0, selectionStart);
        const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

        const beforeSlash = content.substring(0, lastSlashIndex);
        const afterCursor = content.substring(selectionStart);

        let insertText = '';
        let cursorOffset = 0;

        switch (command.id) {
            case 'h1': insertText = '# '; break;
            case 'h2': insertText = '## '; break;
            case 'h3': insertText = '### '; break;
            case 'bullet': insertText = '- '; break;
            case 'number': insertText = '1. '; break;
            case 'todo': insertText = '- [ ] '; break;
            case 'toggle': insertText = '> '; break;
            default: return;
        }

        const newContent = beforeSlash + insertText + afterCursor;
        setContent(newContent);
        setMenuOpen(false);
        textareaRef.current.focus();

        // Need to set cursor position after React update
        setTimeout(() => {
            const newCursorPos = beforeSlash.length + insertText.length;
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            // Trigger save
            if (skillId) updateResource(resource.id, skillId, { url: newContent });
        }, 0);
    };

    const handleKeyDown = (e) => {
        if (menuOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executeCommand(filteredCommands[selectedIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setMenuOpen(false);
            }
        }
    };

    // Filter commands
    const commands = [
        { id: 'h1', label: 'Heading 1', icon: <Heading1 size={16} />, desc: 'Big section heading' },
        { id: 'h2', label: 'Heading 2', icon: <Heading2 size={16} />, desc: 'Medium section heading' },
        { id: 'h3', label: 'Heading 3', icon: <Heading3 size={16} />, desc: 'Small section heading' },
        { id: 'bullet', label: 'Bullet List', icon: <List size={16} />, desc: 'Create a simple list' },
        { id: 'number', label: 'Numbered List', icon: <ListOrdered size={16} />, desc: 'Create a list with numbering' },
        { id: 'todo', label: 'To-do List', icon: <CheckSquare size={16} />, desc: 'Track tasks with a to-do list' },
        { id: 'toggle', label: 'Toggle List', icon: <ChevronRight size={16} />, desc: 'Toggles can hide content inside' },
    ];

    const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(searchText.toLowerCase()));


    if (isUrl(content)) {
        return (
            <>
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 0,
                    color: 'rgba(255,255,255,0.3)',
                    flexDirection: 'column',
                    gap: '16px',
                    background: '#121212'
                }}>
                    <span>Loading preview...</span>
                    <button
                        onClick={() => window.open(content, '_blank')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            background: 'var(--color-primary)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500'
                        }}
                    >
                        Open in New Tab
                    </button>
                </div>
                <iframe
                    src={content}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        position: 'relative',
                        zIndex: 1,
                        background: 'white'
                    }}
                    title="Resource Preview"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
            </>
        );
    }

    // Text Editor Mode
    return (
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>

            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Write your notes here... Type '/' for commands"
                style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    padding: '48px 64px',
                    color: 'rgba(255,255,255,0.9)',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)', // Better readability
                    fontSize: '16px',
                    lineHeight: '1.6',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
                spellCheck="false"
            />
            {menuOpen && filteredCommands.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: '300px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    // Liquid Glass Effect
                    background: 'rgba(30, 30, 30, 0.6)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                    zIndex: 10,
                    padding: '6px'
                }}>
                    <div style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Basic blocks
                    </div>
                    {filteredCommands.map((item, index) => (
                        <div
                            key={item.id}
                            onClick={() => executeCommand(item)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: index === selectedIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
                                transition: 'all 0.1s'
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white'
                            }}>
                                {item.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>
                                    {item.label}
                                </div>
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.desc}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Helper to mirror textarea coordinates ---
const getCaretCoordinates = (element, position) => {
    // Create a mirror div that replicates the textarea's style
    const div = document.createElement('div');
    const style = window.getComputedStyle(element);

    Array.from(style).forEach((prop) => {
        div.style[prop] = style.getPropertyValue(prop);
    });

    div.style.position = 'absolute';
    div.style.top = '0px';
    div.style.left = '0px';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.textContent = element.value.substring(0, position);

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    document.body.appendChild(div);

    const spanRect = span.getBoundingClientRect();
    // We need coordinates relative to the textarea's parent, not viewport
    // But since the popup is absolute inside relative parent, we can use offsetLeft/Top concept?
    // Actually, "modal content" has relative positioning.
    // The trickiest part is scroll.

    // Let's use simpler offset approach relative to the element
    const coordinates = {
        top: span.offsetTop - element.scrollTop,
        left: span.offsetLeft - element.scrollLeft
    };

    document.body.removeChild(div);
    return coordinates;
};

export default FinanceResources;
