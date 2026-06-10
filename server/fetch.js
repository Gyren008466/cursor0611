import { ProxyAgent, Agent, fetch as undiciFetch } from 'undici';

let dispatcher = null;

function getDispatcher() {
  if (dispatcher) return dispatcher;

  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) {
    console.log(`Using proxy: ${proxy}`);
    dispatcher = new ProxyAgent(proxy);
  } else {
    dispatcher = new Agent({
      connect: { timeout: 60_000 },
      bodyTimeout: 120_000,
      headersTimeout: 60_000,
    });
  }
  return dispatcher;
}

export function formatFetchError(err) {
  const cause = err?.cause;
  const code = cause?.code || '';
  const message = String(cause?.message || err?.message || err);

  if (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    message.includes('timeout') ||
    message.includes('Timeout') ||
    message.includes('ETIMEDOUT')
  ) {
    return '无法连接 AI 服务（网络超时）。建议切换到「通义万相」模型（需配置 DASHSCOPE_API_KEY），或为 OpenAI 配置 HTTPS_PROXY 代理后重启服务';
  }

  if (err?.message === 'fetch failed') {
    return '无法连接 AI 服务（fetch failed）。请检查网络代理设置，或切换到已配置 API Key 的模型';
  }

  return err?.message || '生成失败，请重试';
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await undiciFetch(url, {
      ...options,
      dispatcher: getDispatcher(),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('AI 服务请求超时，请稍后重试或更换模型');
    }
    throw new Error(formatFetchError(err));
  } finally {
    clearTimeout(timer);
  }
}

export function getOpenAIBaseUrl() {
  return (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
}

const directAgent = new Agent({
  connect: { timeout: 60_000 },
  bodyTimeout: 180_000,
  headersTimeout: 60_000,
});

/** 国内 API 直连，不走代理 */
export async function fetchDirect(url, options = {}, timeoutMs = 180_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await undiciFetch(url, {
      ...options,
      dispatcher: directAgent,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('AI 服务请求超时，请稍后重试');
    }
    throw new Error(formatFetchError(err));
  } finally {
    clearTimeout(timer);
  }
}
