import { Router } from 'express';
import multer from 'multer';
import { getDb } from '../db/connection.js';
import { RhClient } from '../services/rhClient.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('apiKey') as { value: string } | undefined;
    if (!row) {
      res.status(400).json({ error: 'API key not configured' });
      return;
    }

    const client = new RhClient(row.value);
    const result = await client.uploadFile(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get('/download/:taskId/:nodeId', async (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.taskId)) as {
      id: number;
      resultFiles: string;
    } | undefined;

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const resultFiles: { nodeId: string; url: string }[] = JSON.parse(task.resultFiles);
    const match = resultFiles.find((r) => r.nodeId === req.params.nodeId);

    if (!match) {
      res.status(404).json({ error: 'Result file not found' });
      return;
    }

    const projectRoot = path.resolve(__dirname, '../../..');
    const downloadsDir = path.join(projectRoot, 'downloads', String(task.id));

    const files = await fs.readdir(downloadsDir);
    const localFile = files.find((f) => f.startsWith(req.params.nodeId));

    if (localFile) {
      res.sendFile(path.join(downloadsDir, localFile));
    } else {
      res.redirect(match.url);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
