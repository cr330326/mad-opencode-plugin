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
 *     "plugin": ["@mad/opencode-plugin"]
 *   }
 *
 * Configure:
 *   Set environment variable:
 *   MAD_SERVER_URL=https://your-dashboard.com
 *   MAD_API_KEY=your-api-key
 */
import type { Plugin, PluginInput, Hooks } from '@opencode-ai/plugin';
import { hostname } from 'os';

const SERVER_URL = process.env.MAD_SERVER_URL ?? 'http://localhost:3000';
const API_KEY = process.env.MAD_API_KEY ?? 'dev-key';
const CLIENT_NAME = process.env.MAD_CLIENT_NAME ?? hostname();

let agentId: string;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

// --- HTTP push (fire and forget) ---
function push(path: string, data: unknown): void {
  fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(data),
  }).catch(() => {
    // silently ignore - dashboard might be offline
  });
}

function pushEvent(eventType: string, payload: Record<string, unknown>): void {
  push('/api/events', {
    agentId,
    agentName: `OpenCode (${CLIENT_NAME})`,
    agentType: 'opencode',
    eventType,
    payload: { type: eventType, ...payload },
  });
}

// --- Plugin entry point ---
export const MadPlugin: Plugin = async (input: PluginInput) => {
  agentId = `opencode-${CLIENT_NAME}`;

  // Announce startup
  pushEvent('status_change', {
    previousStatus: 'idle',
    currentStatus: 'running',
    reason: 'OpenCode started',
    directory: input.directory,
    project: input.project,
  });

  // Heartbeat every 30s
  heartbeatTimer = setInterval(() => {
    const mem = process.memoryUsage();
    pushEvent('heartbeat', {
      uptimeMs: process.uptime() * 1000,
      memoryUsageMb: Math.round(mem.heapUsed / 1024 / 1024),
      cpuPercent: 0,
    });
  }, 30_000);

  // Cleanup on exit
  process.on('beforeExit', () => {
    clearInterval(heartbeatTimer);
    pushEvent('status_change', {
      previousStatus: 'running',
      currentStatus: 'idle',
      reason: 'OpenCode stopped',
    });
  });

  const hooks: Hooks = {
    // --- Capture ALL events ---
    async event({ event }) {
      push('/api/sync/event', {
        agentId,
        clientName: CLIENT_NAME,
        event: {
          type: event.type,
          properties: event.properties,
          timestamp: Date.now(),
        },
      });
    },

    // --- Capture chat messages ---
    async 'chat.message'(input, output) {
      push('/api/sync/message', {
        agentId,
        clientName: CLIENT_NAME,
        message: {
          id: input.messageID,
          sessionId: input.sessionID,
          agent: input.agent,
          modelId: input.model?.modelID,
          providerId: input.model?.providerID,
          role: output.message?.role ?? 'unknown',
          partCount: output.parts?.length ?? 0,
          timeCreated: Date.now(),
        },
      });
    },

    // --- Capture tool executions ---
    async 'tool.execute.after'(input, output) {
      push('/api/sync/tool', {
        agentId,
        clientName: CLIENT_NAME,
        tool: {
          name: input.tool,
          sessionId: input.sessionID,
          callId: input.callID,
          title: output.title,
          outputLength: output.output?.length ?? 0,
          timestamp: Date.now(),
        },
      });
    },
  };

  return hooks;
};

// Default export for OpenCode plugin loader
export default MadPlugin;
