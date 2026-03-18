# MAD (Multi-Agent Dashboard)

> 实时监控和可视化 OpenCode Agent 协作活动的 Dashboard 系统

## 项目简介

MAD (Multi-Agent Dashboard) 是一个专为 AI Agent 协作场景设计的监控和可视化平台。在使用 OpenCode CLI 执行复杂任务时，`task` 工具会 spawn 多个 sub-agent，形成树状依赖关系。MAD 通过以下方式解决原生 CLI 的监控盲点：

- **全局视图**：同时查看所有 Agent 的运行状态和依赖关系
- **历史回溯**：方便浏览已完成 session 的对话内容
- **跨机监控**：在一个界面监控多台机器上的 Agent 活动
- **状态可视化**：直观展示 Agent 的运行、等待、完成状态

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器 (React SPA)                    │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ Session    │  │ Dependency   │  │ AgentDetail      │    │
│  │ Selector   │  │ Graph        │  │ Panel            │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP REST / WebSocket
┌─────────────────────────────▼───────────────────────────────┐
│                   MAD Lite Server (Fastify)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ REST API │  │ WebSocket│  │ SQLite Reader            │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────┐                    ┌───────────────────┐
│  OpenCode Plugin  │                    │  OpenCode SQLite  │
│  (事件推送)        │                    │  (数据读取)        │
└───────────────────┘                    └───────────────────┘
```

## 项目结构

```
Multi-Agent-Plugin/
├── README.md              # 本文档
├── DESIGN-SPEC.md         # 系统设计文档
├── design/                # 设计资源
└── code/
    └── mad-opencode-plugin/   # OpenCode 插件 (npm 包)
        ├── src/               # 源代码
        ├── dist/              # 编译输出
        └── package.json
```

## 快速开始

### 1. 安装 OpenCode 插件

```bash
npm install mad-opencode-plugin
```

### 2. 配置 OpenCode

编辑 `~/.config/opencode/opencode.json`：

```json
{
  "plugin": ["mad-opencode-plugin"]
}
```

### 3. 配置环境变量（可选）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAD_SERVER_URL` | `http://localhost:3000` | MAD Server 地址 |
| `MAD_API_KEY` | `dev-key` | 认证 API Key |
| `MAD_CLIENT_NAME` | `hostname()` | 客户端标识 |

### 4. 启动 MAD Server

```bash
# 克隆项目
git clone https://github.com/cr330326/mad-opencode-plugin.git
cd mad-opencode-plugin

# 安装依赖并构建
npm install
npm run build
```

## 功能特性

- **实时事件同步**：通过 OpenCode Plugin 捕获并推送事件
- **依赖图可视化**：以树形图展示 Agent 间的父子关系
- **会话详情**：查看每个 session 的完整对话历史
- **心跳监控**：定期上报客户端状态（内存、uptime）
- **多客户端支持**：支持同时监控多台机器

## 捕获的事件

| Hook | 推送路径 | 数据 |
|------|----------|------|
| `event` | `/api/sync/event` | 所有 OpenCode 事件 |
| `chat.message` | `/api/sync/message` | 聊天消息 |
| `tool.execute.after` | `/api/sync/tool` | 工具调用 |
| 启动/退出 | `/api/events` | 状态变更 |
| 每 30s | `/api/events` | 心跳 |

## 子包

- [mad-opencode-plugin](./code/mad-opencode-plugin) - OpenCode 插件，捕获并同步事件

## License

MIT

## Links

- [OpenCode Plugin - npm](https://www.npmjs.com/package/mad-opencode-plugin)
- [OpenCode Plugin - GitHub](https://github.com/cr330326/mad-opencode-plugin)
