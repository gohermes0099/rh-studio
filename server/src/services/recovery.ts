import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Manifest {
  taskId: string;
  toolId: number;
  toolName?: string;
  resultFiles: string; // JSON string of results[] with nodeId, url, outputType
  completedAt: string;
}

/**
 * One-time migration: scan old manifest.json files from per-task folders
 * and import any results that aren't already in gallery_items.
 *
 * Old format: downloads/<id>/manifest.json
 * New format: downloads/<uuid>.ext (flat), tracked in gallery_items table
 */
export async function recoverOrphanedTasks(): Promise<{ recovered: number }> {
  const db = getDb();
  const projectRoot = path.resolve(__dirname, '../../..');
  const downloadsBase = path.join(projectRoot, 'downloads');

  let entries: string[];
  try {
    entries = await fs.readdir(downloadsBase);
  } catch {
    return { recovered: 0 };
  }

  let recovered = 0;

  for (const entry of entries) {
    // Skip flat files — only process subdirectories (old format)
    const manifestPath = path.join(downloadsBase, entry, 'manifest.json');
    let content: string;
    try {
      content = await fs.readFile(manifestPath, 'utf-8');
    } catch {
      continue;
    }

    let manifest: Manifest;
    try {
      manifest = JSON.parse(content);
    } catch {
      continue;
    }

    const results: { nodeId: string; url: string; outputType?: string }[] = JSON.parse(manifest.resultFiles || '[]');
    if (results.length === 0) continue;

    // Copy each result file to the flat directory and create gallery_items record
    const oldDir = path.join(downloadsBase, entry);
    const oldFiles = await fs.readdir(oldDir);
    const toolName = manifest.toolName || `Tool #${manifest.toolId}`;

    for (const r of results) {
      // Find the matching file in the old folder
      const oldFile = oldFiles.find((f) => f.startsWith(r.nodeId) && f !== 'manifest.json');
      if (!oldFile) continue;

      // Generate a flat UUID-based filename
      const ext = oldFile.split('.').pop() || 'bin';
      const uuid = crypto.randomUUID();
      const newFileName = `${uuid}.${ext}`;

      // Copy file to flat directory (don't delete old — backward compat)
      try {
        await fs.copyFile(path.join(oldDir, oldFile), path.join(downloadsBase, newFileName));
      } catch {
        continue;
      }

      // Check if this result is already in gallery_items (by originalUrl)
      const existing = db.prepare('SELECT id FROM gallery_items WHERE originalUrl = ? AND deletedAt IS NULL').get(r.url);
      if (existing) continue;

      // Insert into gallery_items
      db.prepare(`
        INSERT INTO gallery_items (taskId, toolId, toolName, fileName, originalUrl, outputType, nodeId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        manifest.taskId,
        manifest.toolId,
        toolName,
        newFileName,
        r.url,
        ext,
        r.nodeId,
        manifest.completedAt,
      );

      recovered++;
    }
  }

  return { recovered };
}
