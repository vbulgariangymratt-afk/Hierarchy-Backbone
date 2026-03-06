import React, { useState, useEffect, useRef } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const TaskDetailModal = ({ task, onClose }) => {
    const { updateTask } = useStore();
    const [title, setTitle] = useState(task.title || '');
    const [content, setContent] = useState(task.content || '');
    const [images, setImages] = useState(task.images || []);
    const textareaRef = useRef(null);

    // Auto-save content and title
    useEffect(() => {
        const timer = setTimeout(() => {
            updateTask(task.id, { title, content, images });
        }, 500);
        return () => clearTimeout(timer);
    }, [title, content, images, task.id, updateTask]);

    // Handle image paste
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    setImages(prev => [...prev, event.target.result]);
                };
                reader.readAsDataURL(blob);
            }
        }
    };

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px'
            }}
            onClick={onClose}
        >
            <div
                className="liquid-glass"
                style={{
                    width: '100%',
                    maxWidth: '1000px',
                    maxHeight: '90vh',
                    height: '90vh',
                    borderRadius: '16px',
                    padding: '48px 64px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '32px'
                }}>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Untitled"
                        style={{
                            fontSize: '2.5rem',
                            fontWeight: '700',
                            color: 'var(--color-text-main)',
                            flex: 1,
                            marginRight: '24px',
                            lineHeight: '1.2',
                            background: 'none',
                            border: 'none',
                            outline: 'none',
                            padding: 0,
                            fontFamily: 'inherit'
                        }}
                    />
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--color-text-secondary)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.color = 'var(--color-text-main)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content Area (Scrollable) */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginBottom: '16px'
                }}>
                    {/* Rich Text Editor */}
                    <div style={{ marginBottom: '24px' }}>
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onPaste={handlePaste}
                            placeholder="Write your notes, ideas, or paste images here... (Cmd+V / Ctrl+V to paste images)"
                            style={{
                                width: '100%',
                                minHeight: '300px',
                                padding: '0',
                                border: 'none',
                                background: 'none',
                                color: 'var(--color-text-main)',
                                fontFamily: 'inherit',
                                fontSize: '15px',
                                lineHeight: '1.7',
                                resize: 'none',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Images */}
                    {images.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <div style={{
                                fontSize: '12px',
                                color: 'var(--color-text-secondary)',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <ImageIcon size={14} />
                                Attached Images ({images.length})
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                gap: '12px'
                            }}>
                                {images.map((img, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            position: 'relative',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            aspectRatio: '1',
                                            backgroundColor: 'rgba(0, 0, 0, 0.3)'
                                        }}
                                    >
                                        <img
                                            src={img}
                                            alt={`Pasted ${index + 1}`}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                        <button
                                            onClick={() => removeImage(index)}
                                            style={{
                                                position: 'absolute',
                                                top: '4px',
                                                right: '4px',
                                                background: 'rgba(0, 0, 0, 0.7)',
                                                border: 'none',
                                                borderRadius: '4px',
                                                width: '24px',
                                                height: '24px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: 'white',
                                                opacity: 0.7,
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)',
                    fontStyle: 'italic',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    Auto-saves as you type • Press Esc or click outside to close
                </div>
            </div>
        </div>
    );
};

export default TaskDetailModal;
