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

/**
 * Unified POST /upload handler supporting two flows:
 *
 * 1. RH binary upload (multipart/form-data):
 *    - Client POSTs multipart with 'file' field
 *    - Server forwards binary to RunningHub API
 *    - Saves metadata to uploads table
 *
 * 2. Direct imgbb metadata (application/json):
 *    - Client uploaded directly to imgbb from browser
 *    - Client POSTs { imgbbUrl, imgbbThumbnailUrl, originalName, mimeType, fileSize }
 *    - Server saves metadata to uploads table only
 */
router.post('/', (req, res, next) => {
  const isJson = req.headers['content-type'] === 'application/json';
  if (isJson) {
    // JSON body — parse and handle metadata-only flow
    return next();
  }
  // Multipart — use multer
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
    // --- Direct imgbb metadata flow ---
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
        const result = db.prepare(`
          INSERT INTO uploads (fileName, originalName, mimeType, fileSize, imgbbUrl, imgbbThumbnailUrl, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(imgbbUrl, originalName, mimeType || 'image/jpeg', fileSize || 0, imgbbUrl, imgbbThumbnailUrl || imgbbUrl, now);

        res.json({ id: result.lastInsertRowid, fileName: originalName, imgbbUrl, imgbbThumbnailUrl: imgbbThumbnailUrl || imgbbUrl });
      } else {
        res.json({ fileName: originalName, imgbbUrl, imgbbThumbnailUrl: imgbbThumbnailUrl || imgbbUrl });
      }
      return;
    }

    // --- RH binary upload flow ---
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

    // Upload to RH (binary — this is what RH needs)
    const client = new RhClient(row.value);
    const result = await client.uploadFile(req.file.buffer, req.file.originalname);

    // Persist to uploads table (skipped when saveToGallery=false)
    const saveToGallery = req.query.saveToGallery !== 'false';
    if (saveToGallery) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO uploads (fileName, rhFileName, originalName, mimeType, fileSize, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(result.fileName, result.fileName, req.file.originalname, req.file.mimetype, req.file.size, now);
    }

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** Shared MIME map used by the download endpoint */
function extToMime(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Resolve the downloads directory for a task.
 *
 * The download URL can receive either the RH taskId (new format, e.g.
 * "2059528871363170306") or the internal DB id (old format, e.g. "8").
 * We try multiple strategies in order:
 *
 *   1. Exact param as folder name
 *   2. Numeric conversion of param (covers old numeric internal-id folders)
 *   3. DB lookup: param → RH taskId, then try that folder
 *   4. DB lookup: param → internal id, then try that folder
 */
async function resolveDownloadsDir(projectRoot: string, param: string): Promise<string | null> {
  const candidates: string[] = [param];
  const { getDb } = await import('../db/connection.js');
  const db = getDb();

  // Numeric conversion fallback
  const numeric = Number(param);
  if (!isNaN(numeric)) {
    const numericStr = String(numeric);
    if (numericStr !== param) candidates.push(numericStr);

    // Lookup by internal ID → try RH taskId folder
    const byId = db.prepare('SELECT taskId FROM tasks WHERE id = ?').get(numeric) as { taskId: string } | undefined;
    if (byId && byId.taskId !== param && byId.taskId !== numericStr) {
      candidates.push(byId.taskId);
    }
  }

  // Lookup by RH taskId → try internal ID folder
  const byTaskId = db.prepare('SELECT id FROM tasks WHERE taskId = ?').get(param) as { id: number } | undefined;
  if (byTaskId) {
    const idStr = String(byTaskId.id);
    if (idStr !== param) candidates.push(idStr);
  }

  // Try each candidate
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

/** Read the original URL for a result node, from DB or manifest.json fallback */
async function findOriginalUrl(projectRoot: string, param: string, nodeId: string): Promise<string | null> {
  // Try DB first
  const { getDb } = await import('../db/connection.js');
  const db = getDb();
  const numeric = Number(param);

  if (!isNaN(numeric)) {
    const task = db.prepare('SELECT resultFiles FROM tasks WHERE id = ?').get(numeric) as { resultFiles: string } | undefined;
    if (task?.resultFiles) {
      try {
        const results: { nodeId: string; url: string }[] = JSON.parse(task.resultFiles);
        const match = results.find((r) => r.nodeId === nodeId);
        if (match?.url) return match.url;
      } catch { /* ignore parse errors */ }
    }
  }

  // Fall back to manifest.json
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

    // Path traversal protection
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

      // For .bin files (saved before the extension bug was fixed),
      // detect real type from file magic bytes
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
          else if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70 && header[8] === 0x61 && header[9] === 0x76 && header[10] === 0x69 && header[11] === 0x66) contentType = 'video/avi';
          else if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) contentType = 'video/mp4';
          else if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) contentType = 'video/webm';
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
