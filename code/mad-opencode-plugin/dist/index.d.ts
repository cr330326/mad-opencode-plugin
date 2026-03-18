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
 *   Set environment variables:
 *   MAD_SERVER_URL=https://your-dashboard.com
 *   MAD_API_KEY=your-api-key
 *   MAD_DEBUG=1 (optional, for debug logging)
 */
import type { Plugin } from '@opencode-ai/plugin';
export declare const MadPlugin: Plugin;
export default MadPlugin;
//# sourceMappingURL=index.d.ts.map