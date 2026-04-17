# BottleFind 本地运行指南

本文档用于帮助你在本地快速启动 BottleFind 的前后端服务。

## 1. 环境要求

- Node.js >= 18（推荐 20 LTS）
- npm >= 9
- Git

可用以下命令检查：

```bash
node -v
npm -v
git --version
```

## 2. 获取项目

```bash
git clone <your-repo-url> bottlefind-app
cd bottlefind-app
```

## 3. 配置后端环境变量

```bash
copy server\.env.example server\.env
```

编辑 `server/.env`，最少配置：

```env
OPENROUTER_API_KEY=sk-or-v1-你的key
```

如需扩展能力，可额外配置：

```env
TWITTER_API_KEY=你的twitterkey
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
NOTIFY_EMAIL=receiver@example.com
```

## 4. 安装依赖

```bash
# 后端
cd server
npm install

# 前端
cd ../client
npm install
```

## 5. 初始化数据库

```bash
cd ../server
npx prisma generate
npx prisma db push
```

## 6. 启动服务

打开两个终端：

```bash
# 终端 A：后端
cd server
npm run dev
```

```bash
# 终端 B：前端
cd client
npm run dev
```

访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## 7. 验证运行

进入前端后可按以下顺序验证：

1. 在“关键词管理”中新增一个关键词。
2. 回到“热点看板”点击“立即扫描”。
3. 查看是否出现新热点与通知消息。
4. 在“全网搜索”中输入关键词测试搜索能力。

## 8. 常见排查

### 前端无法请求接口

- 检查后端是否运行。
- 检查 `client/vite.config.ts` 中代理目标是否为 `http://localhost:3001`。

### Prisma 报错

- 先执行 `npx prisma generate` 再执行 `npx prisma db push`。
- 确认 `server/.env` 中 `DATABASE_URL` 有效。

### OpenRouter 请求失败

- 检查 `OPENROUTER_API_KEY` 是否正确。
- 检查账号额度与模型可用性。
