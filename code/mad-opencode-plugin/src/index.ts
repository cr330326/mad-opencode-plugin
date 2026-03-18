/**
 * MAD OpenCode Plugin
 *
 * Automatically syncs OpenCode activity to the MAD Dashboard.
 * Installs as an OpenCode plugin — zero manual startup required.
 *
 * Events captured:
 *   - Session events (create, update, compact)
 *   - Chat messages (user/assistant, model, timing)
 *   - Tool executions (name, args, output)
 *   - Permissions requests
 *
 * Install:
 *   Add to ~/.config/opencode/config.json:
 *   {
 *     "plugin": ["mad-opencode-plugin"]
 *   }
 *
 * Configure:
 *   Set environment variables:
 *   MAD_SERVER_URL=https://your-dashboard.com
 *   MAD_API_KEY=your-api-key
 *   MAD_DEBUG=1 (optional, for debug logging)
 */

import type { Plugin, PluginInput, Hooks } from '@opencode-ai/plugin';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hostname } from 'node:os';
import type {
  PluginState,
  PostEventBody,
  SyncEventBody,
  SyncMessageBody,
  SyncToolBody,
} from './types.js';
import { isSyncEventBody, isSyncMessageBody, isSyncToolBody } from './types.js';
import { logger } from './logger.js';
import { EventQueue } from './queue.js';

/**
 * File logging for debugging (bypasses TUI terminal suppression)
 */
const PLUGIN_LOG_FILE = `${process.env.HOME}/.opencode/log/mad-plugin.log`;
const PLUGIN_LOG_DIR = dirname(PLUGIN_LOG_FILE);

// Ensure log directory exists on module load
try {
  mkdirSync(PLUGIN_LOG_DIR, { recursive: true });
} catch {
  // Silently fail if directory creation fails
}

function fileLog(message: string): void {
  try {
    const timestamp = new Date().toISOString();
    appendFileSync(PLUGIN_LOG_FILE, `[${timestamp}] ${message}\n`);
  } catch {
    // Silently fail if file logging doesn't work
  }
}

/**
 * Configuration from environment variables
 */
const SERVER_URL = process.env.MAD_SERVER_URL ?? 'http://localhost:3000';
const API_KEY = process.env.MAD_API_KEY ?? 'dev-key';
const CLIENT_NAME = process.env.MAD_CLIENT_NAME ?? hostname();

/**
 * Validation helpers
 */
function validateAgentId(agentId: string): boolean {
  return typeof agentId === 'string' && agentId.length > 0;
}

function validateSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && sessionId.length > 0;
}

/**
 * Format a compact session ID for display
 */
function formatSessionId(sessionId: string | undefined): string {
  if (!sessionId) return 'unknown';
  if (sessionId.length > 12) {
    return `${sessionId.slice(0, 8)}...`;
  }
  return sessionId;
}

/**
 * Format message ID for display
 */
function formatMessageId(messageId: string | undefined): string {
  if (!messageId) return 'unknown';
  if (messageId.length > 20) {
    return `${messageId.slice(0, 12)}...`;
  }
  return messageId;
}

/**
 * Plugin state management per instance (WeakMap for proper isolation)
 */
const pluginStates = new WeakMap<PluginInput, PluginState>();

function getOrCreateState(input: PluginInput): PluginState {
  let state = pluginStates.get(input);
  if (!state) {
    const agentId = `opencode-${CLIENT_NAME}`;
    if (!validateAgentId(agentId)) {
      throw new Error(`Invalid agentId: ${agentId}`);
    }

    state = {
      agentId,
      clientName: CLIENT_NAME,
      heartbeatTimer: null,
      isShuttingDown: false,
    };
    pluginStates.set(input, state);
  }
  return state;
}

/**
 * Cleanup function called on process exit
 */
function cleanup(state: PluginState, queue: EventQueue): void {
  if (state.isShuttingDown) {
    logger.debug('Plugin', 'Already shutting down, skipping');
    return;
  }
  state.isShuttingDown = true;

  logger.info('Plugin', 'Shutting down...');

  // Clear heartbeat timer
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }

  // Send exit event
  queue.push('/api/events', {
    agentId: state.agentId,
    agentName: `OpenCode (${state.clientName})`,
    agentType: 'opencode',
    eventType: 'status_change',
    payload: {
      type: 'status_change',
      previousStatus: 'running',
      currentStatus: 'idle',
      reason: 'OpenCode stopped',
    },
  } satisfies PostEventBody);

  // Stop queue (this will do a final flush)
  queue.stop();

  logger.info('Plugin', 'Shutdown complete');
}

/**
 * Push an event to the MAD Server
 */
function pushEvent(queue: EventQueue, state: PluginState, eventType: string, payload: Record<string, unknown>): void {
  queue.push('/api/events', {
    agentId: state.agentId,
    agentName: `OpenCode (${state.clientName})`,
    agentType: 'opencode',
    eventType,
    payload: { type: eventType, ...payload },
  } satisfies PostEventBody);
}

