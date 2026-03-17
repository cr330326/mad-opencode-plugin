/**
 * Type definitions for MAD OpenCode Plugin
 *
 * This file contains all TypeScript types and interfaces used throughout the plugin.
 */

// Agent type
export type AgentType = 'opencode' | 'openclaw' | 'claude-code' | 'custom';

// Event type
export type EventType = 'status_change' | 'log' | 'metric' | 'command_result' | 'heartbeat';

// Agent status
export type AgentStatus = 'idle' | 'running' | 'error' | 'completed' | 'paused';

/**
 * API Response envelope - all API responses follow this structure
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

/**
 * Status change event payload
 */
export interface StatusChangePayload {
  readonly type: 'status_change';
  readonly previousStatus: AgentStatus;
  readonly currentStatus: AgentStatus;
  readonly reason?: string;
}

/**
 * Heartbeat event payload
 */
export interface HeartbeatPayload {
  readonly type: 'heartbeat';
  readonly uptimeMs: number;
  readonly memoryUsageMb: number;
  readonly cpuPercent: number;
}

/**
 * Event API request body
 */
export interface PostEventBody {
  readonly agentId: string;
  readonly agentName?: string;
  readonly agentType: AgentType;
  readonly eventType: EventType | string;
  readonly payload: StatusChangePayload | HeartbeatPayload | Record<string, unknown>;
  readonly tenantId?: string;
}

/**
 * Sync Event API request body
 */
export interface SyncEventBody {
  readonly agentId: string;
  readonly clientName: string;
  readonly event: {
    readonly type: string;
    readonly properties: Record<string, unknown>;
    readonly timestamp: number;
  };
}

/**
 * Sync Message API request body
 */
export interface SyncMessageBody {
  readonly agentId: string;
  readonly clientName: string;
  readonly message: {
    readonly id: string;
    readonly sessionId: string;
    readonly agent: string | undefined;
    readonly modelId?: string;
    readonly providerId?: string;
    readonly role: string;
    readonly partCount: number;
    readonly timeCreated: number;
  };
}

/**
 * Sync Tool API request body
 */
export interface SyncToolBody {
  readonly agentId: string;
  readonly clientName: string;
  readonly tool: {
    readonly name: string;
    readonly sessionId: string;
    readonly callId: string;
    readonly title: string;
    readonly outputLength: number;
    readonly timestamp: number;
  };
}

/**
 * Queue item for offline retry
 */
export interface QueueItem {
  readonly path: string;
  readonly data: unknown;
  attempts: number;
  nextRetryTime: number;
}

/**
 * Plugin state per instance (managed via WeakMap)
 */
export interface PluginState {
  readonly agentId: string;
  readonly clientName: string;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  isShuttingDown: boolean;
}

/**
 * Type guard for SyncEventBody
 */
export function isSyncEventBody(data: unknown): data is SyncEventBody {
  if (typeof data !== 'object' || data === null) return false;
  const body = data as Record<string, unknown>;
  return (
    typeof body.agentId === 'string' &&
    typeof body.clientName === 'string' &&
    typeof body.event === 'object' &&
    body.event !== null
  );
}

/**
 * Type guard for SyncMessageBody
 */
export function isSyncMessageBody(data: unknown): data is SyncMessageBody {
  if (typeof data !== 'object' || data === null) return false;
  const body = data as Record<string, unknown>;
  return (
    typeof body.agentId === 'string' &&
    typeof body.clientName === 'string' &&
    typeof body.message === 'object' &&
    body.message !== null
  );
}

/**
 * Type guard for SyncToolBody
 */
export function isSyncToolBody(data: unknown): data is SyncToolBody {
  if (typeof data !== 'object' || data === null) return false;
  const body = data as Record<string, unknown>;
  return (
    typeof body.agentId === 'string' &&
    typeof body.clientName === 'string' &&
    typeof body.tool === 'object' &&
    body.tool !== null
  );
}
