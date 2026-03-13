/**
 * wallpaperService.js
 *
 * All Supabase operations for the wallpaper sync system.
 *
 * Storage layout:
 *   wallpapers/{userId}/{slotKey}-{theme}.{ext}
 *   e.g. wallpapers/abc-123/global-light.webp
 *        wallpapers/abc-123/launchpad-dark.png
 *
 * The wallpaper_configs table holds one JSONB row per user.
 * Data URLs are uploaded to Storage; only the resulting public
 * URL is stored in the config. The database never holds raw image data.
 */

import { supabase } from './supabase';

const BUCKET = 'wallpapers';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a base64 data URL to a Blob.
 */
const dataUrlToBlob = (dataUrl) => {
    const [header, b64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
};

/**
 * Derive a file extension from a MIME type.
 */
const extFromMime = (mime) => {
    const map = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    return map[mime] || 'jpg';
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a data URL to Supabase Storage.
 * Returns the public URL string, or null on error.
 *
 * @param {string} userId
 * @param {string} dataUrl   - data:image/... base64 string
 * @param {string} slotKey   - unique slot identifier, e.g. "global-light", "launchpad-dark"
 */
export const uploadWallpaperImage = async (userId, dataUrl, slotKey) => {
    try {
        const blob = dataUrlToBlob(dataUrl);
        const ext = extFromMime(blob.type);
        const path = `${userId}/${slotKey}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, blob, {
                upsert: true,          // overwrite existing slot
                contentType: blob.type,
            });

        if (uploadError) {
            console.error("Wallpaper upload failed:", uploadError);
            return null;
        }

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return data.publicUrl;
    } catch (err) {
        console.error('[WallpaperService] Unexpected upload error:', err);
        return null;
    }
};

/**
 * Delete a wallpaper file from Storage by its storage path.
 * @param {string} storagePath  - e.g. "{userId}/global-light.webp"
 */
export const deleteWallpaperImage = async (storagePath) => {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) console.error('[WallpaperService] Delete error:', error.message);
};

// ─────────────────────────────────────────────────────────────────────────────
// Config DB operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the wallpaper config for a user from Supabase.
 * Returns the config object or null if none exists.
 */
export const fetchWallpaperConfig = async (userId) => {
    const { data, error } = await supabase
        .from('wallpaper_configs')
        .select('config')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('[WallpaperService] Fetch error:', error.message);
        return null;
    }

    return data?.config || null;
};

/**
 * Save (upsert) the full wallpaper config for a user.
 * Data URLs are uploaded to Storage first and replaced by public URLs.
 *
 * @param {string} userId
 * @param {object} config   - the full wallpaperConfig object from ThemeContext
 */
export const saveWallpaperConfig = async (userId, config) => {
    // Deep-clone so we don't mutate the React state
    let processedConfig = JSON.parse(JSON.stringify(config));

    // ── Upload any data URLs to Storage, replace with public URLs ────────────
    const uploadIfDataUrl = async (url, slotKey) => {
        if (url && url.startsWith('data:')) {
            const publicUrl = await uploadWallpaperImage(userId, url, slotKey);
            return publicUrl || url; // fallback to data URL if upload fails
        }
        return url;
    };

    // Global
    processedConfig.wallpapers.global.light = await uploadIfDataUrl(
        processedConfig.wallpapers.global.light, 'global-light'
    );
    processedConfig.wallpapers.global.dark = await uploadIfDataUrl(
        processedConfig.wallpapers.global.dark, 'global-dark'
    );

    // Per-page
    for (const [pageKey, pair] of Object.entries(processedConfig.wallpapers.pages)) {
        processedConfig.wallpapers.pages[pageKey].light = await uploadIfDataUrl(
            pair.light, `${pageKey}-light`
        );
        processedConfig.wallpapers.pages[pageKey].dark = await uploadIfDataUrl(
            pair.dark, `${pageKey}-dark`
        );
    }

    // ── Upsert config to DB ───────────────────────────────────────────────────
    const { error } = await supabase
        .from('wallpaper_configs')
        .upsert({ user_id: userId, config: processedConfig }, { onConflict: 'user_id' });

    if (error) {
        console.error('[WallpaperService] Save error:', error.message);
        return { error };
    }

    return { processedConfig };
};

/**
 * Delete the entire wallpaper config row for a user
 * and all their files in Storage.
 */
export const deleteAllWallpapers = async (userId) => {
    // List all files in the user's storage folder
    const { data: files, error: listError } = await supabase.storage
        .from(BUCKET)
        .list(userId);

    if (!listError && files?.length) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from(BUCKET).remove(paths);
    }

    // Delete DB row
    const { error } = await supabase
        .from('wallpaper_configs')
        .delete()
        .eq('user_id', userId);

    if (error) console.error('[WallpaperService] Delete all error:', error.message);
};
