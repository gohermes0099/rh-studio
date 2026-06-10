import { Router } from 'express';
import multer from 'multer';
import { getDb } from '../db/connection.js';
import { RhClient } from '../services/rhClient.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/', (req, res, next) => {
  const isJson = req.headers['content-type'] === 'application/json';
  if (isJson) {
    return next();
  }
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large. Maximum is 50MB.' });
      return;
    }
    if (err) {
      res.status(400).json({ error: 'Upload error: ' + err.message });
      return;
    }
    next();
  });
}, async (req, res) => {
  const isJson = req.headers['content-type'] === 'application/json';

  try {
    if (isJson) {
      const { imgbbUrl, imgbbThumbnailUrl, originalName, mimeType, fileSize } = req.body;
      if (!imgbbUrl || !originalName) {
        res.status(400).json({ error: 'imgbbUrl and originalName are required' });
        return;
      }

      const db = getDb();
      const now = new Date().toISOString();
      const saveToGallery = req.query.saveToGallery !== 'false';

      if (saveToGallery) {
        const result = db.run(`
          INSERT INTO uploads (fileName, originalName, mimeType, fileSize, imgbbUrl, imgbbThumbnailUrl, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, imgbbUrl, originalName, mimeType || 'image/jpeg', fileSize || 0, imgbbUrl, imgbbThumbnailUrl || imgbbUrl, now);

        res.json({ id: result.lastInsertRowid, fileName: originalName, imgbbUrl, imgbbThumbnailUrl: imgbbThumbnailUrl || imgbbUrl });
      } else {
        res.json({ fileName: originalName, imgbbUrl, imgbbThumbnailUrl: imgbbThumbnailUrl || imgbbUrl });
      }
      return;
    }

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

    const saveToGallery = req.query.saveToGallery !== 'false';
    if (saveToGallery) {
      const now = new Date().toISOString();
      db.run(`
        INSERT INTO uploads (fileName, rhFileName, originalName, mimeType, fileSize, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, result.fileName, result.fileName, req.file.originalname, req.file.mimetype, req.file.size, now);
    }

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

function extToMime(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function resolveDownloadsDir(projectRoot: string, param: string): Promise<string | null> {
  const candidates: string[] = [param];
  const db = getDb();

  const numeric = Number(param);
  if (!isNaN(numeric)) {
    const numericStr = String(numeric);
    if (numericStr !== param) candidates.push(numericStr);

    const byId = db.prepare('SELECT taskId FROM tasks WHERE id = ?').get(numeric) as { taskId: string } | undefined;
    if (byId && byId.taskId !== param && byId.taskId !== numericStr) {
      candidates.push(byId.taskId);
    }
  }

  const byTaskId = db.prepare('SELECT id FROM tasks WHERE taskId = ?').get(param) as { id: number } | undefined;
  if (byTaskId) {
    const idStr = String(byTaskId.id);
    if (idStr !== param) candidates.push(idStr);
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const dir = path.join(projectRoot, 'downloads', candidate);
    try {
      await fs.access(dir);
      return dir;
    } catch { continue; }
  }
  return null;
}

async function findOriginalUrl(projectRoot: string, param: string, nodeId: string): Promise<string | null> {
  const db = getDb();
  const numeric = Number(param);

  if (!isNaN(numeric)) {
    const task = db.prepare('SELECT resultFiles FROM tasks WHERE id = ?').get(numeric) as { resultFiles: string } | undefined;
    if (task?.resultFiles) {
      try {
        const results: { nodeId: string; url: string }[] = JSON.parse(task.resultFiles);
        const match = results.find((r) => r.nodeId === nodeId);
        if (match?.url) return match.url;
      } catch { /* ignore */ }
    }
  }

  const dir = await resolveDownloadsDir(projectRoot, param);
  if (!dir) return null;
  try {
    const content = await fs.readFile(path.join(dir, 'manifest.json'), 'utf-8');
    const manifest = JSON.parse(content);
    if (manifest.resultFiles) {
      const results: { nodeId: string; url: string }[] = JSON.parse(manifest.resultFiles);
      const match = results.find((r) => r.nodeId === nodeId);
      if (match?.url) return match.url;
    }
  } catch { /* ignore */ }

  return null;
}

router.get('/:taskId/:nodeId', async (req, res) => {
  try {
    const { taskId, nodeId } = req.params;

    if (taskId.includes('..') || nodeId.includes('..') || taskId.includes('/') || nodeId.includes('/')) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }

    const projectRoot = path.resolve(__dirname, '../../..');
    const downloadsDir = await resolveDownloadsDir(projectRoot, taskId);

    if (!downloadsDir) {
      res.status(404).json({ error: 'Task files not found' });
      return;
    }

    const files = await fs.readdir(downloadsDir);
    const localFile = files.find((f: string) => f.startsWith(nodeId) && f !== 'manifest.json');

    if (localFile) {
      const ext = localFile.split('.').pop()?.toLowerCase() || '';
      let contentType = extToMime(ext);

      if (ext === 'bin' || contentType === 'application/octet-stream') {
        try {
          const fd = await fs.open(path.join(downloadsDir, localFile));
          const header = Buffer.alloc(16);
          await fd.read(header, 0, 16, 0);
          await fd.close();

          if (header[0] === 0xFF && header[1] === 0xD8) contentType = 'image/jpeg';
          else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) contentType = 'image/png';
          else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) contentType = 'image/gif';
          else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) contentType = 'image/webp';
        } catch { /* keep current contentType */ }
      }

      res.setHeader('Content-Type', contentType);

      const isDownload = req.query.dl === '1';
      if (isDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${localFile}"`);
      }

      res.sendFile(path.join(downloadsDir, localFile));
    } else {
      const isDownload = req.query.dl === '1';
      const originalUrl = await findOriginalUrl(projectRoot, taskId, nodeId);

      if (isDownload && originalUrl) {
        try {
          const fileRes = await fetch(originalUrl);
          if (fileRes.ok) {
            const buffer = Buffer.from(await fileRes.arrayBuffer());
            const ext = originalUrl.split('.').pop()?.split('?')[0] || 'bin';
            res.setHeader('Content-Type', fileRes.headers.get('content-type') || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="result-${nodeId}.${ext}"`);
            res.send(buffer);
            return;
          }
        } catch { /* fall through to redirect */ }
      }

      if (originalUrl) {
        res.redirect(originalUrl);
      } else {
        res.status(404).json({ error: 'Result file not found locally or remotely' });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;