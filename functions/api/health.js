import { getDefaultModel } from '../_lib/models.js';
import { jsonResponse } from '../_lib/utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  return jsonResponse({
    ok: true,
    runtime: 'cloudflare-pages',
    hasDashScopeKey: Boolean(env.DASHSCOPE_API_KEY),
    hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
    hasGeminiKey: Boolean(env.GEMINI_API_KEY),
    defaultModel: getDefaultModel(env),
  });
}
