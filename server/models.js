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
    id: 'hf-instruct-pix2pix',
    name: 'InstructPix2Pix',
    provider: 'Hugging Face',
    badge: '免费',
    badgeType: 'free',
    description: '免费图像编辑模型，无需 API Key，首次调用可能需排队 20–60 秒',
    requiresKey: false,
    envKey: 'HF_TOKEN',
    estimatedTime: '30–90 秒',
  },
  {
    id: 'hf-flux-kontext',
    name: 'FLUX Kontext Dev',
    provider: 'Hugging Face',
    badge: '免费',
    badgeType: 'free',
    description: '免费 FLUX 图像编辑，可选配置 HF_TOKEN 加速',
    requiresKey: false,
    envKey: 'HF_TOKEN',
    estimatedTime: '40–120 秒',
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    badge: '免费额度',
    badgeType: 'free',
    description: 'Google AI Studio 免费额度，需在 .env 配置 GEMINI_API_KEY',
    requiresKey: true,
    envKey: 'GEMINI_API_KEY',
    estimatedTime: '15–45 秒',
  },
  {
    id: 'pollinations-flux',
    name: 'Pollinations Flux',
    provider: 'Pollinations',
    badge: '完全免费',
    badgeType: 'free',
    description: '无需密钥，基于提示词生成（不保留原图细节，适合快速预览）',
    requiresKey: false,
    estimatedTime: '10–30 秒',
  },
  {
    id: 'together-flux',
    name: 'FLUX Schnell',
    provider: 'Together AI',
    badge: '免费额度',
    badgeType: 'free',
    description: 'Together AI 免费额度，需在 .env 配置 TOGETHER_API_KEY',
    requiresKey: true,
    envKey: 'TOGETHER_API_KEY',
    estimatedTime: '10–25 秒',
  },
  {
    id: 'replicate-flux',
    name: 'FLUX Kontext Pro',
    provider: 'Replicate',
    badge: '免费试用',
    badgeType: 'free',
    description: 'Replicate 免费试用额度，需在 .env 配置 REPLICATE_API_TOKEN',
    requiresKey: true,
    envKey: 'REPLICATE_API_TOKEN',
    estimatedTime: '20–60 秒',
  },
  {
    id: 'openai-gpt-image',
    name: 'GPT Image 1',
    provider: 'OpenAI',
    badge: '付费',
    badgeType: 'paid',
    description: 'OpenAI 高质量图像编辑，效果最佳（已配置 API Key）',
    requiresKey: true,
    envKey: 'OPENAI_API_KEY',
    estimatedTime: '15–60 秒',
  },
  {
    id: 'openai-responses',
    name: 'GPT-4.1 + 图像生成',
    provider: 'OpenAI',
    badge: '付费',
    badgeType: 'paid',
    description: 'OpenAI Responses API 图像生成备用方案',
    requiresKey: true,
    envKey: 'OPENAI_API_KEY',
    estimatedTime: '20–60 秒',
  },
];

export function getModelAvailability() {
  return AI_MODELS.map((model) => {
    const hasKey = model.envKey ? Boolean(process.env[model.envKey]) : true;
    const available = !model.requiresKey || hasKey;
    return {
      ...model,
      available,
      configured: hasKey,
    };
  });
}

export function getModelById(id) {
  return AI_MODELS.find((m) => m.id === id);
}
