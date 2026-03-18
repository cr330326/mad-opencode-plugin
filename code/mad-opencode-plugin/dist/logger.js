/**
 * Logger for MAD OpenCode Plugin
 *
 * Provides DEBUG-controlled logging output with different log levels.
 * Enable debug logging by setting MAD_DEBUG=1 or DEBUG=mad:* environment variable.
 */
const DEBUG = process.env.MAD_DEBUG === '1' || process.env.DEBUG?.includes('mad:*');
/**
 * Log levels
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
/**
 * Log level names for output
 */
const LEVEL_NAMES = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
};
/**
 * Determine if a log level should be output
 */
function shouldLog(level) {
    if (!DEBUG)
        return level >= LogLevel.WARN;
    return true;
}
/**
 * Core log function
 */
export function log(level, category, message, ...args) {
    if (!shouldLog(level))
        return;
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${LEVEL_NAMES[level]}] [${category}]`;
    if (args.length > 0) {
        console.log(prefix, message, ...args);
    }
    else {
        console.log(prefix, message);
    }
}
/**
 * Logger interface with convenience methods
 */
export const logger = {
    debug: (category, message, ...args) => log(LogLevel.DEBUG, category, message, ...args),
    info: (category, message, ...args) => log(LogLevel.INFO, category, message, ...args),
    warn: (category, message, ...args) => log(LogLevel.WARN, category, message, ...args),
    error: (category, message, ...args) => log(LogLevel.ERROR, category, message, ...args),
};
//# sourceMappingURL=logger.js.map