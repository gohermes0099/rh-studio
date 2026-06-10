import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';
import { getActiveProvider, getConfiguredProviders, getProvider, getAllProviders, type ImageRef, type EnhanceResult } from '../services/aiClient.js';

const router = Router();

/** Default system prompt for prompt enhancement. Optimized for image-editing webapps. */
const DEFAULT_SYSTEM_PROMPT = `You are a prompt-rewriting specialist for an image-editing app.

Your job: take the user's short, often-imperfect instruction and rewrite it into a precise, vivid, structured prompt that will produce the best possible result with the chosen AI image-editing workflow.

CRITICAL RULES:
- You will receive one or more images as context. Use them to understand the subject, lighting, and composition.
- You MUST NOT invent text, numbers, objects, or people that are not in the image and not in the user's intent.
- If the user's intent is ambiguous, do not guess — set "confidence" to "low" and explain in "rationale".
- Use the user's language for "rationale". The "enhanced_prompt" should be in English unless the user wrote in another language AND the target model handles it well.
- Match the prompt structure to the workflow type (relight → lighting terms, restyle → art-style keywords, upscale → sharpness, etc.).

You MUST return a single JSON object with exactly this shape:
{
  "enhanced_prompt": "string, 60-200 words, English, vivid, comma-separated keywords, optimized for the target workflow",
  "negative_prompt": "string, comma-separated terms to AVOID (e.g. 'harsh shadows, overexposed, blurry, deformed')",
  "rationale": "string, 1-2 sentences in the user's language explaining what you changed and why",
  "confidence": "low | medium | high",
  "changes": ["string", "string", ...]   // 3-5 short chips describing categories of change, e.g. "Added: lighting direction", "Added: lens 85mm", "Refined: mood"
}

Return ONLY the JSON. No markdown fences, no commentary, no preamble.`;

/** Built-in system prompt templates (id is reserved range < 1000). */
const BUILTIN_TEMPLATES: Array<{ name: string; content: string; category: string; description: string }> = [
  {
    name: 'Default Enhancer',
    category: 'general',
    description: 'General-purpose prompt enhancer. Works for any image-editing workflow.',
    content: DEFAULT_SYSTEM_PROMPT,
  },
  {
    name: 'Relight Specialist',
    category: 'relight',
    description: 'Focused on lighting — direction, color temperature, mood, time of day.',
    content: `You are a lighting specialist. Rewrite the user's instruction into a precise prompt that controls how light interacts with the subject.

Focus on:
- Key light direction (camera-left at 45°, overhead, behind, etc.)
- Color temperature (warm 3200K, cool 5600K, golden hour, blue hour)
- Light quality (soft, hard, diffused, specular)
- Fill ratio (1:1, 1:2, 1:4)
- Catchlights, rim light, hair light
- Mood (cinematic, natural, dramatic, soft, ethereal)

Return JSON only with: enhanced_prompt, negative_prompt (overexposed, underexposed, flat, harsh shadows), rationale, confidence, changes[].`,
  },
  {
    name: 'Restyle Artist',
    category: 'restyle',
    description: 'Transforms the image into a different artistic style while keeping the subject.',
    content: `You are an art director. Rewrite the user's instruction into a style-focused prompt.

Lead with the medium and style (oil painting, watercolor, anime, cyberpunk, vintage film, etc.).
Keep the original subject recognizable but transformed.
Include style-specific tags: brush stroke quality, color palette, era, cultural references, famous-artist homages.

Return JSON only with: enhanced_prompt, negative_prompt (photo-realistic unless requested, modern elements, anachronistic details), rationale, confidence, changes[].`,
  },
  {
    name: 'Upscale & Detail',
    category: 'upscale',
    description: 'Optimized for high-resolution enhancement, sharpening, and detail recovery.',
    content: `You are a detail-recovery specialist. Rewrite the user's instruction to maximize perceived sharpness and detail.

Emphasize: skin pores, fabric weave, hair strands, micro-textures, edge crispness, depth of field, 8K ultra-detail, tack-sharp focus.

Return JSON only with: enhanced_prompt, negative_prompt (blurry, soft, painterly, low detail, motion blur, jpeg artifacts), rationale, confidence, changes[].`,
  },
];