// --- Plugin entry point ---
export const MadPlugin: Plugin = async (input: PluginInput) => {
  const state = getOrCreateState(input);

  // File log (bypasses TUI suppression)
  fileLog('========================================');
  fileLog('🚀 MAD OpenCode Plugin INITIALIZED');
  fileLog(`Agent ID: ${state.agentId}`);
  fileLog(`Server: ${SERVER_URL}`);
  fileLog(`Directory: ${input.directory}`);
  fileLog(`Project: ${input.project ?? 'none'}`);
  fileLog('========================================');

  // Create queue
  const queue = new EventQueue(SERVER_URL, API_KEY);
  queue.start();

  // Announce startup
  pushEvent(queue, state, 'status_change', {
    previousStatus: 'idle',
    currentStatus: 'running',
    reason: 'OpenCode started',
    directory: input.directory,
    project: input.project,
  });

  // Heartbeat every 30s
  state.heartbeatTimer = setInterval(() => {
    if (state.isShuttingDown) return;

    const mem = process.memoryUsage();
    pushEvent(queue, state, 'heartbeat', {
      uptimeMs: process.uptime() * 1000,
      memoryUsageMb: Math.round(mem.heapUsed / 1024 / 1024),
      cpuPercent: 0,
    });
  }, 30_000);

  // Unref timer to allow Node.js to exit if this is the only active timer
  if (typeof state.heartbeatTimer.unref === 'function') {
    state.heartbeatTimer.unref();
  }

  // Setup cleanup handlers for all exit scenarios
  const exitHandler = () => {
    cleanup(state, queue);
  };
  process.once('SIGTERM', exitHandler);
  process.once('SIGINT', exitHandler);
  process.once('beforeExit', exitHandler);

  // Track message counts for session
  const messageCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();

  const hooks: Hooks = {
    // --- Capture ALL events ---
    async event({ event }) {
      const eventType = String(event.type);
      const sessionId = (event.properties as any)?.sessionId;
      const title = (event.properties as any)?.title;

      // File log session events
      fileLog(`EVENT: ${eventType} | Session: ${formatSessionId(sessionId)} | Title: ${title || 'Untitled'}`);

      const data: SyncEventBody = {
        agentId: state.agentId,
        clientName: state.clientName,
        event: {
          type: event.type,
          properties: event.properties,
          timestamp: Date.now(),
        },
      };

      if (isSyncEventBody(data)) {
        queue.push('/api/sync/event', data);
      } else {
        logger.warn('Plugin', 'Invalid sync event data');
      }
    },

    // --- Capture chat messages ---
    async 'chat.message'(input, output) {
      const messageId = formatMessageId(input.messageID);
      const sessionId = input.sessionID;
      const role = output.message?.role ?? 'unknown';
      const agent = input.agent;
      const modelId = input.model?.modelID;
      const partCount = output.parts?.length ?? 0;

      // Update message count
      const count = (messageCounts.get(sessionId) || 0) + 1;
      messageCounts.set(sessionId, count);

      // File log message
      fileLog(`MESSAGE #${count} | ${role.toUpperCase()} | Session: ${formatSessionId(sessionId)} | Model: ${modelId || 'N/A'} | Agent: ${agent || 'N/A'}`);

      const data = {
        agentId: state.agentId,
        clientName: state.clientName,
        message: {
          id: input.messageID,
          sessionId: input.sessionID,
          agent: input.agent ?? undefined,
          modelId: input.model?.modelID,
          providerId: input.model?.providerID,
          role: output.message?.role ?? 'unknown',
          partCount: output.parts?.length ?? 0,
          timeCreated: Date.now(),
        },
      } as SyncMessageBody;

      if (isSyncMessageBody(data)) {
        if (validateSessionId(data.message.sessionId)) {
          queue.push('/api/sync/message', data);
        } else {
          logger.warn('Plugin', `Invalid sessionId in message: ${data.message.sessionId}`);
        }
      } else {
        logger.warn('Plugin', 'Invalid sync message data');
      }
    },

    // --- Capture tool executions ---
    async 'tool.execute.after'(input, output) {
      const toolName = input.tool;
      const sessionId = input.sessionID;
      const callId = input.callID;
      const title = output.title;
      const outputLength = output.output?.length ?? 0;

      // Update tool count
      const toolKey = `${sessionId}:${toolName}`;
      const count = (toolCounts.get(toolKey) || 0) + 1;
      toolCounts.set(toolKey, count);

      // File log tool execution
      fileLog(`TOOL: ${toolName} | Session: ${formatSessionId(sessionId)} | Title: ${title || '(no title)'} | Output: ${outputLength} chars`);

      // Special logging for task spawns
      if (toolName === 'task') {
        const taskInput = input as any;
        if (taskInput.subagent_type) {
          fileLog(`  👶 Spawning sub-agent: ${taskInput.subagent_type}`);
        }
      }

      const data: SyncToolBody = {
        agentId: state.agentId,
        clientName: state.clientName,
        tool: {
          name: input.tool,
          sessionId: input.sessionID,
          callId: input.callID,
          title: output.title,
          outputLength: output.output?.length ?? 0,
          timestamp: Date.now(),
        },
      };

      if (isSyncToolBody(data)) {
        if (validateSessionId(data.tool.sessionId)) {
          queue.push('/api/sync/tool', data);
        } else {
          logger.warn('Plugin', `Invalid sessionId in tool: ${data.tool.sessionId}`);
        }
      } else {
        logger.warn('Plugin', 'Invalid sync tool data');
      }
    },
  };

  return hooks;
};

// Default export for OpenCode plugin loader
export default MadPlugin;
