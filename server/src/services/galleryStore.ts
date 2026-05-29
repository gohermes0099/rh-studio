import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/connection.js';
import type { ImgbbService } from './imgbbService.js';

interface RhResult {
  nodeId: string;
  url: string;
  outputType?: string;
}

interface SaveOptions {
  /** Array of RH results to download and store */
  results: RhResult[];
  /** imgbbService instance for uploading to imgbb */
  imgbbService: ImgbbService;
  /** RH taskId that produced these results (nullable — for reference only) */
  taskId?: string;
  /** Tool that created the images */
  toolId: number;
  /** Denormalized tool name for gallery display */
  toolName: string;
  /** Prompt text used for generation (optional) */
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

/**
 * Extract prompt text from a nodeInfoList.
 * Scans for a field matching /prompt/i or "Positive Prompt".
 */
export function extractPrompt(nodeInfoList: { fieldName: string; fieldValue: string }[]): string {
  for (const node of nodeInfoList) {
    if (/prompt/i.test(node.fieldName) || node.fieldName === 'Positive Prompt') {
      return node.fieldValue || '';
    }
  }
  // Fallback: first STRING-type field
  for (const node of nodeInfoList) {
    if (node.fieldName) {
      console.warn('[galleryStore] Prompt field not found, falling back to:', node.fieldName);
      return node.fieldValue || '';
    }
  }
  return '';
}

/**
 * Save RH task results to the gallery:
 * 1. For each RH result URL, fetch the image and upload to imgbb
 * 2. Insert a record into gallery_items with imgbb URL in fileName
 *
 * Returns the count of successfully saved items.
 */
export async function saveGalleryResults(options: SaveOptions): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();

  let saved = 0;

  const insert = db.prepare(`
    INSERT INTO gallery_items (taskId, toolId, toolName, fileName, originalUrl, outputType, prompt, nodeId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of options.results) {
    try {
      // Upload RH result to imgbb
      const imgbbResult = await options.imgbbService.uploadFromUrl(r.url);
      const ext = extFromOutputType(r.outputType);

      insert.run(
        options.taskId ?? null,
        options.toolId,
        options.toolName,
        imgbbResult.url,        // fileName = imgbb URL (primary display URL)
        r.url,                   // originalUrl = RH result URL for reference
        ext,
        options.prompt ?? '',
        r.nodeId,
        now,
      );
      saved++;
    } catch (err) {
      console.error('[galleryStore] Failed to upload result to imgbb for nodeId=' + r.nodeId + ':', err);
      // Graceful degradation: log and continue if imgbb upload fails
    }
  }

  return saved;
}

/**
 * Serve a gallery item's file.
 *
 * If fileName starts with 'http', it's an imgbb URL — return a redirect structure.
 * Otherwise treat as local path for legacy support.
 */
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

  // imgbb URLs start with 'http'
  if (item.fileName.startsWith('http')) {
    return {
      filePath: item.fileName,  // treated as redirect URL by caller
      fileName: item.fileName,
      mimeType: mimeTypes[ext] || 'image/png',
      isImgbbUrl: true,
    };
  }

  // Legacy local file
  const { path } = require('node:path');
  const { fileURLToPath } = require('node:url');
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

/**
 * Soft-delete a gallery item (marks deletedAt, does NOT remove the file).
 * Returns true if the item existed and was not already deleted.
 */
export function softDeleteGalleryItem(galleryId: number): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE gallery_items SET deletedAt = ? WHERE id = ? AND deletedAt IS NULL
  `).run(new Date().toISOString(), galleryId);
  return result.changes > 0;
}

/**
 * List all active (non-deleted) gallery items in reverse chronological order.
 */
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
