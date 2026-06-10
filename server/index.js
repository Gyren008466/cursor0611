import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { getModelAvailability, getModelById } from './models.js';
import { generateWithModel } from './providers.js';
import { formatFetchError } from './fetch.js';

const app = express();
const PORT = process.env.PORT || 3001;

function getDefaultModel() {
  if (process.env.DASHSCOPE_API_KEY) return 'dashscope-wan27';
  if (process.env.OPENAI_API_KEY) return 'openai-gpt-image';
  if (process.env.GEMINI_API_KEY) return 'gemini-2-flash';
  return 'hf-instruct-pix2pix';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/api/models', (_req, res) => {
  res.json({ models: getModelAvailability() });
});

app.post('/api/generate', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传照片' });
    }

    const modelId = req.body.model || getDefaultModel();
    const model = getModelById(modelId);

    if (!model) {
      return res.status(400).json({ message: `未知模型: ${modelId}` });
    }

    if (model.requiresKey && model.envKey && !process.env[model.envKey]) {
      return res.status(503).json({
        error: 'missing_api_key',
        message: `模型「${model.name}」需要配置 ${model.envKey}，请在 .env 文件中设置`,
      });
    }

    const mimeType = req.file.mimetype || 'image/jpeg';
    console.log(`Generating with model: ${modelId}`);

    const resultBuffer = await generateWithModel(modelId, req.file.buffer, mimeType);
    const base64 = resultBuffer.toString('base64');
    const outputMime = mimeType.includes('jpeg') ? 'image/jpeg' : 'image/png';

    res.json({
      image: `data:${outputMime};base64,${base64}`,
      model: modelId,
    });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({
      error: 'generation_failed',
      message: formatFetchError(err),
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasDashScopeKey: Boolean(process.env.DASHSCOPE_API_KEY),
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasHfToken: Boolean(process.env.HF_TOKEN),
    defaultModel: getDefaultModel(),
    hasProxy: Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY),
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  const models = getModelAvailability();
  const freeCount = models.filter((m) => m.badgeType === 'free' && m.available).length;
  console.log(`Available models: ${models.filter((m) => m.available).length}/${models.length} (${freeCount} free)`);
});
