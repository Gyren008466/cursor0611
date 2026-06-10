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

## 技术栈

- React 19 + TypeScript + Vite
- @imgly/background-removal（背景合成）
- Express 后端（多模型路由）
- OpenAI / Google Gemini / Hugging Face / Pollinations / Together / Replicate
