import { useCallback, useRef } from 'react';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { isCapacitor } from '../lib/constants';

export interface CameraImageResult {
  /** A File object (from browser fallback) or a Blob created from the Capacitor camera blob */
  file: File;
  /** local object URL for preview */
  previewUrl: string;
}

/**
 * Hook that provides native camera/gallery picker (via @capacitor/camera)
 * with a graceful browser fallback using a hidden <input type="file">.
 *
 * Usage:
 *   const { pickImage, takePhoto, hiddenInput } = useCamera();
 *   const result = await pickImage();        // opens gallery
 *   const result = await takePhoto();        // opens camera
 *
 * On the web, both callbacks open the file picker (cameras can't
 * be targeted individually without `capture` attribute).
 */
export function useCamera() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Convert a Capacitor Camera Photo blob into a File + previewUrl pair.
   */
  const photoToResult = useCallback(async (photo: Photo): Promise<CameraImageResult> => {
    const blob = await fetch(photo.webPath!).then(r => r.blob());
    const ext = photo.format === 'png' ? 'png' : 'jpg';
    const file = new File([blob], `camera_${Date.now()}.${ext}`, {
      type: blob.type || `image/${ext}`,
    });
    const previewUrl = URL.createObjectURL(blob);
    return { file, previewUrl };
  }, []);

  /**
   * Convert browser FileList entries into CameraImageResult objects.
   * Called when the hidden <input type="file"> fires onChange.
   */
  const filesToResults = useCallback(async (files: FileList | null): Promise<CameraImageResult[]> => {
    if (!files || files.length === 0) return [];
    const results: CameraImageResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = URL.createObjectURL(file);
      results.push({ file, previewUrl });
    }
    return results;
  }, []);

  /**
   * Open the device gallery / photo library.
   * On Capacitor → native image picker (supports multiple).
   * On browser  → hidden <input type="file" accept="image/*" multiple>.
   *
   * Returns an array so the caller can handle single or multi selection uniformly.
   */
  const pickImage = useCallback(async (options?: { multiple?: boolean }): Promise<CameraImageResult[]> => {
    if (isCapacitor) {
      try {
        const photo = await Camera.pickImages({
          quality: 92,
          limit: options?.multiple ? 0 : 1, // 0 = unlimited
        });
        const results: CameraImageResult[] = [];
        for (const p of photo.photos) {
          // GalleryPhoto -> Photo: both have webPath, format, etc.
          results.push(await photoToResult(p as unknown as Photo));
        }
        return results;
      } catch (e: any) {
        // User cancelled or permission denied — fall through to browser
        if (e.message?.includes('cancel')) return [];
        throw e;
      }
    }

    // Browser fallback: trigger hidden file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = options?.multiple ?? false;
      input.style.display = 'none';
      document.body.appendChild(input);

      const cleanup = () => {
        document.body.removeChild(input);
        input.removeEventListener('change', onChange);
      };

      const onChange = async () => {
        cleanup();
        const results = await filesToResults(input.files);
        resolve(results);
      };

      input.addEventListener('change', onChange);
      input.click();
    });
  }, [photoToResult, filesToResults]);

  /**
   * Take a photo with the device camera.
   * On Capacitor → native camera UI.
   * On browser  → hidden <input type="file" accept="image/*" capture="environment">.
   *
   * Returns a single result (most cameras only return one photo at a time).
   */
  const takePhoto = useCallback(async (): Promise<CameraImageResult | null> => {
    if (isCapacitor) {
      try {
        const photo = await Camera.getPhoto({
          quality: 92,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          correctOrientation: true,
        });
        if (!photo?.webPath) return null;
        return await photoToResult(photo);
      } catch (e: any) {
        if (e.message?.includes('cancel')) return null;
        throw e;
      }
    }

    // Browser fallback: use file input with capture attribute
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment' as any;
      input.style.display = 'none';
      document.body.appendChild(input);

      const cleanup = () => {
        document.body.removeChild(input);
        input.removeEventListener('change', onChange);
      };

      const onChange = async () => {
        cleanup();
        const results = await filesToResults(input.files);
        resolve(results[0] || null);
      };

      input.addEventListener('change', onChange);
      input.click();
    });
  }, [photoToResult, filesToResults]);

  return { pickImage, takePhoto, fileInputRef };
}
