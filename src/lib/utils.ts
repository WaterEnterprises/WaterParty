import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState, useEffect } from 'react';
import { API_BASE, getSessionToken } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * React hook that returns true when the given CSS media query matches.
 * Uses matchMedia under the hood with automatic re-evaluation on change.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Detect currency from GPS coordinates via the server.
 * Calls POST /api/users/currency which reverse geocodes lat/lon,
 * maps to a supported currency, and saves it to the user's DB profile.
 */
export async function detectCurrencyFromCoords(
  lat: number,
  lon: number,
  fetchWithAuth: (url: string, options?: any) => Promise<Response>
): Promise<string | null> {
  try {
    const res = await fetchWithAuth(`${API_BASE}/api/users/currency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { currency?: string };
    return data.currency || null;
  } catch {
    return null;
  }
}

/**
 * Convert a Blob/File to a base64 data-URI string.
 * Used only where JSON transport is required.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) resolve(reader.result as string);
      else reject(new Error("FileReader returned empty result"));
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload a file (image or video) to the server via /api/upload using multipart/form-data (binary).
 * Accepts a Blob, File, or base64 data-URI string.
 * Returns the media ID (e.g. "media_...") on success.
 */
function extFromMime(mime: string): string {
  if (mime.startsWith('video/')) return '.' + mime.split('/')[1].replace('quicktime', 'mov');
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/webp') return '.webp';
  return '.bin';
}

export async function uploadImage(imageData: string | File | Blob, mimeType = 'image/jpeg', fileName?: string): Promise<string> {
  let blob: Blob;
  const ext = extFromMime(mimeType);
  let name = fileName ? fileName + ext : `upload_${Date.now()}${ext}`;

  if (typeof imageData === 'string') {
    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    const byteChars = atob(base64);
    const byteArrays: Uint8Array[] = [];
    for (let offset = 0; offset < byteChars.length; offset += 8192) {
      const slice = byteChars.slice(offset, offset + 8192);
      const byteArray = new Uint8Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteArray[i] = slice.charCodeAt(i);
      }
      byteArrays.push(byteArray);
    }
    blob = new Blob(byteArrays as BlobPart[], { type: mimeType });
  } else {
    blob = imageData as Blob;
    if (!blob.type && mimeType) {
      blob = new Blob([await blob.arrayBuffer()], { type: mimeType });
    }
  }

  const formData = new FormData();
  formData.append('file', blob, name);

  const sessionToken = getSessionToken();
  const headers: Record<string, string> = {};
  if (sessionToken) headers['x-session-token'] = sessionToken;

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Upload failed');
  }

  const result = await res.json();
  return result.id as string;
}

/**
 * Upload a video file directly (no compression) via binary upload.
 * Returns the media ID (e.g. "media_...") on success.
 */
export async function uploadVideo(file: File | Blob, fileName?: string): Promise<string> {
  const blob = file instanceof Blob ? file : new Blob([file]);
  return uploadImage(blob, file instanceof File ? file.type : 'video/mp4', fileName || `video_${Date.now()}`);
}

/**
 * Compress an image and upload it via binary upload.
 * For profile photos: center-crops to 9:16 aspect ratio, max 4000px longest side, q0.92.
 * For party photos: maintains original aspect ratio, max 4000px longest side, q0.92.
 */
export async function compressAndUpload(
  file: File | Blob,
  fileName?: string,
  maxWidth = 4000,
  maxHeight = 4000,
  quality = 0.92,
): Promise<string> {
  const compressedBlob = await compressImageBlob(file, maxWidth, maxHeight, quality);
  return uploadImage(compressedBlob, undefined, fileName);
}

/**
 * Compress and 9:16 center-crop an image (File or Blob) for profile photos.
 * Returns a compressed Blob.
 */
export async function compressImageForProfile(file: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');

      // Determine crop dimensions: center crop to 9:16
      const targetAspect = 9 / 16;
      const imgAspect = img.width / img.height;

      let cropW: number, cropH: number, cropX: number, cropY: number;

      if (imgAspect > targetAspect) {
        // Image is wider than 9:16 — crop sides
        cropH = img.height;
        cropW = cropH * targetAspect;
        cropX = (img.width - cropW) / 2;
        cropY = 0;
      } else {
        // Image is taller than 9:16 — crop top/bottom
        cropW = img.width;
        cropH = cropW / targetAspect;
        cropX = 0;
        cropY = (img.height - cropH) / 2;
      }

      // Scale down if needed (max 4000px on longest side)
      let outW = cropW;
      let outH = cropH;
      const maxDim = 4000;
      if (outW > maxDim || outH > maxDim) {
        if (outW > outH) {
          outH = (outH / outW) * maxDim;
          outW = maxDim;
        } else {
          outW = (outW / outH) * maxDim;
          outH = maxDim;
        }
      }

      canvas.width = Math.round(outW);
      canvas.height = Math.round(outH);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg', 0.92);
      } else {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed for profile compression'));
    };
  });
}

/**
 * Compress an image (File or Blob) and return a compressed Blob.
 * Preserves original aspect ratio, caps at maxWidth/maxHeight.
 */
export async function compressImageBlob(
  file: File | Blob,
  maxWidth = 4000,
  maxHeight = 4000,
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Scale down if exceeds max dimensions on longest side
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg', quality);
      } else {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, file.type || 'image/jpeg');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed for compression'));
    };
  });
}
