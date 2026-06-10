import type { AIProvider, EnhanceOptions, EnhanceResult } from '../aiClient.js';
import { resolveImage } from '../aiClient.js';

const id = 'gemini' as const;
const displayName = 'Google Gemini';
const defaultModel = 'gemini-2.5-flash';
const availableModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

async function enhance(opts: EnhanceOptions, model: string, apiKey: string): Promise<EnhanceResult> {
  const parts: any[] = [{ text: opts.user }];

  if (opts.images?.length) {
    for (const img of opts.images) {
      const { base64, mimeType } = await resolveImage(img);
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64,  // Gemini wants raw base64, no data: prefix
        },
      });
    }
  }

  // Gemini uses systemInstruction for system prompts
  const body: any = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: opts.system }] },
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxTokens ?? 1024,
    },
  };
  if (opts.jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    modelVersion?: string;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  const content = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';

  return parseEnhanceResponse(content, {
    model: data.modelVersion || model,
    provider: 'gemini',
    usage: data.usageMetadata ? {
      prompt: data.usageMetadata.promptTokenCount || 0,
      completion: data.usageMetadata.candidatesTokenCount || 0,
      total: data.usageMetadata.totalTokenCount || 0,
    } : undefined,
  });
}

async function testConnection(apiKey: string, model: string) {
  const start = Date.now();
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
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