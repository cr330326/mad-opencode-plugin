/**
 * Logger for MAD OpenCode Plugin
 *
 * Provides DEBUG-controlled logging output with different log levels.
 * Enable debug logging by setting MAD_DEBUG=1 or DEBUG=mad:* environment variable.
 */

import { appendFileSync } from 'node:fs';

const DEBUG = process.env.MAD_DEBUG === '1' || process.env.DEBUG?.includes('mad:*');
const PLUGIN_LOG_FILE = '/tmp/mad-plugin.log';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log level names for output
 */
const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

/**
 * Write to log file
 */
function writeToFile(message: string): void {
  try {
    appendFileSync(PLUGIN_LOG_FILE, `${message}\n`);
  } catch {
    // Silently fail if file logging doesn't work
  }
}

/**
 * Determine if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  if (!DEBUG) return level >= LogLevel.WARN;
  return true;
}

/**
 * Core log function
 */
export function log(level: LogLevel, category: string, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${LEVEL_NAMES[level]}] [${category}]`;

  if (args.length > 0) {
    writeToFile(`${prefix} ${message} ${args.map(String).join(' ')}`);
  } else {
    writeToFile(`${prefix} ${message}`);
  }
}

/**
 * Logger interface with convenience methods
 */
export const logger = {
  debug: (category: string, message: string, ...args: unknown[]) =>
    log(LogLevel.DEBUG, category, message, ...args),
  info: (category: string, message: string, ...args: unknown[]) =>
    log(LogLevel.INFO, category, message, ...args),
  warn: (category: string, message: string, ...args: unknown[]) =>
    log(LogLevel.WARN, category, message, ...args),
  error: (category: string, message: string, ...args: unknown[]) =>
    log(LogLevel.ERROR, category, message, ...args),
};
