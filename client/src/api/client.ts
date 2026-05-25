import type { Tool, Task } from '@shared/types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getKeyStatus: () =>
    request<{ keyIsSet: boolean }>('/settings/key/status'),

  setApiKey: (apiKey: string) =>
    request<{ success: boolean }>('/settings/key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  registerTool: (webappId: string) =>
    request<{ success: boolean; webappId: string; webappName: string }>(
      '/tools/register',
      { method: 'POST', body: JSON.stringify({ webappId }) },
    ),

  listTools: () => request<Tool[]>('/tools'),

  getTool: (id: number) => request<Tool>(`/tools/${id}`),

  deleteTool: (id: number) =>
    request<{ success: boolean }>(`/tools/${id}`, { method: 'DELETE' }),

  runTask: (toolId: number, fieldValues: Record<string, string>) =>
    request<Task>('/tasks/run', {
      method: 'POST',
      body: JSON.stringify({ toolId, fieldValues }),
    }),

  listTasks: (params?: { search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<Task[]>(`/tasks${qs ? '?' + qs : ''}`);
  },

  getTask: (id: number) => request<Task>(`/tasks/${id}`),

  deleteTask: (id: number) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  uploadFile: async (file: File): Promise<{ fileName: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};
