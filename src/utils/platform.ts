import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';

/** Cloudflare / 本地 API 根地址；Web 留空表示同源 */
export function getApiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  return base.replace(/\/$/, '');
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

function dataUrlToBase64(dataUrl: string): { base64: string; mime: string } {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  return { base64, mime };
}

export function dataUrlToFile(dataUrl: string, filename = 'photo.jpg'): File {
  const { base64, mime } = dataUrlToBase64(dataUrl);
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    arr[i] = binary.charCodeAt(i);
  }
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  return new File([arr], filename.includes('.') ? filename : `${filename}.${ext}`, { type: mime });
}

export async function pickPhotoFromCamera(): Promise<File | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    if (!photo.dataUrl) return null;
    return dataUrlToFile(photo.dataUrl, `camera-${Date.now()}.jpg`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('cancel') || message.includes('User cancelled')) {
      return null;
    }
    throw new Error('无法打开相机，请检查权限设置');
  }
}

export async function pickPhotoFromGallery(): Promise<File | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      correctOrientation: true,
    });
    if (!photo.dataUrl) return null;
    return dataUrlToFile(photo.dataUrl, `gallery-${Date.now()}.jpg`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('cancel') || message.includes('User cancelled')) {
      return null;
    }
    throw new Error('无法打开相册，请检查权限设置');
  }
}

async function canvasToBase64(imageSrc: string, format: 'png' | 'jpg'): Promise<string> {
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
      const dataUrl = canvas.toDataURL(mime, format === 'jpg' ? 0.92 : 1);
      resolve(dataUrlToBase64(dataUrl).base64);
    };
    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageSrc;
  });
}

/** 原生端保存到系统相册；Web 端返回 false 由调用方走下载 */
export async function saveImageToGallery(
  imageSrc: string,
  format: 'png' | 'jpg',
  filename = 'american-id-photo',
): Promise<boolean> {
  if (!isNativeApp()) return false;

  const ext = format === 'png' ? 'png' : 'jpg';
  const cacheName = `${filename}-${Date.now()}.${ext}`;
  const base64 = await canvasToBase64(imageSrc, format);

  await Filesystem.writeFile({
    path: cacheName,
    data: base64,
    directory: Directory.Cache,
  });

  const { uri } = await Filesystem.getUri({
    path: cacheName,
    directory: Directory.Cache,
  });

  const { albums } = await Media.getAlbums();
  const album = albums.find((a) => a.name === '美式证件照') ?? albums[0];

  await Media.savePhoto({
    path: uri,
    albumIdentifier: album?.identifier,
    fileName: `${filename}.${ext}`,
  });

  return true;
}
