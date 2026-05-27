import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search, toolId } = req.query;

    let sql = `SELECT * FROM prompts WHERE 1=1`;
    const params: unknown[] = [];

    if (toolId && typeof toolId === 'string') {
      sql += ' AND (toolId = ? OR toolId IS NULL)';
      params.push(Number(toolId));
    }

    if (search && typeof search === 'string') {
      sql += ' AND (title LIKE ? OR content LIKE ? OR description LIKE ?)';
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    sql += ' ORDER BY updatedAt DESC';

    const rows = db.prepare(sql).all(...params);
    res.json({ prompts: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/', (req, res) => {
  try {
    const { title, content, toolId, description, tags } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO prompts (title, content, toolId, description, tags, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      content.trim(),
      toolId ? Number(toolId) : null,
      description?.trim() ?? '',
      JSON.stringify(tags ?? []),
      now,
      now,
    );

    const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { title, content, toolId, description, tags } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(Number(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE prompts SET title = ?, content = ?, toolId = ?, description = ?, tags = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      title?.trim() ?? (existing as any).title,
      content?.trim() ?? (existing as any).content,
      toolId !== undefined ? Number(toolId) : (existing as any).toolId,
      description?.trim() ?? (existing as any).description ?? '',
      tags ? JSON.stringify(tags) : (existing as any).tags,
      now,
      Number(req.params.id),
    );

    const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(Number(req.params.id));
    res.json({ prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
