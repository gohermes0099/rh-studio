import { Router } from 'express';
import { listGalleryItems, getGalleryFileInfo, softDeleteGalleryItem } from '../services/galleryStore.js';
import fs from 'node:fs/promises';

const router = Router();

/**
 * GET /api/gallery — list all active gallery items
 *
 * Images are stored independently of tasks in the gallery_items table.
 * Tasks can be deleted without affecting gallery visibility.
 */
router.get('/', (_req, res) => {
  try {
    const items = listGalleryItems().map((item) => ({
      id: item.id,
      toolId: item.toolId,
      toolName: item.toolName,
      fileName: item.fileName,
      outputType: item.outputType,
      nodeId: item.nodeId,
      createdAt: item.createdAt,
      prompt: item.prompt,
    }));

    res.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gallery/files/:id — serve a gallery item's file
 *
 * Looks up the gallery_items record, detects MIME type, and serves the file.
 * Supports ?dl=1 for download-with-filename.
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

    // Verify file exists on disk
    try {
      await fs.access(info.filePath);
    } catch {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    res.setHeader('Content-Type', info.mimeType);

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
 *
 * Marks deletedAt so it disappears from the gallery but the file
 * remains on disk for potential recovery.
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
