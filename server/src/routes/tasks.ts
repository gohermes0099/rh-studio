import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { RhClient } from '../services/rhClient.js';
import { ImgbbService } from '../services/imgbbService.js';
import { saveGalleryResults, extractPrompt } from '../services/galleryStore.js';
import type { RhNodeField } from '../../../shared/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

function getRhClient(): RhClient {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('apiKey') as { value: string } | undefined;
  if (!row) throw new Error('API key not configured');
  return new RhClient(row.value);
}

function getImgbbService(): ImgbbService {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('imgbbApiKey') as { value: string } | undefined;
  if (!row?.value) throw new Error('imgbb API key not configured');
  return new ImgbbService(row.value);
}

router.post('/run', async (req, res) => {
  try {
    const { toolId, nodeInfoList } = req.body;
    if (!toolId) {
      res.status(400).json({ error: 'toolId is required' });
      return;
    }
    if (!nodeInfoList || !Array.isArray(nodeInfoList)) {
      res.status(400).json({ error: 'nodeInfoList is required' });
      return;
    }

    const db = getDb();
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId) as {
      id: number;
      webappId: string;
      nodeInfoList: string;
    } | undefined;

    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    const client = getRhClient();

    // Build nodeInfoList in the format RH expects, preserving fieldData for LIST
    // and description for all nodes (as shown in RH's own curl examples)
    const stripped: RhNodeField[] = nodeInfoList.map((f) => {
      const entry: RhNodeField = {
        nodeId: f.nodeId,
        fieldName: f.fieldName,
        fieldValue: f.fieldValue ?? '',
      };
      if (f.fieldData) entry.fieldData = f.fieldData;
      if (f.description) entry.description = f.description;
      return entry;
    });

    const result = await client.runTask(tool.webappId, stripped, {
      instanceType: 'default',
      usePersonalQueue: false,
    });

    const now = new Date().toISOString();
    const statusMap: Record<string, string> = {
      QUEUED: 'PENDING',
      RUNNING: 'RUNNING',
      SUCCESS: 'COMPLETED',
      FAILED: 'FAILED',
    };
    const status = statusMap[result.status] || 'PENDING';
    db.prepare(`
      INSERT INTO tasks (taskId, toolId, status, nodeInfoList, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(result.taskId, tool.id, status, JSON.stringify(nodeInfoList), now, now);

    const task = db.prepare('SELECT * FROM tasks WHERE taskId = ?').get(result.taskId);
    res.status(201).json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get('/', (req, res) => {
  const db = getDb();
  const { search, status } = req.query;

  let sql = `
    SELECT t.*, tl.webappName as toolName,
      (SELECT COUNT(*) FROM tasks t2 WHERE t2.toolId = t.toolId) as resultCount
    FROM tasks t
    LEFT JOIN tools tl ON tl.id = t.toolId
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status && typeof status === 'string') {
    sql += ' AND t.status = ?';
    params.push(status);
  }

  if (search && typeof search === 'string') {
    sql += ' AND (t.taskId LIKE ? OR tl.webappName LIKE ?)';
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }

  sql += ' ORDER BY t.createdAt DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ tasks: rows });
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare(`
      SELECT t.*, tl.webappName as toolName
      FROM tasks t
      LEFT JOIN tools tl ON tl.id = t.toolId
      WHERE t.id = ?
    `).get(Number(req.params.id)) as {
      id: number;
      taskId: string;
      status: string;
      createdAt: string;
      pollCount: number;
      resultFiles: string;
      errorMessage?: string;
      failedReason?: string;
      toolName?: string;
      nodeInfoList: string;
      toolId: number;
      updatedAt: string;
      completedAt?: string;
      lastPolledAt?: string;
    } | undefined;

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.status === 'PENDING' || task.status === 'RUNNING') {
      try {
        const client = getRhClient();
        const queryResult = await client.queryTask(task.taskId);

        const age = Date.now() - new Date(task.createdAt).getTime();
        const maxAge = 25 * 60 * 60 * 1000;
        const now = new Date().toISOString();
        const updates: Record<string, unknown> = { pollCount: task.pollCount + 1, lastPolledAt: now, updatedAt: now };

        if (age > maxAge) {
          updates.status = 'EXPIRED';
          updates.completedAt = now;
        } else if (queryResult.status === 'SUCCESS') {
          updates.status = 'COMPLETED';
          updates.completedAt = now;
          updates.resultFiles = JSON.stringify(queryResult.results ?? []);

          // Upload results to imgbb and save to gallery
          if (queryResult.results) {
            try {
              const imgbb = getImgbbService();
              const nodeInfoList = JSON.parse(task.nodeInfoList) as RhNodeField[];
              const prompt = extractPrompt(nodeInfoList);
              const saved = await saveGalleryResults({
                results: queryResult.results,
                imgbbService: imgbb,
                taskId: task.taskId,
                toolId: task.toolId,
                toolName: (task as any).toolName || 'Tool #' + task.toolId,
                prompt,
              });
              if (saved > 0) {
                console.log('[tasks] Saved ' + saved + ' result(s) to gallery for task ' + task.taskId);
              }
            } catch (imgbbErr) {
              console.error('[tasks] imgbb upload failed for task ' + task.taskId + ':', imgbbErr);
              // Graceful degradation: don't fail task completion if imgbb upload fails
            }
          }
        } else if (queryResult.status === 'FAILED') {
          updates.status = 'FAILED';
          updates.completedAt = now;
          updates.errorMessage = queryResult.errorMessage ?? null;
          updates.failedReason = queryResult.failedReason ? JSON.stringify(queryResult.failedReason) : null;
        } else {
          const mapped: Record<string, string> = { QUEUED: 'PENDING', RUNNING: 'RUNNING' };
          updates.status = mapped[queryResult.status] || 'PENDING';
        }

        const setClauses = Object.keys(updates).map((k) => k + ' = ?').join(', ');
        const values = Object.values(updates);
        db.prepare('UPDATE tasks SET ' + setClauses + ' WHERE id = ?').run(...values, task.id);
      } catch (pollErr) {
        console.error('Poll error:', pollErr);
      }
    }

    const updated = db.prepare(`
      SELECT t.*, tl.webappName as toolName
      FROM tasks t
      LEFT JOIN tools tl ON tl.id = t.toolId
      WHERE t.id = ?
    `).get(task.id);

    res.json({ task: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);

  // Fetch the task first to get the RH taskId for folder cleanup
  const task = db.prepare('SELECT taskId FROM tasks WHERE id = ?').get(taskId) as { taskId: string } | undefined;

  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Clean up locally cached result files — try both old (internal id) and new (RH taskId) folders
  const projectRoot = path.resolve(__dirname, '../../..');
  const oldDir = path.join(projectRoot, 'downloads', String(taskId));
  try { await fs.rm(oldDir, { recursive: true, force: true }); } catch { /* ok */ }

  if (task) {
    const newDir = path.join(projectRoot, 'downloads', task.taskId);
    try { await fs.rm(newDir, { recursive: true, force: true }); } catch { /* ok */ }
  }

  res.json({ success: true });
});

export default router;
