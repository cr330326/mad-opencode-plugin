/**
 * Logger for MAD OpenCode Plugin
 *
 * Provides DEBUG-controlled logging output with different log levels.
 * Enable debug logging by setting MAD_DEBUG=1 or DEBUG=mad:* environment variable.
 */
/**
 * Log levels
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
/**
 * Core log function
 */
export declare function log(level: LogLevel, category: string, message: string, ...args: unknown[]): void;
/**
 * Logger interface with convenience methods
 */
export declare const logger: {
    debug: (category: string, message: string, ...args: unknown[]) => void;
    info: (category: string, message: string, ...args: unknown[]) => void;
    warn: (category: string, message: string, ...args: unknown[]) => void;
    error: (category: string, message: string, ...args: unknown[]) => void;
};
//# sourceMappingURL=logger.d.ts.map