import type { AIProvider, EnhanceOptions, EnhanceResult } from '../aiClient.js';
import { resolveImage } from '../aiClient.js';

const id = 'groq' as const;
const displayName = 'Groq';
const defaultModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
const availableModels = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.2-90b-vision-instruct',
];

async function enhance(opts: EnhanceOptions, model: string, apiKey: string): Promise<EnhanceResult> {
  const userContent: any[] = [];
  if (opts.images?.length) {
    for (const img of opts.images) {
      const { base64, mimeType } = await resolveImage(img);
      // Groq prefers URLs but accepts base64 data URIs. 4MB limit.
      // For larger, we'd need to host first. For now use data URI.
      if (base64.length > 4 * 1024 * 1024 * 4 / 3) {  // 4MB base64 = ~5.3MB string
        console.warn('[groq] Image too large for base64 (>4MB), skipping');
        continue;
      }
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` },
      });
    }
  }
  userContent.push({ type: 'text', text: opts.user });

  const body: any = {
    model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: userContent },
    ],
    temperature: opts.temperature ?? 0.3,
    max_completion_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[]; model?: string; usage?: any };
  const content = data.choices?.[0]?.message?.content || '';

  return parseEnhanceResponse(content, { model: data.model || model, provider: 'groq', usage: data.usage });
}

async function testConnection(apiKey: string, model: string) {
  const start = Date.now();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_completion_tokens: 16 }),
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