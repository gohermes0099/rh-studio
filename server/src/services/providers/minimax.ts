import type { AIProvider, EnhanceOptions, EnhanceResult } from '../aiClient.js';
import { resolveImage } from '../aiClient.js';

const id = 'minimax' as const;
const displayName = 'MiniMax (Token Plan)';
const defaultModel = 'MiniMax-M3';
const availableModels = ['MiniMax-M3'];

async function enhance(opts: EnhanceOptions, model: string, apiKey: string): Promise<EnhanceResult> {
  const content: any[] = [];
  if (opts.images?.length) {
    for (const img of opts.images) {
      const { base64, mimeType } = await resolveImage(img);
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64,
        },
      });
    }
  }
  content.push({ type: 'text', text: opts.user });

  const body: any = {
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    system: opts.system,
    messages: [{ role: 'user', content }],
  };
  // Note: MiniMax token plan does not advertise JSON-mode support.
  // We rely on the system prompt to instruct JSON output and parse on our end.

  const res = await fetch('https://api.minimax.io/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as {
    content?: { type: string; text?: string }[];
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (data.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('');

  return parseEnhanceResponse(text, {
    model: data.model || model,
    provider: 'minimax',
    usage: data.usage ? {
      prompt: data.usage.input_tokens || 0,
      completion: data.usage.output_tokens || 0,
      total: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
    } : undefined,
  });
}

async function testConnection(apiKey: string, model: string) {
  const start = Date.now();
  try {
    const res = await fetch('https://api.minimax.io/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] }),
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