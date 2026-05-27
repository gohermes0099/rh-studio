import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { RhClient } from '../services/rhClient.js';

const router = Router();

router.post('/key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ error: 'apiKey is required' });
      return;
    }

    const client = new RhClient(apiKey);
    await client.fetchSchema('1');

    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('apiKey', apiKey);

    res.json({ keyIsSet: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `Invalid API key: ${message}` });
  }
});

router.get('/key/status', (_req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('apiKey') as { value: string } | undefined;
  res.json({ keyIsSet: !!row });
});

export default router;
