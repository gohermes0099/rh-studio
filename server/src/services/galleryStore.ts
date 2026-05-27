import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RhResult {
  nodeId: string;
  url: string;
  outputType?: string;
}

interface SaveOptions {
  /** Array of RH results to download and store */
  results: RhResult[];
  /** Base downloads directory (projectRoot/downloads/) */
  downloadsBase: string;
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
 * Download a single result to the flat downloads directory and return the filename.
 * Uses UUID-based names to avoid collisions in the flat directory.
 */
async function downloadResult(r: RhResult, downloadsBase: string): Promise<{ fileName: string; ext: string } | null> {
  const ext = extFromOutputType(r.outputType);
  const uuid = crypto.randomUUID();
  const fileName = `${uuid}.${ext}`;
  const filePath = path.join(downloadsBase, fileName);

  try {
    const fileRes = await fetch(r.url);
    if (!fileRes.ok) {
      console.error(`[galleryStore] Download failed for ${r.nodeId}: HTTP ${fileRes.status}`);
      return null;
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return { fileName, ext };
  } catch (err) {
    console.error(`[galleryStore] Download error for ${r.nodeId}:`, err);
    return null;
  }
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
 * 1. Downloads each result file to the flat downloads/ directory (UUID-based names)
 * 2. Inserts a record into gallery_items for each downloaded file
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
    const result = await downloadResult(r, options.downloadsBase);
    if (!result) continue;

    insert.run(
      options.taskId ?? null,
      options.toolId,
      options.toolName,
      result.fileName,
      r.url,
      result.ext,
      options.prompt ?? '',
      r.nodeId,
      now,
    );

    saved++;
  }

  return saved;
}

/**
 * Serve a gallery item's file. Returns the absolute path and MIME type, or null.
 */
export function getGalleryFileInfo(galleryId: number): { filePath: string; fileName: string; mimeType: string } | null {
  const db = getDb();
  const item = db.prepare('SELECT fileName, outputType FROM gallery_items WHERE id = ? AND deletedAt IS NULL').get(galleryId) as {
    fileName: string;
    outputType: string;
  } | undefined;

  if (!item) return null;

  const projectRoot = path.resolve(__dirname, '../../..');
  const filePath = path.join(projectRoot, 'downloads', item.fileName);

  const mimeTypes: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  };

  const ext = (item.outputType || item.fileName.split('.').pop() || '').toLowerCase();
  return {
    filePath,
    fileName: item.fileName,
    mimeType: mimeTypes[ext] || 'application/octet-stream',
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
