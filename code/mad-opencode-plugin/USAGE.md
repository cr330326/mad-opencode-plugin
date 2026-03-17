# MAD OpenCode Plugin 使用指南

## 快速开始

### 1️⃣ 本地开发模式（推荐用于测试）

运行自动设置脚本：

```bash
cd code/mad-opencode-plugin
make setup
```

或者手动执行：

```bash
# 1. 构建
npm run build

# 2. 链接到全局
npm link

# 3. 配置 OpenCode
# 编辑 ~/.config/opencode/opencode.json，添加：
{
  "plugin": ["@mad/opencode-plugin"]
}
```

### 2️⃣ 设置环境变量

```bash
# 必需
export MAD_SERVER_URL=http://localhost:3000
export MAD_API_KEY=dev-key

# 可选（启用调试日志）
export MAD_DEBUG=1
```

**永久添加到 ~/.zshrc 或 ~/.bashrc：**

```bash
# MAD OpenCode Plugin
export MAD_SERVER_URL=http://localhost:3000
export MAD_API_KEY=dev-key
export MAD_DEBUG=1  # 可选
```

### 3️⃣ 启动 OpenCode

在新终端中：

```bash
# 启用调试日志（推荐）
export MAD_DEBUG=1

# 启动 OpenCode
opencode
```

插件会自动加载并开始同步！

## 本地测试（无 MAD Server）

即使 MAD Server 尚未开发完成，您也可以进行本地测试。插件会在终端中实时输出所有捕获的事件信息。

### 日志输出示例

当您在 OpenCode 中进行对话时，会看到类似以下的实时输出：

```
╔══════════════════════════════════════════════════════════════════════╗
║          🚀 MAD OpenCode Plugin Initialized                          ║
╚══════════════════════════════════════════════════════════════════════╝

[2025-03-17T...] [INFO] [Plugin] Agent ID: opencode-<hostname>
[2025-03-17T...] [INFO] [Plugin] Server: http://localhost:3000
[2025-03-17T...] [INFO] [Plugin] Directory: /your/project
[2025-03-17T...] [INFO] [Plugin] Project: your-project

✅ Plugin ready and listening for events...

┌─────────────────────────────────────────────────────────────────┐
│  📁 NEW SESSION: Help me write code                             │
│  ID: ses_1234...                                                 │
└─────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────
  │ 👤 MESSAGE #1 | USER | Session: ses_1234...
  │ ├───────────────────────────────────────────────────────────────
  │  🧠 Model: claude-sonnet-4-20250514
  │  📝 Parts: 1 | Message ID: msg_5678...
  │ └───────────────────────────────────────────────────────────────

  ┌───────────────────────────────────────────────────────────────
  │ 🤖 MESSAGE #2 | ASSISTANT | Session: ses_1234...
  │ ├───────────────────────────────────────────────────────────────
  │  📦 Agent: general
  │  🧠 Model: claude-sonnet-4-20250514
  │  📝 Parts: 3 | Message ID: msg_9012...
  │ └───────────────────────────────────────────────────────────────

  ┌───────────────────────────────────────────────────────────────
  │ 📖 TOOL | Read | Session: ses_1234...
  │ ├───────────────────────────────────────────────────────────────
  │  📋 Title: Read file
  │  📤 Output: 1234 chars
  │  🔑 Call ID: call_3456...
  │ └───────────────────────────────────────────────────────────────

  ┌───────────────────────────────────────────────────────────────
  │ 💻 TOOL | Bash | Session: ses_1234...
  │ ├───────────────────────────────────────────────────────────────
  │  📋 Title: List files
  │  📤 Output: 456 chars
  │  🔑 Call ID: call_7890...
  │ └───────────────────────────────────────────────────────────────

  🔄 Session updated: ses_1234...
```

### 工具图标说明

