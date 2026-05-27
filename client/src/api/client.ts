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
  const res = await fetch(`${BASE}${url}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || res.statusText || 'Request failed', res.status);
  }
  return res.json();
}

export const api = {
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

  deleteTask: (id: number) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  listUploads: () =>
    request<{ uploads: UploadItem[] }>('/uploads'),

  deleteUpload: (id: number) =>
    request<{ success: boolean }>(`/uploads/${id}`, { method: 'DELETE' }),

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

  uploadFile: async (file: File, saveToGallery?: boolean): Promise<{ fileName: string }> => {
    const form = new FormData();
    form.append('file', file);
    const query = saveToGallery === false ? '?saveToGallery=false' : '';
    try {
      const res = await fetch(`${BASE}/upload${query}`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(body.error || 'Upload failed', res.status);
      }
      return res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('Network error — unable to reach server');
    }
  },
};
