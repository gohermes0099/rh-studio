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
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'apiKey', apiKey);

    res.json({ keyIsSet: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `Invalid API key: ${message}` });
  }
});

router.get('/key/status', (_req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('apiKey');
  res.json({ keyIsSet: !!row });
});

router.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key as string] = row.value as string;
  }
  
  // Don't expose actual API key
  if (settings.apiKey) {
    settings.apiKey = '***';
  }
  
  res.json(settings);
});

router.post('/', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    res.status(400).json({ error: 'key and value are required' });
    return;
  }

  const db = getDb();
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, String(value));
  res.json({ success: true });
});

export default router;