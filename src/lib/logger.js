/**
 * Universal logger.
 * File logging disabled as requested.
 */
export async function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    
    // Always log to console
    console.log(logLine);
}

export async function logErrorToFile(context, error) {
    const errorString = error instanceof Error 
        ? `${error.name}: ${error.message}\nStack: ${error.stack}` 
        : JSON.stringify(error, null, 2);
    
    await logToFile(`ERROR [${context}]: ${errorString}`);
}
