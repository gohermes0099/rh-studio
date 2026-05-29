/**
 * StorageService — abstraction layer for image storage backends.
 *
 * Currently the only implementation is imgbb, but the interface allows
 * swapping in other backends (S3, Cloudflare R2, etc.) without breaking
 * consuming code.
 */

import { ImgbbService } from './imgbbService.js';

export interface StorageService {
  upload(buffer: Buffer, fileName: string, mimeType: string): Promise<{ url: string; thumbnailUrl: string }>;
  url(_key: string): string;
  delete?(_key: string): Promise<void>;
}

/**
 * Factory that returns the configured StorageService implementation.
 * Currently hard-coded to imgbb.
 */
export function createStorageService(imgbbApiKey: string): StorageService {
  const imgbb = new ImgbbService(imgbbApiKey);

  return {
    async upload(buffer: Buffer, fileName: string, mimeType: string) {
      const result = await imgbb.upload(buffer, fileName, mimeType);
      return { url: result.url, thumbnailUrl: result.thumbnailUrl };
    },
    url(key: string) {
      // For imgbb the key IS the full URL
      return key;
    },
    async delete(_key: string) {
      // imgbb delete URLs are personal tokens — not implemented server-side
    },
  };
}