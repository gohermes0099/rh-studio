import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { getDb } from '../db/connection.js';
import type { ImgbbService } from './imgbbService.js';

interface RhResult {
  nodeId: string;
  url: string;
  outputType?: string;
}

interface SaveOptions {
  results: RhResult[];
  imgbbService?: ImgbbService | null;
  taskId?: string;
  toolId: number;
  toolName: string;
  prompt?: string;
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];
const AUDIO_EXTS = ['wav', 'mp3', 'ogg', 'm4a', 'flac', 'aac'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

function extFromOutputType(outputType?: string): string {
  const lower = (outputType || '').toLowerCase();
  if (IMAGE_EXTS.includes(lower)) return lower;
  if (AUDIO_EXTS.includes(lower)) return lower;
  if (VIDEO_EXTS.includes(lower)) return lower;
  if (lower === 'image') return 'png';
  if (lower === 'audio' || lower === 'video') return 'mp4';
  return 'bin';
}

export function extractPrompt(nodeInfoList: { fieldName: string; fieldValue: string }[]): string {
  for (const node of nodeInfoList) {
    if (/prompt/i.test(node.fieldName) || node.fieldName === 'Positive Prompt') {
      return node.fieldValue || '';
    }
  }
  for (const node of nodeInfoList) {
    if (node.fieldName) {
      return node.fieldValue || '';
    }
  }
  return '';
}

export async function saveGalleryResults(options: SaveOptions): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();
  let saved = 0;

  for (const r of options.results) {
    try {
      let displayUrl: string;
      let originalUrl = r.url;
      const ext = extFromOutputType(r.outputType);

      if (options.imgbbService) {
        // Re-upload to imgbb for permanent hosting
        try {
          const imgbbResult = await options.imgbbService.uploadFromUrl(r.url);
          displayUrl = imgbbResult.url;
        } catch (imgbbErr) {
          console.error('[galleryStore] imgbb re-upload failed, using RH URL:', imgbbErr);
          displayUrl = r.url;  // Fall back to RH CDN URL
        }
      } else {
        // No imgbb — use the RH URL directly (it will expire but at least we have a record)
        displayUrl = r.url;
      }

      db.run(`
        INSERT INTO gallery_items (taskId, toolId, toolName, fileName, originalUrl, outputType, prompt, nodeId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        options.taskId ?? null,
        options.toolId,
        options.toolName,
        displayUrl,
        originalUrl,
        ext,
        options.prompt ?? '',
        r.nodeId,
        now,
      );
      saved++;
    } catch (err) {
      console.error('[galleryStore] Failed to save gallery item for nodeId=' + r.nodeId + ':', err);
    }
  }

  return saved;
}

export function getGalleryFileInfo(galleryId: number): { filePath: string; fileName: string; mimeType: string; isImgbbUrl: boolean } | null {
  const db = getDb();
  const item = db.prepare('SELECT fileName, outputType FROM gallery_items WHERE id = ? AND deletedAt IS NULL').get(galleryId) as {
    fileName: string;
    outputType: string;
  } | undefined;

  if (!item) return null;

  const mimeTypes: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  };

  const ext = (item.outputType || item.fileName.split('.').pop() || '').toLowerCase();

  if (item.fileName.startsWith('http')) {
    return {
      filePath: item.fileName,
      fileName: item.fileName,
      mimeType: mimeTypes[ext] || 'image/png',
      isImgbbUrl: true,
    };
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '../../..');

  return {
    filePath: path.join(projectRoot, 'downloads', item.fileName),
    fileName: item.fileName,
    mimeType: mimeTypes[ext] || 'application/octet-stream',
    isImgbbUrl: false,
  };
}

export function softDeleteGalleryItem(galleryId: number): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE gallery_items SET deletedAt = ? WHERE id = ? AND deletedAt IS NULL
  `).run(new Date().toISOString(), galleryId);
  return result.changes > 0;
}

export function listGalleryItems(): Array<{
  id: number;
  taskId: string | null;
  toolId: number;
  toolName: string;
  fileName: string;
  outputType: string;
  nodeId: string;
  createdAt: string;
  prompt: string;
}> {
  const db = getDb();
  return db.prepare(`
    SELECT id, taskId, toolId, toolName, fileName, outputType, nodeId, createdAt, prompt
    FROM gallery_items
    WHERE deletedAt IS NULL
    ORDER BY createdAt DESC
  `).all() as any[];
}