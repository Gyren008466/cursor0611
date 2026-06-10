import { getDefaultModel, getModelAvailability, getModelById } from '../_lib/models.js';
import { generateWithModel } from '../_lib/providers.js';
import { bytesToBase64, formatFetchError, jsonResponse } from '../_lib/utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');

  try {
    if (route === 'models' && request.method === 'GET') {
      return jsonResponse({ models: getModelAvailability(env) });
    }

    if (route === 'health' && request.method === 'GET') {
      return jsonResponse({
        ok: true,
        runtime: 'cloudflare-pages',
        hasDashScopeKey: Boolean(env.DASHSCOPE_API_KEY),
        hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
        hasGeminiKey: Boolean(env.GEMINI_API_KEY),
        defaultModel: getDefaultModel(env),
      });
    }

    if (route === 'generate' && request.method === 'POST') {
      const formData = await request.formData();
      const photo = formData.get('photo');

      if (!photo || typeof photo === 'string') {
        return jsonResponse({ message: '请上传照片' }, 400);
      }

      const modelId = String(formData.get('model') || getDefaultModel(env));
      const model = getModelById(modelId);

      if (!model) {
        return jsonResponse({ message: `未知模型: ${modelId}` }, 400);
      }

      if (model.requiresKey && model.envKey && !env[model.envKey]) {
        return jsonResponse({
          error: 'missing_api_key',
          message: `模型「${model.name}」需要在 Cloudflare 环境变量中配置 ${model.envKey}`,
        }, 503);
      }

      const mimeType = photo.type || 'image/jpeg';
      const imageBuffer = new Uint8Array(await photo.arrayBuffer());
      const result = await generateWithModel(modelId, imageBuffer, mimeType, env);

      return jsonResponse({
        image: `data:image/png;base64,${bytesToBase64(result)}`,
        model: modelId,
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    return jsonResponse({ message: `API 路由不存在: /api/${route}` }, 404);
  } catch (err) {
    console.error('API error:', err);
    return jsonResponse({
      error: 'generation_failed',
      message: formatFetchError(err),
    }, 500);
  }
}
