import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { RhClient } from '../services/rhClient.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { webappId } = req.body;
    if (!webappId || typeof webappId !== 'string') {
      res.status(400).json({ error: 'webappId is required' });
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('apiKey') as { value: string } | undefined;
    if (!row) {
      res.status(400).json({ error: 'API key not configured' });
      return;
    }

    const client = new RhClient(row.value);
    const schema = await client.fetchSchema(webappId);

    const now = new Date().toISOString();
    const nodeInfoList = JSON.stringify(schema.nodeInfoList);
    const tags = JSON.stringify(schema.tags ?? []);

    db.prepare(`
      INSERT INTO tools (webappId, webappName, nodeInfoList, tags, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(webappId) DO UPDATE SET
        webappName = excluded.webappName,
        nodeInfoList = excluded.nodeInfoList,
        tags = excluded.tags,
        updatedAt = excluded.updatedAt
    `).run(webappId, schema.webappName, nodeInfoList, tags, now, now);

    res.json({ success: true, webappId, webappName: schema.webappName });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM tasks WHERE toolId = t.id) as taskCount
    FROM tools t
    ORDER BY t.updatedAt DESC
  `).all();

  res.json(rows);
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