/** Get active system prompt — built-in or user-saved */
function getActiveSystemPrompt(): { id: number | null; name: string; content: string } {
  const db = getDb();
  const activeId = (db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_active_system_prompt_id') as { value: string } | undefined)?.value;
  if (activeId) {
    const id = Number(activeId);
    if (id < 1000) {
      const idx = BUILTIN_TEMPLATES.findIndex((_, i) => i + 1 === id);
      if (idx >= 0) return { id, name: BUILTIN_TEMPLATES[idx].name, content: BUILTIN_TEMPLATES[idx].content };
    } else {
      const row = db.prepare('SELECT id, name, content FROM system_prompts WHERE id = ?').get(id) as { id: number; name: string; content: string } | undefined;
      if (row) return row;
    }
  }
  return { id: 1, name: BUILTIN_TEMPLATES[0].name, content: BUILTIN_TEMPLATES[0].content };
}

// ───────────────────────── AI Config endpoints ─────────────────────────

router.get('/config', (_req, res) => {
  try {
    const db = getDb();
    const activeProvider = (db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_active_provider') as { value: string } | undefined)?.value || null;
    const activeSystemPromptId = (db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_active_system_prompt_id') as { value: string } | undefined)?.value || '1';

    const providers = getConfiguredProviders().map(p => ({
      id: p.provider.id,
      displayName: p.provider.displayName,
      defaultModel: p.provider.defaultModel,
      availableModels: p.provider.availableModels,
      hasKey: p.hasKey,
      selectedModel: p.model,
    }));

    res.json({
      activeProvider,
      activeSystemPromptId,
      providers,
      hasActiveConfig: providers.some(p => p.id === activeProvider && p.hasKey),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/config/active-provider', (req, res) => {
  try {
    const { providerId } = req.body;
    if (!providerId) { res.status(400).json({ error: 'providerId required' }); return; }
    if (!getAllProviders().some(p => p.id === providerId)) {
      res.status(400).json({ error: 'Unknown provider' });
      return;
    }
    const db = getDb();
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'ai_active_provider', providerId);
    res.json({ success: true, activeProvider: providerId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/config/api-key', async (req, res) => {
  try {
    const { providerId, apiKey } = req.body;
    if (!providerId || !apiKey) { res.status(400).json({ error: 'providerId and apiKey required' }); return; }
    if (!getAllProviders().some(p => p.id === providerId)) {
      res.status(400).json({ error: 'Unknown provider' });
      return;
    }
    const db = getDb();
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', `ai_key_${providerId}`, apiKey.trim());
    res.json({ success: true, providerId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/config/api-key/:providerId', (req, res) => {
  try {
    const { providerId } = req.params;
    const db = getDb();
    db.run('DELETE FROM settings WHERE key = ?', `ai_key_${providerId}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/config/model', (req, res) => {
  try {
    const { providerId, model } = req.body;
    if (!providerId || !model) { res.status(400).json({ error: 'providerId and model required' }); return; }
    const db = getDb();
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', `ai_model_${providerId}`, model);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/config/test', async (req, res) => {
  try {
    const { providerId } = req.body;
    const provider = getAllProviders().find(p => p.id === providerId);
    if (!provider) { res.status(400).json({ error: 'Unknown provider' }); return; }
    const db = getDb();
    const key = (db.prepare('SELECT value FROM settings WHERE key = ?').get(`ai_key_${providerId}`) as { value: string } | undefined)?.value;
    if (!key) { res.status(400).json({ error: 'No API key configured for this provider' }); return; }
    const model = (db.prepare('SELECT value FROM settings WHERE key = ?').get(`ai_model_${providerId}`) as { value: string } | undefined)?.value || provider.defaultModel;
    const result = await provider.testConnection(key, model);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────── System Prompts ─────────────────────────

router.get('/system-prompts', (_req, res) => {
  try {
    const db = getDb();
    const userPrompts = db.prepare('SELECT id, name, content, category, description, isBuiltin, createdAt, updatedAt FROM system_prompts ORDER BY updatedAt DESC').all();
    const builtins = BUILTIN_TEMPLATES.map((t, i) => ({
      id: i + 1,  // 1..N
      name: t.name,
      content: t.content,
      category: t.category,
      description: t.description,
      isBuiltin: 1,
      createdAt: '',
      updatedAt: '',
    }));
    res.json({ systemPrompts: [...builtins, ...userPrompts] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/system-prompts', (req, res) => {
  try {
    const { name, content, category, description } = req.body;
    if (!name || !content) { res.status(400).json({ error: 'name and content required' }); return; }
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.run(
      'INSERT INTO system_prompts (name, content, category, description, isBuiltin, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)',
      name.trim(), content, category || 'general', description || '', now, now
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/system-prompts/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id < 1000) { res.status(400).json({ error: 'Cannot edit built-in system prompts' }); return; }
    const { name, content, category, description } = req.body;
    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      'UPDATE system_prompts SET name = COALESCE(?, name), content = COALESCE(?, content), category = COALESCE(?, category), description = COALESCE(?, description), updatedAt = ? WHERE id = ?',
      name, content, category, description, now, id
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/system-prompts/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id < 1000) { res.status(400).json({ error: 'Cannot delete built-in system prompts' }); return; }
    const db = getDb();
    db.run('DELETE FROM system_prompts WHERE id = ?', id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/config/active-system-prompt', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    const db = getDb();
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'ai_active_system_prompt_id', String(id));
    res.json({ success: true, activeSystemPromptId: String(id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────── Enhance endpoint ─────────────────────────

/** Simple in-memory rate limit per user (IP) — 30 req/min */
const enhanceBuckets = new Map<string, { ts: number }[]>();
const ENHANCE_WINDOW = 60_000;
const ENHANCE_MAX = 30;
function checkRateLimit(ip: string): { ok: boolean; left: number } {
  const now = Date.now();
  const arr = (enhanceBuckets.get(ip) || []).filter(a => now - a.ts < ENHANCE_WINDOW);
  if (arr.length >= ENHANCE_MAX) return { ok: false, left: 0 };
  arr.push({ ts: now });
  enhanceBuckets.set(ip, arr);
  return { ok: true, left: ENHANCE_MAX - arr.length };
}

router.post('/', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const rl = checkRateLimit(ip);
    if (!rl.ok) {
      res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.', retryAfter: 60 });
      return;
    }

    const { text, fieldName, toolId, toolName, imageUrls, imageBase64, imageMimeType, systemPromptId } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const active = getActiveProvider();
    if (!active) {
      res.status(400).json({ error: 'No active AI provider configured. Go to Settings to add an API key and pick a provider.' });
      return;
    }

    // Determine system prompt
    let sysPrompt = getActiveSystemPrompt();
    if (systemPromptId) {
      const id = Number(systemPromptId);
      if (id < 1000) {
        const idx = BUILTIN_TEMPLATES.findIndex((_, i) => i + 1 === id);
        if (idx >= 0) sysPrompt = { id, name: BUILTIN_TEMPLATES[idx].name, content: BUILTIN_TEMPLATES[idx].content };
      } else {
        const db = getDb();
        const row = db.prepare('SELECT id, name, content FROM system_prompts WHERE id = ?').get(id) as { id: number; name: string; content: string } | undefined;
        if (row) sysPrompt = row;
      }
    }

    // Build image refs
    const images: ImageRef[] = [];
    if (Array.isArray(imageUrls)) {
      for (const url of imageUrls) {
        if (typeof url === 'string' && url.length) images.push({ url });
      }
    }
    if (imageBase64) {
      images.push({ base64: imageBase64, mimeType: imageMimeType || 'image/jpeg' });
    }

    // Augment the system prompt with webapp context
    const contextNote = toolName ? `\n\nTarget workflow: ${toolName}${fieldName ? ` (input field: ${fieldName})` : ''}.` : '';
    const fullSystem = sysPrompt.content + contextNote;

    // User message
    const userMessage = images.length
      ? `${text}\n\n(See attached image${images.length > 1 ? 's' : ''} for context.)`
      : text;

    const result: EnhanceResult = await active.provider.enhance({
      system: fullSystem,
      user: userMessage,
      images,
      jsonMode: true,
      signal: (req as any).signal,
    }, active.model, active.apiKey);

    // Log the enhancement
    const db = getDb();
    const imageHashes = JSON.stringify(images.map((_, i) => `img-${i}-${crypto.createHash('md5').update(`${i}-${text.length}-${Date.now()}`).digest('hex').slice(0, 8)}`));
    db.run(
      `INSERT INTO prompt_enhancements
       (originalText, enhancedText, rationale, confidence, provider, model, systemPromptId, imageHashes, userContext, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      text.trim(),
      result.enhanced,
      result.rationale,
      result.confidence,
      active.provider.id,
      result.model,
      sysPrompt.id || null,
      imageHashes,
      JSON.stringify({ fieldName, toolId, toolName }),
      new Date().toISOString()
    );

    res.json({
      enhanced: result.enhanced,
      negative: result.negative,
      rationale: result.rationale,
      confidence: result.confidence,
      changes: result.changes,
      model: result.model,
      provider: active.provider.id,
      systemPrompt: { id: sysPrompt.id, name: sysPrompt.name },
      usage: result.usage,
    });
  } catch (err: any) {
    console.error('[enhance] Error:', err);
    res.status(500).json({ error: err.message || 'Enhancement failed' });
  }
});

/** Get recent enhancement history */
router.get('/history', (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = db.prepare(`
      SELECT id, originalText, enhancedText, rationale, confidence, provider, model, createdAt
      FROM prompt_enhancements
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(limit);
    res.json({ enhancements: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;