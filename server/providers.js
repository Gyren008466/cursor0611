import { GENERATION_PROMPT } from './models.js';
import { fetchWithTimeout, fetchDirect, getOpenAIBaseUrl } from './fetch.js';

async function downloadDashScopeImage(imageRef) {
  if (imageRef.startsWith('data:')) {
    const base64 = imageRef.split(',')[1];
    return Buffer.from(base64, 'base64');
  }
  const imgRes = await fetchDirect(imageRef, {}, 60_000);
  if (!imgRes.ok) throw new Error('下载百炼生成图像失败');
  return Buffer.from(await imgRes.arrayBuffer());
}

function extractImageFromDashScopeResponse(data) {
  const choices = data.output?.choices || [];
  for (const choice of choices) {
    const content = choice.message?.content;
    if (!content) continue;
    const items = Array.isArray(content) ? content : [content];
    for (const item of items) {
      if (typeof item === 'string' && item.startsWith('http')) return item;
      if (item?.image) return item.image;
      if (item?.url) return item.url;
    }
  }

  const results = data.output?.results || [];
  if (results[0]?.url) return results[0].url;
  if (results[0]?.image) return results[0].image;

  if (data.output?.image_url) return data.output.image_url;
  if (data.output?.url) return data.output.url;

  throw new Error(`百炼未返回图像: ${JSON.stringify(data).slice(0, 300)}`);
}

export async function generateWithDashScopeWan27(imageBuffer, mimeType) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('请在 .env 中配置 DASHSCOPE_API_KEY');

  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await fetchDirect(
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
              content: [
                { image: dataUrl },
                { text: GENERATION_PROMPT },
              ],
            },
          ],
        },
        parameters: {
          size: '2K',
          n: 1,
          watermark: false,
        },
      }),
    },
    180_000,
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`万相 2.7 Pro 错误: ${err.slice(0, 400)}`);
  }

  const data = await response.json();
  const imageRef = extractImageFromDashScopeResponse(data);
  return downloadDashScopeImage(imageRef);
}

export async function generateWithDashScope(imageBuffer, mimeType) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('请在 .env 中配置 DASHSCOPE_API_KEY（阿里云百炼 API Key）');

  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const createRes = await fetchDirect(
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
        parameters: {
          strength: 0.65,
          n: 1,
        },
      }),
    },
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`阿里云百炼错误: ${err.slice(0, 400)}`);
  }

  const createData = await createRes.json();
  const taskId = createData.output?.task_id;
  if (!taskId) {
    throw new Error(`阿里云百炼未返回任务ID: ${JSON.stringify(createData).slice(0, 200)}`);
  }

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetchDirect(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
      30_000,
    );

    if (!pollRes.ok) {
      const err = await pollRes.text();
      throw new Error(`阿里云百炼查询失败: ${err.slice(0, 200)}`);
    }

    const pollData = await pollRes.json();
    const status = pollData.output?.task_status;

    if (status === 'SUCCEEDED') {
      const imageUrl = pollData.output?.results?.[0]?.url;
      if (!imageUrl) throw new Error('阿里云百炼未返回图像 URL');
      const imgRes = await fetchDirect(imageUrl, {}, 60_000);
      if (!imgRes.ok) throw new Error('下载生成图像失败');
      return Buffer.from(await imgRes.arrayBuffer());
    }

    if (status === 'FAILED') {
      const msg = pollData.output?.message || pollData.message || '未知错误';
      throw new Error(`阿里云百炼生成失败: ${msg}`);
    }
  }

  throw new Error('阿里云百炼任务超时，请稍后重试');
}

function getHfHeaders() {
  const headers = {};
  if (process.env.HF_TOKEN) {
    headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
  }
  return headers;
}

async function pollHfResult(modelUrl, maxAttempts = 12) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetchWithTimeout(modelUrl, { headers: getHfHeaders() }, 60_000);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 1000) return buf;
    }
  }
  throw new Error('Hugging Face 模型排队超时，请稍后重试或更换模型');
}

