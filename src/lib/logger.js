import { writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/api/path';

/**
 * Universal logger that writes to a persistent file.
 * Saves to ~/Desktop/backbone_auth_log.txt as requested.
 */
export async function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;

    try {
        const fileName = 'backbone_auth_log.txt';
        
        await writeTextFile(fileName, logLine, {
            baseDir: BaseDirectory.Desktop,
            append: true,
            create: true
        });
        
    } catch (err) {
        console.error('[FILE_LOG ERROR]', err);
        // Fallback to console if file logging fails
    }
}

export async function logErrorToFile(context, error) {
    const errorString = error instanceof Error 
        ? `${error.name}: ${error.message}\nStack: ${error.stack}` 
        : JSON.stringify(error, null, 2);
    
    await logToFile(`ERROR [${context}]: ${errorString}`);
}
