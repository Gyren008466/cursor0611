import { GENERATION_PROMPT } from './models.js';
import { base64ToBytes, bytesToBase64, toBytes } from './utils.js';

async function downloadImage(imageRef) {
  if (imageRef.startsWith('data:')) {
    return base64ToBytes(imageRef.split(',')[1]);
  }
  const res = await fetch(imageRef);
  if (!res.ok) throw new Error('下载生成图像失败');
  return new Uint8Array(await res.arrayBuffer());
}

function extractDashScopeImage(data) {
  for (const choice of data.output?.choices || []) {
    for (const item of [].concat(choice.message?.content || [])) {
      if (typeof item === 'string' && item.startsWith('http')) return item;
      if (item?.image) return item.image;
      if (item?.url) return item.url;
    }
  }
  const results = data.output?.results || [];
  if (results[0]?.url) return results[0].url;
  if (results[0]?.image) return results[0].image;
  throw new Error(`百炼未返回图像: ${JSON.stringify(data).slice(0, 300)}`);
}

async function generateDashScopeWan27(imageBuffer, mimeType, env) {
  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('请在 Cloudflare 环境变量中配置 DASHSCOPE_API_KEY');

  const dataUrl = `data:${mimeType};base64,${bytesToBase64(imageBuffer)}`;
  const response = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'wan2.7-image-pro',
        input: {
          messages: [
            {
              role: 'user',
              content: [{ image: dataUrl }, { text: GENERATION_PROMPT }],
            },
          ],
        },
        parameters: { size: '2K', n: 1, watermark: false },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`万相 2.7 Pro 错误: ${(await response.text()).slice(0, 400)}`);
  }

  const data = await response.json();
  return downloadImage(extractDashScopeImage(data));
}

async function generateDashScopeWanx(imageBuffer, mimeType, env) {
  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('请在 Cloudflare 环境变量中配置 DASHSCOPE_API_KEY');

  const dataUrl = `data:${mimeType};base64,${bytesToBase64(imageBuffer)}`;
  const createRes = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'wanx2.1-imageedit',
        input: {
          function: 'description_edit',
          prompt: GENERATION_PROMPT,
          base_image_url: dataUrl,
        },
        parameters: { strength: 0.65, n: 1 },
      }),
    },
  );

  if (!createRes.ok) {
    throw new Error(`阿里云百炼错误: ${(await createRes.text()).slice(0, 400)}`);
  }

  const taskId = (await createRes.json()).output?.task_id;
  if (!taskId) throw new Error('阿里云百炼未返回任务ID');

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const pollData = await pollRes.json();
    const status = pollData.output?.task_status;

    if (status === 'SUCCEEDED') {
      const imageUrl = pollData.output?.results?.[0]?.url;
      if (!imageUrl) throw new Error('阿里云百炼未返回图像');
      return downloadImage(imageUrl);
    }
    if (status === 'FAILED') {
      throw new Error(`阿里云百炼生成失败: ${pollData.output?.message || '未知错误'}`);
    }
  }
  throw new Error('阿里云百炼任务超时');
}

async function generateOpenAI(imageBuffer, mimeType, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('请在 Cloudflare 环境变量中配置 OPENAI_API_KEY');

  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const ext = mimeType.includes('png') ? 'png' : 'jpeg';
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: mimeType }), `photo.${ext}`);
  formData.append('prompt', GENERATION_PROMPT);
  formData.append('model', 'gpt-image-1');
  formData.append('size', '1024x1024');
  formData.append('quality', 'high');

  const response = await fetch(`${base}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OpenAI 错误: ${(await response.text()).slice(0, 300)}`);
  }

  const b64 = (await response.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI 未返回图像');
  return base64ToBytes(b64);
}

async function generateGemini(imageBuffer, mimeType, env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('请在 Cloudflare 环境变量中配置 GEMINI_API_KEY');

  const base64 = bytesToBase64(imageBuffer);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: GENERATION_PROMPT },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini 错误: ${(await response.text()).slice(0, 300)}`);
  }

  const data = await response.json();
  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) return base64ToBytes(part.inlineData.data);
  }
  throw new Error('Gemini 未返回图像');
}

const PROVIDERS = {
  'dashscope-wan27': generateDashScopeWan27,
  'dashscope-wanx': generateDashScopeWanx,
  'openai-gpt-image': generateOpenAI,
  'gemini-2-flash': generateGemini,
};

export async function generateWithModel(modelId, imageBuffer, mimeType, env) {
  const provider = PROVIDERS[modelId];
  if (!provider) throw new Error(`未知或不支持的模型: ${modelId}`);
  const bytes = await toBytes(imageBuffer);
  return provider(bytes, mimeType, env);
}
