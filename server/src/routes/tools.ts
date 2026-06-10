import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { RhClient } from '../services/rhClient.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { webappId } = req.body;
    if (!webappId || typeof webappId !== 'string' || webappId.trim().length === 0) {
      res.status(400).json({ error: 'Valid webappId is required' });
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('apiKey');
    if (!row) {
      res.status(400).json({ error: 'API key not configured' });
      return;
    }

    const client = new RhClient(row.value as string);
    const schema = await client.fetchSchema(webappId);

    if (!schema.nodeInfoList || !Array.isArray(schema.nodeInfoList)) {
      res.status(400).json({ error: 'Invalid webappId or schema fetch failed' });
      return;
    }

    const now = new Date().toISOString();
    const nodeInfoList = JSON.stringify(schema.nodeInfoList);
    const tags = JSON.stringify(schema.tags ?? []);
    const coverUrl = schema.covers?.[0]?.thumbnailUri || schema.covers?.[0]?.url || '';

    db.run(`
      INSERT INTO tools (webappId, webappName, coverUrl, nodeInfoList, tags, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(webappId) DO UPDATE SET
        webappName = excluded.webappName,
        coverUrl = excluded.coverUrl,
        nodeInfoList = excluded.nodeInfoList,
        tags = excluded.tags,
        updatedAt = excluded.updatedAt
    `, webappId, schema.webappName, coverUrl, nodeInfoList, tags, now, now);

    const tool = db.prepare('SELECT * FROM tools WHERE webappId = ?').get(webappId);
    res.status(201).json({ tool });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `Invalid webappId or schema fetch failed: ${message}` });
  }
});

router.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM tasks WHERE toolId = t.id) as taskCount
    FROM tools t
    ORDER BY t.updatedAt DESC
  `).all();

  res.json({ tools: rows });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM tasks WHERE toolId = t.id) as taskCount
    FROM tools t WHERE t.id = ?
  `).get(Number(req.params.id));

  if (!row) {
    res.status(404).json({ error: 'Tool not found' });
    return;
  }

  res.json(row);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM tools WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) {
    res.status(404).json({ error: 'Tool not found' });
    return;
  }
  res.json({ success: true });
});

export default router;