/**
 * Event Queue for MAD OpenCode Plugin
 *
 * Provides offline queue with exponential backoff retry for failed HTTP requests.
 * Events are queued when the MAD Server is offline and retried automatically.
 */
/**
 * Event Queue with exponential backoff retry
 */
export declare class EventQueue {
    private queue;
    private flushTimer;
    private isProcessing;
    private serverUrl;
    private apiKey;
    constructor(serverUrl: string, apiKey: string);
    /**
     * Start the periodic flush timer
     */
    start(): void;
    /**
     * Stop the flush timer and perform final flush
     */
    stop(): void;
    /**
     * Add an item to the queue
     */
    push(path: string, data: unknown): void;
    /**
     * Flush the queue - send items that are ready for retry
     */
    private flush;
    /**
     * Send a single item to the server
     */
    private sendItem;
    /**
     * Get queue statistics
     */
    getStats(): {
        size: number;
        processing: boolean;
    };
}
//# sourceMappingURL=queue.d.ts.map