import React, { useRef, useState, useEffect } from 'react';
import './WallpaperInputPair.css';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_WIDTH = 1920;
const QUALITY = 0.85;

/**
 * Resize an image file using a canvas before converting to data URL.
 * Constrains to MAX_WIDTH while preserving aspect ratio.
 * Returns a Promise<string> (data URL).
 */
const resizeImage = (file) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let { width, height } = img;
            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Prefer webp for best compression; fall back to jpeg
            const mime = file.type === 'image/png' ? 'image/png' : 'image/webp';
            resolve(canvas.toDataURL(mime, QUALITY));
        };

        img.onerror = reject;
        img.src = objectUrl;
    });

/**
 * A single wallpaper slot (light OR dark).
 *
 * Props:
 *   label       – e.g. "Light Mode"
 *   value       – current URL or data URL
 *   onChange    – (url: string) => void
 *   inputId     – unique id for the hidden file input
 */
const WallpaperSlot = ({ label, value, onChange, inputId }) => {
    // LOG B-0: confirm WallpaperSlot is mounted and received onChange
    console.log("LOG B-0: WallpaperSlot mounted/rendered", { label, hasOnChange: typeof onChange === 'function' });

    // Bridge local typing with the external context value
    const [localValue, setLocalValue] = useState(value || '');

    // Sync local value when the external value changes (unless it's a file upload)
    useEffect(() => {
        if (!value?.startsWith('data:')) {
            setLocalValue(value || '');
        }
    }, [value]);

    const fileInputRef = useRef(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
            alert(`Unsupported file type: ${file.type}.\nAllowed: PNG, JPEG, WebP.`);
            e.target.value = '';
            return;
        }

        try {
            const dataUrl = await resizeImage(file);
            console.log("LOG B-1: file processed, calling onChange", { dataUrl: dataUrl.slice(0, 40) });
            if (typeof onChange !== 'function') { console.error('LOG B-1 ERROR: onChange is not a function', onChange); return; }
            onChange(dataUrl);
        } catch (err) {
            console.error('[WallpaperSlot] Failed to process image:', err);
        }

        // Reset so the same file can be re-selected
        e.target.value = '';
    };

    const isDataUrl = value?.startsWith('data:');
    const hasValue = !!value;

    return (
        <div className="wp-slot">
            <span className="wp-slot-label">{label}</span>

            {/* Row: upload button + url input side by side */}
            <div className="wp-slot-row">
                {/* Hidden file input */}
                <input
                    id={inputId}
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    style={{ display: 'none' }}
                    onChange={handleFile}
                />

                {/* Upload trigger */}
                <button
                    type="button"
                    className="wp-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload local image"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload
                </button>

                <span className="wp-or">or</span>

                {/* URL input */}
                <input
                    type="text"
                    className="wp-url-input"
                    placeholder="Paste URL…"
                    value={isDataUrl ? '' : localValue}
                    onChange={(e) => {
                        const newVal = e.target.value;
                        setLocalValue(newVal);
                        console.log("LOG B-2: URL input changed", { value: newVal, hasOnChange: typeof onChange === 'function' });
                        if (typeof onChange === 'function') {
                            onChange(newVal);
                        }
                    }}
                />

                {/* Clear button */}
                {hasValue && (
                    <button
                        type="button"
                        className="wp-clear-btn"
                        onClick={() => onChange('')}
                        title="Clear"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Preview */}
            {hasValue && (
                <div className="wp-preview-wrap">
                    <img
                        className="wp-preview"
                        src={value}
                        alt={`${label} wallpaper preview`}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                    />
                    {isDataUrl && (
                        <span className="wp-preview-badge">Local file</span>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * A pair of light + dark wallpaper slots.
 *
 * Props:
 *   label         – optional section label (e.g. "Launchpad")
 *   lightValue    – current light URL/data URL
 *   darkValue     – current dark URL/data URL
 *   onLightChange – (url) => void
 *   onDarkChange  – (url) => void
 *   idPrefix      – unique prefix to avoid duplicate input IDs
 */
const WallpaperInputPair = ({
    label,
    lightValue,
    darkValue,
    onLightChange,
    onDarkChange,
    idPrefix = 'wp',
}) => (
    <div className="wp-pair">
        {label && <div className="wp-pair-label">{label}</div>}
        <WallpaperSlot
            label="Light Mode"
            value={lightValue}
            onChange={onLightChange}
            inputId={`${idPrefix}-light-file`}
        />
        <WallpaperSlot
            label="Dark Mode"
            value={darkValue}
            onChange={onDarkChange}
            inputId={`${idPrefix}-dark-file`}
        />
    </div>
);

export default WallpaperInputPair;
