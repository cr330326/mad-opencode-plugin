/**
 * Event Queue for MAD OpenCode Plugin
 *
 * Provides offline queue with exponential backoff retry for failed HTTP requests.
 * Events are queued when the MAD Server is offline and retried automatically.
 */
import { logger } from './logger.js';
/**
 * Queue configuration constants
 */
const MAX_QUEUE_SIZE = 1000;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;
const FLUSH_INTERVAL_MS = 5000;
/**
 * Event Queue with exponential backoff retry
 */
export class EventQueue {
    queue = [];
    flushTimer = null;
    isProcessing = false;
    serverUrl;
    apiKey;
    constructor(serverUrl, apiKey) {
        this.serverUrl = serverUrl;
        this.apiKey = apiKey;
    }
    /**
     * Start the periodic flush timer
     */
    start() {
        if (this.flushTimer) {
            logger.warn('Queue', 'Flush timer already started');
            return;
        }
        logger.info('Queue', 'Starting event queue flush timer');
        // Flush periodically
        this.flushTimer = setInterval(() => {
            this.flush().catch(err => {
                logger.error('Queue', 'Flush timer error:', err);
            });
        }, FLUSH_INTERVAL_MS);
        // Unref to allow Node.js to exit if this is the only active timer
        if (typeof this.flushTimer.unref === 'function') {
            this.flushTimer.unref();
        }
    }
    /**
     * Stop the flush timer and perform final flush
     */
    stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        logger.info('Queue', `Stopping queue (${this.queue.length} items remaining)`);
        // Final flush (synchronous best effort, don't wait)
        this.flush().catch(err => {
            logger.error('Queue', 'Final flush error:', err);
        });
    }
    /**
     * Add an item to the queue
     */
    push(path, data) {
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            // Drop oldest item
            const dropped = this.queue.shift();
            logger.warn('Queue', `Queue full, dropping oldest item (attempts: ${dropped?.attempts})`);
        }
        this.queue.push({
            path,
            data,
            attempts: 0,
            nextRetryTime: Date.now(),
        });
        logger.debug('Queue', `Item queued (${this.queue.length}/${MAX_QUEUE_SIZE}): ${path}`);
        // Try to flush immediately if we're not already processing
        if (!this.isProcessing) {
            this.flush().catch(err => {
                logger.error('Queue', 'Immediate flush error:', err);
            });
        }
    }
    /**
     * Flush the queue - send items that are ready for retry
     */
    async flush() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }
        this.isProcessing = true;
        try {
            const now = Date.now();
            const itemsToProcess = this.queue.filter(item => item.nextRetryTime <= now);
            if (itemsToProcess.length === 0) {
                return;
            }
            logger.debug('Queue', `Processing ${itemsToProcess.length} items (${this.queue.length} total)`);
            for (const item of itemsToProcess) {
                const success = await this.sendItem(item);
                if (success) {
                    // Remove from queue
                    const index = this.queue.indexOf(item);
                    if (index > -1) {
                        this.queue.splice(index, 1);
                    }
                    logger.debug('Queue', `Item sent successfully: ${item.path}`);
                }
                else {
                    // Update retry info
                    item.attempts++;
                    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
                        // Give up, remove from queue
                        const index = this.queue.indexOf(item);
                        if (index > -1) {
                            this.queue.splice(index, 1);
                        }
                        logger.error('Queue', `Item dropped after ${MAX_RETRY_ATTEMPTS} failures: ${item.path}`);
                    }
                    else {
                        // Calculate next retry time with exponential backoff
                        const delay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, item.attempts), RETRY_MAX_DELAY_MS);
                        // Add jitter (±25%)
                        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
                        item.nextRetryTime = Date.now() + delay + jitter;
                        logger.debug('Queue', `Item retry ${item.attempts}/${MAX_RETRY_ATTEMPTS} in ${Math.round(delay + jitter)}ms: ${item.path}`);
                    }
                }
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Send a single item to the server
     */
    async sendItem(item) {
        try {
            const response = await fetch(`${this.serverUrl}${item.path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                },
                body: JSON.stringify(item.data),
                signal: AbortSignal.timeout(10000), // 10s timeout
            });
            if (response.ok) {
                return true;
            }
            logger.warn('Queue', `HTTP ${response.status} for ${item.path}`);
            return false;
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                logger.warn('Queue', `Request timeout for ${item.path}`);
            }
            else {
                logger.debug('Queue', `Request failed for ${item.path}:`, error);
            }
            return false;
        }
    }
    /**
     * Get queue statistics
     */
    getStats() {
        return {
            size: this.queue.length,
            processing: this.isProcessing,
        };
    }
}
//# sourceMappingURL=queue.js.map