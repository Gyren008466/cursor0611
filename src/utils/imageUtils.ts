import { getApiBase, isNativeApp, saveImageToGallery } from './platform';

export type BackgroundColor = 'blue' | 'red' | 'white' | 'black' | 'transparent';

function apiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}

export type AiModel = {
  id: string;
  name: string;
  provider: string;
  badge: string;
  badgeType: 'free' | 'paid';
  description: string;
  requiresKey: boolean;
  envKey?: string;
  estimatedTime: string;
  available: boolean;
  configured: boolean;
};

export const BACKGROUND_OPTIONS: {
  id: BackgroundColor;
  label: string;
  color: string | null;
}[] = [
  { id: 'blue', label: '蓝色', color: '#003399' },
  { id: 'red', label: '红色', color: '#CC0000' },
  { id: 'white', label: '白色', color: '#FFFFFF' },
  { id: 'black', label: '黑色', color: '#1A1A1A' },
  { id: 'transparent', label: '无背景', color: null },
];

export async function fetchAiModels(): Promise<AiModel[]> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/models'));
  } catch {
    throw new Error(
      isNativeApp()
        ? '无法连接 API 服务，请确认 .env.production 中 VITE_API_BASE_URL 指向已部署的 Cloudflare 地址'
        : '无法连接 API 服务。本地开发请运行 npm run dev；Cloudflare 部署请在 Pages 设置中配置 Functions 与环境变量 DASHSCOPE_API_KEY',
    );
  }
  if (!response.ok) throw new Error('无法加载 AI 模型列表');
  const data = await response.json();
  return data.models as AiModel[];
}

export async function generateIdPhoto(file: File, modelId: string): Promise<string> {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('model', modelId);

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/generate'), {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error(
      isNativeApp()
        ? '无法连接 API 服务器，请检查网络与 VITE_API_BASE_URL 配置'
        : '无法连接本地服务器，请确认已运行 npm run dev',
    );
  }

  let data: { message?: string; image?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error(`服务器响应异常 (${response.status})，请重启 npm run dev 后重试`);
  }

  if (!response.ok) {
    throw new Error(data.message || '生成失败');
  }

  if (!data.image) {
    throw new Error('服务器未返回图像数据');
  }

  return data.image;
}

export async function applyBackground(
  imageSrc: string,
  background: BackgroundColor,
): Promise<string> {
  const bgOption = BACKGROUND_OPTIONS.find((o) => o.id === background);
  if (!bgOption) return imageSrc;

  if (background === 'transparent') {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await fetch(imageSrc).then((r) => r.blob());
    const result = await removeBackground(blob);
    return URL.createObjectURL(result);
  }

  const { removeBackground } = await import('@imgly/background-removal');
  const blob = await fetch(imageSrc).then((r) => r.blob());
  const foregroundBlob = await removeBackground(blob);
  const foregroundUrl = URL.createObjectURL(foregroundBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      ctx.fillStyle = bgOption.color!;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (resultBlob) => {
          URL.revokeObjectURL(foregroundUrl);
          if (resultBlob) {
            resolve(URL.createObjectURL(resultBlob));
          } else {
            reject(new Error('Failed to composite image'));
          }
        },
        'image/png',
        1,
      );
    };
    img.onerror = () => reject(new Error('Failed to load foreground'));
    img.src = foregroundUrl;
  });
}

export async function downloadImage(
  imageSrc: string,
  format: 'png' | 'jpg',
  filename = 'american-id-photo',
): Promise<'saved' | 'downloaded'> {
  if (isNativeApp()) {
    await saveImageToGallery(imageSrc, format, filename);
    return 'saved';
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      if (format === 'jpg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : 'jpg';
      const link = document.createElement('a');
      link.download = `${filename}.${ext}`;
      link.href = canvas.toDataURL(mime, format === 'jpg' ? 0.92 : 1);
      link.click();
      resolve('downloaded');
    };
    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageSrc;
  });
}

export function pickDefaultModel(models: AiModel[]): string {
  const wan27 = models.find((m) => m.id === 'dashscope-wan27' && m.available);
  if (wan27) return wan27.id;

  const dashscope = models.find((m) => m.id === 'dashscope-wanx' && m.available);
  if (dashscope) return dashscope.id;

  const openai = models.find((m) => m.id === 'openai-gpt-image' && m.available);
  if (openai) return openai.id;

  const gemini = models.find((m) => m.id === 'gemini-2-flash' && m.available);
  if (gemini) return gemini.id;

  const freeAvailable = models.find((m) => m.badgeType === 'free' && m.available);
  if (freeAvailable) return freeAvailable.id;

  const anyAvailable = models.find((m) => m.available);
  if (anyAvailable) return anyAvailable.id;

  return models[0]?.id || 'dashscope-wanx';
}
