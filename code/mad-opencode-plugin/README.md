# MAD OpenCode Plugin

[![npm version](https://img.shields.io/npm/v/mad-opencode-plugin.svg)](https://www.npmjs.com/package/mad-opencode-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Multi-Agent Dashboard 的 OpenCode 插件，自动同步 OpenCode 活动数据到 MAD Dashboard，实现多 Agent 协作的可视化监控。

## ✨ 特性

- 🔌 **无缝集成** - 通过 OpenCode Plugin SDK 自动加载
- 📡 **实时同步** - 捕获事件并推送到 MAD Server
- 💾 **离线队列** - 网络断开时自动缓存，恢复后重试
- 📊 **心跳监控** - 30 秒心跳上报内存和运行状态
- 📝 **文件日志** - 独立日志文件，不受 TUI 抑制影响

## 工作原理

```
┌─────────────┐
│  OpenCode   │
└──────┬──────┘
       │ hooks
       ▼
┌──────────────────┐
│  MAD Plugin      │
│  - 捕获事件      │
│  - 队列缓存      │
│  - 自动重试      │
└──────┬───────────┘
       │ HTTP POST
       ▼
┌──────────────────┐
│  MAD Server      │
│  :3000           │
└──────────────────┘
```

## 📦 安装

### 方式一：npm 安装（推荐）

```bash
npm install mad-opencode-plugin
```

### 方式二：本地开发安装

```bash
# 克隆源码
git clone https://github.com/cr330326/mad-opencode-plugin.git
cd mad-opencode-plugin

# 安装依赖并构建
npm install
npm run build

# 设置本地链接（一键安装）
make setup
```

## ⚙️ 配置

### 1. 启用插件

编辑 `~/.config/opencode/opencode.json`：

**npm 安装方式：**
```json
{
  "plugin": ["mad-opencode-plugin"]
}
```

**本地开发方式：**
```json
{
  "plugin": ["file:///Users/你的用户名/.cache/opencode/node_modules/@mad/opencode-plugin"]
}
```

### 2. 配置环境变量

```bash
# 必需
export MAD_SERVER_URL=http://localhost:3000
export MAD_API_KEY=dev-key

# 可选
export MAD_CLIENT_NAME=my-laptop    # 客户端标识，默认为主机名
export MAD_DEBUG=1                   # 启用调试日志
```

永久添加到 `~/.zshrc` 或 `~/.bashrc`：

```bash
# MAD OpenCode Plugin
export MAD_SERVER_URL=http://localhost:3000
export MAD_API_KEY=dev-key
```

### 3. 配置递归 Sub-agent（可选）

如需支持多层级 Agent 调用，在 `opencode.json` 中配置：

```json
{
  "agent": {
    "explore": { "tools": { "task": true } },
    "general": { "tools": { "task": true } }
  }
}
```

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAD_SERVER_URL` | `http://localhost:3000` | MAD Server 地址 |
| `MAD_API_KEY` | `dev-key` | 认证 API Key |
| `MAD_CLIENT_NAME` | `hostname()` | 客户端标识 |
| `MAD_DEBUG` | - | 设为 `1` 启用调试日志 |

## 📡 捕获的事件

| Hook | 触发时机 | 推送路径 |
|------|----------|----------|
| `event` | Session 创建/更新/压缩 | `/api/sync/event` |
| `chat.message` | 每条聊天消息 | `/api/sync/message` |
| `tool.execute.after` | 工具执行后 | `/api/sync/tool` |
| 启动时 | 插件加载完成 | `/api/events` (status_change) |
| 每 30s | 心跳上报 | `/api/events` (heartbeat) |
| 退出时 | 进程退出 | `/api/events` (status_change) |

## 💾 离线队列

- Dashboard 离线时自动缓存事件
- 最多缓存 **1000 条**事件
- **指数退避重试**（最多 5 次，间隔 1s-30s）
- 网络恢复后自动发送

## 📝 日志

插件日志位于 `~/.config/opencode/log/mad-plugin.log`：

```bash
# 查看日志
cat ~/.config/opencode/log/mad-plugin.log

# 实时监控
tail -f ~/.config/opencode/log/mad-plugin.log
```

日志示例：
```text
[2026-03-18T04:47:08.556Z] 🚀 MAD OpenCode Plugin INITIALIZED
[2026-03-18T04:47:08.556Z] Agent ID: opencode-xxx
[2026-03-18T04:47:08.556Z] Server: http://localhost:3000
[2026-03-18T04:48:15.123Z] EVENT: session.create | Session: ses_abc123
[2026-03-18T04:48:25.789Z] TOOL: Read | Session: ses_abc123 | Output: 1234 chars
```

## 🛠️ 开发命令

```bash
make build    # 构建插件
make dev      # 开发模式（监听文件变化）
make clean    # 清理构建产物
make setup    # 一键本地安装
make test     # 运行测试
make help     # 查看所有命令
```

## 🔍 故障排查

### 插件加载失败 / npm 404 错误

插件未发布到 npm 时会报 404 错误。**解决方案**：使用本地安装方式（见上方"方式二"）。

### 插件没有加载？

1. 检查配置文件：`~/.config/opencode/opencode.json`（不是 `config.json`）
2. 本地开发时使用 `file://` 绝对路径
3. 查看日志确认：
   ```bash
   cat ~/.config/opencode/log/mad-plugin.log
   ```

### 事件没有发送到 Dashboard？

1. 确认环境变量：`echo $MAD_SERVER_URL`
2. 确认 MAD Server 正在运行
3. 启用调试日志：`export MAD_DEBUG=1`

## 📄 License

MIT

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/mad-opencode-plugin)
- [GitHub Repository](https://github.com/cr330326/mad-opencode-plugin)
- [Report Issues](https://github.com/cr330326/mad-opencode-plugin/issues)
