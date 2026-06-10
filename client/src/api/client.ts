import type { Tool, Task, RhNodeField, UploadItem, SavedPrompt } from '@shared/types';

const BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${url}`, {
    headers,
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new Event('auth-expired'));
    const err = new ApiError('Authentication required', 401);
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = new ApiError(body.error || res.statusText || 'Request failed', res.status);
    // Attach extra fields from response body (attemptsLeft, retryAfter, etc.)
    Object.assign(err, body);
    throw err;
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  me: () =>
    request<{ authenticated: boolean; user: string }>('/auth/me'),

  getKeyStatus: () =>
    request<{ keyIsSet: boolean }>('/settings/key/status'),

  setApiKey: (apiKey: string) =>
    request<{ keyIsSet: boolean }>('/settings/key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  registerTool: (webappId: string) =>
    request<{ tool: Tool }>(
      '/tools/register',
      { method: 'POST', body: JSON.stringify({ webappId }) },
    ),

  listTools: () => request<{ tools: Tool[] }>('/tools'),

  getTool: (id: number) => request<Tool>(`/tools/${id}`),

  deleteTool: (id: number) =>
    request<{ success: boolean }>(`/tools/${id}`, { method: 'DELETE' }),

  runTask: (toolId: number, nodeInfoList: RhNodeField[]) =>
    request<{ task: Task }>('/tasks/run', {
      method: 'POST',
      body: JSON.stringify({ toolId, nodeInfoList }),
    }),

  listTasks: (params?: { search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{ tasks: Task[] }>(`/tasks${qs ? '?' + qs : ''}`);
  },

  getTask: (id: number) => request<{ task: Task }>(`/tasks/${id}`),

  rerunTask: (id: number) =>
    request<{ task: Task; rerunOf: number }>(`/tasks/${id}/rerun`, { method: 'POST' }),

  deleteTask: (id: number) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  listUploads: () =>
    request<{ uploads: UploadItem[] }>('/uploads'),

  deleteUpload: (id: number) =>
    request<{ success: boolean }>(`/uploads/${id}`, { method: 'DELETE' }),

  /**
   * Re-process an existing upload: download from imgbb, re-upload to RunningHub,
   * update the fileName in DB. Returns a fresh RunningHub fileName.
   */
  reprocessUpload: (id: number) =>
    request<{ rhFileName: string; alreadyProcessed: boolean }>(`/upload/reprocess/${id}`, {
      method: 'POST',
    }),

  /**
   * Returns the CDN URL for an upload.
   * If imgbbUrl is set, returns it directly (direct browser upload).
   * Otherwise falls back to the backend proxy for legacy records.
   */
  downloadUrl: (item: UploadItem): string => {
    if (item.imgbbUrl) return item.imgbbUrl;
    return `/api/uploads/${item.id}/file`;
  },

  listGallery: () =>
    request<{ items: { id: number; toolId: number; toolName: string; fileName: string; outputType: string; nodeId: string; createdAt: string; prompt?: string }[] }>('/gallery'),

  deleteGalleryItem: (id: number) =>
    request<{ success: boolean }>(`/gallery/${id}`, { method: 'DELETE' }),

  listPrompts: (params?: { search?: string; toolId?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.toolId) q.set('toolId', String(params.toolId));
    const qs = q.toString();
    return request<{ prompts: SavedPrompt[] }>(`/prompts${qs ? '?' + qs : ''}`);
  },

  createPrompt: (data: { title: string; content: string; toolId?: number | null; description?: string; tags?: string[] }) =>
    request<{ prompt: SavedPrompt }>('/prompts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePrompt: (id: number, data: { title?: string; content?: string; toolId?: number | null; description?: string; tags?: string[] }) =>
    request<{ prompt: SavedPrompt }>(`/prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePrompt: (id: number) =>
    request<{ success: boolean }>(`/prompts/${id}`, { method: 'DELETE' }),

  uploadFile: async (file: File, saveToGallery?: boolean): Promise<{ fileName: string; originalName?: string; imgbbUrl: string; imgbbThumbnailUrl: string; uploadId?: number }> => {
    const query = saveToGallery === false ? '?saveToGallery=false' : '';
    const form = new FormData();
    form.append('file', file, file.name);

    const headers: Record<string, string> = {};
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('[upload] No auth token found in localStorage');
    }

    console.log('[upload] Sending file to server:', file.name, file.size, 'bytes');

    const res = await fetch(`${BASE}/upload${query}`, {
      method: 'POST',
      headers,
      body: form,
    });

    console.log('[upload] Response status:', res.status);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      console.error('[upload] Failed:', body);
      throw new ApiError(body.error || 'Upload failed', res.status);
    }

    const result = await res.json();
    console.log('[upload] Success:', result);
    return {
      fileName: result.fileName,
      originalName: result.originalName || file.name,
      imgbbUrl: result.imgbbUrl,
      imgbbThumbnailUrl: result.imgbbThumbnailUrl,
      uploadId: result.uploadId,
    };
  },

  getImgbbKeyStatus: () =>
    request<{ keyIsSet: boolean }>('/upload/key/status'),

  setImgbbKey: (apiKey: string) =>
    request<{ keyIsSet: boolean }>('/upload/key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  // ── AI Enhancement ──
  getAIConfig: () =>
    request<{
      activeProvider: string | null;
      activeSystemPromptId: string;
      hasActiveConfig: boolean;
      providers: Array<{
        id: string;
        displayName: string;
        defaultModel: string;
        availableModels: string[];
        hasKey: boolean;
        selectedModel: string;
      }>;
    }>('/enhance/config'),

  setActiveProvider: (providerId: string) =>
    request<{ success: boolean; activeProvider: string }>('/enhance/config/active-provider', {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    }),

  setProviderApiKey: (providerId: string, apiKey: string) =>
    request<{ success: boolean }>('/enhance/config/api-key', {
      method: 'POST',
      body: JSON.stringify({ providerId, apiKey }),
    }),

  deleteProviderApiKey: (providerId: string) =>
    request<{ success: boolean }>(`/enhance/config/api-key/${providerId}`, {
      method: 'DELETE',
    }),

  setProviderModel: (providerId: string, model: string) =>
    request<{ success: boolean }>('/enhance/config/model', {
      method: 'POST',
      body: JSON.stringify({ providerId, model }),
    }),

  testProvider: (providerId: string) =>
    request<{ ok: boolean; latencyMs: number; error?: string }>('/enhance/config/test', {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    }),

  listSystemPrompts: () =>
    request<{
      systemPrompts: Array<{
        id: number;
        name: string;
        content: string;
        category: string;
        description: string;
        isBuiltin: number;
      }>;
    }>('/enhance/system-prompts'),

  createSystemPrompt: (data: { name: string; content: string; category?: string; description?: string }) =>
    request<{ success: boolean; id: number }>('/enhance/system-prompts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSystemPrompt: (id: number, data: { name?: string; content?: string; category?: string; description?: string }) =>
    request<{ success: boolean }>(`/enhance/system-prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSystemPrompt: (id: number) =>
    request<{ success: boolean }>(`/enhance/system-prompts/${id}`, {
      method: 'DELETE',
    }),

  setActiveSystemPrompt: (id: number | string) =>
    request<{ success: boolean; activeSystemPromptId: string }>('/enhance/config/active-system-prompt', {
      method: 'POST',
      body: JSON.stringify({ id: String(id) }),
    }),

  enhancePrompt: (data: {
    text: string;
    fieldName?: string;
    toolId?: number;
    toolName?: string;
    imageUrls?: string[];
    imageBase64?: string;
    imageMimeType?: string;
    systemPromptId?: number | string;
  }) =>
    request<{
      enhanced: string;
      negative?: string;
      rationale: string;
      confidence: 'low' | 'medium' | 'high';
      changes: string[];
      model: string;
      provider: string;
      systemPrompt: { id: number | null; name: string };
      usage?: { prompt: number; completion: number; total: number };
    }>('/enhance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEnhancementHistory: (limit = 50) =>
    request<{
      enhancements: Array<{
        id: number;
        originalText: string;
        enhancedText: string;
        rationale: string;
        confidence: string;
        provider: string;
        model: string;
        createdAt: string;
      }>;
    }>(`/enhance/history?limit=${limit}`),
};