async function callHfModel(modelId, imageBuffer, extraParams = {}) {
  const url = `https://api-inference.huggingface.co/models/${modelId}`;
  const params = new URLSearchParams({
    prompt: GENERATION_PROMPT.slice(0, 500),
    ...extraParams,
  });

  const response = await fetchWithTimeout(
    `${url}?${params}`,
    {
      method: 'POST',
      headers: getHfHeaders(),
      body: imageBuffer,
    },
    90_000,
  );

  if (response.status === 503) {
    const body = await response.json().catch(() => ({}));
    if (body.estimated_time) {
      console.log(`HF model loading, estimated ${body.estimated_time}s`);
    }
    return pollHfResult(url);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Hugging Face 错误 (${response.status}): ${err.slice(0, 200)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function generateWithHfInstructPix2Pix(imageBuffer) {
  return callHfModel('timbrooks/instruct-pix2pix', imageBuffer, {
    image_guidance_scale: '1.5',
    guidance_scale: '7.5',
  });
}

export async function generateWithHfFluxKontext(imageBuffer) {
  return callHfModel('black-forest-labs/FLUX.1-Kontext-dev', imageBuffer);
}

export async function generateWithGemini(imageBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('MISSING_GEMINI_KEY');

  const base64 = imageBuffer.toString('base64');
  const models = [
    'gemini-2.0-flash-exp-image-generation',
    'gemini-2.0-flash-preview-image-generation',
  ];

  let lastError = null;
  for (const model of models) {
    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
        },
      );

      if (!response.ok) {
        lastError = await response.text();
        continue;
      }

      const data = await response.json();
      for (const part of data.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
      lastError = 'Gemini 未返回图像';
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(`Gemini 生成失败: ${lastError}`);
}

export async function generateWithPollinations(_imageBuffer) {
  const prompt = encodeURIComponent(GENERATION_PROMPT.slice(0, 800));
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://gen.pollinations.ai/image/${prompt}?width=1024&height=1024&model=flux&seed=${seed}&nologo=true`;

  const response = await fetchWithTimeout(url, { redirect: 'follow' }, 90_000);
  if (!response.ok) {
    throw new Error(`Pollinations 错误 (${response.status})，该服务可能已限制免费调用，请改用 OpenAI 模型`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function generateWithTogether(_imageBuffer) {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error('MISSING_TOGETHER_KEY');

  const response = await fetchWithTimeout('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell-Free',
      prompt: GENERATION_PROMPT,
      width: 1024,
      height: 1024,
      steps: 4,
      n: 1,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Together AI 错误: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('Together AI 未返回图像');
  return Buffer.from(b64, 'base64');
}

export async function generateWithReplicate(imageBuffer, mimeType) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('MISSING_REPLICATE_KEY');

  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const modelRes = await fetchWithTimeout(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=120',
      },
      body: JSON.stringify({
        input: {
          prompt: GENERATION_PROMPT,
          input_image: dataUrl,
          aspect_ratio: '1:1',
          output_format: 'png',
        },
      }),
    },
    180_000,
  );

  if (!modelRes.ok) {
    const err = await modelRes.text();
    throw new Error(`Replicate 错误: ${err.slice(0, 200)}`);
  }

  const prediction = await modelRes.json();
  const outputUrl = Array.isArray(prediction.output)
    ? prediction.output[0]
    : prediction.output;

  if (!outputUrl) {
    throw new Error('Replicate 未返回图像，可能仍在处理中');
  }

  const imgRes = await fetchWithTimeout(outputUrl, {}, 60_000);
  return Buffer.from(await imgRes.arrayBuffer());
}

export async function generateWithOpenAIEdit(imageBuffer, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('MISSING_OPENAI_KEY');

  const ext = mimeType.includes('png') ? 'png' : 'jpeg';
  const formData = new FormData();
  formData.append(
    'image',
    new Blob([imageBuffer], { type: mimeType }),
    `photo.${ext}`,
  );
  formData.append('prompt', GENERATION_PROMPT);
  formData.append('model', 'gpt-image-1');
  formData.append('size', '1024x1024');
  formData.append('quality', 'high');

  const response = await fetchWithTimeout(`${getOpenAIBaseUrl()}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  }, 180_000);

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI 错误: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI 未返回图像');
  return Buffer.from(b64, 'base64');
}

export async function generateWithOpenAIResponses(imageBuffer, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('MISSING_OPENAI_KEY');

  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await fetchWithTimeout(`${getOpenAIBaseUrl()}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: GENERATION_PROMPT },
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ],
      tools: [{ type: 'image_generation' }],
    }),
  }, 180_000);

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Responses 错误: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  for (const item of data.output || []) {
    if (item.type === 'image_generation_call' && item.result) {
      return Buffer.from(item.result, 'base64');
    }
  }
  throw new Error('OpenAI Responses 未返回图像');
}

const PROVIDERS = {
  'dashscope-wan27': generateWithDashScopeWan27,
  'dashscope-wanx': generateWithDashScope,
  'hf-instruct-pix2pix': generateWithHfInstructPix2Pix,
  'hf-flux-kontext': generateWithHfFluxKontext,
  'gemini-2-flash': generateWithGemini,
  'pollinations-flux': generateWithPollinations,
  'together-flux': generateWithTogether,
  'replicate-flux': generateWithReplicate,
  'openai-gpt-image': generateWithOpenAIEdit,
  'openai-responses': generateWithOpenAIResponses,
};

export async function generateWithModel(modelId, imageBuffer, mimeType) {
  const provider = PROVIDERS[modelId];
  if (!provider) {
    throw new Error(`未知模型: ${modelId}`);
  }
  return provider(imageBuffer, mimeType);
}
