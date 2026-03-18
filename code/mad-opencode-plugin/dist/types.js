/**
 * Type definitions for MAD OpenCode Plugin
 *
 * This file contains all TypeScript types and interfaces used throughout the plugin.
 */
/**
 * Type guard for SyncEventBody
 */
export function isSyncEventBody(data) {
    if (typeof data !== 'object' || data === null)
        return false;
    const body = data;
    return (typeof body.agentId === 'string' &&
        typeof body.clientName === 'string' &&
        typeof body.event === 'object' &&
        body.event !== null);
}
/**
 * Type guard for SyncMessageBody
 */
export function isSyncMessageBody(data) {
    if (typeof data !== 'object' || data === null)
        return false;
    const body = data;
    return (typeof body.agentId === 'string' &&
        typeof body.clientName === 'string' &&
        typeof body.message === 'object' &&
        body.message !== null);
}
/**
 * Type guard for SyncToolBody
 */
export function isSyncToolBody(data) {
    if (typeof data !== 'object' || data === null)
        return false;
    const body = data;
    return (typeof body.agentId === 'string' &&
        typeof body.clientName === 'string' &&
        typeof body.tool === 'object' &&
        body.tool !== null);
}
//# sourceMappingURL=types.js.map