| 工具 | 图标 | 用途 |
| :--- | :---: | :--- |
| Read | 📖 | 读取文件 |
| Edit | ✏️ | 编辑文件 |
| Bash | 💻 | 执行命令 |
| Grep | 🔍 | 搜索内容 |
| Glob | 🌐 | 查找文件 |
| task | 🔄 | 子 Agent |
| Write | 📝 | 写入文件 |
| Skill | 🔧 | 执行技能 |

### 特殊日志

- **子 Agent 生成**：当使用 `task` 工具创建子 Agent 时，会显示：

  ```text
     👶 Spawning sub-agent: explore
  ```

- **Session 更新**：当 Session 标题或状态变化时：

  ```text
  🔄 Session updated: ses_1234...
  ```

- **Session 压缩**：当 Session 被压缩时：

  ```text
  🗜️  Session compacted: ses_1234...
  ```

### 禁用详细日志

如果不需要详细日志，可以取消设置 `MAD_DEBUG` 环境变量：

```bash
unset MAD_DEBUG
opencode
```

这样只会显示 WARN 和 ERROR 级别的日志。

## 工作原理

```
┌─────────────┐
│  OpenCode   │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  MAD Plugin      │
│  - 捕获事件      │
│  - 队列缓存      │
│  - 自动重试      │
└──────┬───────────┘
       │
       ▼ HTTP POST
┌──────────────────┐
│  MAD Server      │
│  :3000           │
└──────────────────┘
```

## 捕获的事件

| Hook | 触发时机 | 数据 |
|------|----------|------|
| `event` | Session 创建/更新/压缩 | 事件类型、属性、时间戳 |
| `chat.message` | 每条聊天消息 | 消息 ID、Session、模型、角色 |
| `tool.execute.after` | 工具执行后 | 工具名、输出长度、耗时 |

## 离线队列

- Dashboard 离线时自动缓存事件
- 最多缓存 1000 条
- 指数退避重试（最多 5 次）
- 网络恢复后自动发送

## Make 命令

```bash
# 查看所有命令
make help

# 构建插件
make build

# 开发模式（监听文件变化，自动重新编译）
make dev

# 清理构建产物
make clean

# 一次性设置（构建 + 链接）
make setup
```

## 发布到 npm

### 准备

1. 更新 `package.json` 中的元数据：
   ```json
   {
     "repository": {
       "type": "git",
       "url": "https://github.com/your-username/mad-opencode-plugin"
     },
     "author": "Your Name <your.email@example.com>"
   }
   ```

2. 登录 npm：
   ```bash
   npm login
   ```

### 发布

```bash
# 1. 构建
npm run build

# 2. 发布
npm publish
```

### 其他用户安装

```bash
npm install -g @mad/opencode-plugin

# 然后在 OpenCode 配置中添加：
{
  "plugin": ["@mad/opencode-plugin"]
}
```

## 故障排查

### 插件没有加载？

1. 检查 OpenCode 配置文件是否存在
2. 确认插件名称正确：`@mad/opencode-plugin`
3. 查看 OpenCode 日志：`opencode --verbose`

### 事件没有发送到 Dashboard？

1. 确认环境变量已设置：`echo $MAD_SERVER_URL`
2. 确认 MAD Server 正在运行
3. 启用调试日志：`export MAD_DEBUG=1`

### 如何卸载？

```bash
# 1. 取消全局链接
npm unlink -g @mad/opencode-plugin

# 2. 从 OpenCode 配置中移除插件
# 编辑 ~/.config/opencode/opencode.json，删除 "@mad/opencode-plugin"
```

## 开发

```bash
# 构建
make build

# 开发模式（自动重新编译）
make dev

# 测试
make test

# 所有命令
make help
```

## 相关文件

- `src/index.ts` - 主插件入口
- `src/types.ts` - 类型定义
- `src/logger.ts` - 日志系统
- `src/queue.ts` - 离线队列
- `opencode.example.json` - OpenCode 配置示例
