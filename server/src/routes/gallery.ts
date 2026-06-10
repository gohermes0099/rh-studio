import { Router } from 'express';
import { listGalleryItems, getGalleryFileInfo, softDeleteGalleryItem } from '../services/galleryStore.js';
import fs from 'node:fs/promises';

const router = Router();

/**
 * GET /api/gallery — list all active gallery items
 */
router.get('/', (_req, res) => {
  try {
    const items = listGalleryItems().map((item) => ({
      id: item.id,
      taskId: item.taskId,
      toolId: item.toolId,
      toolName: item.toolName,
      fileName: item.fileName,
      outputType: item.outputType,
      nodeId: item.nodeId,
      createdAt: item.createdAt,
      prompt: item.prompt,
      sourceUploadUrl: item.sourceUploadUrl,
      sourceUploadId: item.sourceUploadId,
    }));

    res.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gallery/files/:id — serve a gallery item's file
 * - imgbb URLs: public redirect (CDN URLs are inherently public)
 * - Local files: require auth (Bearer header OR ?token=)
 */
router.get('/files/:id', async (req, res) => {
  try {
    const galleryId = Number(req.params.id);
    if (isNaN(galleryId)) {
      res.status(400).json({ error: 'Invalid gallery item ID' });
      return;
    }

    const info = getGalleryFileInfo(galleryId);
    if (!info) {
      res.status(404).json({ error: 'Gallery item not found' });
      return;
    }

    // imgbb URL — public redirect
    if (info.isImgbbUrl) {
      res.redirect(302, info.filePath);
      return;
    }

    // Local file — require auth via Authorization header or ?token=
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.substring(7)
      : undefined;
    const token = queryToken || headerToken;
    const session = token ? (global as any).__sessions?.get(token) : null;
    if (!session || session.expiresAt < Date.now()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      await fs.access(info.filePath);
    } catch {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    res.setHeader('Content-Type', info.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');

    const isDownload = req.query.dl === '1';
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${info.fileName}"`);
    }

    res.sendFile(info.filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/gallery/:id — soft-delete a gallery item
 */
router.delete('/:id', (req, res) => {
  try {
    const galleryId = Number(req.params.id);
    if (isNaN(galleryId)) {
      res.status(400).json({ error: 'Invalid gallery item ID' });
      return;
    }

    const deleted = softDeleteGalleryItem(galleryId);
    if (!deleted) {
      res.status(404).json({ error: 'Gallery item not found or already deleted' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;