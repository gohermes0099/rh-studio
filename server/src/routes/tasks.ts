import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { RhClient } from '../services/rhClient.js';
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

router.post('/run', async (req, res) => {
  try {
    const { toolId, uploadedFiles } = req.body;
    if (!toolId) {
      res.status(400).json({ error: 'toolId is required' });
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
    const fields: RhNodeField[] = JSON.parse(tool.nodeInfoList);
    const nodeInfoList = fields.map((f) => {
      if (uploadedFiles?.[f.nodeId]) {
        return { ...f, fieldValue: uploadedFiles[f.nodeId] };
      }
      return f;
    });

    const result = await client.runTask(tool.webappId, nodeInfoList);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (taskId, toolId, status, nodeInfoList, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(result.taskId, tool.id, result.status, JSON.stringify(nodeInfoList), now, now);

    const task = db.prepare('SELECT * FROM tasks WHERE taskId = ?').get(result.taskId);
    res.json(task);
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
  res.json(rows);
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

          const projectRoot = path.resolve(__dirname, '../../..');
          const downloadsDir = path.join(projectRoot, 'downloads', String(task.id));
          await fs.mkdir(downloadsDir, { recursive: true });

          if (queryResult.results) {
            for (const r of queryResult.results) {
              const fileName = `${r.nodeId}_${Date.now()}.${r.outputType === 'IMAGE' ? 'png' : r.outputType === 'AUDIO' ? 'wav' : 'bin'}`;
              const filePath = path.join(downloadsDir, fileName);
              const fileRes = await fetch(r.url);
              if (fileRes.ok) {
                const buffer = Buffer.from(await fileRes.arrayBuffer());
                await fs.writeFile(filePath, buffer);
              }
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

        const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
        const values = Object.values(updates);
        db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`).run(...values, task.id);
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

    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
