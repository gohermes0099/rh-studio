/**
 * One-time migration: create manifest.json files in any existing download
 * folder that is missing one.
 *
 * Run with: npx tsx server/src/migrations/backfill-manifests.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const db = getDb();
  const projectRoot = path.resolve(__dirname, '../../..');
  const downloadsBase = path.join(projectRoot, 'downloads');

  let entries: string[];
  try {
    entries = await fs.readdir(downloadsBase);
  } catch {
    console.log('No downloads/ directory found — nothing to migrate.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const folderPath = path.join(downloadsBase, entry);
    const manifestPath = path.join(folderPath, 'manifest.json');

    try {
      await fs.access(manifestPath);
      skipped++;
      continue; // Already has manifest
    } catch {
      // No manifest — create one
    }

    // Check if this folder name is an internal DB id
    const dbId = Number(entry);
    if (isNaN(dbId)) {
      console.log(`  Skipping folder "${entry}" — not a numeric id`);
      skipped++;
      continue;
    }

    // Look up task in DB
    const task = db.prepare(`
      SELECT t.*, tl.webappName as toolName
      FROM tasks t
      LEFT JOIN tools tl ON tl.id = t.toolId
      WHERE t.id = ?
    `).get(dbId) as {
      id: number;
      taskId: string;
      toolId: number;
      status: string;
      nodeInfoList: string;
      resultFiles: string;
      createdAt: string;
      completedAt?: string;
      updatedAt: string;
    } | undefined;

    if (!task) {
      console.log(`  Skipping folder "${entry}" — no DB record found`);
      skipped++;
      continue;
    }

    const manifest = {
      id: task.id,
      taskId: task.taskId,
      toolId: task.toolId,
      status: task.status,
      nodeInfoList: task.nodeInfoList,
      resultFiles: task.resultFiles,
      createdAt: task.createdAt,
      completedAt: task.completedAt || task.updatedAt,
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`  Created manifest for task #${task.id} (RH: ${task.taskId}) in folder "${entry}"`);
    created++;
  }

  console.log(`\nDone. Created ${created} manifest(s), skipped ${skipped} folder(s).`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
