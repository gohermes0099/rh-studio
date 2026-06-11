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
    const upload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(Number(req.params.id)) as Record<string, unknown> | undefined;

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    if (upload.imgbbUrl && (upload.imgbbUrl as string).startsWith('http')) {
      const isDownload = req.query.dl === '1';
      const imgbbUrl = upload.imgbbUrl as string;

      if (isDownload) {
        // For downloads, proxy imgbb server-side so we can set a clean
        // Content-Disposition filename. Otherwise the browser would follow
        // a 302 to the imgbb URL and either render the image inline or open
        // it in a new tab, depending on Content-Disposition at the CDN.
        try {
          const imgRes = await fetch(imgbbUrl, { signal: (req as any).signal });
          if (!imgRes.ok) {
            res.status(502).json({ error: `Upstream image fetch failed: ${imgRes.status}` });
            return;
          }
          const contentType = imgRes.headers.get('content-type') || (upload.mimeType as string) || 'application/octet-stream';
          const contentLength = imgRes.headers.get('content-length');
          res.setHeader('Content-Type', contentType);
          if (contentLength) res.setHeader('Content-Length', contentLength);
          res.setHeader('Content-Disposition', `attachment; filename="${upload.originalName}"`);
          res.setHeader('Cache-Control', 'private, max-age=3600');
          const ab = await imgRes.arrayBuffer();
          res.send(Buffer.from(ab));
        } catch (e: any) {
          if (e.name === 'AbortError') return;
          res.status(502).json({ error: `Failed to proxy image: ${e.message}` });
        }
        return;
      }

      // For inline viewing, redirect to the imgbb URL — it's a public CDN and
      // the redirect is faster than proxying the bytes.
      res.redirect(302, imgbbUrl);
      return;
    }

    const filePath = path.join(uploadsDir, upload.fileName as string);

    if (filePath.indexOf(uploadsDir) !== 0) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }

    const isDownload = req.query.dl === '1';
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${upload.originalName}"`);
    }

    res.setHeader('Content-Type', (upload.mimeType as string) || 'application/octet-stream');
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
    const upload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(uploadId) as { fileName: string } | undefined;

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    db.prepare('DELETE FROM uploads WHERE id = ?').run(uploadId);

    const filePath = path.join(uploadsDir, upload.fileName);
    await fs.rm(filePath, { force: true });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;