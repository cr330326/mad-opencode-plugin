# MAD OpenCode Plugin 使用指南

## 快速开始

### 1️⃣ 本地开发模式（推荐用于测试）

#### ⚠️ 重要说明

如果插件还未发布到 npm，OpenCode 会尝试从 npm registry 下载并失败。请使用以下**本地安装方法**：

```bash
cd code/mad-opencode-plugin

# 1. 构建
npm run build

# 2. 创建插件包
npm pack

# 3. 安装到 OpenCode 缓存目录
PLUGIN_CACHE_DIR="$HOME/.cache/opencode/node_modules/@mad"
mkdir -p "$PLUGIN_CACHE_DIR"

# 解压插件包
tar -xzf mad-opencode-plugin-*.tgz -C "$PLUGIN_CACHE_DIR"
mv "$PLUGIN_CACHE_DIR/package" "$PLUGIN_CACHE_DIR/opencode-plugin"

# 4. 安装依赖
cd "$PLUGIN_CACHE_DIR/opencode-plugin"
npm install

# 5. 配置 OpenCode 使用本地路径
# 编辑 ~/.config/opencode/opencode.json
```

在 `~/.config/opencode/opencode.json` 中添加插件配置：

```json
{
  "plugin": [
    "file:///Users/用户名/.cache/opencode/node_modules/@mad/opencode-plugin"
  ]
}
```

**注意**：

- 配置文件是 `~/.config/opencode/opencode.json`（不是 `config.json`）
- 插件路径必须是 `file://` 开头的绝对路径
- 将 `vsh9p8q` 替换为你的用户名

#### 自动设置脚本

```bash
cd code/mad-opencode-plugin
make setup
```

这将自动执行上述所有步骤。

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

### 4️⃣ 验证插件运行

插件启动后，检查日志文件确认是否正常运行：

```bash
# 查看插件日志
cat ~/.config/opencode/log/mad-plugin.log
```

应该看到类似输出：

```text
========================================
🚀 MAD OpenCode Plugin INITIALIZED
Agent ID: opencode-xxx
Server: http://localhost:3000
Directory: /your/project
========================================
```

或者实时查看日志：

```bash
tail -f ~/.config/opencode/log/mad-plugin.log
```

## 本地测试（无 MAD Server）

即使 MAD Server 尚未开发完成，您也可以进行本地测试。插件会记录所有捕获的事件到日志文件。

### ⚠️ 关于日志输出

**重要**：当 OpenCode 在 TUI（终端界面）模式运行时，`console.log` 输出会被抑制，您在终端中**不会**看到插件的控制台输出。

要查看插件日志，请使用：

```bash
# 查看完整日志
cat ~/.config/opencode/log/mad-plugin.log

# 实时跟踪日志
tail -f ~/.config/opencode/log/mad-plugin.log
```

### 日志输出示例

当您在 OpenCode 中进行对话时，`~/.config/opencode/log/mad-plugin.log` 中会记录类似以下内容：

```text
[2026-03-18T04:47:08.555Z] ========================================
[2026-03-18T04:47:08.556Z] 🚀 MAD OpenCode Plugin INITIALIZED
[2026-03-18T04:47:08.556Z] Agent ID: opencode-CICNBJSMCCD0160
[2026-03-18T04:47:08.556Z] Server: http://localhost:3000
[2026-03-18T04:47:08.556Z] Directory: /Users/yourname/project
[2026-03-18T04:47:08.556Z] ========================================

[2026-03-18T04:48:15.123Z] EVENT: session.create | Session: ses_abc123... | Title: Help me write code

[2026-03-18T04:48:16.234Z] MESSAGE #1 | USER | Session: ses_abc123... | Model: claude-sonnet-4-20250514 | Agent: N/A

[2026-03-18T04:48:20.456Z] MESSAGE #2 | ASSISTANT | Session: ses_abc123... | Model: claude-sonnet-4-20250514 | Agent: general

[2026-03-18T04:48:25.789Z] TOOL: Read | Session: ses_abc123... | Title: Read file | Output: 1234 chars

[2026-03-18T04:48:30.012Z] TOOL: Bash | Session: ses_abc123... | Title: List files | Output: 456 chars

[2026-03-18T04:48:35.345Z] EVENT: session.update | Session: ses_abc123... | Title: Updated session title
```

### 事件类型说明

| 事件类型 | 说明 |
| :--- | :--- |
| `session.create` | 新会话创建 |
| `session.update` | 会话更新（标题变更等） |
| `session.compact` | 会话压缩 |
| `MESSAGE` | 聊天消息（USER/ASSISTANT） |
| `TOOL` | 工具执行（Read/Bash/Grep 等） |

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

### 插件加载失败？npm 404 错误？

如果看到类似这样的错误：

```text
ERROR ... service=plugin pkg=@mad/opencode-plugin ...
error: GET https://registry.npmjs.org/@mad%2fopencode-plugin - 404 failed to install plugin
```

这是因为插件还未发布到 npm。OpenCode 会尝试从 npm registry 下载包。

**解决方案**：使用本地安装方法（见上文"本地开发模式"）

### 插件没有加载？

1. **检查配置文件位置**：确保编辑的是 `~/.config/opencode/opencode.json`（不是 `config.json`）
2. **确认插件路径**：本地开发时必须使用 `file://` 绝对路径
3. **查看 OpenCode 日志**：

   ```bash
   # 查看最新日志
   ls -t ~/.local/share/opencode/log/*.log | head -1 | xargs cat | grep -i plugin
   ```

### 如何验证插件是否工作？

插件会在启动时创建日志文件：

```bash
# 检查插件日志
cat ~/.config/opencode/log/mad-plugin.log
```

应该看到类似输出：

```text
[2026-03-18T...] ========================================
[2026-03-18T...] 🚀 MAD OpenCode Plugin INITIALIZED
[2026-03-18T...] Agent ID: opencode-xxx
[2026-03-18T...] Server: http://localhost:3000
[2026-03-18T...] ========================================
```

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
