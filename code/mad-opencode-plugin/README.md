# MAD OpenCode Plugin

Multi-Agent Dashboard 的 OpenCode 插件，自动同步 OpenCode 活动数据到 MAD Dashboard。

## 安装

```bash
# 1. 安装插件
cd mad-opencode-plugin
npm install
npm run build

# 2. 链接到全局
npm link

# 3. 在 OpenCode 配置中启用
# 编辑 ~/.config/opencode/opencode.json
{
  "plugin": ["@mad/opencode-plugin"]
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAD_SERVER_URL` | `http://localhost:3000` | MAD Server 地址 |
| `MAD_API_KEY` | `dev-key` | 认证 API Key |
| `MAD_CLIENT_NAME` | `hostname()` | 客户端标识 |

## 捕获的 Hooks

| Hook | 推送路径 | 数据 |
|------|----------|------|
| `event` | `/api/sync/event` | 所有 OpenCode 事件 |
| `chat.message` | `/api/sync/message` | 聊天消息（session、model、role） |
| `tool.execute.after` | `/api/sync/tool` | 工具调用（名称、参数、输出长度） |
| 启动时 | `/api/events` | status_change: started |
| 每 30s | `/api/events` | heartbeat（内存、uptime） |
| 退出时 | `/api/events` | status_change: stopped |

## 配置递归 Sub-agent

在 `opencode.json` 的 `agent` 字段给 sub-agent 开启 `task` 工具：

```json
{
  "agent": {
    "explore": { "tools": { "task": true } },
    "general": { "tools": { "task": true } }
  }
}
```

这样 L2 sub-agent 就能再 spawn L3 子 agent。

## 完整设计文档

参见 `DESIGN-SPEC.md`（1705 行），包含：
- 系统架构图
- 所有 API 接口定义
- 数据模型和类型
- 核心算法说明
- 部署指南
