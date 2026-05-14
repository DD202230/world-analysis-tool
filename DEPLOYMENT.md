# 易因 · 世界分析引擎 — 部署与版本管理指南

本文档记录项目的本地版本管理、GitHub 提交和 InsForge 部署的完整流程。在任何环境下打开本文档即可按步骤操作。

---

## 1. 本地版本管理（Git）

### 当前版本号
查看 `CHANGELOG.md` 最新条目，或搜索代码中的版本号：
```bash
grep -rn "version" index.html app.js
```

### 日常开发流程
```bash
# 1. 查看修改
git status
git diff

# 2. 添加修改
git add index.html app.js styles.css animations.js

# 3. 提交（遵循语义化版本规范）
git commit -m "feat: 具体改动描述"

# 4. 推送到 GitHub
git push origin main
```

### 版本号规范
- `feat:` 新功能 → 次版本号 +1（如 v4.5.0 → v4.6.0）
- `fix:` Bug 修复 → 修订号 +1（如 v4.5.0 → v4.5.1）
- `release:` 发布版本 → 同步更新代码中的版本号 + CHANGELOG

### 更新版本号的文件
1. `index.html` — 页脚版本文字
2. `app.js` — `exportAllData()` 中的 `version` 字段
3. `CHANGELOG.md` — 新增版本条目

---

## 2. 提交到 GitHub

### 仓库地址
- **仓库**: `DD202230/world-analysis-tool`
- **远程**: `git@github.com:DD202230/world-analysis-tool.git`

### 操作步骤
```bash
# 确保在正确的分支
git branch  # 应为 main

# 提交并推送
git add .
git commit -m "release: vX.Y.Z — 改动摘要"
git push origin main
```

### 检查远程状态
```bash
git log --oneline main
git log --oneline origin/main
```

---

## 3. 提交到 InsForge（部署）

### 项目信息
- **部署地址**: https://u3r5m9q6.insforge.site
- **项目 ID**: `73344261-0e4d-4ea5-bb4c-d278fcaf536d`
- **Provider**: Vercel
- **地区**: us-east

### 前置条件
确保已通过 InsForge CLI link 到项目：
```bash
npx @insforge/cli link \
  --api-base-url https://u3r5m9q6.us-east.insforge.app \
  --api-key <YOUR_API_KEY> \
  --project-id 73344261-0e4d-4ea5-bb4c-d278fcaf536d
```

### 部署步骤
```bash
# 进入项目目录
cd /Users/dd/world-analysis-tool

# 执行部署（当前目录下的所有文件）
npx @insforge/cli deployments deploy . --json
```

### 查看部署历史
```bash
npx @insforge/cli deployments list --json
```

### 部署成功标志
返回 JSON 中 `status` 为 `READY`，`url` 为 `https://u3r5m9q6.insforge.site`。

---

## 4. 敏感信息处理规则（重要）

### 绝不提交到 GitHub 的内容
- **API Key**（如 InsForge 的 `ik_xxx`）
- **数据库密码**、**JWT Secret**
- **OAuth Token**、**私钥文件**（*.pem, *.key）
- **环境变量文件**（.env, .env.local, .env.production）

### 正确做法
1. 将 `.env` 等敏感文件加入 `.gitignore`（已配置）
2. 需要记录配置项时，创建 `.env.example` 模板（只写 key，不写 value）
3. 在文档中用 `<YOUR_API_KEY>` 占位符代替真实 key

### 当前项目中的敏感信息位置
- **无**。本项目是纯前端应用，不内置任何 API key。InsForge 部署通过 CLI 环境变量或命令行参数传入 key。

### 如果不慎提交了敏感信息
```bash
# 立即从 Git 历史中移除（以 .env 为例）
git rm --cached .env
git commit -m "security: remove leaked secrets"

# 若已推送到 GitHub，需要强制重写历史（谨慎操作）
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch 文件名' HEAD
git push origin main --force
```

---

## 5. 一键部署脚本（可选）

创建 `deploy.sh` 放在项目根目录（不提交到 GitHub）：
```bash
#!/bin/bash
set -e

# 1. 检查版本号
echo "Current version:"
grep -o "v[0-9]\+\.[0-9]\+\.[0-9]\+" index.html | head -1

# 2. 提交 Git
read -p "Commit message: " msg
git add .
git commit -m "$msg" || true
git push origin main

# 3. 部署到 InsForge
npx @insforge/cli deployments deploy . --json

echo "Done."
```

---

## 6. 常见问题

### Q: InsForge CLI 提示 "No project linked"
A: 重新执行 link 命令（见第 3 节前置条件）。若换过账号，先 `npx @insforge/cli logout`。

### Q: 部署后页面没有更新
A: InsForge 部署有缓存，尝试强制刷新浏览器（Cmd + Shift + R），或检查新部署的 `url` 是否正确。

### Q: GitHub 推送被拒绝
A: 可能远程有更新，先执行 `git pull origin main --rebase` 再 push。

---

*本文档跟随项目版本同步更新。最后一次更新：v4.5.2*
