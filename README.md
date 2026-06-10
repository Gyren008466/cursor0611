# 美式证件照生成器

上传原始照片，AI 自动生成专业美式证件照，支持多种 AI 模型、自定义背景颜色与 PNG/JPG 导出。

## 功能

- **左右双栏布局**：左侧上传 + 选择 AI 模型，右侧输出证件照
- **8 种 AI 模型**：含 6 个免费/免费额度模型 + 2 个 OpenAI 付费模型
- **背景自定义**：蓝色、红色、白色、黑色、无背景（透明）
- **多格式导出**：PNG、JPG

## AI 模型列表

| 模型 | 提供商 | 费用 | 是否需要 Key |
|------|--------|------|-------------|
| InstructPix2Pix | Hugging Face | 免费 | 否（可选 HF_TOKEN 加速） |
| FLUX Kontext Dev | Hugging Face | 免费 | 否（可选 HF_TOKEN 加速） |
| Gemini 2.0 Flash | Google | 免费额度 | 是（GEMINI_API_KEY） |
| Pollinations Flux | Pollinations | 完全免费 | 否 |
| FLUX Schnell | Together AI | 免费额度 | 是（TOGETHER_API_KEY） |
| FLUX Kontext Pro | Replicate | 免费试用 | 是（REPLICATE_API_TOKEN） |
| GPT Image 1 | OpenAI | 付费 | 是（OPENAI_API_KEY） |
| GPT-4.1 + 图像生成 | OpenAI | 付费 | 是（OPENAI_API_KEY） |

默认使用 **InstructPix2Pix**（完全免费，无需配置）。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key（可选）

复制 `.env.example` 为 `.env`，按需填入 Key：

```bash
cp .env.example .env
```

- 免费模型无需任何 Key 即可使用
- 付费 OpenAI 模型需配置 `OPENAI_API_KEY`
- 其他免费额度模型按需配置对应 Key

### 3. 启动

```bash
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3001

## 使用说明

1. 在左侧选择 AI 生成模型
2. 上传人像照片（拖拽或点击）
3. 等待右侧自动生成美式证件照
4. 切换背景颜色，导出 PNG 或 JPG

## 部署到 Cloudflare Pages

线上 API 由 **Cloudflare Pages Functions** 提供，入口文件为：

```
functions/api/[[path]].js
```

无需单独部署 Node/Express 后端。部署后自动提供：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/models` | GET | 获取 AI 模型列表 |
| `/api/generate` | POST | 上传照片并生成证件照 |
| `/api/health` | GET | 检查 API 与 Key 是否配置 |

### Dashboard 构建设置（英文界面）

路径：**Workers & Pages** → 你的项目 → **Settings** → **Build**

| 设置项 | 值 |
|--------|-----|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空（仓库根目录，**不要**填 `dist`） |
| **Deploy command** | **留空**（不要填 `npx wrangler deploy`） |

> ⚠️ **Deploy command 必须留空！** 若填写 `npx wrangler deploy` 会报错 `Missing entry-point to Worker script`，因为那是 Worker 命令，不是 Pages 命令。

### 环境变量

路径：**Settings** → **Environment variables** → **Production**

| 变量 | 必填 | 说明 |
|------|------|------|
| `DASHSCOPE_API_KEY` | 是 | 阿里云百炼 API Key |
| `OPENAI_API_KEY` | 否 | OpenAI 模型 |
| `GEMINI_API_KEY` | 否 | Gemini 模型 |
| `OPENAI_BASE_URL` | 否 | OpenAI 代理地址 |

### 查看 Functions 构建日志（英文界面）

1. **Workers & Pages** → 项目 → **Deployments**
2. 点击最新部署 → **View build log**
3. 在日志中搜索：`Functions`、`No routes found`、`Compiled Worker`

正常示例：

```
Found Functions directory at /functions. Uploading.
✨ Compiled Worker successfully
```

### 若构建成功但部署失败（`wrangler deploy` 错误）

日志若出现：

```
Executing user deploy command: npx wrangler deploy
Missing entry-point to Worker script or to assets directory
```

说明 **Deploy command 配置错误**。修复步骤：

1. **Workers & Pages** → 项目 → **Settings** → **Build**
2. 找到 **Deploy command** 字段
3. **清空**该字段（删除 `npx wrangler deploy`）
4. 只保留 Build command = `npm run build`，Output = `dist`
5. 保存后 **Retry deployment**

Git 连接的 Pages 项目会自动部署 `dist` 目录和 `functions/` 文件夹，**不需要** Deploy command。

### 若提示「No routes found / 无活动路由」

1. 确认 GitHub 仓库根目录存在 `functions/api/[[path]].js`
2. **Root directory** 留空，不要设为 `dist`
3. 构建命令 `npm run build`，输出目录 `dist`
4. 确认 `public/_routes.json` 已随构建进入 `dist` 目录
5. 保存设置后 **Retry deployment**

## 技术栈

- React 19 + TypeScript + Vite
- @imgly/background-removal（背景合成）
- 本地开发：Express 后端
- 线上部署：Cloudflare Pages Functions
- OpenAI / Google Gemini / 阿里云百炼
