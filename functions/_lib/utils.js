export function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(await data.arrayBuffer());
}

export function formatFetchError(err) {
  const message = String(err?.message || err);
  if (
    message.includes('timeout') ||
    message.includes('Timeout') ||
    message.includes('ETIMEDOUT') ||
    message.includes('network')
  ) {
    return '无法连接 AI 服务（网络超时），请稍后重试或更换模型';
  }
  return message || '生成失败，请重试';
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
