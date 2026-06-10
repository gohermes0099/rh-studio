// AI Provider abstraction. Each provider implements AIProvider interface.
// The factory creates the active provider based on settings.

import * as ollama from './providers/ollama.js';
import * as groq from './providers/groq.js';
import * as gemini from './providers/gemini.js';
import * as minimax from './providers/minimax.js';
import { getDb } from '../db/connection.js';
import fs from 'node:fs/promises';

export type ProviderId = 'ollama' | 'groq' | 'gemini' | 'minimax';

export interface ImageRef {
  /** Public URL (http/https) or data URI */
  url?: string;
  /** Local file path (will be read + base64) */
  path?: string;
  /** Pre-computed base64 data (without data: prefix) */
  base64?: string;
  mimeType?: string;
}

export interface EnhanceOptions {
  system: string;
  user: string;
  images?: ImageRef[];
  /** Request JSON-structured output. Default true. */
  jsonMode?: boolean;
  /** Max output tokens. Default 1024. */
  maxTokens?: number;
  /** Temperature. Default 0.3 (lower = more deterministic). */
  temperature?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface EnhanceResult {
  /** The enhanced prompt */
  enhanced: string;
  /** Optional negative prompt */
  negative?: string;
  /** Why the agent made these changes */
  rationale: string;
  /** Confidence: low | medium | high */
  confidence: 'low' | 'medium' | 'high';
  /** List of change categories (for UI chips) */
  changes: string[];
  /** Which model actually answered */
  model: string;
  /** Token usage if reported */
  usage?: { prompt: number; completion: number; total: number };
  /** Raw response for debugging */
  raw?: string;
}

export interface AIProvider {
  id: ProviderId;
  displayName: string;
  defaultModel: string;
  availableModels: string[];
  enhance(opts: EnhanceOptions, model: string, apiKey: string): Promise<EnhanceResult>;
  /** Quick connectivity check (no images, no system prompt) */
  testConnection(apiKey: string, model: string): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
}

const PROVIDERS: Record<ProviderId, AIProvider> = {
  ollama,
  groq,
  gemini,
  minimax,
};

export function getProvider(id: ProviderId): AIProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown AI provider: ${id}`);
  return p;
}

export function getAllProviders(): AIProvider[] {
  return Object.values(PROVIDERS);
}

export function getActiveProvider(): { provider: AIProvider; model: string; apiKey: string } | null {
  const db = getDb();
  const activeId = (db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_active_provider') as { value: string } | undefined)?.value as ProviderId | undefined;
  if (!activeId) return null;
  const provider = getProvider(activeId);
  const apiKey = (db.prepare('SELECT value FROM settings WHERE key = ?').get(`ai_key_${activeId}`) as { value: string } | undefined)?.value;
  if (!apiKey) return null;
  const model = (db.prepare('SELECT value FROM settings WHERE key = ?').get(`ai_model_${activeId}`) as { value: string } | undefined)?.value || provider.defaultModel;
  return { provider, model, apiKey };
}

/** Returns the providers that have an API key configured */
export function getConfiguredProviders(): { provider: AIProvider; model: string; hasKey: boolean }[] {
  const db = getDb();
  return getAllProviders().map(p => {
    const key = (db.prepare('SELECT value FROM settings WHERE key = ?').get(`ai_key_${p.id}`) as { value: string } | undefined)?.value;
    const model = (db.prepare('SELECT value FROM settings WHERE key = ?').get(`ai_model_${p.id}`) as { value: string } | undefined)?.value || p.defaultModel;
    return { provider: p, model, hasKey: !!key };
  });
}

/** Resolves an ImageRef to { base64, mimeType } — fetching URLs as needed */
export async function resolveImage(img: ImageRef): Promise<{ base64: string; mimeType: string }> {
  if (img.base64) {
    return { base64: img.base64, mimeType: img.mimeType || 'image/jpeg' };
  }
  if (img.path) {
    const buf = await fs.readFile(img.path);
    return { base64: buf.toString('base64'), mimeType: img.mimeType || 'image/jpeg' };
  }
  if (img.url) {
    if (img.url.startsWith('data:')) {
      // data URI: data:image/png;base64,XXXX
      const match = img.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { base64: match[2], mimeType: match[1] };
      throw new Error('Invalid data URI');
    }
    // Fetch the URL and convert to base64
    const res = await fetch(img.url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return { base64: buf.toString('base64'), mimeType };
  }
  throw new Error('ImageRef has no url, path, or base64');
}