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
  resultFiles: string;
  completedAt: string;
}

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

    const oldDir = path.join(downloadsBase, entry);
    const oldFiles = await fs.readdir(oldDir);
    const toolName = manifest.toolName || `Tool #${manifest.toolId}`;

    for (const r of results) {
      const oldFile = oldFiles.find((f) => f.startsWith(r.nodeId) && f !== 'manifest.json');
      if (!oldFile) continue;

      const ext = oldFile.split('.').pop() || 'bin';
      const uuid = crypto.randomUUID();
      const newFileName = `${uuid}.${ext}`;

      try {
        await fs.copyFile(path.join(oldDir, oldFile), path.join(downloadsBase, newFileName));
      } catch {
        continue;
      }

      const existing = db.prepare('SELECT id FROM gallery_items WHERE originalUrl = ? AND deletedAt IS NULL').get(r.url);
      if (existing) continue;

      db.run(`
        INSERT INTO gallery_items (taskId, toolId, toolName, fileName, originalUrl, outputType, nodeId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
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