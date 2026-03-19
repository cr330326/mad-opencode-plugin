---
description: Pre-flight checks and build for npm publish (device auth requires manual terminal)
argument-hint: "[optional: --tag beta|next]"
disable-model-invocation: true
allowed-tools: Read(*), Bash(npm *), Bash(node *), Bash(ls *), Bash(cat package.json)
---

Prepare npm package for publishing with pre-flight checks and build.

> **Note**: npm 现在使用手机扫码授权（非 OTP 码），需要交互式终端。此 skill 只做预检查和构建，最后需要用户在终端手动执行发布命令。

## Steps

1. **Locate package.json**
   - Start from current directory, look for package.json
   - If not found, check parent directories up to project root

2. **Read package.json and display info**
   - Show package name, version, description

3. **Pre-flight checks**
   - Verify LICENSE file exists
   - Verify README.md exists
   - Check if npm is logged in: `npm whoami`

4. **Build the package**
   - Run `npm run build` if build script exists

5. **Preview package contents**
   - Run `npm pack --dry-run` to show what will be published
   - List files and total size

6. **Show publish command**
   - Display the command user needs to run manually in terminal
   - Default: `npm publish --access public`
   - If $ARGUMENTS contains `--tag`: `npm publish --access public --tag beta`

## Output Format

```
📦 Package: name@1.0.0
✓ Pre-flight checks passed
✓ Build completed

📝 Files to publish (21 files, 14.7 kB):
   ├── dist/
   ├── LICENSE
   ├── README.md
   └── package.json

🚀 Ready to publish! Run in terminal:
   npm publish --access public

📍 After publish: https://www.npmjs.com/package/name
```

## Common Scenarios

| Scenario | Command |
|----------|---------|
| Normal publish | `/npm-publish` → then run `npm publish --access public` |
| Beta release | `/npm-publish --tag beta` → then run `npm publish --access public --tag beta` |

## Notes

- Device auth 使用手机扫码登录（非 OTP 码输入），需要交互式终端，无法自动化
- Version bump should be done before running this skill
