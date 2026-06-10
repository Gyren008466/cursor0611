import { getDefaultModel, getModelById } from '../_lib/models.js';
import { generateWithModel } from '../_lib/providers.js';
import { bytesToBase64, formatFetchError, jsonResponse } from '../_lib/utils.js';

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
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
    const base64 = bytesToBase64(result);

    return jsonResponse({
      image: `data:image/png;base64,${base64}`,
      model: modelId,
    });
  } catch (err) {
    console.error('Generation error:', err);
    return jsonResponse({
      error: 'generation_failed',
      message: formatFetchError(err),
    }, 500);
  }
}
