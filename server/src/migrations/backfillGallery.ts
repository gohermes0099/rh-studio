// One-time backfill: update existing gallery_items with extracted prompt and source URL
import { getDb } from '../db/connection.js';
import { extractPrompt } from '../services/galleryStore.js';

export async function backfillGallery(): Promise<{ promptsUpdated: number; sourcesUpdated: number }> {
  const db = getDb();

  // Get all gallery items that are missing prompt
  const items = db.prepare(`
    SELECT id, taskId, toolId, prompt, sourceUploadUrl
    FROM gallery_items
  `).all() as Array<{ id: number; taskId: string; toolId: number; prompt: string; sourceUploadUrl: string }>;

  let promptsUpdated = 0;
  let sourcesUpdated = 0;

  for (const item of items) {
    // Backfill prompt from task's nodeInfoList
    if (!item.prompt && item.taskId) {
      const task = db.prepare('SELECT nodeInfoList FROM tasks WHERE taskId = ?').get(item.taskId) as { nodeInfoList: string } | undefined;
      if (task?.nodeInfoList) {
        try {
          const fields = JSON.parse(task.nodeInfoList) as { fieldName: string; fieldValue: string; description?: string; fieldType?: string }[];
          const prompt = extractPrompt(fields);
          if (prompt) {
            db.run('UPDATE gallery_items SET prompt = ? WHERE id = ?', prompt, item.id);
            promptsUpdated++;
            console.log(`[backfill] Updated prompt for gallery ${item.id}: "${prompt.substring(0, 50)}..."`);
          }
        } catch (e) {
          console.error(`[backfill] Failed to extract prompt for ${item.id}:`, e);
        }
      }
    }

    // Backfill sourceUploadUrl from task's nodeInfoList → uploads table
    if (!item.sourceUploadUrl && item.taskId) {
      const task = db.prepare('SELECT nodeInfoList FROM tasks WHERE taskId = ?').get(item.taskId) as { nodeInfoList: string } | undefined;
      if (task?.nodeInfoList) {
        try {
          const fields = JSON.parse(task.nodeInfoList) as { fieldValue?: string; fieldType?: string }[];
          const imageField = fields.find(f =>
            f.fieldType === 'IMAGE' && f.fieldValue && f.fieldValue.length > 0
          );
          if (imageField) {
            const sourceFileName = imageField.fieldValue!;
            let upload = db.prepare(
              'SELECT id, imgbbUrl FROM uploads WHERE fileName = ? OR rhFileName = ?'
            ).get(sourceFileName, sourceFileName) as { id: number; imgbbUrl: string } | undefined;

            if (!upload && sourceFileName.startsWith('http')) {
              upload = db.prepare(
                'SELECT id, imgbbUrl FROM uploads WHERE fileName = ? OR imgbbUrl = ?'
              ).get(sourceFileName, sourceFileName) as { id: number; imgbbUrl: string } | undefined;
            }

            if (upload?.imgbbUrl) {
              db.run('UPDATE gallery_items SET sourceUploadUrl = ?, sourceUploadId = ? WHERE id = ?', upload.imgbbUrl, upload.id, item.id);
              sourcesUpdated++;
              console.log(`[backfill] Updated source for gallery ${item.id}: ${upload.imgbbUrl.substring(0, 60)}`);
            }
          }
        } catch (e) {
          console.error(`[backfill] Failed to extract source for ${item.id}:`, e);
        }
      }
    }
  }

  return { promptsUpdated, sourcesUpdated };
}