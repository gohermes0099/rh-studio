import { Router } from 'express';
import { getDb } from '../db/connection.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const projectRoot = path.resolve(__dirname, '../../..');
const uploadsDir = path.join(projectRoot, 'uploads');

router.get('/', (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, fileName, rhFileName, originalName, mimeType, fileSize, createdAt, imgbbUrl, imgbbThumbnailUrl
      FROM uploads
      ORDER BY createdAt DESC
    `).all();

    res.json({ uploads: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get('/:id/file', async (req, res) => {
  try {
    const db = getDb();
    const upload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(Number(req.params.id)) as {
      id: number;
      fileName: string;
      rhFileName: string;
      originalName: string;
      mimeType: string;
      fileSize: number;
      createdAt: string;
      imgbbUrl: string;
      imgbbThumbnailUrl: string;
    } | undefined;

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    // If imgbb URL exists, redirect to it
    if (upload.imgbbUrl && upload.imgbbUrl.startsWith('http')) {
      res.redirect(302, upload.imgbbUrl);
      return;
    }

    // Fallback: serve legacy local file
    const filePath = path.join(uploadsDir, upload.fileName);

    // Path traversal protection
    if (filePath.indexOf(uploadsDir) !== 0) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }

    const isDownload = req.query.dl === '1';
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${upload.originalName}"`);
    }

    res.setHeader('Content-Type', upload.mimeType || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const uploadId = Number(req.params.id);
    const upload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(uploadId) as {
      id: number;
      fileName: string;
    } | undefined;

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    db.prepare('DELETE FROM uploads WHERE id = ?').run(uploadId);

    // Delete file from disk
    const filePath = path.join(uploadsDir, upload.fileName);
    await fs.rm(filePath, { force: true });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
