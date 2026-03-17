# MAD (Multi-Agent Dashboard) 系统设计文档

> 版本: 1.0 | 最后更新: 2026-03-17

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [技术栈](#3-技术栈)
4. [Monorepo 结构](#4-monorepo-结构)
5. [OpenCode Plugin 详细设计](#5-opencode-plugin-详细设计)
6. [Server API 接口定义](#6-server-api-接口定义)
7. [数据模型](#7-数据模型)
8. [前端组件设计](#8-前端组件设计)
9. [核心算法](#9-核心算法)
10. [Sidecar Daemon 设计](#10-sidecar-daemon-设计)
11. [配置参考](#11-配置参考)
12. [部署指南](#12-部署指南)

---

## 1. 项目概述

### 1.1 什么是 MAD

MAD (Multi-Agent Dashboard) 是一个实时监控和可视化平台，专为多 Agent 协作场景设计。它以 Dashboard 的形式展示由 OpenCode (AI 编码助手) 创建和管理的多层 Agent 树，支持：

- **实时 Agent 依赖图**：以交互式树形图展示 Orchestrator → Sub-agent → Sub-sub-agent 的层级关系
- **Session 管理**：按 Session 分组查看 Agent 协作过程，支持 active/completed/failed 状态过滤
- **对话时间线**：查看每个 Session 的完整对话历史，包括 text、tool call、reasoning、task spawn 等 part 级别的详细信息
- **子 Agent Session 穿透**：在 task spawn bubble 中直接加载和查看子 Agent 的完整 session 内容
- **多机数据同步**：通过 Plugin 或 Sidecar 将远程机器上的 OpenCode 数据推送到中心 Dashboard

### 1.2 解决什么问题

在使用 OpenCode 进行复杂编码任务时，OpenCode 的 `task` tool 会 spawn 多个 sub-agent，每个 sub-agent 运行在独立的 session 中。这些 sub-agent 之间形成树状依赖关系。原生 OpenCode CLI 不提供：

1. **全局视图**：无法同时看到所有 Agent 的运行状态和依赖关系
2. **历史回溯**：无法方便地浏览已完成 session 的对话内容
3. **跨机监控**：无法在一个界面看到多台机器上的 Agent 活动
4. **状态可视化**：无法直观了解哪些 Agent 在运行、等待、或已完成

MAD 通过直接读取 OpenCode 的 SQLite 数据库 + Plugin 推送机制，以零侵入方式解决以上问题。

---

## 2. 系统架构

### 2.1 整体架构图

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                          用户浏览器 (React SPA)                             │
 │                                                                             │
 │  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────────────┐   │
 │  │ SessionSel-  │   │  DependencyGraph  │   │   AgentDetailPanel         │   │
 │  │ ector (左栏) │   │  (中央画布)       │   │   (右栏, 可选)             │   │
 │  └──────────────┘   └──────────────────┘   └────────────────────────────┘   │
 │  ┌────────────────────────────────────────────────────────────────────────┐  │
 │  │                    TopBar (顶部导航 + 状态指示)                        │  │
 │  └────────────────────────────────────────────────────────────────────────┘  │
 │                                                                             │
 │  ┌────────────────────────────────────────────────────────────────────────┐  │
 │  │            Sessions 页面 (卡片列表 + 对话时间线详情)                    │  │
 │  └────────────────────────────────────────────────────────────────────────┘  │
 └─────────────────┬──────────────────────────────────────┬────────────────────┘
                   │  HTTP REST (polling 3s)              │  HTTP REST (on-demand)
                   │  GET /api/opencode/stats              │  GET /api/opencode/sessions/:id/parts
                   ▼                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                        MAD Lite Server (Fastify)                            │
 │                                                                             │
 │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
 │  │ REST API    │  │ WebSocket    │  │ OpenCode     │  │ Sync Store      │  │
 │  │ Routes      │  │ Broadcast    │  │ SQLite Reader│  │ (in-memory)     │  │
 │  └─────────────┘  └──────────────┘  └──────┬───────┘  └─────────────────┘  │
 │                                             │                               │
 └─────────────────────────────────────────────┼───────────────────────────────┘
                                               │ sqlite3 CLI (execSync)
                                               ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │              OpenCode SQLite Database                                        │
 │              ~/.local/share/opencode/opencode.db                            │
 │                                                                             │
 │  ┌──────────┐    ┌──────────┐    ┌──────────┐                               │
 │  │ session  │    │ message  │    │  part    │                               │
 │  │ 表       │◄───│ 表       │◄───│  表      │                               │
 │  └──────────┘    └──────────┘    └──────────┘                               │
 └─────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────┐     ┌────────────────────────────┐
 │  OpenCode Plugin           │     │  Sidecar Daemon            │
 │  (@mad/opencode-plugin)    │     │  (@mad/sidecar)            │
 │                            │     │                            │
 │  运行在 OpenCode 进程内    │     │  独立后台进程              │
 │  通过 Hooks 捕获事件       │     │  watchFile + 轮询          │
 │  HTTP POST → Server        │     │  读取 SQLite → HTTP POST   │
 └────────────┬───────────────┘     └────────────┬───────────────┘
              │                                  │
              │  POST /api/sync/event            │  POST /api/sync/session
              │  POST /api/sync/message          │  POST /api/sync/message
              │  POST /api/sync/tool             │  POST /api/events
              │  POST /api/events                │
              └──────────────┬───────────────────┘
                             ▼
                     MAD Lite Server
```

### 2.2 数据流

```
OpenCode 运行 (CLI / Desktop)
        │
        ├──(1) 直接读取──► OpenCode SQLite DB ◄──(2) Server 直接查询──► MAD Server
        │
        ├──(3) Plugin Hook──► POST /api/sync/* ──► MAD Server ──► WebSocket Broadcast
        │
        └──(4) Sidecar watchFile──► POST /api/sync/* ──► MAD Server ──► WebSocket Broadcast
                                                                │
                                                                ▼
                                                         React Frontend
                                                       (polling + WS)
```

**三条数据通道**：

| 通道 | 触发方式 | 延迟 | 适用场景 |
|------|---------|------|---------|
| 本地 SQLite 直接读取 | 前端 polling (3s) → Server → sqlite3 | ~3s | 本地运行 Server + OpenCode 在同一台机器 |
| Plugin HTTP Push | OpenCode Hook 实时触发 | <1s | OpenCode CLI 安装了 Plugin |
| Sidecar DB Watch | watchFile 3s + 轮询 15s | 3~15s | OpenCode 在远程机器，不方便装 Plugin |

---

## 3. 技术栈

### 3.1 各 Package 技术栈

| Package | 技术 | 版本 | 用途 |
|---------|------|------|------|
| `@mad/root` | Turborepo | ^2.3.0 | Monorepo 构建编排 |
| `@mad/root` | TypeScript | ~5.7.0 | 全局类型系统 |
| `@mad/root` | ESLint | ^9.0.0 | 代码质量 |
| `@mad/root` | Prettier | ^3.4.0 | 代码格式化 |
| `@mad/client` | React | ^19.0.0 | UI 框架 |
| `@mad/client` | React Router | ^7.13.1 | 客户端路由 |
| `@mad/client` | Vite | ^6.0.0 | 构建工具 + 开发服务器 |
| `@mad/client` | Tailwind CSS | ^4.0.0 | 原子化 CSS |
| `@mad/client` | Lucide React | ^0.577.0 | 图标库 |
| `@mad/client` | Zustand | ^5.0.0 | 全局状态管理 |
| `@mad/client` | D3 | ^7.9.0 | 数据可视化 (备用) |
| `@mad/client` | Recharts | ^3.8.0 | 图表组件 |
| `@mad/client` | Framer Motion | ^12.0.0 | 动画 |
| `@mad/client` | Radix UI | ^1.1.8+ | 无样式 UI 原语 (Progress, Slot) |
| `@mad/client` | Vitest | ^3.0.0 | 单元测试 |
| `@mad/server` | Fastify | ^5.2.0 | HTTP 框架 |
| `@mad/server` | @fastify/websocket | ^11.0.0 | WebSocket 支持 |
| `@mad/server` | @fastify/cors | ^10.0.0 | 跨域 |
| `@mad/server` | @fastify/jwt | ^9.0.0 | JWT 认证 (预留) |
| `@mad/server` | @fastify/rate-limit | ^10.0.0 | 速率限制 (预留) |
| `@mad/server` | Drizzle ORM | ^0.38.0 | 数据库 ORM (预留) |
| `@mad/server` | Zod | ^3.24.0 | 请求校验 |
| `@mad/server` | ioredis | ^5.4.0 | Redis 客户端 (预留) |
| `@mad/server` | pg | ^8.13.0 | PostgreSQL 客户端 (预留) |
| `@mad/server` | tsx | ^4.19.0 | TypeScript 直接执行 |
| `@mad/shared` | TypeScript | ~5.7.0 | 共享类型定义 |
| `@mad/sidecar` | ws | ^8.18.0 | WebSocket 客户端 |
| `@mad/sidecar` | Zod | ^3.24.0 | Schema 校验 |
| `@mad/sidecar` | Pino | ^9.6.0 | 日志 |
| `@mad/sidecar` | node-pty | ^1.0.0 | PTY (可选) |
| `@mad/opencode-plugin` | @opencode-ai/plugin | ^1.2.20 | OpenCode Plugin SDK |

> 注意: Server 的 `package.json` 中列出了 pg、ioredis、drizzle-orm 等重量级依赖，但当前 Lite 模式未使用，全部数据存储在内存中 + 直接读取 OpenCode 的 SQLite。这些依赖是为未来完整版 Server 预留的。

### 3.2 Node.js 版本要求

- Node.js >= 20.0.0
- npm 10.9.0 (packageManager 锁定)

---

## 4. Monorepo 结构

### 4.1 目录树

```
multi_agent_dashboard/
├── package.json                  # Root workspace 配置, Turborepo 脚本
├── turbo.json                    # Turborepo pipeline 配置
├── packages/
│   ├── shared/                   # 共享类型和常量
│   │   ├── package.json          # @mad/shared
│   │   └── src/
│   │       ├── index.ts          # 统一导出
│   │       ├── constants.ts      # WS/心跳/重连等常量
│   │       └── types/
│   │           ├── events.ts     # AgentEvent, EventPayload 等联合类型
│   │           ├── ws-protocol.ts# WSMessage, WSEventPayload 等 WS 协议类型
│   │           └── api.ts        # ApiResponse, AgentSummary 等 API 类型
│   │
│   ├── server/                   # 后端服务
│   │   ├── package.json          # @mad/server (Fastify + 预留 PG/Redis/Drizzle)
│   │   └── src/
│   │       └── lite/
│   │           ├── index.ts      # Lite Server 入口: 路由注册、WS、内存存储
│   │           └── opencode.ts   # OpenCode SQLite 直接查询层
│   │
│   ├── client/                   # 前端 SPA
│   │   ├── package.json          # @mad/client (React 19 + Vite 6 + Tailwind 4)
│   │   └── src/
│   │       ├── routes.ts         # React Router 路由表
│   │       ├── pages/
│   │       │   ├── Root.tsx      # 根布局 (暗色主题 + Outlet)
│   │       │   ├── Dashboard.tsx # Dashboard 页面: 三栏布局 + DependencyGraph
│   │       │   └── Sessions.tsx  # Sessions 页面: 卡片列表 + 对话详情
│   │       ├── hooks/
│   │       │   └── useRealAgents.ts # 核心数据 Hook: polling + tree 构建
│   │       ├── components/
│   │       │   └── dashboard/
│   │       │       ├── TopBar.tsx          # 顶部导航栏 + 状态计数
│   │       │       ├── SessionSelector.tsx # 左侧 Session 列表 (可折叠)
│   │       │       ├── DependencyGraph.tsx # 中央 Agent 依赖图 (可缩放/拖拽)
│   │       │       └── AgentDetailPanel.tsx# 右侧 Agent 详情面板 + 时间线
│   │       ├── types/
│   │       │   ├── agent.ts      # Agent, AgentState, TimelineStep 等类型
│   │       │   ├── session.ts    # Session 类型
│   │       │   └── conversation.ts # ConversationMessage 类型
│   │       └── lib/
│   │           └── utils.ts      # cn() 等工具函数
│   │
│   ├── sidecar/                  # 独立后台同步进程
│   │   ├── package.json          # @mad/sidecar
│   │   └── src/
│   │       ├── daemon.ts         # 系统级 Daemon (跨平台服务安装)
│   │       └── opencode-sync.ts  # OpenCode DB 同步 Agent
│   │
│   └── opencode-plugin/          # OpenCode Plugin
│       ├── package.json          # @mad/opencode-plugin
│       └── src/
│           └── index.ts          # Plugin 入口: event/chat.message/tool.execute.after Hooks
│
└── docs/
    ├── DESIGN.md
    ├── GETTING-STARTED.md
    └── DESIGN-SPEC.md            # 本文档
```

### 4.2 依赖关系

```
@mad/client ──depends──► @mad/shared
@mad/server ──depends──► @mad/shared
@mad/sidecar ──depends──► @mad/shared
@mad/opencode-plugin ──depends──► @opencode-ai/plugin (外部)
```

---

## 5. OpenCode Plugin 详细设计

### 5.1 Plugin 概述

`@mad/opencode-plugin` 运行在 OpenCode 进程内部，通过 OpenCode 的 Plugin Hooks 系统实时捕获 OpenCode 活动，并通过 HTTP POST fire-and-forget 方式推送到 MAD Server。

**文件**: `packages/opencode-plugin/src/index.ts`

### 5.2 使用的 OpenCode Hooks

| Hook 名称 | 触发时机 | 输入参数 | 输出参数 |
|-----------|---------|---------|---------|
| `event` | 任何 OpenCode 事件发生时 (session 创建/更新/压缩等) | `{ event: { type: string; properties: Record<string, unknown> } }` | 无 |
| `chat.message` | 每条 chat message 完成后 (user/assistant 消息) | `{ messageID, sessionID, agent, model: { modelID, providerID } }` | `{ message: { role }, parts: unknown[] }` |
| `tool.execute.after` | 工具执行完成后 (如 Read, Edit, Bash, task 等) | `{ tool: string; sessionID: string; callID: string }` | `{ title: string; output: string }` |

### 5.3 Hook 详细说明

#### 5.3.1 `event` Hook

**触发时机**: OpenCode 内部产生任何事件时触发，包括：
- Session 创建 (`session.create`)
- Session 更新 (`session.update`)
- Session 压缩 (`session.compact`)
- 其他平台事件

**推送格式**:
```typescript
// POST /api/sync/event
interface SyncEventPayload {
  readonly agentId: string;      // "opencode-{hostname}"
  readonly clientName: string;   // hostname
  readonly event: {
    readonly type: string;       // 原始事件类型
    readonly properties: Record<string, unknown>;  // 事件属性
    readonly timestamp: number;  // Date.now()
  };
}
```

#### 5.3.2 `chat.message` Hook

**触发时机**: 每条消息完成处理后触发，包括 user 发送的消息和 assistant 的回复。

**推送格式**:
```typescript
// POST /api/sync/message
interface SyncMessagePayload {
  readonly agentId: string;      // "opencode-{hostname}"
  readonly clientName: string;   // hostname
  readonly message: {
    readonly id: string;         // input.messageID
    readonly sessionId: string;  // input.sessionID
    readonly agent: string;      // input.agent (agent 类型名)
    readonly modelId?: string;   // input.model?.modelID (如 "claude-sonnet-4-20250514")
    readonly providerId?: string;// input.model?.providerID (如 "anthropic")
    readonly role: string;       // output.message?.role ("user" | "assistant")
    readonly partCount: number;  // output.parts?.length
    readonly timeCreated: number;// Date.now()
  };
}
```

#### 5.3.3 `tool.execute.after` Hook

**触发时机**: 任何 tool 执行完成后触发。

**推送格式**:
```typescript
// POST /api/sync/tool
interface SyncToolPayload {
  readonly agentId: string;      // "opencode-{hostname}"
  readonly clientName: string;   // hostname
  readonly tool: {
    readonly name: string;       // input.tool (如 "Read", "Edit", "Bash", "task")
    readonly sessionId: string;  // input.sessionID
    readonly callId: string;     // input.callID
    readonly title: string;      // output.title (工具执行标题)
    readonly outputLength: number;// output.output?.length
    readonly timestamp: number;  // Date.now()
  };
}
```

### 5.4 Plugin 生命周期事件

除了 Hooks，Plugin 还在启动和退出时推送状态事件：

**启动时**:
```typescript
// POST /api/events
{
  agentId: "opencode-{hostname}",
  agentName: "OpenCode ({hostname})",
  agentType: "opencode",
  eventType: "status_change",
  payload: {
    type: "status_change",
    previousStatus: "idle",
    currentStatus: "running",
    reason: "OpenCode started",
    directory: input.directory,
    project: input.project,
  }
}
```

**心跳 (每 30s)**:
```typescript
// POST /api/events
{
  agentId: "opencode-{hostname}",
  agentName: "OpenCode ({hostname})",
  agentType: "opencode",
  eventType: "heartbeat",
  payload: {
    type: "heartbeat",
    uptimeMs: process.uptime() * 1000,
    memoryUsageMb: Math.round(mem.heapUsed / 1024 / 1024),
    cpuPercent: 0,
  }
}
```

**退出时** (`beforeExit`):
```typescript
// POST /api/events
{
  eventType: "status_change",
  payload: {
    type: "status_change",
    previousStatus: "running",
    currentStatus: "idle",
    reason: "OpenCode stopped",
  }
}
```

### 5.5 认证机制

#### 当前方案: API Key

Plugin 通过 HTTP Header `X-API-Key` 传递 API Key：

```typescript
headers: {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,  // 环境变量 MAD_API_KEY
}
```

Server 端目前**不校验** API Key（Lite 模式），但 Header 已就位。

#### 未来方案: OAuth Auth Hook

OpenCode Plugin SDK 将来可能支持 `auth` hook，可以在 Plugin 初始化时通过 OAuth 流程获取 token，然后在每次 HTTP 请求中携带 Bearer token。

### 5.6 配置方式

#### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|-------|------|
| `MAD_SERVER_URL` | `http://localhost:3000` | MAD Server 地址 |
| `MAD_API_KEY` | `dev-key` | API Key |
| `MAD_CLIENT_NAME` | `os.hostname()` | 客户端名称 (显示在 Dashboard) |

#### opencode.json 配置

路径: `~/.config/opencode/opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@mad/opencode-plugin"],
  "agent": {
    "explore": { "tools": { "task": true } },
    "general": { "tools": { "task": true } }
  }
}
```

> `tools.task: true` 启用 OpenCode 的 `task` tool，这是多 Agent 协作的前提。

### 5.7 安装方式

1. 确保 `@mad/opencode-plugin` 包可被 Node.js resolve (在 monorepo 中已通过 workspace 链接)
2. 在 `~/.config/opencode/opencode.json` 的 `plugin` 数组中添加包名
3. 设置环境变量 `MAD_SERVER_URL` 和 `MAD_API_KEY`
4. 重启 OpenCode

---

## 6. Server API 接口定义

### 6.1 REST API

所有 API 响应遵循统一信封格式：

```typescript
interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
  readonly meta?: PaginationMeta;
}
```

#### 6.1.1 健康检查

| 属性 | 值 |
|------|---|
| Method | `GET` |
| Path | `/health` |
| Request Body | 无 |
| Response | `{ status: "ok", mode: "lite", timestamp: number }` |

#### 6.1.2 Agent 管理 API

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| `GET` | `/api/agents` | 无 | `ApiResponse<AgentSummary[]>` |
| `GET` | `/api/agents/:id` | 无 | `ApiResponse<AgentSummary>` (404 if not found) |

#### 6.1.3 Event API

| Method | Path | Query/Body | Response |
|--------|------|-----------|----------|
| `GET` | `/api/events` | `?agentId=string&limit=number` (max 500, default 50) | `ApiResponse<AgentEvent[]>` |
| `POST` | `/api/events` | 见下方 | `ApiResponse<{ id: string }>` |

**POST /api/events Request Body**:
```typescript
interface PostEventBody {
  readonly agentId: string;
  readonly agentName?: string;
  readonly agentType: string;      // "opencode" | "openclaw" | "claude-code" | "custom"
  readonly eventType: string;      // "status_change" | "log" | "metric" | "command_result" | "heartbeat"
  readonly payload: Record<string, unknown>;
  readonly tenantId?: string;      // 默认 "default"
}
```

**副作用**:
- 存储 event 到内存数组 (上限 10,000 条，FIFO 淘汰)
- 自动注册/更新 Agent 到 `agentMap`
- 通过 WebSocket broadcast 给所有客户端

#### 6.1.4 OpenCode 本地数据 API

| Method | Path | Query | Response |
|--------|------|-------|----------|
| `GET` | `/api/opencode/status` | 无 | `ApiResponse<{ available: boolean }>` |
| `GET` | `/api/opencode/sessions` | `?limit=number` (default 20) | `ApiResponse<OpenCodeSession[]>` |
| `GET` | `/api/opencode/sessions/:sessionId/messages` | `?limit=number` (default 100) | `ApiResponse<OpenCodeMessage[]>` |
| `GET` | `/api/opencode/sessions/:sessionId/parts` | 无 | `ApiResponse<SessionPart[]>` |
| `GET` | `/api/opencode/stats` | 无 | `ApiResponse<OpenCodeStats & { sessionTree }>` |

**关键接口 - `/api/opencode/stats` Response**:
```typescript
interface StatsResponse {
  readonly totalSessions: number;
  readonly totalMessages: number;
  readonly recentSessions: readonly OpenCodeSession[];
  readonly recentMessages: readonly OpenCodeMessage[];  // 当前为空数组
  readonly sessionTree: readonly { parentId: string; childId: string }[];
}
```

> 这是前端 `useRealAgents` hook 的核心数据源，每 3 秒 polling 一次。

#### 6.1.5 远程同步 API (Sync)

供 Plugin 和 Sidecar 推送数据使用：

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | `/api/sync/session` | `{ agentId, clientName, session: {...} }` | `ApiResponse<null>` |
| `POST` | `/api/sync/message` | `{ agentId, clientName, message: {...} }` | `ApiResponse<null>` |
| `POST` | `/api/sync/event` | `{ agentId, clientName, event: {...} }` | `ApiResponse<null>` |
| `POST` | `/api/sync/tool` | `{ agentId, clientName, tool: {...} }` | `ApiResponse<null>` |
| `GET` | `/api/sync/sessions` | 无 | `ApiResponse<SyncedSession[]>` |
| `GET` | `/api/sync/sessions/:sessionId/messages` | 无 | `ApiResponse<SyncedMessage[]>` |

**POST /api/sync/session Request Body**:
```typescript
{
  agentId: string;
  clientName: string;
  session: {
    id: string;
    title: string;
    directory: string;
    summaryFiles: number | null;
    summaryAdditions: number | null;
    summaryDeletions: number | null;
    timeCreated: number;
    timeUpdated: number;
  };
}
```

**POST /api/sync/message Request Body**:
```typescript
{
  agentId: string;
  clientName: string;
  message: {
    id: string;
    sessionId: string;
    agent?: string;
    modelId?: string;
    providerId?: string;
    role: string;
    partCount: number;
    timeCreated: number;
  };
}
```

**POST /api/sync/tool Request Body**:
```typescript
{
  agentId: string;
  clientName: string;
  tool: {
    name: string;
    sessionId: string;
    callId: string;
    title: string;
    outputLength: number;
    timestamp: number;
  };
}
```

**副作用 (所有 POST /api/sync/* 共同)**:
- 更新 `syncStore.agents` 中的 lastSeen
- 存储到对应的 `syncStore.sessions` / `syncStore.messages`
- 自动注册/更新 `agentMap`
- WebSocket broadcast 给所有客户端

### 6.2 WebSocket 协议

#### 连接

```
ws://localhost:3000/ws
```

#### 连接时初始消息

Server 在客户端连接时发送当前所有 Agent 状态：

```typescript
{
  type: "event",
  id: string,       // UUID
  timestamp: number, // Date.now()
  payload: {
    agents: AgentSummary[]  // 所有已注册 Agent
  }
}
```

#### 事件广播消息

当有新 event ingest 时，广播到所有 WS 客户端：

```typescript
interface WSMessage<WSEventPayload> {
  readonly type: "event";
  readonly id: string;
  readonly timestamp: number;
  readonly payload: {
    readonly events: readonly AgentEvent[];
    readonly cursor: string;  // 最后一个 event 的 id
  };
}
```

#### Sync 广播消息

当有远程 sync 数据到达时：

```typescript
{
  type: "sync",
  id: string,
  timestamp: number,
  payload: {
    kind: "session" | "message",
    agentId: string,
    clientName: string,
    session?: {...},   // kind="session" 时
    message?: {...},   // kind="message" 时
  }
}
```

#### WSMessage 类型定义

```typescript
type WSMessageType =
  | "event"
  | "command"
  | "ack"
  | "error"
  | "ping"
  | "pong"
  | "backpressure"
  | "auth_refresh"
  | "degraded";

interface WSMessage<T = unknown> {
  readonly type: WSMessageType;
  readonly id: string;
  readonly timestamp: number;
  readonly payload: T;
}
```

> 目前 Lite Server 仅使用 `event` 和 `sync` 类型。其他类型为完整版预留。

---

## 7. 数据模型

### 7.1 OpenCode SQLite 数据库表结构

数据库路径: `~/.local/share/opencode/opencode.db`

#### session 表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT (PK) | Session ID (如 `ses_xxx`) |
| `title` | TEXT | Session 标题 (可能包含 `(@xxx subagent)` 后缀) |
| `directory` | TEXT | 工作目录路径 |
| `summary_files` | INTEGER (nullable) | 修改的文件数 |
| `summary_additions` | INTEGER (nullable) | 新增行数 |
| `summary_deletions` | INTEGER (nullable) | 删除行数 |
| `time_created` | INTEGER | 创建时间 (Unix ms) |
| `time_updated` | INTEGER | 最后更新时间 (Unix ms) |

#### message 表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT (PK) | Message ID |
| `session_id` | TEXT (FK → session.id) | 所属 Session |
| `data` | TEXT (JSON) | 消息完整 JSON |
| `time_created` | INTEGER | 创建时间 |

**`data` JSON 结构**:
```typescript
interface MessageData {
  readonly role: "user" | "assistant";
  readonly modelID?: string;
  readonly providerID?: string;
  readonly mode?: string;
  readonly agent?: string;     // Agent 类型名 (如 "explore", "general")
  readonly time?: {
    readonly created?: number;
    readonly completed?: number;
  };
}
```

#### part 表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT (PK) | Part ID |
| `message_id` | TEXT (FK → message.id) | 所属 Message |
| `data` | TEXT (JSON) | Part 完整 JSON |
| `time_created` | INTEGER | 创建时间 |

**`data` JSON 结构** (根据 `type` 字段不同):

```typescript
// text part
interface TextPartData {
  readonly type: "text";
  readonly text: string;
}

// reasoning part
interface ReasoningPartData {
  readonly type: "reasoning";
  readonly text: string;
}

// tool part (普通工具)
interface ToolPartData {
  readonly type: "tool";
  readonly tool: string;      // 工具名: "Read", "Edit", "Bash", "Grep", "Glob" 等
  readonly state: {
    readonly input: unknown;  // 工具输入参数
    readonly output?: string; // 工具输出
    readonly status?: "completed" | "error" | "pending";
    readonly time?: {
      readonly start?: number;
      readonly end?: number;
    };
  };
}

// tool part (task spawn)
interface TaskPartData {
  readonly type: "tool";
  readonly tool: "task";     // 固定为 "task"
  readonly state: {
    readonly input: {
      readonly description: string;      // 任务描述
      readonly subagent_type: string;    // 子 Agent 类型
    };
    readonly output?: string;            // 可能包含 "task_id: ses_xxx"
    readonly metadata?: {
      readonly sessionId?: string;       // 子 session ID (新格式)
    };
    readonly status?: "completed" | "error" | "pending";
    readonly time?: {
      readonly start?: number;
      readonly end?: number;
    };
  };
}

// step-start / step-finish (噪音数据，前端过滤掉)
interface StepPartData {
  readonly type: "step-start" | "step-finish";
}
```

### 7.2 Server 内存存储结构

```typescript
// Agent 注册表 (key: agentId)
const agentMap = new Map<string, AgentSummary>();

interface AgentSummary {
  readonly id: string;
  readonly name: string;
  readonly type: AgentType;      // "opencode" | "openclaw" | "claude-code" | "custom"
  readonly status: AgentStatus;  // "idle" | "running" | "error" | "completed" | "paused"
  readonly lastSeen: number;
  readonly clientId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// 事件列表 (FIFO, 上限 10,000)
const events: AgentEvent[] = [];

interface AgentEvent {
  readonly id: string;           // UUID
  readonly tenantId: string;     // "default"
  readonly agentId: string;
  readonly agentType: AgentType;
  readonly eventType: EventType; // "status_change" | "log" | "metric" | "command_result" | "heartbeat"
  readonly payload: EventPayload;
  readonly timestamp: number;
  readonly traceId?: string;
}

// 远程同步存储
const syncStore = {
  agents: new Map<string, { clientName: string; lastSeen: number }>(),
  sessions: new Map<string, unknown>(),
  messages: new Map<string, unknown>(),
};

// WebSocket 客户端集合
const wsClients = new Set<WebSocket>();
```

### 7.3 前端类型定义

#### Agent (前端渲染用)

```typescript
type AgentState = "queued" | "running" | "waiting" | "completed" | "failed";

interface Activity {
  readonly type: "thinking" | "tool_call";
  readonly tool?: string;
  readonly detail?: string;
}

interface TimelineStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly timestamp: string;
  readonly duration: string;
  readonly status: "completed" | "current" | "pending";
}

interface Agent {
  readonly id: string;
  readonly name: string;
  readonly type: string;           // "Orchestrator" | "opencode" | agent 类型名
  readonly state: AgentState;
  readonly activity?: Activity;
  readonly duration: string;       // 格式化后的持续时间 "5m 30s"
  readonly toolsUsed: number;
  readonly parentId?: string;      // 父 Agent ID
  readonly childIds: readonly string[];  // 子 Agent ID 列表
  readonly timeline: readonly TimelineStep[];
  readonly level: 1 | 2 | 3;      // 树深度层级
  readonly sessionId: string;      // 所属根 Session ID
}
```

#### Session (前端渲染用)

```typescript
interface Session {
  readonly id: string;
  readonly name: string;
  readonly status: "active" | "paused" | "completed" | "failed";
  readonly startTime: string;      // ISO 8601
  readonly duration: string;       // 格式化后的持续时间
  readonly leaderAgentId: string;  // 顶层 Agent ID
  readonly totalAgents: number;
  readonly description?: string;   // 工作目录
}
```

#### ConversationMessage (对话视图用)

```typescript
type MessageRole = "user" | "assistant" | "tool_call" | "tool_result" | "system";

interface ConversationMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly agentName?: string;
  readonly content: string;
  readonly timestamp: string;
  readonly toolName?: string;
  readonly toolArgs?: string;
  readonly duration?: string;
  readonly status?: "success" | "error" | "pending";
}
```

#### SessionPart (Parts 时间线视图用)

```typescript
interface SessionPart {
  readonly id: string;
  readonly messageId: string;
  readonly role: string;
  readonly agent?: string;
  readonly modelId?: string;
  readonly partType: string;       // "text" | "reasoning" | "tool" | "step-start" | "step-finish"
  readonly tool?: string;          // 工具名
  readonly text?: string;          // text/reasoning 内容
  readonly toolArgs?: string;      // 工具输入
  readonly toolOutput?: string;    // 工具输出
  readonly taskDescription?: string; // task spawn 描述
  readonly taskSessionId?: string;   // task 子 session ID
  readonly status?: string;        // "completed" | "error" | "pending"
  readonly timeCreated: number;
  readonly duration?: number;      // 毫秒
}
```

### 7.4 Event Payload 联合类型

```typescript
type EventPayload =
  | StatusChangePayload
  | LogPayload
  | MetricPayload
  | CommandResultPayload
  | HeartbeatPayload;

interface StatusChangePayload {
  readonly type: "status_change";
  readonly previousStatus: AgentStatus;
  readonly currentStatus: AgentStatus;
  readonly reason?: string;
}

interface LogPayload {
  readonly type: "log";
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly raw?: string;
}

interface MetricPayload {
  readonly type: "metric";
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly tags?: Readonly<Record<string, string>>;
}

interface CommandResultPayload {
  readonly type: "command_result";
  readonly commandId: string;
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

interface HeartbeatPayload {
  readonly type: "heartbeat";
  readonly uptimeMs: number;
  readonly memoryUsageMb: number;
  readonly cpuPercent: number;
}
```

---

## 8. 前端组件设计

### 8.1 页面路由

```typescript
// packages/client/src/routes.ts
const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,          // 暗色主题根布局
    children: [
      { index: true, Component: Dashboard },  // 首页: Agent 依赖图
      { path: "sessions", Component: Sessions }, // Sessions: 对话历史
    ],
  },
]);
```

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `Dashboard` | Agent 依赖图 + Session 选择器 + 详情面板 |
| `/sessions` | `Sessions` | Session 卡片列表 / 对话详情 |

### 8.2 Root 布局

```
Root.tsx
└── <div class="dark min-h-screen" style="background: #0A0E1A">
    └── <Outlet />    ← Dashboard 或 Sessions
```

全局暗色主题，背景色 `#0A0E1A`。

### 8.3 Dashboard 页面三栏布局

```
┌──────────────────────────────────────────────────────────────────┐
│  TopBar (h-12)                                                   │
│  [Logo] Agent Orchestration Center │ Session名 │ Dashboard  Sessions │ Running Waiting Done Error │ 时钟 │
├────────────┬─────────────────────────────────────┬───────────────┤
│ Session    │  DependencyGraph                    │ AgentDetail   │
│ Selector   │  (中央画布, flex-1)                 │ Panel (340px) │
│ (240px /   │                                     │ (可选, 仅选中 │
│  44px      │  ┌────────────┐                     │  Agent 时显示)│
│  折叠态)   │  │ Orchestrator│                    │               │
│            │  └──────┬─────┘                     │ ┌───────────┐ │
│ ● Session1 │        ├──────────┐                │ │ Agent名    │ │
│ ○ Session2 │  ┌─────┴───┐ ┌───┴─────┐          │ │ Duration   │ │
│ ○ Session3 │  │SubAgent1│ │SubAgent2│          │ │ Tools Used │ │
│            │  └─────────┘ └─────────┘          │ │ Sub-agents │ │
│            │                                     │ │ Timeline   │ │
│            │  [Zoom controls: + - ⟲ 100%]       │ └───────────┘ │
│            │  [Legend: ● Running ● Waiting ...]  │               │
├────────────┴─────────────────────────────────────┴───────────────┤
│  底部状态栏: Legend + Progress (x/y done · z running · w waiting) │
└──────────────────────────────────────────────────────────────────┘
```

**状态处理**:
- `loading && agents.length === 0`: 显示 Spinner "Connecting to server..."
- `error && agents.length === 0`: 显示错误信息 + 启动命令提示
- `agents.length === 0`: 显示 "No Agents Connected" 空状态
- 有 Agents: 显示三栏布局

### 8.4 DependencyGraph 树形布局算法

#### 布局参数

```typescript
const NODE_DIMENSIONS: Record<1 | 2 | 3, NodeDimensions> = {
  1: { width: 260, height: 64 },  // L1: 最大节点
  2: { width: 220, height: 58 },  // L2: 中等节点
  3: { width: 200, height: 54 },  // L3: 最小节点
};

const LEVEL_GAP = 140;    // 层级间垂直间距
const NODE_GAP = 28;      // 同级节点间水平间距
const TOP_PADDING = 60;   // 顶部留白
```

#### 算法步骤

1. **buildForest**: 从扁平 Agent 数组构建 `TreeNode[]` 森林
   - 按 `parentId` 建立 `childrenMap`
   - 无 `parentId` 的 Agent 成为 root
   - 递归构建每个 root 的子树

2. **subtreeWidth**: 递归计算子树宽度
   - 叶子节点: 使用 `NODE_DIMENSIONS[level].width`
   - 内部节点: `sum(children subtreeWidth) + gaps`，与自身宽度取 max

3. **layoutTree**: 递归分配坐标
   - 父节点居中于所有子节点之上
   - 子节点按 subtreeWidth 从左到右排列
   - 子节点 Y = 父节点 Y + 父节点高度 + LEVEL_GAP

4. **computeNodePositions**: 排列多棵树
   - 所有 root 树从左到右排列，间距 `NODE_GAP * 2`
   - 居中于 canvas 中心 (canvasCenter = 1000)

5. **buildConnectionPath**: S 形贝塞尔曲线连线
   ```
   M x1 y1 C x1 (y1+offset), x2 (y2-offset), x2 y2
   ```

#### 交互功能

| 功能 | 实现方式 |
|------|---------|
| 缩放 | 滚轮事件 → 修改 `zoom` (0.3 ~ 2.0, 步长 0.1) |
| 拖拽平移 | mouseDown/mouseMove/mouseUp → 修改 `pan` |
| 点击选中 | onClick → `onSelectAgent(agent)` |
| 悬停高亮 | onMouseEnter/onMouseLeave → borderColor 变化 |
| 运行态动画 | `agent-pulse` CSS class (呼吸效果 boxShadow) |

### 8.5 SessionSelector 折叠/展开

| 状态 | 宽度 | 内容 |
|------|------|------|
| 展开 | 240px | 完整 Session 列表: 名称、描述、agent 数、时长、状态 badge |
| 折叠 | 44px | 仅显示彩色圆点 (状态颜色) + tooltip 悬浮提示 |

**折叠态**:
- 点击折叠按钮 `<PanelLeftClose>` / `<PanelLeftOpen>` 切换
- 每个 Session 用一个 `3x3` 的圆点表示，颜色映射:
  - Active: `#22C55E` (绿色)
  - Paused: `#F59E0B` (琥珀色)
  - Completed: `#10B981` (翠绿色)
  - Failed: `#EF4444` (红色)
- 当前选中 Session 的圆点有 `boxShadow` 发光效果 + 左侧 accent 条

### 8.6 Sessions 页面双状态视图

#### 状态一: Session 卡片列表

当 `selectedSessionId === null` 时显示。

```
┌──────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                  │
│  Sessions                                             │
│  View conversation history and tool calls              │
│                                                        │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │ ● Session Title  │  │ ○ Session Title  │           │
│  │ /path/to/dir     │  │ /another/dir     │           │
│  │                   │  │                   │           │
│  │ Agents: 5         │  │ Agents: 3         │           │
│  │ Levels: —         │  │ Levels: —         │           │
│  │ Duration: 5m 30s  │  │ Duration: 2m 10s  │           │
│  │ ─────────────     │  │ ─────────────     │           │
│  │ ● 2 running       │  │ ● 3 completed     │           │
│  │ ● 3 completed     │  │ Mar 17, 14:30     │           │
│  └──────────────────┘  └──────────────────┘           │
└──────────────────────────────────────────────────────┘
```

**卡片内容**:
- 状态圆点 + Session 名称
- 状态 badge (ACTIVE/COMPLETED/FAILED)
- 工作目录描述
- 3 列 stats: Agents 数、Levels、Duration
- 底部: agent 状态分布 + 时间

#### 状态二: 对话详情视图

当选中某个 Session 后 (`selectedSessionId !== null`) 显示。

```
┌──────────────────────────────────────────────────────────┐
│  ← │ ● Session Name │ ACTIVE │ 5 agents · 5m 30s       │
│  [All(42)] [Messages(15)] [Tools(20)] [Tasks(3)] [Thinking(4)] │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──── User ─────────────────────────────── 14:30:05 ──┐ │
│  │ Please implement the authentication module           │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──── Agent ────── claude-sonnet-4 ────── 14:30:08 ──┐ │
│  │ I'll implement the authentication module...          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──── Read ─────────── DONE ── 120ms ─── 14:30:10 ──┐ │
│  │ ▶ Show parameters                                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──── Thinking ─────────────────────────── 14:30:12 ──┐ │
│  │ ▶ (点击展开)                                         │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──── Spawn Sub-agent ─── DONE ── 45s ── 14:30:15 ──┐ │
│  │ ★ Create the login page component                    │ │
│  │ ▶ Show result  ◆ View sub-agent session              │ │
│  │                                                       │ │
│  │ ┃ SUB-AGENT SESSION · 8 parts                        │ │
│  │ ┃ ┌── User ──────────────────────────────────┐       │ │
│  │ ┃ │ Create the login page...                  │       │ │
│  │ ┃ └──────────────────────────────────────────┘       │ │
│  │ ┃ ┌── Agent ─────────────────────────────────┐       │ │
│  │ ┃ │ I'll create the login page...             │       │ │
│  │ ┃ └──────────────────────────────────────────┘       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                    [↓]    │
└──────────────────────────────────────────────────────────┘
```

**Part 过滤器**:

| Filter | 规则 |
|--------|-----|
| `all` | 所有 part (排除 step-start/step-finish) |
| `text` | `partType === "text"` |
| `tool` | `partType === "tool" && tool !== "task"` |
| `task` | `partType === "tool" && tool === "task"` |
| `reasoning` | `partType === "reasoning"` |

**Part Bubble 类型**:

| partType | 组件 | 颜色主题 | 特性 |
|----------|------|---------|------|
| `text` (user) | PartBubble | 蓝色 (`#3B82F6`) | 用户图标、完整文本 |
| `text` (assistant) | PartBubble | 青色 (`#06B6D4`) | Bot 图标、agent 名、model badge |
| `reasoning` | PartBubble | 琥珀色 (`#F59E0B`) | Brain 图标、可折叠 |
| `tool` | PartBubble | 青色 (`#06B6D4`) | Terminal 图标、状态 badge、可折叠参数 |
| `tool` (task) | TaskSpawnBubble | 紫色 (`#8B5CF6`) | Play 图标、任务描述、Show result、View sub-agent session |

**TaskSpawnBubble 子 Session 加载**:
1. 用户点击 "View sub-agent session"
2. `fetch(/api/opencode/sessions/{taskSessionId}/parts)`
3. 过滤掉 step-start/step-finish
4. 在紫色左边框内递归渲染 `PartBubble`

### 8.7 AgentDetailPanel 时间线

右侧面板显示选中 Agent 的详细信息：

**头部**:
- Agent 名称 + 状态圆点 + 关闭按钮

**Stats 行**:
- DURATION (Clock 图标)
- TOOLS USED (Wrench 图标)
- SUB-AGENTS (Users 图标)

**状态 Badge**:
- 显示当前状态 + 活动描述
- 颜色由 `getDisplayColor(agent)` 决定

**Execution Timeline**:
- 纵向时间线，每个 step 有：
  - 圆点 (completed=绿色, current=青色+发光, pending=空心)
  - 连接线 (completed=实线, pending=虚线)
  - 标题、描述、时间戳、持续时间

---

## 9. 核心算法

### 9.1 Session Tree 构建

**数据来源**: OpenCode SQLite `part` 表中 `tool="task"` 的记录。

**SQL 查询** (`getSessionTree()`):
```sql
SELECT
  m.session_id as parent_session,
  json_extract(p.data, '$.state.metadata.sessionId') as meta_session_id,
  json_extract(p.data, '$.state.output') as output_text
FROM part p
JOIN message m ON p.message_id = m.id
WHERE json_extract(p.data, '$.tool') = 'task'
AND json_extract(p.data, '$.state.input.subagent_type') IS NOT NULL
ORDER BY p.time_created ASC
```

**子 Session ID 提取逻辑** (优先级从高到低):
1. `$.state.metadata.sessionId` (新版 OpenCode 格式)
2. 从 `$.state.output` 中正则匹配 `task_id:\s*(ses_\w+)` (旧版格式)

**去重**: 使用 `Set<"parentId→childId">` 避免重复 link。

**返回格式**:
```typescript
ReadonlyArray<{ parentId: string; childId: string }>
```

### 9.2 Agent 状态推断

**核心函数**: `inferState()` + 递归子树状态聚合

#### 单个 Session 的状态推断

```typescript
const COMPLETED_THRESHOLD_MS = 30_000; // 30 秒

function inferState(session: OpenCodeSession): AgentState {
  const age = Date.now() - session.timeUpdated;
  return age < COMPLETED_THRESHOLD_MS ? "running" : "completed";
}
```

**逻辑**: 如果 session 的 `timeUpdated` 距今不到 30 秒，认为还在运行。

#### 父 Agent 状态聚合

```typescript
if (hasChildren) {
  if (anyChildRunning || anyChildWaiting) {
    state = "waiting";     // 有子 Agent 在运行 → 父等待中
  } else if (selfState === "running") {
    state = "running";     // 自身活跃，子都完成 → 还在收尾
  } else {
    state = "completed";   // 自己和子都完成
  }
} else {
  state = selfState;       // 叶子节点 → 直接用自身状态
}
```

### 9.3 多层 Agent 树构建

**核心函数**: `buildTree()` 在 `useRealAgents.ts` 中

#### 输入

- `sessions: OpenCodeSession[]` — 所有 Session
- `links: SessionLink[]` — 父子关系

#### 算法步骤

1. **构建关系图**:
   - `childrenOf: Map<parentId, childId[]>`
   - `hasParent: Set<childId>`
   - 只保留两端 Session 都存在的 link

2. **识别 Root Sessions**:
   - Root = 没有 parent 的 Session

3. **递归构建 Agent 树** (`buildAgentTree()`):
   - 为每个 Session 创建一个 `Agent` 对象
   - 如果 Session 有子节点且是 root (depth=1)，ID 加 `-orch` 后缀，type 设为 `"Orchestrator"`
   - Level = `Math.min(depth, 3)` (最多 3 层)
   - 先递归处理子节点，再设置父节点状态 (bottom-up)

4. **构建 Session 对象**:
   - 每个 root Session 生成一个 `Session` 对象
   - `leaderAgentId` = 有子节点时为 `{sessionId}-orch`，否则为 `sessionId`
   - `status` 由 `deriveGroupStatus()` 从所有子 Agent 状态推导

5. **排序**:
   - Active Sessions 排在前面
   - 同状态按 startTime 降序

#### Session 状态推导

```typescript
function deriveGroupStatus(agents: Agent[]): Session["status"] {
  if (agents.some(a => a.state === "failed")) return "failed";
  if (agents.some(a => a.state === "running")) return "active";
  return "completed";
}
```

#### Agent 命名规则

```typescript
// 清理 title 中的子 Agent 标记
function cleanTitle(title: string): string {
  return title.replace(/\s*\(@\w+\s+subagent\)/, "");
}

// 提取 Agent 类型
function extractAgentType(title: string): string {
  const match = title.match(/@(\w+)\s+subagent/);
  return match ? match[1] : "opencode";
}
```

- Title 含 `(@explore subagent)` → type = "explore"
- Title 以 "New session" 开头 → name = "OpenCode Session"

---

## 10. Sidecar Daemon 设计

### 10.1 两个 Sidecar 变体

| 文件 | 用途 | 区别 |
|------|------|------|
| `daemon.ts` | 系统级后台服务 | 支持 install/uninstall，跨平台 DB 检测，进程检测 |
| `opencode-sync.ts` | 轻量同步 Agent | 简单 watch + 轮询，不支持服务安装 |

### 10.2 Daemon 详细设计

**文件**: `packages/sidecar/src/daemon.ts`

#### 跨平台 DB 检测

```typescript
function findDbPath(): string | null {
  const candidates = [
    // macOS / Linux (CLI)
    "${HOME}/.local/share/opencode/opencode.db",
    // Windows (CLI)
    "${HOME}\\AppData\\Local\\opencode\\opencode.db",
    "${HOME}\\.local\\share\\opencode\\opencode.db",
    // Windows desktop app
    "${HOME}\\AppData\\Roaming\\opencode\\opencode.db",
    "${HOME}\\AppData\\Local\\Programs\\opencode\\opencode.db",
    // Linux snap/flatpak
    "${HOME}/snap/opencode/current/.local/share/opencode/opencode.db",
  ];
  // 依次检查 existsSync
}
```

#### 进程检测

```typescript
function isOpenCodeRunning(): boolean {
  // macOS/Linux: pgrep -f opencode
  // Windows: tasklist /FI "IMAGENAME eq opencode*" /NH
}
```

#### DB 查询策略 (双重降级)

```
尝试 opencode CLI → opencode db "SQL" --format json
        │
        ▼ (失败)
降级到 sqlite3 CLI → sqlite3 -json "path" "SQL"
        │
        ▼ (失败)
返回空数组
```

#### 同步流程

```
1. 检测 OpenCode 进程状态 (start/stop)
   └── 推送 status_change event

2. 查询 session 表 (WHERE time_updated > lastSyncTime)
   └── 逐条推送 POST /api/sync/session

3. 查询 message 表 (WHERE time_created > lastSyncTime)
   └── 逐条推送 POST /api/sync/message

4. 发送 heartbeat event

5. 更新 lastSyncTime = Date.now()
```

#### 触发机制

| 触发方式 | 间隔 | 说明 |
|---------|------|------|
| `watchFile(dbPath)` | 3 秒检测 | 文件修改时触发 sync |
| `setInterval` | 15 秒 | 兜底轮询 |

#### 系统服务安装

| 平台 | 服务类型 | 配置路径 | 安装命令 |
|------|---------|---------|---------|
| macOS | LaunchAgent | `~/Library/LaunchAgents/com.mad.daemon.plist` | `launchctl load` |
| Linux | systemd user service | `~/.config/systemd/user/mad-daemon.service` | `systemctl --user enable/start` |
| Windows | 手动 (提示命令) | Startup folder | 手动添加 |

**macOS LaunchAgent 配置**:
- `RunAtLoad: true` — 登录时自动启动
- `KeepAlive: true` — 崩溃自动重启
- 日志输出到 `/tmp/mad-daemon.log`

**Linux systemd 配置**:
- `Restart=always`, `RestartSec=10`
- `WantedBy=default.target`

### 10.3 OpenCode Sync Agent

**文件**: `packages/sidecar/src/opencode-sync.ts`

更轻量的变体，不支持服务安装，直接运行：

```bash
npx tsx opencode-sync.ts --server https://dashboard.com --api-key KEY
```

**额外功能**:
- `--client-name` 自定义显示名
- `--sync-interval` 自定义同步间隔 (默认 5 秒)
- `knownSessionIds` / `knownMessageIds` 增量同步避免重复

---

## 11. 配置参考

### 11.1 环境变量

| 变量名 | 默认值 | 用于 | 说明 |
|--------|-------|------|------|
| `PORT` | `3000` | Server | HTTP 监听端口 |
| `MAD_SERVER_URL` | `http://localhost:3000` | Plugin, Daemon | Server 地址 |
| `MAD_API_KEY` | `dev-key` | Plugin, Daemon | API 认证密钥 |
| `MAD_CLIENT_NAME` | `os.hostname()` | Plugin | 客户端显示名 |
| `HOME` | (系统) | Server, Daemon | 用于定位 OpenCode DB |

### 11.2 共享常量

```typescript
// packages/shared/src/constants.ts
const WS_PING_INTERVAL_MS    = 30_000;    // WebSocket ping 间隔
const WS_PONG_TIMEOUT_MS     = 10_000;    // Pong 超时
const MAX_RECONNECT_ATTEMPTS  = 10;        // 最大重连次数
const RECONNECT_BASE_DELAY_MS = 1_000;     // 重连基础延迟
const RECONNECT_MAX_DELAY_MS  = 30_000;    // 重连最大延迟
const STATUS_THROTTLE_MS      = 100;       // 状态更新节流
const LOG_BATCH_SIZE           = 50;        // 日志批量大小
const SPARKLINE_SAMPLE_MS      = 2_000;     // 迷你图采样间隔
const RATE_LIMIT_EVENTS_PER_MIN = 1_000;   // 事件速率限制
const HEARTBEAT_INTERVAL_MS    = 15_000;   // 心跳间隔
const HEARTBEAT_TIMEOUT_MS     = 45_000;   // 心跳超时
```

### 11.3 前端硬编码常量

```typescript
// useRealAgents.ts
const POLL_INTERVAL = 3000;            // 数据 polling 间隔 (ms)
const COMPLETED_THRESHOLD_MS = 30_000; // Agent 完成判定阈值 (ms)

// DependencyGraph.tsx
const LEVEL_GAP = 140;    // 层级间垂直间距 (px)
const NODE_GAP = 28;      // 节点间水平间距 (px)
const TOP_PADDING = 60;   // 画布顶部留白 (px)
const MIN_ZOOM = 0.3;     // 最小缩放
const MAX_ZOOM = 2.0;     // 最大缩放
const ZOOM_STEP = 0.1;    // 缩放步长
```

### 11.4 OpenCode 配置文件

路径: `~/.config/opencode/opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@mad/opencode-plugin"],
  "agent": {
    "explore": { "tools": { "task": true } },
    "general": { "tools": { "task": true } }
  }
}
```

**关键配置项**:

| 字段 | 说明 |
|------|------|
| `plugin` | Plugin 包名数组。`@mad/opencode-plugin` 使 MAD Plugin 自动加载 |
| `agent.*.tools.task` | 启用 `task` tool，允许 Agent spawn sub-agent |

---

## 12. 部署指南

### 12.1 本地开发

#### 前置条件

- Node.js >= 20.0.0
- npm >= 10.9.0
- OpenCode 已安装并运行过至少一次 (产生 SQLite DB)
- sqlite3 CLI 可用 (macOS/Linux 通常自带)

#### 步骤

```bash
# 1. Clone 仓库
git clone <repo-url> multi_agent_dashboard
cd multi_agent_dashboard

# 2. 安装依赖
npm install

# 3. 构建共享包
npm run build --workspace=packages/shared

# 4. 启动 Server (终端1)
npx tsx packages/server/src/lite/index.ts

# 5. 启动 Client 开发服务器 (终端2)
npm run dev --workspace=packages/client

# 6. (可选) 配置 OpenCode Plugin
# 编辑 ~/.config/opencode/opencode.json，添加 plugin
# 设置环境变量 MAD_SERVER_URL=http://localhost:3000

# 7. 启动 OpenCode (终端3)
opencode
```

**访问地址**:
- 前端: `http://localhost:5173` (Vite 默认端口)
- API: `http://localhost:3000/api/agents`
- WebSocket: `ws://localhost:3000/ws`
- Health: `http://localhost:3000/health`

#### 开发模式下的 Vite proxy

前端的 `fetch("/api/...")` 调用需要 Vite 配置 proxy 到 Server。确保 `vite.config.ts` 中有：

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/ws': { target: 'ws://localhost:3000', ws: true },
  }
}
```

### 12.2 生产部署

#### 方案 A: 单机部署 (推荐)

适用于 Server 和 OpenCode 运行在同一台机器。

```bash
# 构建所有包
npm run build

# 启动 Server
PORT=3000 node packages/server/dist/lite/index.js

# 或使用 tsx 直接运行
PORT=3000 npx tsx packages/server/src/lite/index.ts
```

前端静态文件由 Vite 构建后放在 `packages/client/dist/`，可通过 Nginx 或 Fastify 的 static 插件托管。

#### 方案 B: 多机部署

适用于 OpenCode 运行在远程机器。

```
远程机器 A (运行 OpenCode)
├── 安装 @mad/opencode-plugin (Plugin 方式)
│   └── MAD_SERVER_URL=https://dashboard.example.com
│
└── 或运行 Sidecar Daemon (Daemon 方式)
    └── mad-daemon --server https://dashboard.example.com --api-key KEY --install

远程机器 B (运行 OpenCode)
└── 同上

中心服务器 (运行 MAD Server + Client)
├── PORT=3000 node packages/server/dist/lite/index.js
└── Nginx → Client dist + proxy /api → :3000
```

#### 方案 C: Sidecar Daemon 系统服务

```bash
# 安装为系统服务 (macOS)
npx tsx packages/sidecar/src/daemon.ts \
  --server https://dashboard.example.com \
  --api-key YOUR_KEY \
  --install

# 卸载系统服务
npx tsx packages/sidecar/src/daemon.ts --uninstall
```

### 12.3 Turborepo 命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动所有包的 dev 模式 |
| `npm run build` | 构建所有包 |
| `npm run lint` | 运行所有包的 lint |
| `npm run test` | 运行所有包的测试 |
| `npm run clean` | 清理所有构建产物 + node_modules |

---

## 附录: 颜色系统

### Agent 状态颜色

| 状态 | 颜色 | HEX |
|------|------|-----|
| queued | Slate | `#64748B` |
| running | Green | `#22C55E` |
| waiting | Amber | `#F59E0B` |
| completed | Emerald | `#10B981` |
| failed | Red | `#EF4444` |

### Session 状态颜色

| 状态 | 颜色 | HEX |
|------|------|-----|
| active | Green | `#22C55E` |
| paused | Amber | `#F59E0B` |
| completed | Emerald | `#10B981` |
| failed | Red | `#EF4444` |

### Part Bubble 颜色主题

| Part 类型 | 主题色 | HEX |
|-----------|-------|-----|
| text (user) | Blue | `#3B82F6` |
| text (assistant) | Cyan | `#06B6D4` |
| reasoning | Amber | `#F59E0B` |
| tool | Cyan | `#06B6D4` |
| task spawn | Violet | `#8B5CF6` |

### 全局背景色

| 元素 | HEX |
|------|-----|
| Root 背景 | `#0A0E1A` |
| Dashboard 背景 | `#080C16` |
| 面板/卡片背景 | `#0D1320` |
| 边框 | `#1C2A3E` |
| Hover 边框 | `#2A4060` |
| Accent | `#06B6D4` (Cyan) |
