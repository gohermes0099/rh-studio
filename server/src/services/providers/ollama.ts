import type { AIProvider, EnhanceOptions, EnhanceResult, ImageRef } from '../aiClient.js';
import { resolveImage } from '../aiClient.js';

const id = 'ollama' as const;
const displayName = 'Ollama Cloud';
const defaultModel = 'gemma4:31b-cloud';
const availableModels = ['gemma4:31b-cloud', 'gemma4:26b-cloud', 'gemma4:12b-cloud'];

async function enhance(opts: EnhanceOptions, model: string, apiKey: string): Promise<EnhanceResult> {
  const images: string[] = [];
  if (opts.images?.length) {
    for (const img of opts.images) {
      const { base64 } = await resolveImage(img);
      images.push(base64);
    }
  }

  const messages: any[] = [];
  messages.push({ role: 'system', content: opts.system });
  messages.push({
    role: 'user',
    content: opts.user,
    images: images.length ? images : undefined,
  });

  const body: any = {
    model,
    messages,
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.3,
      num_predict: opts.maxTokens ?? 1024,
    },
  };
  if (opts.jsonMode) body.format = 'json';

  const res = await fetch('https://ollama.com/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { message?: { content?: string }; total_duration?: number; prompt_eval_count?: number; eval_count?: number };
  const content = data.message?.content || '';

  return parseEnhanceResponse(content, { model, provider: 'ollama', usage: { prompt: data.prompt_eval_count || 0, completion: data.eval_count || 0, total: (data.prompt_eval_count || 0) + (data.eval_count || 0) } });
}

async function testConnection(apiKey: string, model: string) {
  const start = Date.now();
  try {
    const res = await fetch('https://ollama.com/api/chat', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], stream: false }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, latencyMs: Date.now() - start, error: `${res.status}: ${t.slice(0, 100)}` };
    }
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, error: e.message };
  }
}

function parseEnhanceResponse(content: string, meta: { model: string; provider: string; usage?: any }): EnhanceResult {
  // Try to extract JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      return {
        enhanced: obj.enhanced_prompt || obj.enhanced || content,
        negative: obj.negative_prompt || obj.negative,
        rationale: obj.rationale || '',
        confidence: (obj.confidence || 'medium') as any,
        changes: Array.isArray(obj.changes) ? obj.changes : [],
        model: meta.model,
        usage: meta.usage,
        raw: content,
      };
    } catch {}
  }
  return {
    enhanced: content.trim(),
    rationale: '',
    confidence: 'medium',
    changes: [],
    model: meta.model,
    usage: meta.usage,
    raw: content,
  };
}

export { id, displayName, defaultModel, availableModels, enhance, testConnection };