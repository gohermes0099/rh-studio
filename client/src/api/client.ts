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
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || res.statusText || 'Request failed', res.status);
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

  deleteTask: (id: number) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  listUploads: () =>
    request<{ uploads: UploadItem[] }>('/uploads'),

  deleteUpload: (id: number) =>
    request<{ success: boolean }>(`/uploads/${id}`, { method: 'DELETE' }),

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

  uploadFile: async (file: File, saveToGallery?: boolean): Promise<{ fileName: string; imgbbUrl: string; imgbbThumbnailUrl: string; uploadId?: number }> => {
    const imgbbApiKey = localStorage.getItem('imgbbApiKey');
    if (!imgbbApiKey) {
      throw new ApiError('Configure imgbb API key in Settings first');
    }

    const imgbbFolder = localStorage.getItem('imgbbFolder') || undefined;

    // Convert file to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // data:applicationjpeg;base64,/9j/4AAQ... → strip prefix
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => reject(new ApiError('Failed to read file'));
      reader.readAsDataURL(file);
    });

    // Build imgbb upload URL
    let uploadUrl = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbApiKey)}`;
    if (imgbbFolder) {
      uploadUrl += `&folder=${encodeURIComponent(imgbbFolder)}`;
    }

    // POST directly to imgbb
    const form = new FormData();
    form.append('image', base64);
    form.append('name', file.name);

    let imgbbRes: { url: string; thumb: { url: string } };
    try {
      const res = await fetch(uploadUrl, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data?.data) {
        throw new ApiError(data?.error || 'imgbb upload failed', res.status);
      }
      imgbbRes = data.data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('Failed to reach imgbb — check your API key and try again');
    }

    const imgbbUrl = imgbbRes.url;
    const imgbbThumbnailUrl = imgbbRes.thumb?.url || imgbbUrl;

    // Save metadata to backend
    const query = saveToGallery === false ? '?saveToGallery=false' : '';
    const metadataRes = await fetch(`${BASE}/upload${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imgbbUrl,
        imgbbThumbnailUrl,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      }),
    });

    if (!metadataRes.ok) {
      const body = await metadataRes.json().catch(() => ({ error: metadataRes.statusText }));
      throw new ApiError(body.error || 'Failed to save upload metadata', metadataRes.status);
    }

    const result = await metadataRes.json();
    return {
      fileName: file.name,
      imgbbUrl,
      imgbbThumbnailUrl,
      uploadId: result.id,
    };
  },
};
