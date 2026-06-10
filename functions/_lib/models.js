export const GENERATION_PROMPT = `Convert the uploaded portrait into an American-style professional headshot in corporate photography style, while preserving the original facial features and identity. Requirements: half-body portrait, blue textured studio background, soft natural studio lighting, high-definition clarity, realistic skin tones, clean and elegant composition. Wearing business casual shirt, minimalist and elegant design, modern professional aesthetic. Tailored fit, crisp natural silhouette, wrinkle-free fabric, paired with a necktie in a coordinating color and style. Updated hairstyle: modern and trendy, yet sharp, neat, and professional. The physique should be subtly toned, mildly athletic, with lean muscle—fit yet natural. Expression should be relaxed, confident, and natural with bright, engaging eyes and a genuine smile. Maintain sharp focus on the face, with a slightly blurred background for depth, overall polished and professional. Ensure no visible AI artifacts.`;

export const AI_MODELS = [
  {
    id: 'dashscope-wan27',
    name: '万相 2.7 Pro',
    provider: '阿里云百炼',
    badge: '国内推荐',
    badgeType: 'free',
    description: 'wan2.7-image-pro 多模态生成，国内直连，效果最佳（默认）',
    requiresKey: true,
    envKey: 'DASHSCOPE_API_KEY',
    estimatedTime: '15–45 秒',
  },
  {
    id: 'dashscope-wanx',
    name: '万相 2.1 图像编辑',
    provider: '阿里云百炼',
    badge: '国内推荐',
    badgeType: 'free',
    description: 'wanx2.1-imageedit 指令编辑，国内网络直连',
    requiresKey: true,
    envKey: 'DASHSCOPE_API_KEY',
    estimatedTime: '15–40 秒',
  },
  {
    id: 'openai-gpt-image',
    name: 'GPT Image 1',
    provider: 'OpenAI',
    badge: '付费',
    badgeType: 'paid',
    description: 'OpenAI 高质量图像编辑',
    requiresKey: true,
    envKey: 'OPENAI_API_KEY',
    estimatedTime: '15–60 秒',
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    badge: '免费额度',
    badgeType: 'free',
    description: 'Google AI Studio 免费额度',
    requiresKey: true,
    envKey: 'GEMINI_API_KEY',
    estimatedTime: '15–45 秒',
  },
];

export function getModelAvailability(env) {
  return AI_MODELS.map((model) => {
    const hasKey = model.envKey ? Boolean(env[model.envKey]) : true;
    return {
      ...model,
      available: !model.requiresKey || hasKey,
      configured: hasKey,
    };
  });
}

export function getModelById(id) {
  return AI_MODELS.find((m) => m.id === id);
}

export function getDefaultModel(env) {
  if (env.DASHSCOPE_API_KEY) return 'dashscope-wan27';
  if (env.OPENAI_API_KEY) return 'openai-gpt-image';
  if (env.GEMINI_API_KEY) return 'gemini-2-flash';
  return 'dashscope-wan27';
}
